const crypto = require('crypto');
const COOKIE = 'misri_admin_session';
const TTL = 8 * 60 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function createSecurity({ password, dbPool, production = false }) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Set ADMIN_PASSWORD to a unique password of at least 12 characters before starting.');
  const salt = crypto.randomBytes(16);
  const passwordHash = crypto.scryptSync(password, salt, 32);
  const credentialKey = crypto.scryptSync(password, 'misri-session-rotation-v1', 32);
  const credentialVersion = tokenHash => crypto.createHmac('sha256', credentialKey).update(tokenHash).digest('hex');
  const sessions = new Map();
  const attempts = new Map();
  const safe = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  async function init() {
    if (!dbPool) return;
    await dbPool.query('CREATE TABLE IF NOT EXISTS security_sessions (token_hash TEXT PRIMARY KEY, credential_version TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL)');
    await dbPool.query('CREATE TABLE IF NOT EXISTS security_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL)');
  }
  async function consume(key, maximum, duration) {
    const now = Date.now();
    if (dbPool) {
      const result = await dbPool.query(`INSERT INTO security_limits (bucket,count,expires_at) VALUES ($1,1,$2)
        ON CONFLICT (bucket) DO UPDATE SET count=CASE WHEN security_limits.expires_at <= NOW() THEN 1 ELSE security_limits.count+1 END,
        expires_at=CASE WHEN security_limits.expires_at <= NOW() THEN EXCLUDED.expires_at ELSE security_limits.expires_at END RETURNING count`, [digest(key), new Date(now + duration)]);
      // Bound expired records without a timer that keeps serverless instances alive.
      if (crypto.randomInt(100) === 0) {
        await dbPool.query('DELETE FROM security_limits WHERE expires_at < NOW()');
        await dbPool.query('DELETE FROM security_sessions WHERE expires_at < NOW()');
      }
      return result.rows[0].count <= maximum;
    }
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10000) return false;
      entry = { count: 0, until: now + duration }; attempts.set(key, entry);
    }
    return ++entry.count <= maximum;
  }
  function rateLimit(scope, max, duration = 15 * 60 * 1000) {
    return safe(async (req, res, next) => {
      if (!await consume(`${scope}:${req.ip}`, max, duration)) return res.status(429).set('Retry-After', String(Math.ceil(duration / 1000))).json({success:false,message:'Too many requests. Please try again later.'});
      next();
    });
  }
  function originGuard(req, res, next) {
    if (['GET','HEAD','OPTIONS'].includes(req.method)) return next();
    const origin = req.get('Origin');
    let sameOrigin = true;
    if (origin) {
      try { sameOrigin = new URL(origin).host === req.get('Host') && (production ? new URL(origin).protocol === 'https:' : ['http:','https:'].includes(new URL(origin).protocol)); }
      catch { sameOrigin = false; }
    }
    if (!sameOrigin || req.get('Sec-Fetch-Site') === 'cross-site') return res.status(403).json({success:false,message:'Cross-site request blocked.'});
    if (!req.headers['transfer-encoding'] && !Number(req.headers['content-length'] || 0)) return next();
    if (!req.is('application/json') && !req.is('multipart/form-data')) return res.status(415).json({success:false,message:'Unsupported request format.'});
    next();
  }
  function cookieToken(req) {
    const value = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
    return /^[a-f0-9]{64}$/.test(value || '') ? value : null;
  }
  async function authenticated(req) {
    const token = cookieToken(req); if (!token) return false;
    const hash = digest(token);
    if (dbPool) {
      const r = await dbPool.query('SELECT expires_at FROM security_sessions WHERE token_hash=$1 AND credential_version=$2 AND expires_at>NOW()', [hash,credentialVersion(hash)]);
      if (!r.rows.length) return false;
      req.sessionExpiresAt = new Date(r.rows[0].expires_at).getTime();
    } else {
      for (const [key, expiry] of sessions) if (expiry <= Date.now()) sessions.delete(key);
      req.sessionExpiresAt = sessions.get(hash);
      if (!req.sessionExpiresAt) return false;
    }
    req.adminAuthenticated = true; return true;
  }
  const protect = safe(async (req,res,next) => {
    if (!await authenticated(req)) return res.status(401).json({success:false,message:'Please sign in to the admin panel.'});
    res.set('Cache-Control','no-store'); next();
  });
  function register(app) {
    app.post('/api/admin/login', rateLimit('login',10), safe(async (req,res) => {
      const supplied = req.body?.password;
      if (typeof supplied !== 'string' || supplied.length > 1024 || !crypto.timingSafeEqual(await new Promise((resolve,reject)=>crypto.scrypt(supplied,salt,32,(err,result)=>err?reject(err):resolve(result))),passwordHash)) return res.status(401).json({success:false,message:'Incorrect password.'});
      const token = crypto.randomBytes(32).toString('hex'), expiry = Date.now()+TTL;
      if (dbPool) await dbPool.query('INSERT INTO security_sessions(token_hash,credential_version,expires_at) VALUES($1,$2,$3)',[digest(token),credentialVersion(digest(token)),new Date(expiry)]);
      else { if (sessions.size>=100) sessions.delete(sessions.keys().next().value); sessions.set(digest(token),expiry); }
      res.cookie(COOKIE,token,{httpOnly:true,secure:production,sameSite:'strict',path:'/api',maxAge:TTL});
      res.set('Cache-Control','no-store').json({success:true});
    }));
    app.use('/api/admin', protect);
    app.get('/api/admin/session', (req,res)=>res.json({success:true}));
    app.get('/api/admin/proxy-check', (req,res)=>res.json({clientIp:req.ip,proxyChain:req.ips}));
    app.post('/api/admin/logout', safe(async (req,res)=>{
      const hash = digest(cookieToken(req));
      if(dbPool) await dbPool.query('DELETE FROM security_sessions WHERE token_hash=$1',[hash]); else sessions.delete(hash);
      res.clearCookie(COOKIE,{httpOnly:true,secure:production,sameSite:'strict',path:'/api'}).json({success:true});
    }));
    app.use(['/api/orders','/api/messages'], protect);
  }
  return { init, register, protect, rateLimit, originGuard, authenticated };
}
function securityHeaders(req,res,next) {
  res.set({'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
  if(process.env.RENDER || process.env.VERCEL || req.secure) res.set('Strict-Transport-Security','max-age=31536000');
  if(req.path.startsWith('/api/'))res.set('Cache-Control','no-store');
  next();
}
function csvCell(value) {
  let text=String(value??'');
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
module.exports={createSecurity,securityHeaders,csvCell};
