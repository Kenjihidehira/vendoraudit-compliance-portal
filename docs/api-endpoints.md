# Endpoints da API

URL base para execução local:

```txt
http://127.0.0.1:4182
```

| Método | Endpoint | Finalidade |
| --- | --- | --- |
| GET | `/api/health` | Saúde e nome do serviço |
| GET | `/api/summary` | KPIs executivos de gasto, exposição, renovações e lacunas de conformidade |
| GET | `/api/vendors` | Portfólio de fornecedores ordenado por risco calculado |
| GET | `/api/risk-breakdown` | Contagem de fornecedores por nível de risco |
| GET | `/api/renewals` | Agenda de renovação dos próximos 120 dias |
| GET | `/api/compliance-matrix` | Status dos documentos obrigatórios por fornecedor |
| GET | `/api/automation-queue` | Fila de ações manuais e geradas |
| POST | `/api/simulate/renewal-hold` | Simula bloqueio de renovações arriscadas até resolver pendências |

## Exemplo de Resposta da Simulação

```json
{
  "blockedRenewals": 2,
  "protectedContractValue": 697200,
  "vendors": [
    {
      "id": "vnd-005",
      "name": "MarketPulse Media",
      "contractValue": 183600,
      "riskLevel": "critical",
      "renewalDays": 17,
      "reason": "Documentos de conformidade incompletos"
    }
  ]
}
```

## Regras de Negócio

- Documentos de conformidade ausentes ou vencidos aumentam a pontuação de risco do fornecedor.
- Fornecedores críticos recebem peso maior porque custo de substituição e exposição operacional são mais altos.
- Renovações dentro da janela de alerta viram ações de compras.
- Gaps de SLA acima da tolerância geram tarefas de plano de recuperação.
- Auditorias antigas criam trabalho de acompanhamento para compras.
- Renovações de alto risco com lacunas de conformidade são bloqueadas na simulação.
