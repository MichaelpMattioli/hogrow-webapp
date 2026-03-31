# Discovery Report — HoGrow Revenue Intelligence

*Gerado pelo Agente 1 (Discovery)*

## 1. Fontes de Dados Analisadas

### 1.1 ANALISYS/dados/json/SOL_ALPHAVILLE_-_PLANNING_2026_-_JANEIRO/

| Arquivo | Tipo | Observações |
|---------|------|-------------|
| `Resumo.json` | Resumo mensal | Receita Total, OCC, RevPAR, Diária Média por mês |
| `TARIFARIO_26.json` | Tarifário BAR | 8 níveis (A–H) com preços SGL/DBL/TRP por categoria |
| `Acompanhamento_Receitas.json` | Meta mensal | Realizado, OTB, projeção, variação vs budget |
| `Pick-Up_Diário.json` | Pickup por dia | Dados de pickup com delta diário e acumulado |
| `Gatilhos.json` | Gatilhos ocupação | Regras de gatilho por faixa de ocupação |
| `Comparativos.json` | Comp-set | RevPAR, ADR e OCC de concorrentes |
| `M.D.S_2026.json` | MDS (Mapa de Segmentos) | Segmentação por tipo de receita |
| `30.12.2025.json` – `20.02.2026.json` | Snapshots diários | Ocupação/receita por dia do mês |

### 1.2 ANALISYS/dados/json/ACESSOS_PMS_HOGROW/
- `BD.json`: Credenciais de acesso PMS para hotéis da carteira

### 1.3 ANALISYS/midia/transcricoes/
- `2026-02-10 18-31-49.txt`: Transcrição de áudio sobre decisões de revenue
- `RELATORIO_COMPLETO.md`: Relatório consolidado da reunião

### 1.4 WEBAPP/hogrow-dashboard.jsx
- **Referência principal** para o design do dashboard
- 881 linhas com 6 hotéis, componentes UI completos
- Inline styles com design system (cores, fonts, border-radius)
- Componentes: KpiCard, StatusBadge, PickupChart, OtbBarChart, CompetitorTable, BarGrid

## 2. Estrutura dos Dados

### Hotel (tipo principal)
```
id, nome, cidade, uhs (unidades hab.)
meta: { receita, realizado, otb, projecao, mesRef, pickup24h }
pickup[]: data, occ, dm, revpar
otb[]: dia, occ (0–100)
competitors[]: nome, revpar, adr, occ, isOwn
barLevels[]: nivel, preco, isCurrent
```

### Status derivado
- **Excelente** (≥95% projeção/receita) → verde
- **Saudável** (≥85%) → azul
- **Atenção** (≥70%) → âmbar
- **Crítico** (<70%) → vermelho

## 3. Qualidade dos Dados

| Aspecto | Avaliação |
|---------|-----------|
| JSONs do Excel | Contêm colunas "Unnamed:" e headers repetidos — requerem limpeza |
| JSX de referência | Dados limpos e prontos para uso direto |
| Cobertura temporal | Jan–Fev 2026 para Sol Alphaville |
| Comp-set | 5 concorrentes por hotel no JSX |

## 4. Decisões Tomadas

1. **Fonte primária**: Dados do `hogrow-dashboard.jsx` (6 hotéis limpos) + 4 hotéis mock adicionais
2. **Dados do Excel não usados diretamente**: A qualidade dos JSONs exportados não permite uso automático sem pipeline de limpeza
3. **Sol Alphaville como hotel principal**: Dados mais ricos e detalhados
4. **10 hotéis no total**: Para demonstrar escalabilidade da interface

## 5. Gaps Identificados

- Sem dados históricos (apenas Jan–Fev 2026)
- Sem API real — dados estáticos embarcados
- Segmentação de receita (corporate, OTA, direto) disponível nos JSONs mas não implementada na v1
- Integração PMS futura indicada no BD.json
