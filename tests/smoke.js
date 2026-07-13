import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

const server = createServer();
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const home = await fetch(`${baseUrl}/`);
  const summary = await fetch(`${baseUrl}/api/summary`).then((response) => response.json());
  const queue = await fetch(`${baseUrl}/api/automation-queue`).then((response) => response.json());

  assert.equal(home.status, 200);
  assert.match(await home.text(), /VendorAudit Portal de Compliance/);
  assert.equal(summary.documentsPending, 7);
  assert.ok(queue.length >= 10);

  console.log('Smoke test aprovado:', baseUrl);
} finally {
  await new Promise((resolve) => server.close(resolve));
}
