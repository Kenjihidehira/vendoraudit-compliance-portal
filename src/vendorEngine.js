import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(dirname, '..', 'data', 'seed.json');

const DOCUMENT_LABELS = {
  taxCertificate: 'Certidão fiscal',
  insurance: 'Seguro',
  lgpdDpa: 'Acordo de tratamento de dados LGPD',
  antiCorruption: 'Declaração anticorrupção'
};

const DOCUMENT_STATUS_LABELS = {
  missing: 'ausente',
  expired: 'vencido'
};

const CRITICALITY_POINTS = {
  high: 22,
  medium: 12,
  low: 5
};

export function loadSeed() {
  return JSON.parse(fs.readFileSync(seedPath, 'utf8'));
}

export function cloneData(data) {
  return JSON.parse(JSON.stringify(data));
}

export function daysUntil(dateString, todayString) {
  const dayMs = 24 * 60 * 60 * 1000;
  const date = new Date(`${dateString}T00:00:00Z`);
  const today = new Date(`${todayString}T00:00:00Z`);
  return Math.ceil((date - today) / dayMs);
}

export function missingDocuments(vendor) {
  return Object.entries(vendor.compliance)
    .filter(([, status]) => status === 'missing' || status === 'expired')
    .map(([key, status]) => ({
      key,
      label: DOCUMENT_LABELS[key] ?? key,
      status
    }));
}

export function calculateVendorRisk(vendor, policy) {
  const renewalDays = daysUntil(vendor.renewalDate, policy.today);
  const docs = missingDocuments(vendor);
  const slaGap = Number((vendor.sla.target - vendor.sla.actual).toFixed(1));
  let score = CRITICALITY_POINTS[vendor.criticality] ?? 8;

  score += Math.min(docs.length * 14, 42);
  if (renewalDays <= 15) score += 20;
  else if (renewalDays <= policy.renewalWarningDays) score += 12;
  if (slaGap > policy.minimumSlaTolerance) score += Math.min(Math.round(slaGap * 3), 20);
  score += Math.min(vendor.incidentsLast90Days * 4, 20);
  if (vendor.lastAuditDays > policy.auditStaleDays) score += 12;
  if (vendor.monthlySpend >= policy.highSpendThreshold) score += 8;
  if (vendor.paymentTerms < 20) score += 4;

  return Math.min(score, 100);
}

export function classifyRisk(score) {
  if (score >= 78) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 32) return 'medium';
  return 'low';
}

export function vendorPortfolio(data) {
  return data.vendors
    .map((vendor) => {
      const score = calculateVendorRisk(vendor, data.policy);
      const renewalDays = daysUntil(vendor.renewalDate, data.policy.today);
      const docs = missingDocuments(vendor);
      const slaGap = Number((vendor.sla.target - vendor.sla.actual).toFixed(1));
      return {
        ...vendor,
        riskScore: score,
        riskLevel: classifyRisk(score),
        renewalDays,
        missingDocuments: docs,
        slaGap,
        recommendedAction: recommendationForVendor(vendor, data.policy, score, docs, renewalDays, slaGap)
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore || a.renewalDays - b.renewalDays);
}

export function dashboardSummary(data) {
  const vendors = vendorPortfolio(data);
  const totalSpend = data.vendors.reduce((sum, vendor) => sum + vendor.monthlySpend, 0);
  const exposure = vendors
    .filter((vendor) => vendor.riskLevel === 'critical' || vendor.riskLevel === 'high')
    .reduce((sum, vendor) => sum + vendor.contractValue, 0);
  const renewals = vendors.filter((vendor) => vendor.renewalDays <= data.policy.renewalWarningDays);
  const docsPending = vendors.reduce((sum, vendor) => sum + vendor.missingDocuments.length, 0);
  const slaBreaches = vendors.filter((vendor) => vendor.sla.actual < vendor.sla.target).length;

  return {
    vendors: vendors.length,
    monthlySpend: totalSpend,
    annualContractValue: data.vendors.reduce((sum, vendor) => sum + vendor.contractValue, 0),
    highRiskExposure: exposure,
    criticalVendors: vendors.filter((vendor) => vendor.riskLevel === 'critical').length,
    renewalsNext60Days: renewals.length,
    documentsPending: docsPending,
    slaBreaches
  };
}

export function riskBreakdown(data) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const vendor of vendorPortfolio(data)) counts[vendor.riskLevel] += 1;
  return Object.entries(counts).map(([level, count]) => ({ level, count }));
}

export function renewalPipeline(data) {
  return vendorPortfolio(data)
    .filter((vendor) => vendor.renewalDays <= 120)
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      owner: vendor.owner,
      renewalDate: vendor.renewalDate,
      renewalDays: vendor.renewalDays,
      contractValue: vendor.contractValue,
      riskLevel: vendor.riskLevel,
      action: vendor.renewalDays <= data.policy.renewalWarningDays ? 'Revisar antes da renovação' : 'Monitorar'
    }))
    .sort((a, b) => a.renewalDays - b.renewalDays);
}

export function complianceMatrix(data) {
  return vendorPortfolio(data).map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    category: vendor.category,
    owner: vendor.owner,
    riskLevel: vendor.riskLevel,
    documents: Object.entries(vendor.compliance).map(([key, status]) => ({
      key,
      label: DOCUMENT_LABELS[key] ?? key,
      status
    }))
  }));
}

export function automationQueue(data) {
  const generated = vendorPortfolio(data).flatMap((vendor) => {
    const actions = [];
    if (vendor.renewalDays <= data.policy.renewalWarningDays) {
      actions.push(taskFor(vendor, 'Revisar risco antes da renovação automática', vendor.renewalDays <= 15 ? 'critical' : 'high', 'Compras'));
    }
    for (const doc of vendor.missingDocuments) {
      actions.push(taskFor(vendor, `Solicitar ${doc.label.toLowerCase()} (${documentStatus(doc.status)})`, doc.status === 'missing' ? 'critical' : 'high', 'Conformidade'));
    }
    if (vendor.slaGap > data.policy.minimumSlaTolerance) {
      actions.push(taskFor(vendor, 'Abrir plano de recuperação de SLA com responsável do fornecedor', 'high', vendor.owner));
    }
    if (vendor.lastAuditDays > data.policy.auditStaleDays) {
      actions.push(taskFor(vendor, 'Agendar auditoria atrasada do fornecedor', 'medium', 'Compras'));
    }
    return actions;
  });

  return [...data.tasks, ...generated]
    .sort((a, b) => priorityWeight(b.priority) - priorityWeight(a.priority) || a.dueInDays - b.dueInDays);
}

export function simulateRenewalHold(data) {
  const blocked = vendorPortfolio(data)
    .filter((vendor) => vendor.renewalDays <= data.policy.renewalWarningDays && (vendor.riskLevel === 'critical' || vendor.missingDocuments.length > 0))
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      contractValue: vendor.contractValue,
      riskLevel: vendor.riskLevel,
      renewalDays: vendor.renewalDays,
      reason: vendor.missingDocuments.length > 0 ? 'Documentos de conformidade incompletos' : 'Risco crítico do fornecedor'
    }));

  return {
    blockedRenewals: blocked.length,
    protectedContractValue: blocked.reduce((sum, vendor) => sum + vendor.contractValue, 0),
    vendors: blocked
  };
}

function recommendationForVendor(vendor, policy, score, docs, renewalDays, slaGap) {
  if (renewalDays <= 15 && docs.length > 0) return 'Bloquear renovação até fechar pendências de conformidade';
  if (score >= 78) return 'Escalar para compras, financeiro e jurídico';
  if (slaGap > policy.minimumSlaTolerance) return 'Negociar plano de recuperação de SLA e penalidades';
  if (docs.length > 0) return 'Solicitar documentos pendentes antes do próximo ciclo de pagamento';
  if (renewalDays <= policy.renewalWarningDays) return 'Preparar benchmark de renovação e fluxo de aprovação';
  return 'Manter monitoramento trimestral';
}

function documentStatus(status) {
  return DOCUMENT_STATUS_LABELS[status] ?? status;
}

function taskFor(vendor, title, priority, owner) {
  return {
    id: `auto-${vendor.id}-${slug(title)}`,
    vendorId: vendor.id,
    vendorName: vendor.name,
    title,
    priority,
    dueInDays: priority === 'critical' ? 1 : priority === 'high' ? 5 : 14,
    owner
  };
}

function priorityWeight(priority) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority] ?? 0;
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36);
}
