# Metas via Excel — Validação, Erros, Alertas e Status

> Spec de robustez do upload de metas (`Metas → Lançar metas`).
> Mapeia **todos** os problemas possíveis do template, define **os caminhos para cada status**
> (`ok` / `parcial` / `erro`), o modelo de dados, a **sequência de implementação** em fases e a
> **matriz de casos de teste**.
>
> Estado atual (base já entregue): front parseia o `.xlsx` (SheetJS), Edge Function `metas-upload`
> faz upsert em `hotel_metas` + versiona o arquivo no Storage + grava 1 linha em `metas_upload_log`
> com `status` calculado de forma simples (`ok`/`parcial`/`erro`). Este doc é o plano para
> **detalhar** essa validação. Referência: backlog #24.

---

## 1. Princípios

| Conceito | Significado | Efeito no status |
|---|---|---|
| **ERRO** (`E-*`) | Problema que **impede** aplicar (arquivo/linha/célula). | Bloqueia o item. Se nada sobra para aplicar → `erro`. Se aplica parte → `parcial`. |
| **ALERTA** (`A-*`) | Aplicável, mas **suspeito ou destrutivo** — exige atenção. | Mantém aplicação. Alerta destrutivo não confirmado → `parcial`. Demais → `ok (com avisos)`. |
| **INFO** (`I-*`) | Observação benigna (ignorou coluna extra, pulou linha vazia). | Não afeta status. |

Regras de ouro:
1. **A Edge Function é a autoridade.** O front valida para dar feedback rápido (UX), mas nunca é
   a fonte de verdade — toda regra roda também no backend (service role).
2. **Tudo vira `issue` estruturada** (`{level, code, msg, hotelId?, mes?, cat?}`), não string solta.
   A coluna *Observação* e o futuro modal de detalhe leem dessas issues.
3. **Idempotência:** subir o mesmo arquivo 2x não muda nada (upsert por `hotel_id + mes_ano`).
4. **Nada de aplicação silenciosa destrutiva:** apagar/zerar meta existente sempre gera alerta.

---

## 2. Camadas de validação

```
┌─────────────┐   parse + pré-validação      ┌──────────────────┐   validação + diff + apply   ┌────────────┐
│  Front       │  (E-FMT / E-HDR rápidos,     │  Edge Function    │  (TODAS as regras, upsert,   │  Postgres   │
│  MetasExcel  │   feedback imediato; pode     │  metas-upload     │   issues, status, log)        │ hotel_metas │
│  Card        │   abortar antes de enviar)    │  (service role)   │                               │ +_upload_log│
└─────────────┘                               └──────────────────┘                               └────────────┘
```

- **Front:** só checagens baratas e seguras (arquivo lê? cabeçalho bate? tem ≥1 linha?). Se falhar,
  nem envia — mostra o erro na hora. Caso passe, envia o payload já parseado + o arquivo bruto.
- **Edge Function:** repete as checagens de formato **e** faz as de negócio/valor (que dependem do
  banco: hotel existe? é cliente? meta já existia?). Decide o `status` e grava o log.
- **Postgres:** constraint final (tipos, `onConflict`).

---

## 3. Taxonomia de status — os caminhos

Mantemos os 3 status visíveis (badge): **`ok`** (verde), **`parcial`** (âmbar), **`erro`** (vermelho).
O detalhe vem das `issues`. Precedência (primeira condição verdadeira vence):

```
1. Arquivo ilegível / cabeçalho inválido (E-FMT-*, E-HDR-*)? ───────────────► ERRO  (0 aplicado)
                       │ não
2. Após processar linhas, há ≥1 meta válida para aplicar? ── não ───────────► ERRO  (0 aplicado)
                       │ sim
3. Upsert no banco falhou (E-DB-01/02)? ────────────────────────────────────► ERRO  (0 aplicado)
                       │ não  (aplicou N > 0)
4. Houve rejeição de linha/célula (E-ROW-*, E-VAL-*)                     ┐
   OU alerta destrutivo não confirmado (A-BIZ-04 zeragem)               ├─ sim ► PARCIAL
   OU arquivo não versionou no Storage (A-SYS-01)?                      ┘
                       │ não
5. Houve algum alerta/info (A-*, I-*)? ─────────────────────────────────────► OK (com avisos)
                       │ não
6. ──────────────────────────────────────────────────────────────────────────► OK (limpo)
```

> **OK (com avisos)** = `status = 'ok'` **e** `alertas > 0`. A UI mostra o badge verde **+** um pill
> âmbar “N avisos”. Não é um 4º status no banco; é OK com `issues` de nível alerta/info.

No **modo preview** (Fase 4) nada é aplicado: a função devolve o **status projetado** + issues + o
*diff* (o que mudaria), e o usuário confirma antes de aplicar de fato.

---

## 4. Modelo de dados (evolução do `metas_upload_log`)

Migration nova (Fase 1) — adiciona detalhe sem quebrar o que existe:

```sql
alter table public.metas_upload_log
  add column if not exists issues   jsonb   not null default '[]'::jsonb,
  add column if not exists erros    integer not null default 0,
  add column if not exists alertas  integer not null default 0,
  add column if not exists modo     text    not null default 'apply'  -- 'apply' | 'preview'
    check (modo in ('apply','preview'));
```

Forma de cada issue:
```jsonc
{
  "level": "erro" | "alerta" | "info",
  "code":  "E-ROW-02",
  "msg":   "Hotel 99999 não existe",
  "hotelId": 99999,          // opcional
  "hotelNome": "…",          // opcional
  "mes": 7,                   // opcional (1..12)
  "cat": "receita"            // opcional (receita|occ|dm)
}
```

A coluna **Observação** passa a renderizar: `{erros} erro(s) · {alertas} alerta(s)` (clicável → modal
com a lista). Hoje ela mostra texto genérico; com isso vira detalhada.

---

## 5. Catálogo de ERROS (`E-*`)

### 5.1 Arquivo / formato — bloqueiam o upload inteiro → `erro`
| Código | Gatilho | Camada |
|---|---|---|
| **E-FMT-01** | Arquivo corrompido/ilegível (`XLSX.read` lança) | front + função |
| **E-FMT-02** | Extensão/MIME não suportado (não `.xlsx`/`.xls`) | front (`accept`) + função |
| **E-FMT-03** | Arquivo vazio (0 bytes) ou sem nenhuma aba | front + função |
| **E-FMT-04** | Aba selecionada sem nenhuma linha de dados | front + função |
| **E-FMT-05** | Acima do limite de tamanho (guarda; bucket = 50 MB) | função |

### 5.2 Cabeçalho — bloqueiam → `erro`
| Código | Gatilho |
|---|---|
| **E-HDR-01** | 1ª linha não é cabeçalho (não encontra `ID`/`Cliente`/`Categoria`) |
| **E-HDR-02** | Falta coluna obrigatória (`ID`, `Cliente` ou `Categoria`) |
| **E-HDR-03** | Nº de colunas de mês ≠ 12 (faltando ou sobrando meses) |
| **E-HDR-04** | Rótulos de mês irreconhecíveis (não casa `Jan..Dez`) |

### 5.3 Linha — bloqueiam a LINHA (hotel/categoria) → contribui para `parcial`
| Código | Gatilho |
|---|---|
| **E-ROW-01** | `ID` vazio ou não-numérico |
| **E-ROW-02** | Hotel inexistente (ID fora de `hotel`) |
| **E-ROW-03** | Hotel existe mas **não é cliente** (`tipo = 'concorrente'`) |
| **E-ROW-04** | Categoria desconhecida (não é Receita/Ocupação/Diária Média) |

### 5.4 Valor / célula — bloqueiam a CÉLULA → contribui para `parcial`
| Código | Gatilho |
|---|---|
| **E-VAL-01** | Valor não-numérico numa célula de mês (texto, fórmula com erro `#REF!`) |
| **E-VAL-02** | Valor negativo (receita/occ/dm < 0) |
| **E-VAL-03** | Ocupação fora de \[0, 100] (ver decisão P-4) |

### 5.5 Persistência
| Código | Gatilho | Efeito |
|---|---|---|
| **E-DB-01** | Falha no upsert `hotel_metas` | `erro` (nada aplicado) |
| **E-DB-02** | Falha ao consultar hotéis-cliente | `erro` |

---

## 6. Catálogo de ALERTAS (`A-*`)

### 6.1 Negócio
| Código | Gatilho | Nível padrão |
|---|---|---|
| **A-BIZ-01** | **Meses vazios**: hotel com 1+ meses sem meta *(exemplo citado pelo cliente)* | info/alerta |
| **A-BIZ-02** | Hotel-cliente presente no arquivo mas **sem nenhuma meta** (tudo vazio) | alerta |
| **A-BIZ-03** | **Hotéis-cliente ausentes** do arquivo (subiu parcial) — metas atuais mantidas | alerta |
| **A-BIZ-04** | **Zeragem/remoção**: célula vazia/0 onde **já existia** meta → vai apagar (ver P-1) | alerta (destrutivo) |
| **A-BIZ-05** | **Sobrescrita**: meta existente trocada por valor diferente | info |
| **A-BIZ-06** | Categoria incompleta: hotel só tem 1–2 das 3 categorias no arquivo | alerta |
| **A-BIZ-07** | Categoria duplicada p/ o mesmo hotel (2 linhas “Receita”) — última vence | alerta |
| **A-BIZ-08** | Ano do arquivo ≠ ano selecionado (se detectável pelo nome da aba/arquivo) | alerta |

### 6.2 Valor / sanidade
| Código | Gatilho | Nível |
|---|---|---|
| **A-VAL-01** | Ocupação parece **fração** (0 < occ ≤ 1) — provável esqueceu de × 100 | alerta |
| **A-VAL-02** | Diária média > 0 mas receita = 0 (ou vice-versa) — incoerência | alerta |
| **A-VAL-03** | **Outlier vs realizado**: meta muito acima/abaixo do histórico (`hotel_receita_diaria`) | alerta |
| **A-VAL-04** | Separador de milhar textual (“1.000.000”) — auto-corrigido, mas avisa | info |
| **A-VAL-05** | Ocupação = 100 exato em vários meses — suspeito | info |

### 6.3 Sistema
| Código | Gatilho | Efeito |
|---|---|---|
| **A-SYS-01** | Upsert OK mas **arquivo não versionou** no Storage | → `parcial` |

---

## 7. Catálogo de INFOS (`I-*`) — não afetam status
| Código | Gatilho |
|---|---|
| **I-01** | Coluna(s) extra(s) à direita de Dez ignoradas |
| **I-02** | Linha(s) totalmente em branco puladas |
| **I-03** | Abas extras ignoradas (usou a primeira) |

---

## 8. Decisões de política (precisam de confirmação)

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| **P-1** | Célula **vazia** numa meta que **já existia** | (a) **mantém** a atual (não-destrutivo); (b) **apaga** (espelho exato do arquivo) | **(a) mantém** + alerta `A-BIZ-04` só quando o valor cair para vazio/0 explicitamente marcado. Apagar só via preview confirmado. |
| **P-2** | Arquivo **parcial** (faltam hotéis) | (a) upsert dos presentes, mantém ausentes (sempre); (b) oferecer “substituição total” | **(a)** + alerta `A-BIZ-03`. “Substituição total” fica para depois. |
| **P-3** | **Preview** antes de aplicar | (a) aplicar-e-reportar (atual); (b) dry-run → confirmar → aplicar | **(b)** como meta final (Fase 4). (a) segue como fallback. |
| **P-4** | Ocupação fora de \[0,100] | (a) **erro** (rejeita célula); (b) alerta (aceita) | **> 100 = erro** (`E-VAL-03`); **0 < occ ≤ 1 = alerta** de fração (`A-VAL-01`). |
| **P-5** | Granularidade da rejeição | (a) rejeita **célula** isolada; (b) rejeita a **categoria/linha** inteira | **(a) célula** — aproveita o máximo do arquivo. |

### Decisões travadas (2026-06-07)
- **P-1 = (a) Manter a meta atual.** Célula vazia **ignora** aquele campo (não apaga). O upsert passa a
  ser **por campo** (merge com o existente): só sobrescreve receita/occ/dm que vierem preenchidos.
  Apagar uma meta só acontece de forma explícita (via preview confirmado, Fase 4) → alerta `A-BIZ-04`.
- **P-3 = (b) Pré-visualizar e confirmar.** Fluxo final: escolher arquivo → `modo=preview` (valida +
  calcula diff, **sem gravar**) → modal de confirmação → aplicar. O `apply` direto segue existindo como
  caminho interno. **Preview é read-only: não faz upsert, não versiona, não gera linha de log.**
- **P-2 = (a)**, **P-4 = >100 erro / fração alerta**, **P-5 = (a) por célula** — conforme recomendado.

> Implicação de P-1: a Fase 2/3 lê as metas atuais do mês e faz merge campo-a-campo antes do upsert,
> em vez do upsert “cego” atual (que zera campos vazios).

---

## 9. Sequência de implementação

### Fase 1 — Fundação de `issues` + erros de formato/cabeçalho (bloqueio) ✅ FEITA (2026-06-07)
- **DB:** migration `20260607190000_metas_upload_log_issues.sql` — colunas `issues`, `erros`, `alertas`, `modo`.
- **Função (virou a AUTORIDADE de parse):** passou a parsear o `.xlsx` no servidor (SheetJS via
  `esm.sh/xlsx@0.18.5` — `cdn.sheetjs.com` é bloqueado pelo bundler do Supabase). Guarda por **magic
  bytes** (ZIP/OLE) antes do SheetJS (que é leniente e leria texto como CSV) → `E-FMT-02`. Implementa
  `E-FMT-01/02/03/04` e `E-HDR-01/02/03/04` → `status='erro'` com `issues`, **nada aplicado**, logado.
  Responde sempre **HTTP 200** com `{status, issues, …}` (erros de validação não são 4xx/5xx).
  **`modo='preview'`** = read-only (valida + conta o que aplicaria; sem upsert/storage/log).
- **Front:** `MetasExcelCard` deixou de parsear — manda só o arquivo (base64); o template (download)
  ainda usa xlsx. Banner colorido por status (verde/âmbar/vermelho) com a 1ª issue de erro.
- **UI log:** coluna Observação lê das `issues` (`{n} alerta(s)` / 1ª msg de erro), defensiva a linhas
  de cache antigas sem o campo.
- **Cobre / validado:** harness `tests/metas_upload/test_fase1.py` (modo preview, sem efeito colateral)
  — **7/7**: T-OK-01, T-FMT-01(→E-FMT-02), T-FMT-03, T-FMT-04, T-HDR-02, T-HDR-03, T-HDR-04.
  E2E Playwright do apply: upload OK (verde, 12/12) e cabeçalho sem Categoria (vermelho, log `erro`).

### Fase 2 — Validação de linha/célula (`parcial` detalhado) ✅ FEITA (2026-06-07)
- **Função:** `E-ROW-01/02/03/04` (ID inválido / inexistente / não-cliente / categoria desconhecida —
  usa `hotel(id, nome_fantasia, tipo)` para separar E-ROW-02 de E-ROW-03) e `E-VAL-01/02/03`
  (não-numérico / negativo / ocupação fora de 0–100) por célula. Aplica o que é válido, rejeita o resto.
- **Cobre:** T-ROW-01/02/03/04, T-VAL-01/02/03.

### Fase 3 — Merge P-1 + alertas de negócio ✅ FEITA (2026-06-07)
- **Função:** lê as metas atuais (`hotel_metas` do ano) e faz **merge campo-a-campo** — célula vazia
  MANTÉM o valor atual (P-1), só faz `upsert` das linhas que de fato mudam. Alertas `A-BIZ-01`
  (meses vazios mantidos), `A-BIZ-06` (categoria incompleta), `A-BIZ-07` (duplicada), `A-BIZ-08`
  (ano divergente); infos `A-BIZ-03` (hotéis ausentes), `A-BIZ-05` (substituições). `A-BIZ-04`
  (zeragem) só via preview confirmado — fora do apply normal.
- **Cobre:** T-BIZ-01/06/07/08.

### Fase 4 — Preview / dry-run + UI de detalhe ✅ FEITA (2026-06-07)
- **Função:** `modo='preview'` valida + calcula o **diff** (`criadas/substituidas/mantidas/inalteradas/
  aplicar/ignored/hoteisAusentes`) **sem gravar** (nem upsert, nem storage, nem log).
- **Front:** escolher o arquivo chama o preview → **modal** (`MetasModal`) com os números do diff +
  lista de issues → **Confirmar · aplicar N**. No histórico, cada linha é **clicável** → modal com as
  issues daquele envio. Componente reusável `IssueList` **agrupa por tipo (código)**: 1 linha por tipo
  com contagem + resumo condensado do "onde" (hotéis "90000 · 90001 … +76"; células "UCAYALI · Receita ·
  Jan–Dez"), expansível sob demanda (cap 60). Colapsa a repetição (80 erros iguais → 1 linha) — crucial
  nos casos de muitas linhas/colunas com problema.
- **Cobre:** T-PRV-01 (diff). E2E Playwright: preview (parcial, 8 a aplicar) + detalhe.

### Fase 5 — Sanidade avançada (opcional)
- **Função:** `A-VAL-01/02/03/05` (fração, incoerência, outlier vs `hotel_receita_diaria`).
- **Cobre:** T-VAL-adv-*.

---

## 10. Matriz de casos de teste

Cada caso = 1 fixture `.xlsx` + status/issues esperados. `[base]` = 1 hotel-cliente válido (ex.: id 43),
3 categorias × 12 meses preenchidos.

| Caso | Fixture (o que muda do base) | Status esperado | Códigos | Fase |
|---|---|---|---|---|
| **T-OK-01** | base íntegro | `ok` | — | 1 |
| **T-FMT-01** | arquivo `.txt` renomeado p/ `.xlsx` | `erro` | E-FMT-01/02 | 1 |
| **T-FMT-03** | arquivo 0 byte | `erro` | E-FMT-03 | 1 |
| **T-FMT-04** | aba só com cabeçalho (sem linhas) | `erro` | E-FMT-04 | 1 |
| **T-HDR-02** | remove a coluna `Categoria` | `erro` | E-HDR-02 | 1 |
| **T-HDR-03** | só 10 colunas de mês | `erro` | E-HDR-03 | 1 |
| **T-HDR-04** | meses como `M1..M12` | `erro` | E-HDR-04 | 1 |
| **T-ROW-01** | linha com `ID` = "abc" | `parcial` | E-ROW-01 | 2 |
| **T-ROW-02** | `ID` = 99999 (inexistente) | `parcial`* | E-ROW-02 | 2 |
| **T-ROW-03** | `ID` de um concorrente | `parcial`* | E-ROW-03 | 2 |
| **T-ROW-04** | categoria “Revpar” (desconhecida) | `parcial` | E-ROW-04 | 2 |
| **T-VAL-01** | célula Jun da Receita = "x" | `parcial` | E-VAL-01 | 2 |
| **T-VAL-02** | Receita Mar = -100 | `parcial` | E-VAL-02 | 2 |
| **T-VAL-03** | Ocupação Abr = 150 | `parcial` | E-VAL-03 | 2 |
| **T-BIZ-01** | 3 meses de Receita vazios (hotel novo) | `ok (avisos)` | A-BIZ-01 | 3 |
| **T-BIZ-02** | hotel presente, tudo vazio | `ok (avisos)` | A-BIZ-02 | 3 |
| **T-BIZ-03** | só 1 hotel num parque de 48 | `ok (avisos)` | A-BIZ-03 | 3 |
| **T-BIZ-04** | apaga 2 metas que já existiam (P-1=a, sem confirmar) | `parcial` | A-BIZ-04 | 3 |
| **T-BIZ-05** | muda valores de metas existentes | `ok (avisos)` | A-BIZ-05 | 3 |
| **T-BIZ-06** | hotel só com Receita (sem Occ/DM) | `ok (avisos)` | A-BIZ-06 | 3 |
| **T-BIZ-07** | 2 linhas “Receita” p/ o mesmo hotel | `ok (avisos)` | A-BIZ-07 | 3 |
| **T-BIZ-08** | template 2027 subindo com ano=2026 | `ok (avisos)` | A-BIZ-08 | 3 |
| **T-PRV-01** | preview de um base: não aplica, devolve diff | `ok` (modo preview) | — | 4 |
| **T-PRV-02** | preview com zeragem: diff mostra “zerar Z” | projetado `parcial` | A-BIZ-04 | 4 |
| **T-VAL-adv-01** | Ocupação 0.85 (fração) | `ok (avisos)` | A-VAL-01 | 5 |
| **T-VAL-adv-02** | DM = 400, Receita = 0 | `ok (avisos)` | A-VAL-02 | 5 |
| **T-VAL-adv-03** | Receita 10× o realizado | `ok (avisos)` | A-VAL-03 | 5 |

\* `parcial` quando o arquivo tem **também** linhas válidas; se a única linha for inválida → `erro`
(cai na regra 2 do §3, “0 metas válidas para aplicar”).

---

## 11. Harness de teste ✅ implementado

- **`tests/metas_upload/test_validacao.py`** — gera fixtures `.xlsx` em memória (`openpyxl`) e invoca a
  Edge Function em **`modo='preview'`** (read-only, zero efeito colateral), afirmando `status` + os
  `code`s esperados (e campos do `diff`). **19/19** cobrindo Fases 1–4 (T-OK, T-FMT, T-HDR, T-ROW,
  T-VAL, T-BIZ, T-PRV). Roda contra produção sem tocar dado nenhum.
- **`tests/metas_upload/gen_exemplos.py`** — gera os EXEMPLOS VISUAIS do histórico em `modo='apply'`
  (nomes descritivos: `exemplo-ok` / `exemplo-aviso-meses-vazios` / `exemplo-parcial-celula-invalida` /
  `exemplo-parcial-hotel-inexistente` / `exemplo-erro-cabecalho`), restaurando a UCAYALI ao original ao
  final — os dados não mudam, mas as linhas ficam no log como referência visual.
- **E2E de UI (Playwright):** validados banner por status, badges, **modal de preview** (diff + issues) e
  **modal de detalhe**. *(Esses dois scripts vivem em `tests/`, que — como `supabase/` — não é versionado
  pelo repo `WEBAPP/`.)*

---

## 12. Resumo executivo
- **3 status** (`ok`/`parcial`/`erro`) + camada de `issues` detalhada (erros/alertas/infos com código).
- **§3** define exatamente o caminho para cada status.
- **§5–7** mapeiam todos os erros, alertas e infos com código estável.
- **§8** lista as 5 decisões de política (P-1 e P-3 são as críticas).
- **§9** entrega em 5 fases incrementais; **§10** dá a matriz de testes 1:1 com os códigos.
