import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  automationQueue,
  cloneData,
  complianceMatrix,
  dashboardSummary,
  loadSeed,
  renewalPipeline,
  riskBreakdown,
  simulateRenewalHold,
  vendorPortfolio
} from './vendorEngine.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(dirname, '..', 'public');
const data = cloneData(loadSeed());

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

export function createServer(state = data) {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');

      if (url.pathname === '/api/health') return sendJson(res, { ok: true, service: 'vendoraudit-compliance-portal' });
      if (url.pathname === '/api/summary') return sendJson(res, dashboardSummary(state));
      if (url.pathname === '/api/vendors') return sendJson(res, vendorPortfolio(state));
      if (url.pathname === '/api/risk-breakdown') return sendJson(res, riskBreakdown(state));
      if (url.pathname === '/api/renewals') return sendJson(res, renewalPipeline(state));
      if (url.pathname === '/api/compliance-matrix') return sendJson(res, complianceMatrix(state));
      if (url.pathname === '/api/automation-queue') return sendJson(res, automationQueue(state));
      if (url.pathname === '/api/simulate/renewal-hold' && req.method === 'POST') {
        return sendJson(res, simulateRenewalHold(state));
      }

      return serveStatic(url.pathname, res);
    } catch (error) {
      return sendJson(res, { error: 'Erro interno do servidor', detail: error.message }, 500);
    }
  });
}

function serveStatic(pathname, res) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) return sendJson(res, { error: 'Acesso negado' }, 403);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return sendJson(res, { error: 'Não encontrado' }, 404);
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function sendJson(res, payload, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4182);
  createServer().listen(port, () => {
    console.log(`VendorAudit Portal de Compliance rodando em http://127.0.0.1:${port}`);
  });
}
