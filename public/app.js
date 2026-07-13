const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
});

const number = new Intl.NumberFormat('pt-BR');

const riskLabels = {
  critical: 'crítico',
  high: 'alto',
  medium: 'médio',
  low: 'baixo'
};

const documentStatusLabels = {
  valid: 'válido',
  missing: 'ausente',
  expired: 'vencido',
  not_required: 'não exigido'
};

async function fetchJson(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) throw new Error(`${path} retornou ${response.status}`);
  return response.json();
}

async function loadDashboard() {
  const [summary, vendors, tasks, renewals, matrix] = await Promise.all([
    fetchJson('/api/summary'),
    fetchJson('/api/vendors'),
    fetchJson('/api/automation-queue'),
    fetchJson('/api/renewals'),
    fetchJson('/api/compliance-matrix')
  ]);

  renderKpis(summary);
  renderVendors(vendors);
  renderTasks(tasks.slice(0, 8));
  renderRenewals(renewals);
  renderMatrix(matrix);
}

function renderKpis(summary) {
  const items = [
    ['Gasto mensal', money.format(summary.monthlySpend)],
    ['Exposição de alto risco', money.format(summary.highRiskExposure)],
    ['Renovações em 60 dias', number.format(summary.renewalsNext60Days)],
    ['Documentos pendentes', number.format(summary.documentsPending)]
  ];
  document.querySelector('#kpis').innerHTML = items
    .map(([label, value]) => `<article class="kpi"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function renderVendors(vendors) {
  document.querySelector('#portfolioCount').textContent = `${vendors.length} fornecedores`;
  document.querySelector('#vendorRows').innerHTML = vendors
    .map((vendor) => `
      <tr>
        <td><strong>${vendor.name}</strong><span class="muted">${vendor.category} | ${money.format(vendor.contractValue)} valor anual</span></td>
        <td>${vendor.owner}</td>
        <td><span class="pill risk-${vendor.riskLevel}">${riskLabel(vendor.riskLevel)} ${vendor.riskScore}</span></td>
        <td><strong>${formatDays(vendor.renewalDays)}</strong><span class="muted">${vendor.renewalDate}</span></td>
        <td><strong>${vendor.sla.actual}%</strong><span class="muted">meta ${vendor.sla.target}%</span></td>
        <td>${vendor.recommendedAction}</td>
      </tr>
    `)
    .join('');
}

function renderTasks(tasks) {
  document.querySelector('#taskList').innerHTML = tasks
    .map((task) => `
      <article class="task">
        <div class="task-top">
          <strong>${task.title}</strong>
          <span class="pill risk-${riskClass(task.priority)}">${riskLabel(task.priority)}</span>
        </div>
        <span class="muted">${task.vendorName ?? task.vendorId} | ${task.owner} | ${formatDue(task.dueInDays)}</span>
      </article>
    `)
    .join('');
}

function renderRenewals(renewals) {
  document.querySelector('#renewals').innerHTML = renewals
    .map((vendor) => `
      <article class="stack-item">
        <div class="stack-top">
          <strong>${vendor.name}</strong>
          <span class="pill risk-${vendor.riskLevel}">${formatDays(vendor.renewalDays)}</span>
        </div>
        <span class="muted">${vendor.owner} | ${money.format(vendor.contractValue)} | ${vendor.action}</span>
      </article>
    `)
    .join('');
}

function renderMatrix(rows) {
  document.querySelector('#matrix').innerHTML = rows
    .map((row) => `
      <article class="matrix-row">
        <div class="stack-top">
          <strong>${row.name}</strong>
          <span class="pill risk-${row.riskLevel}">${riskLabel(row.riskLevel)}</span>
        </div>
        <div class="doc-grid">
          ${row.documents.map((doc) => `<span class="doc ${doc.status}">${shortDoc(doc.label)}<br>${documentStatus(doc.status)}</span>`).join('')}
        </div>
      </article>
    `)
    .join('');
}

function riskClass(priority) {
  return { critical: 'critical', high: 'high', medium: 'medium', low: 'low' }[priority] ?? 'medium';
}

function riskLabel(value) {
  return riskLabels[value] ?? value;
}

function documentStatus(value) {
  return documentStatusLabels[value] ?? value;
}

function formatDays(days) {
  return `${days} dia${days === 1 ? '' : 's'}`;
}

function formatDue(days) {
  if (days <= 0) return 'vence hoje';
  return `vence em ${days} dia${days === 1 ? '' : 's'}`;
}

function shortDoc(label) {
  return label
    .replace('Certidão fiscal', 'Cert. fiscal')
    .replace('Acordo de tratamento de dados LGPD', 'DPA LGPD')
    .replace('Declaração anticorrupção', 'Anticorrupção');
}

function formatSimulationResult(result) {
  const vendors = result.vendors
    .map((vendor) => `- ${vendor.name}: ${money.format(vendor.contractValue)}, risco ${riskLabel(vendor.riskLevel)}, renovação em ${formatDays(vendor.renewalDays)}. Motivo: ${vendor.reason}.`)
    .join('\n');

  return [
    `Renovações bloqueadas: ${number.format(result.blockedRenewals)}`,
    `Valor contratual protegido: ${money.format(result.protectedContractValue)}`,
    '',
    'Fornecedores afetados:',
    vendors || '- Nenhum fornecedor bloqueado.'
  ].join('\n');
}

document.querySelector('#simulateBtn').addEventListener('click', async () => {
  const result = await fetchJson('/api/simulate/renewal-hold', { method: 'POST' });
  document.querySelector('#simulationOutput').textContent = formatSimulationResult(result);
  document.querySelector('#simulationDialog').showModal();
});

loadDashboard().catch((error) => {
  document.body.insertAdjacentHTML('beforeend', `<p class="load-error">${error.message}</p>`);
});
