import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { cloneData, loadSeed } from '../src/vendorEngine.js';

test('api exposes health, summary, vendors and renewal hold simulation', async () => {
  const server = createServer(cloneData(loadSeed()));
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await getJson(`${baseUrl}/api/health`);
    const summary = await getJson(`${baseUrl}/api/summary`);
    const vendors = await getJson(`${baseUrl}/api/vendors`);
    const simulation = await postJson(`${baseUrl}/api/simulate/renewal-hold`);

    assert.equal(health.ok, true);
    assert.equal(summary.criticalVendors, 2);
    assert.equal(vendors[0].riskLevel, 'critical');
    assert.equal(simulation.blockedRenewals, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.json();
}

async function postJson(url) {
  const response = await fetch(url, { method: 'POST' });
  assert.equal(response.status, 200);
  return response.json();
}
