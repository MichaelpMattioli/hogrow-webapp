# Seletor de período em 2 painéis (substituir o `HeaderMonthReference`)

> Status: **PLANO / aguardando aprovação do DoR**. Sem implementação ainda.
> Data: 2026-06-07.

## 1. Objetivo

Substituir o seletor de datas atual — `HeaderMonthReference` (dropdown "DADOS DO MÊS") — usado em **ClienteDetalhe** (`/clientes/:id`) e **Clientes** (`/clientes`) por um seletor de **dois painéis com divisão clara**, inspirado no visual do **pick-up diário** (os painéis "MÊS DAS DIÁRIAS" vs "EXTRAÇÃO DOS DADOS"). O usuário gostou dessa divisão; ela deixa explícito o que cada eixo controla.

O seletor controla **3 dimensões**:
1. **Mês de referência** (`p_mes_ano`)
2. **Visão da extração** (`p_data_extracao`) — qual "retrato" dos dados
3. **Faixa de dias** (`p_dia_ini`/`p_dia_fim`) — sub-filtro do mês

## 2. Conclusões dos testes (validação do data-layer)

Validação read-only via PostgREST/`service_role` no prod (`yirmkfzzwpkfozpqntjo`), hotel 6 / mês 2026-06 / extração 2026-06-05. Scripts em `.pwtmp/verify_rpcs.py` + `verify_range.py`.

| RPC | params | HTTP | Resultado |
|---|---|---|---|
| `rpc_cliente_detalhe_calendar` | hotel, mês, extração | 200 | `selected_mes_ano`, `selected_data_extracao`, `available_months` (13), `available_extraction_dates` (145) |
| `rpc_cliente_detalhe_cards` | hotel, mês, extração, **dia_ini/fim** | 200 | devolve `selected_dia_ini/fim` + `is_faixa_parcial` |
| `rpc_cliente_pickup_diario` | hotel, mês, extração | 200 | 30 linhas |
| `rpc_clientes_calendar` | mês, extração | 200 | `available_months` (14), `available_extraction_dates` (162) |
| `rpc_clientes_table` | mês, extração, **dia_ini/fim** | 200 | 48 linhas |

**Faixa de dias confirmada (1–10 vs mês todo):**
- Cards: `receita_atual` 62.608 → 28.728 · `room_nights` 77 → 34 · `hospedes` 179 → 89 · `is_faixa_parcial` false→true.
- Clientes_table: `receita_real` 900.108 → 373.670 **muda**; `receita_meta`, `receita_meta_pct`, `receita_mes_anterior` **ficam iguais**. ⇒ regra "só a coluna Real reflete a faixa; Meta/MoM/YoY/Acumulado são do mês completo" **validada**.

**Contrato dos seletores (de onde vêm as opções):**
- Opções de **mês** ← `available_months` (`YYYY-MM`) do `*_calendar`.
- Opções de **extração** ← `available_extraction_dates` (`YYYY-MM-DD`) do `*_calendar`.
- Defaults resolvidos ← `selected_mes_ano` / `selected_data_extracao`.

**Views/MVs**: validadas **transitivamente** — as RPCs acima leem as MVs do site (`mv_clientes_page_position_kpis`, `mv_cliente_pickup_diario`, summaries) e retornaram dados corretos, não-vazios e sensíveis à faixa. Não há mudança de schema neste épico (só front).

## 3. Mapa de dados (o que cada dimensão atualiza)

| Dimensão | ClienteDetalhe | Clientes |
|---|---|---|
| Mês | cards, calendar, pickup (diário+mensal), rate-shopper | calendar, table |
| Extração | cards, calendar, pickup | calendar, table |
| Faixa de dias | **só** cards ("Real/atual") | **só** table (coluna "Real") |

Hooks afetados: `useClienteDetalheCalendar/Cards/PickupDiario`, `useClientesCalendar/Table` (todos já recebem as 3 dims). **Nenhuma mudança nos hooks/RPCs é necessária** — é troca de UI do seletor.

## 4. Design proposto

Componente novo `PeriodSelector` (nome interno) — drop-in com as MESMAS props do `HeaderMonthReference` (`selectedMonth/availableMonths/onSelect/selectedPosition/availablePositionDates/onPositionSelect/onCurrentMonthSelect/dayRange/onDayRangeChange`), então a troca nas páginas é 1-para-1.

```
+--------------------------------------------------+  +------------------------------------------+
| MES DE REFERENCIA                  [Mes atual]   |  | VISAO DA EXTRACAO                        |
|  <   Junho 2026  v   >    01/06 a 30/06          |  |  <   Data: 05/06  v   >    05/06/2026    |
|  Faixa: [Mes todo][1-10][11-20][21-30]  (dias X) |  |  retrato usado p/ calcular os valores    |
+--------------------------------------------------+  +------------------------------------------+
       (esquerda, azul = eixo "dados")                    (direita, marrom = eixo "extracao")
```

- **Painel A — "Mês de referência"** (eixo azul `stayAxis`): título grande do mês + faixa do mês; `< >` (prev/next via `availableMonths`); **dropdown** com grade de meses (ano + 12 meses, desabilita sem dado) para pular; botão **"Mês atual"**; **sub-linha de faixa de dias** (presets Mês todo/1–10/11–20/21–fim + dia-picker), mostrando "Faixa: dias X–Y" quando parcial.
- **Painel B — "Visão da extração"** (eixo marrom `extractionAxis`): `< >` (prev/next via `availableExtractionDates`) + **dropdown calendário de extração** (reaproveitar o `ExtracaoCalendar`, com realce de datas que têm alteração) + a data selecionada.
- Reaproveita os helpers visuais `axisPanel`/`axisLabel` do pick-up → **extrair para um módulo compartilhado** (`components/ui/axisPanel.ts`) e o pick-up passa a importar de lá (consistência + DRY).

## 5. Decisões (resolvidas 2026-06-07)

1. **Nomes dos painéis** — ✅ **"Mês de referência"** | **"Visão da extração"**.
2. **Faixa de dias** — ✅ **dentro do Painel A** (sub-linha de presets/dia-picker no painel do mês).
3. **Espaço** — ✅ assumido OK ocupar mais altura (o usuário pediu explicitamente a divisão mais clara em vez do dropdown compacto).
4. **Mobile** — ✅ empilhar os 2 painéis (A em cima, B embaixo).

## 6. Etapas de implementação (cada uma testada)

1. **Extrair `axisPanel`/`axisLabel`** p/ `components/ui/axisPanel.ts`; pick-up importa de lá. _Teste:_ build + Playwright no pick-up (visual idêntico, 0 regressão).
2. **Criar `PeriodSelector`** (2 painéis, 3 dims, mesmas props). _Teste:_ render isolado em `/clientes/:id` lado a lado com o antigo (flag temporária) + build.
3. **Integrar no ClienteDetalhe** (trocar o `HeaderMonthReference`). _Teste Playwright:_ mudar mês/extração/faixa e conferir que cards + pickup batem com os valores das RPCs (ex.: faixa 1–10 → `receita_atual` = 28.728).
4. **Integrar no Clientes**. _Teste Playwright:_ tabela atualiza; faixa muda só "Real".
5. **Remover `HeaderMonthReference`** (se sem outros usos) + varredura de órfãos. _Teste:_ build + grep.
6. **Responsivo + a11y** (empilhar no mobile; foco/ESC/aria nos dropdowns). _Teste Playwright:_ desktop + mobile.
7. **Regressão final** nas duas páginas + commit/push (auto-deploy Vercel).

## 7. DoR — Definition of Ready (para começar a implementar)

- [x] RPCs validadas (5/5 HTTP 200, contrato confirmado) — §2.
- [x] Faixa de dias confirmada afetando só "Real/atual" — §2.
- [x] Dimensões × telas mapeadas; sem mudança de schema/hooks — §3.
- [x] Props do novo componente = props do atual (troca 1-para-1) — §4.
- [x] **Nomes dos painéis aprovados** (§5.1) — "Mês de referência" / "Visão da extração".
- [x] **Posição da faixa de dias decidida** (§5.2) — dentro do painel do mês.
- [x] **Espaço maior + empilhar no mobile** aprovados (§5.3/§5.4).

**→ DoR COMPLETO. Pronto para implementar.**

## 8. DoD — Definition of Done ✅ (verificado 2026-06-07)

- [x] Novo seletor em **ClienteDetalhe e Clientes**; `HeaderMonthReference` **removido** (arquivo deletado), 0 órfãos (grep + build).
- [x] As 3 dimensões funcionam e **batem com as RPCs** — Playwright em `/clientes/6`: faixa **1–10 → Receita `R$ 28.728`** (RPC `receita_atual`=28728 ✓), full = `R$ 62.608,05` (=62608.05 ✓); em `/clientes`: faixa muda a tabela.
- [x] **Faixa só afeta "Real/atual"** — banner confirma; RPC §2 mostrou Meta/MoM/YoY/Acumulado iguais entre full e faixa.
- [x] **"Mês atual"** presente nos 2 painéis; reset de faixa ("Mês todo") volta os valores ao full.
- [x] Opções vêm de `available_months`/`available_extraction_dates`; default = `selected_*` (mostrou Junho 2026 / 05/06).
- [x] **Responsivo** (mobile 390px: painéis empilham full-width) e **a11y** (ESC fecha dropdown; `aria-label` nos botões/dropdowns).
- [x] `npm run build` limpo (TS) em todas as etapas + **Playwright** validou as 2 páginas + pickup sem regressão.
- [x] Commit + push (auto-deploy). Memória [[webapp-frontend]] atualizada.

**Etapa 1 (DRY):** `axisPanel.ts` + `ExtracaoCalendar.tsx` extraídos; `PickupTable` importa de lá (sem regressão — toggle/painéis/Mês atual confirmados no Playwright).

## 9. Riscos / observações

- **Só front** — zero risco de dados (nenhuma RPC/MV muda). Reversível (é troca de componente).
- O `ExtracaoCalendar` e os helpers de eixo hoje vivem em `PickupTable`/`HeaderMonthReference`; a extração compartilhada (etapa 1) precisa não regredir o pick-up.
- O `HeaderMonthReference` tem drill-down ano→mês e presets de faixa que **devem ser preservados** no novo Painel A (não perder funcionalidade ao ganhar clareza).
