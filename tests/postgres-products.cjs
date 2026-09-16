// Run with: node --test tests/postgres-products.cjs
// Exercises database paths with the installed pg driver's wire serialization.
// No credentials, network connection, or production data are used.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareValue } = require('pg/lib/utils');
const { createAdminApi } = require('../lib/admin-api');

test('PostgreSQL product writes and reads preserve JSON fields and per-color stock', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'misri-pg-'));
  const rows = new Map();
  const jsonFields = new Set(['color_stock', 'images', 'sizes', 'colors', 'stitching_types', 'garment_options']);
  let nextId = 1;
  const dbPool = { async query(sql, values = []) {
    if (/SELECT categories FROM catalog_settings/.test(sql)) return { rows: [] };
    if (/INSERT INTO products/.test(sql)) {
      const columns = sql.match(/INSERT INTO products\s*\(([^)]+)\)/)[1].split(',').map(s => s.trim());
      const row = { id: nextId++ };
      columns.forEach((key, i) => {
        const wire = prepareValue(values[i]);
        row[key] = jsonFields.has(key) && wire !== null ? JSON.parse(wire) : values[i];
      });
      rows.set(row.id, row);
      return { rows: [{ id: row.id }] };
    }
    if (/UPDATE products SET name=/.test(sql)) {
      const row = rows.get(Number(values[22]));
      for (const [, key, index] of sql.matchAll(/(\w+)=\$(\d+)/g)) {
        if (key === 'id') continue;
        const value = values[Number(index) - 1];
        const wire = prepareValue(value);
        row[key] = jsonFields.has(key) && wire !== null ? JSON.parse(wire) : value;
      }
      return { rows: [] };
    }
    if (/SELECT \* FROM products/.test(sql)) return { rows: values.length ? [structuredClone(rows.get(Number(values[0])))].filter(Boolean) : [...rows.values()].map(r => structuredClone(r)) };
    if (/INSERT INTO activity_logs|INSERT INTO admin_notifications/.test(sql)) return { rows: [{ id: 1, created_at: new Date() }] };
    throw new Error('Unexpected SQL: ' + sql);
  } };
  try {
    const api = createAdminApi({ ROOT: path.resolve(__dirname, '..'), DATA_DIR: temp, UPLOADS_DIR: temp,
      useDb: () => true, dbPool, ADMIN_PASSWORD: 'test', readJson: () => [], writeJson: () => {} });
    const routes = new Map();
    const app = Object.fromEntries(['get','post','put','delete','patch'].map(method => [method, (url, ...handlers) => routes.set(method + ' ' + url, handlers.at(-1))]));
    const originalInterval = global.setInterval;
    global.setInterval = () => ({ unref() {} });
    try { api.registerRoutes(app); } finally { global.setInterval = originalInterval; }
    const create = async body => {
      let output, status = 200;
      const res = { status(code) { status = code; return this; }, json(value) { output = value; } };
      await routes.get('post /api/admin/products')({ body }, res);
      assert.equal(status, 200, JSON.stringify(output));
      assert.equal(output.success, true);
      return output.product;
    };
    const fabric = await create({ name: 'Cotton test', category: 'fabric', fabricType: 'cotton', price: 1500,
      colors: ['Black', 'White'], colorStock: { Black: 30, White: 15 }, images: ['pics/test.jpg'], sizes: ['4 Meter'],
      stitchingEnabled: true, stitchingTypes: ['shalwar-kameez', 'waistcoats'] });
    assert.deepEqual(fabric.colorStock, { Black: 30, White: 15 });
    assert.deepEqual(fabric.stitchingTypes, ['shalwar-kameez', 'waistcoats']);
    await api.adjustStock(fabric.id, 5, 'Test', 'Restock', 'White');
    let saved = await api.getProductById(fabric.id, true);
    assert.deepEqual(saved.colorStock, { Black: 30, White: 20 });
    assert.equal(saved.stockQuantity, 50);
    await api.adjustStock(fabric.id, -3, 'Test', 'Order', 'Black');
    saved = await api.getProductById(fabric.id, true);
    assert.deepEqual(saved.colorStock, { Black: 27, White: 20 });
    assert.deepEqual(saved.stitchingTypes, fabric.stitchingTypes);
    assert.deepEqual(saved.images, fabric.images);
    await assert.rejects(api.adjustStock(fabric.id, -100, 'Test', 'Order', 'Black'), /Insufficient stock/);
    const options = { readyMadeSizes: ['Small', 'Large'], customEnabled: true, measurementType: 'prince-coat' };
    const garment = await create({ name: 'Suit test', category: 'suits', price: 2800, stockQuantity: 20, colors: [], garmentOptions: options });
    assert.deepEqual(garment.garmentOptions, options);
    assert.deepEqual(rows.get(garment.id).stitching_types, []);
    await api.adjustStock(garment.id, 2);
    assert.deepEqual((await api.getProductById(garment.id, true)).garmentOptions, options);
    // Support string-valued JSON from legacy adapters as well as decoded pg objects.
    const row = rows.get(fabric.id);
    for (const key of jsonFields) if (row[key] != null) row[key] = JSON.stringify(row[key]);
    saved = await api.getProductById(fabric.id, true);
    assert.deepEqual(saved.colorStock, { Black: 27, White: 20 });
    assert.deepEqual(saved.stitchingTypes, fabric.stitchingTypes);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
