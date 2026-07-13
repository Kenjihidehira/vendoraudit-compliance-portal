import test from 'node:test';
import assert from 'node:assert/strict';
import {
  automationQueue,
  calculateVendorRisk,
  cloneData,
  complianceMatrix,
  dashboardSummary,
  loadSeed,
  renewalPipeline,
  simulateRenewalHold,
  vendorPortfolio
} from '../src/vendorEngine.js';

test('risk engine ranks risky renewal vendors before compliant suppliers', () => {
  const data = cloneData(loadSeed());
  const vendors = vendorPortfolio(data);
  assert.equal(vendors[0].id, 'vnd-005');
  assert.equal(vendors[0].riskLevel, 'critical');
  assert.ok(calculateVendorRisk(vendors[0], data.policy) > calculateVendorRisk(vendors.at(-1), data.policy));
});

test('summary exposes commercial supplier KPIs', () => {
  const summary = dashboardSummary(cloneData(loadSeed()));
  assert.equal(summary.vendors, 6);
  assert.equal(summary.monthlySpend, 125600);
  assert.equal(summary.renewalsNext60Days, 2);
  assert.equal(summary.documentsPending, 7);
  assert.equal(summary.slaBreaches, 3);
});

test('renewal pipeline and compliance matrix are derived from seed data', () => {
  const data = cloneData(loadSeed());
  const renewals = renewalPipeline(data);
  const matrix = complianceMatrix(data);
  assert.equal(renewals[0].id, 'vnd-005');
  assert.ok(renewals.some((vendor) => vendor.action === 'Revisar antes da renovação'));
  assert.equal(matrix.length, data.vendors.length);
  assert.ok(matrix.find((vendor) => vendor.id === 'vnd-003').documents.some((doc) => doc.status === 'missing'));
});

test('automation queue includes generated compliance and SLA tasks', () => {
  const queue = automationQueue(cloneData(loadSeed()));
  assert.ok(queue.length > 10);
  assert.ok(queue.some((task) => task.title.includes('LGPD')));
  assert.ok(queue.some((task) => task.title.includes('recuperação de SLA')));
  assert.equal(queue[0].priority, 'critical');
});

test('renewal hold simulation protects risky contract value', () => {
  const result = simulateRenewalHold(cloneData(loadSeed()));
  assert.equal(result.blockedRenewals, 2);
  assert.equal(result.protectedContractValue, 697200);
  assert.ok(result.vendors.every((vendor) => vendor.reason));
});
