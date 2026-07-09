# Deploy MISRI CLOTH — Permanent 24/7 Link

Your code is ready. Follow these steps once (takes ~10 minutes).

## Quick deploy (easiest)

1. **Double-click** `DEPLOY-TO-RENDER.bat` in this folder
2. Follow the on-screen steps
3. You get a permanent link like `https://misri-cloth.onrender.com`

---

## Manual steps

### 1. GitHub (upload code)

1. Go to https://github.com/new
2. Repository name: `misri-cloth`
3. Public, no README → Create
4. In terminal, in this folder:

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/misri-cloth.git
git push -u origin main
```

### 2. Render (go live 24/7)

1. Go to https://render.com — sign up free with GitHub
2. **New +** → **Web Service**
3. Select **misri-cloth** repository
4. Render reads `render.yaml` automatically:
   - Build: `npm install`
   - Start: `npm start`
5. Click **Create Web Service**
6. Wait 2–3 minutes

### 3. Your permanent links

| Page | URL |
|------|-----|
| Website | `https://misri-cloth.onrender.com` |
| Admin orders | `https://misri-cloth.onrender.com/admin/orders.html` |
| Admin password | `misri2026` |

Share the website link on WhatsApp — works on all phones, PC can be off.

---

## Important: Keep Orders Permanent

Render free web service disk is temporary. To keep orders/messages forever, add a Postgres database:

1. In Render dashboard, click **New +** → **PostgreSQL**
2. Name: `misri-cloth-db` → create database (free plan)
3. Open your web service `misri-cloth` → **Environment**
4. Add environment variable:
   - Key: `DATABASE_URL`
   - Value: Internal/External database URL from your Render Postgres service
5. Save changes and redeploy web service

After redeploy, the app auto-creates tables and starts storing orders/messages in Postgres.

## Notes

- **Free tier**: Site may sleep after 15 min idle; first visit takes ~30 sec to wake up
- **Orders**: Saved in Postgres when `DATABASE_URL` is set
- **Custom domain**: Add your own domain in Render settings later
