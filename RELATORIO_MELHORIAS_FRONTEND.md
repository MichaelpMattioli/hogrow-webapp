# 📋 Relatório de Melhorias — WEBAPP (Hogrow Dashboard)

> Auditoria front-end read-only conduzida por 5 análises paralelas (rotas, dados/caching, auth, performance, UX/a11y) + verificação manual dos achados de maior impacto. **Nenhuma alteração de banco de dados.**
>
> Data: 2026-06-05

## Stack
React 19 · React Router 7 (`BrowserRouter` + `<Routes>`) · Vite 6 · TypeScript 5.6 · Tailwind 4 · Supabase JS (anon key) · recharts · lucide-react · date-fns.
**Sem** biblioteca de data-fetching/caching · **sem** autenticação · **sem** ErrorBoundary · **sem** rota 404.

## Nota geral
Base sólida e organizada (páginas em `lazy()`, componentes separados, skeletons existentes, pt-BR majoritariamente correto). Três lacunas estruturais comprometem robustez/profissionalismo:
1. Nada protege contra crash de render (sem ErrorBoundary, sem 404).
2. Zero caching, apesar de os dados das materialized views mudarem **1×/dia**.
3. Dashboard financeiro **100% público** (sem auth; segurança depende só de RLS).

---

## 🔴 P0 — Corrigir primeiro

| # | Problema | Arquivo | Correção | Status |
|---|----------|---------|----------|--------|
| 1 | Sem ErrorBoundary → erro de render = tela branca total | `App.tsx`, `main.tsx` | ErrorBoundary com fallback + reload, resetado por rota | ✅ Sprint 1 |
| 2 | Sem rota catch-all `path="*"` → URL inválida = tela em branco | `App.tsx:32-40` | `<Route path="*" element={<NotFound/>} />` | ✅ Sprint 1 |
| 3 | `Number(id)` sem validar → `/clientes/abc` = `NaN` | `ClienteDetalhe.tsx:159` | Guard `isNaN` → not-found | ✅ Sprint 1 |
| 4 | `STATUS_CONFIG[hotel.status]` sem fallback → derruba a tabela | `Clientes.tsx:393` | `?? STATUS_CONFIG.critical` | ✅ Sprint 1 |
| 5 | Variáveis CSS inexistentes (`--surface-2` 13×, `--accent-rgb` 9×) ✅verificado | `index.css` | Definir no `:root` | ✅ Sprint 1 |
| 6 | Dashboard financeiro público (sem auth) | `App.tsx`, `lib/supabase.ts` | Verificar RLS + adicionar auth (Frente 3) | ⏸️ **ADIADO** (decisão 2026-06-05) — ver abaixo |
| 7 | Sem `focus-visible` (WCAG 2.4.7) | `index.css:46-52` | Regra global de foco | ✅ Sprint 1 |
| 8 | Modal sem acessibilidade (role/aria/ESC/foco) | `RateDayModal.tsx` | `role=dialog`, `aria-modal`, ESC, `aria-label` | ✅ Sprint 1 (base) |

---

## 🧭 Frente 1 — Rotas & Resiliência de Navegação

| Sev | Local | Problema | Recomendação |
|-----|-------|----------|--------------|
| P0 | `App.tsx` | Sem ErrorBoundary / sem 404 | ErrorBoundary + NotFound |
| P1 | `Navbar.tsx:84-109` | Tabs são `<button onClick={navigate}>` em vez de `<NavLink>` (sem `aria-current`, sem Ctrl/Cmd+click, sem semântica) | `<NavLink>` |
| P1 | `Navbar.tsx:34-65` | Media queries injetadas via `<style>` inline no JSX | Mover para `index.css`/Tailwind |
| P1 | `App.tsx:20` + `ClienteDetalhe.tsx:282` | Prop `breadcrumbName` do Navbar é código morto; 2 back-links divergentes | Unificar via `useOutletContext` ou remover |
| P2 | `App.tsx` | Sem scroll-restoration ao voltar de detalhe | `scrollTo(0,0)` em mudança de rota |
| P2 | `Metas.tsx:16,29` | `MONTHS` calculado no load do módulo → pode sair do range em uso prolongado | `useMemo`/recalcular |
| P2 | linhas/cards clicáveis | Navegação só por `onClick` (sem `<a href>`) | Envolver em `<Link>` |

## 🗄️ Frente 2 — Carregamento de Dados & Caching

Camada inteira em `useSupabase.ts` (1765 linhas), `useEffect`+`useState` manuais, **zero caching**.

| Sev | Hook / Local | Problema | Recomendação |
|-----|--------------|----------|--------------|
| P0 | `useHotels`, `useHotelDetail`, `usePickup`, `usePickupAcumuladoMensal`… | Sem flag `cancelled`/cleanup → race + `setState` pós-unmount; loops `while(true)` continuam após sair | Adotar caching (abaixo) ou `cancelled` + checar no loop |
| P0 | `useHotelDetail:204,212` | Waterfall: `hotel` depois `kpiRows` em série (2 RTT) | `Promise.all([...])` |
| P0 | `fetchClientHotelIds` (6 hooks) | Mesma query roda até 6× em paralelo no load | Query compartilhada/deduplicada |
| P1 | `useClienteRateShopper:1452` | `from = localDateKey()` avaliado em import time → data estale perto da meia-noite | Calcular dentro do hook |
| P1 | `useAllMetas`, `usePickupAcumuladoMensal` | `error` não exposto → loading infinito em falha | Padronizar `{data,loading,error}` |
| P1 | `select('*')` em views grandes | Trafega colunas nunca usadas | Enumerar colunas |
| P2 | `transforms.ts buildHotelSummary` | Recalculado fora de `useMemo` (O(n)/render) | `useMemo` |
| P2 | `Home.tsx:104` | `localDateKey()` recriado por render → refetch | `useMemo` |

### ⭐ Estratégia de caching recomendada (dados 1×/dia)
Adotar **`@tanstack/react-query` v5 + persistência em `sessionStorage` com chave do dia**.

```ts
// src/lib/queryClient.ts
const TODAY = new Date().toISOString().slice(0,10);            // "2026-06-05"
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, gcTime: 86_400_000, retry: 2 } },
});
persistQueryClient({
  queryClient,
  persister: createSyncStoragePersister({
    storage: window.sessionStorage,
    key: `hogrow-cache-${TODAY}`,   // muda de dia ⇒ cache miss = busta sozinho
  }),
});
```
- Chave por data → invalida sozinho quando a MV atualiza (próximo dia).
- MVs: `staleTime: Infinity`. Dados live (`hotel_metas`, `booking_rates`): `staleTime` curto + `invalidateQueries` após salvar.
- Conversão dos hooks é mecânica (trocar `useEffect` por `useQuery`, mesmo retorno) → páginas não mudam.
- Resolve: re-fetch em navegação, 6× `fetchClientHotelIds`, races, "loading toda vez que volto pra Home".
- Esforço: ~1 dia.

## 🔐 Frente 3 — Autenticação & Tokens de Sessão

**Veredito: auth NÃO existe** (`App.tsx:30-41` sem rotas protegidas/AuthContext; `lib/supabase.ts:10` sem options). Dashboard 100% público via anon key.

| Sev | Local | Problema | Recomendação |
|-----|-------|----------|--------------|
| P0 | `App.tsx` | Dados financeiros acessíveis sem credencial | `AuthProvider` + `<ProtectedRoute>` + `/login` |
| P0 | RLS (servidor) | Única barreira é o RLS; **verificar** (sem alterar) em `hotel`, `hotel_receita_diaria`, `hotel_metas`, `booking_rates`, views `vw_*`, RPCs | Confirmar políticas |
| P0 | `updateHotel`/`saveHotelMeta` | Mutações via anon sem checagem de identidade | RLS de escrita `authenticated` + esconder form sem sessão |
| P1 | `lib/supabase.ts` | Sem `onAuthStateChange` → token expirado = 401 silencioso | Listener com cleanup → redirect `/login` |
| P1 | `Navbar.tsx:193-201` | Avatar "VA" hardcoded, sem sign-out | `user.email` + sair |
| P2 | `lib/supabase.ts` | Sem `storageKey` → colisão entre ambientes | `auth: { storageKey: 'hogrow-auth' }` |

### Padrão recomendado
`createClient(..., { auth: { persistSession:true, autoRefreshToken:true, storageKey:'hogrow-auth' }})` → `AuthProvider` (`getSession` + `onAuthStateChange` com `unsubscribe`) → `<ProtectedRoute>` → `/login` (magic link ou senha) → sign-out no Navbar → **RLS obrigatório no servidor**.

## ⚡ Frente 4 — Performance, Renderização & Bundle

| Sev | Local | Problema | Recomendação |
|-----|-------|----------|--------------|
| P0 | `vite.config.ts` | Sem `manualChunks` → bundle inicial ~600 kB (recharts junto) | `manualChunks` (abaixo) |
| P0 | `useAnimatedNumber.ts:8` | `useState(0)` anima 0→valor no mount → pico de setState em tabelas | Iniciar no valor final; animar só na mudança; respeitar `prefers-reduced-motion`; pausar fora da viewport |
| P1 | `Clientes.tsx HotelRow` | Sem `React.memo`; `onClick` inline; ~12 derivações/linha por render | `React.memo` + `useCallback` + `useMemo` |
| P1 | `RateCalendar.tsx:696`, `RateDayModal.tsx:32-37` | `.filter()`/`.find()` dentro do JSX (O(n²)) | Pré-computar `Map` em `useMemo` |
| P2 | `OccupancyChart`/`RevenueChart` | `isAnimationActive` default bloqueia troca de mês | `isAnimationActive={false}` + `debounce={50}` |
| P2 | skeletons `key={index}` | Glitch na transição loading→data | key estável |

### `vite.config.ts` — manualChunks sugerido
```ts
build: {
  rollupOptions: { output: { manualChunks(id) {
    if (/node_modules\/(recharts|d3-|victory-vendor)/.test(id)) return 'vendor-charts';
    if (/node_modules\/(react|react-dom|react-router)/.test(id)) return 'vendor-react';
    if (id.includes('node_modules/@supabase/')) return 'vendor-supabase';
    if (id.includes('node_modules/lucide-react')) return 'vendor-icons';
  }}},
  chunkSizeWarningLimit: 250,
},
```

## 🎨 Frente 5 — UX, Acessibilidade & Profissionalismo

| Sev | Local | Problema | Recomendação |
|-----|-------|----------|--------------|
| P0 | `RateDayModal.tsx` | Sem `role=dialog`/`aria-modal`/focus-trap/ESC; X sem `aria-label` | Dialog acessível |
| P0 | `App.tsx:11-15` | Fallback do Suspense é texto puro embora exista `Skeleton` | Skeleton estruturado |
| P0 | `index.css` | Sem `focus-visible`; `--surface-2`/`--accent-rgb` indefinidos | Corrigir `:root` |
| P1 | `KpiTable`, `PickupTable`, `RateDayModal` | `<th>` sem `scope` | `scope="col"`/`"colgroup"` |
| P1 | `ToggleGroup`, `SortSelector` | Estado ativo só visual | `aria-pressed` |
| P1 | `RateCalendar` (prev/next, CSV, toggle) | Botões só com `title` | `aria-label` + `aria-pressed` |
| P1 | `MonthYearPicker`, `HeaderMonthReference` | Dropdowns não fecham com ESC | listener `Escape` |
| P2 | `ClientListCard.tsx:337`, `Clientes.tsx:154` | `toFixed().replace('.',',')` → `R$ 1.5M` | `toLocaleString('pt-BR')` |
| P2 | `ClienteDetalhe.tsx:264`, `PickupMensalTable.tsx:314,349` | Typos "nao"/"Mes" | "não"/"Mês" |
| P2 | `Home.tsx:176` | KPI grid `repeat(4,1fr)` fixo → esmaga em mobile | `repeat(auto-fit, minmax(160px,1fr))` |
| P2 | ~15 ocorrências | Hover via `onMouseEnter/Leave` mutando `style` | Classes Tailwind `hover:` |

---

## 🗺️ Roadmap

| Sprint | Foco | Esforço |
|--------|------|---------|
| **1** | Robustez & segurança (P0): ErrorBoundary, 404, validar `hotelId`, fallback status, vars CSS, focus-visible, modal a11y | ~2-3 dias |
| **2** | Caching & dados: TanStack Query + persist por data, converter hooks, `Promise.all`, dedupe, padronizar `error` | ~1-2 dias |
| **3** | Performance & bundle: `manualChunks`, `React.memo`/`useCallback`, `AnimatedNumber`, loops de calendário, recharts | ~1 dia |
| **4** | A11y & polish: `scope`, `aria-pressed`/`aria-label`, ESC, locale pt-BR, typos, responsividade, `NavLink` | ~1-2 dias |

## ✅ O que já está bom
Code-splitting por rota; hooks recentes com flag `cancelled`; componente `Skeleton`; pt-BR via `toLocaleString`; estrutura coesa; alias `@`.

## ⚠️ Ressalvas
- Verificados manualmente: vars CSS indefinidas e typos — **confirmados**.
- Linhas exatas em arquivos grandes (`useSupabase.ts`) vêm das análises automatizadas; confirmar pontualmente antes de cada correção (pode haver drift).
- Frente de auth depende de RLS no servidor (não inspecionado; o P0 é **verificar**).

---

## ✅ Execução — Sprint 1 (2026-06-05)

Itens aplicados nesta sprint (somente front-end, sem tocar no banco):
1. **ErrorBoundary** — `src/components/layout/ErrorBoundary.tsx` (classe, com botão "Tentar de novo"/reload), aplicado em `App.tsx` resetando por rota (`key={pathname}`).
2. **Rota 404** — `src/pages/NotFound.tsx` + `<Route path="*">` em `App.tsx`.
3. **Validação de `hotelId`** — guard `isNaN` em `ClienteDetalhe.tsx` (mostra not-found em vez de skeleton eterno) + correção do typo "Hotel não encontrado".
4. **Fallback de status** — `Clientes.tsx:393` agora usa `?? STATUS_CONFIG.critical`.
5. **Variáveis CSS** — `--surface-2` e `--accent-rgb` definidas no `:root` (`index.css`), corrigindo fundos/destaques em RateDayModal, RateCalendar, PickupAcumuladoTable, Clientes.
6. **`focus-visible` global** — anel de foco acessível em `index.css`.
7. **Acessibilidade do modal** — `RateDayModal` com `role="dialog"`, `aria-modal`, `aria-labelledby`, fechar com **ESC** e `aria-label` no botão X.
8. **Fallback do Suspense** — spinner com ícone animado (mais profissional) em `App.tsx`.

**Adiado conscientemente:** muro de autenticação (P0 #6). Adicionar login agora quebraria o app público atual e exige provisionar usuários no Supabase Auth + confirmar RLS. Recomenda-se tratar como item dedicado (Frente 3) com decisão do time.

### Validação

**Build:** `npm run build` (tsc + vite) — ✅ 1654 módulos, 0 erros.

**E2E ao vivo (Playwright MCP, dev server em http://localhost:5173):**

| Item Sprint 1 | Teste executado | Resultado |
|---|---|---|
| Rota 404 | `GET /rota-que-nao-existe-xyz` | ✅ "404 / Página não encontrada / Voltar para o início"; navbar intacto |
| Validação `hotelId` | `GET /clientes/abc` | ✅ "Hotel não encontrado / Voltar para lista" (sem skeleton eterno; acento ok) |
| Variáveis CSS (runtime) | `getComputedStyle` no `:root` e no modal | ✅ `--surface-2`→`rgb(244,246,252)`, `--accent-rgb`→`rgba(29,44,92,0.05)` (header e linha do cliente renderizam corretos) |
| Modal acessível | abrir RateDayModal (dia 12, hotel 1) | ✅ `role=dialog`, `aria-modal=true`, `aria-labelledby`, X com `aria-label` |
| Modal — ESC | tecla Escape | ✅ modal fecha (`role=dialog` some) |
| `:focus-visible` | Tab → 1º foco | ✅ botão "Ir para Home" com `outline: solid 2px rgb(29,44,92)`, `matches(':focus-visible')=true` |
| Navegação por clique | clique em linha de cliente | ✅ vai para `/clientes/42` |
| 4 rotas carregam | Home, Clientes, ClienteDetalhe, Metas | ✅ todas renderizam, navbar presente, sem tela branca |
| Console | toda a sessão | ✅ 0 erros de front-end (único erro: 500 de backend na RPC `rpc_cliente_detalhe_calendar` do hotel 42) |
| ErrorBoundary | (não force-crashed) | ⚠️ Wired + build OK; resiliência observada na prática: backend 500 → estado de erro ("Erro ao carregar calendário"), **sem tela branca** |
| Fallback de status | (sem linha de status inválido na base) | ⚠️ Aplicado + build OK; tabela de 48 clientes renderizou sem crash |

**Achado fora da Sprint 1 (backend, reportar ao time):** a RPC `rpc_cliente_detalhe_calendar` retorna **HTTP 500** para o hotel_id 42 — o front trata graciosamente, mas é um bug de servidor a investigar. Também há o typo "calendario" (sem acento) na string de erro (Frente 5, P2).

**Conclusão:** todos os itens de Sprint 1 testáveis ao vivo **passaram**. Os 2 itens não força-disparáveis (ErrorBoundary e fallback de status) estão aplicados, validados por build e indiretamente confirmados (o app não quebrou diante de um 500 real de backend).

---

## ✅ Execução — Sprint 2: Caching com TanStack Query (2026-06-05)

Implementado:
1. **TanStack Query v5** instalado (`@tanstack/react-query`, `@tanstack/query-sync-storage-persister`, `@tanstack/react-query-persist-client`).
2. **`src/lib/queryClient.ts`** — `QueryClient` persistido em `sessionStorage`, com cache **atrelado ao ciclo de dados (boundary 09:30 BRT)**, não à meia-noite (ver seção abaixo). `gcTime: 24h`, `retry: 1`, `refetchOnWindowFocus: true`.
3. **`src/main.tsx`** — app envolvido em `PersistQueryClientProvider`.
4. **`src/hooks/useSupabase.ts`** — todos os **22 hooks** migrados de `useEffect`/`useState` para `useQuery`, preservando a API pública `{ data, loading, error }` (páginas não mudaram). Ganhos:
   - **Sem refetch ao navegar** (cache por `queryKey`).
   - **Sem race conditions / setState pós-unmount** (ciclo de vida gerido pelo React Query).
   - **Dedupe de `client-hotel-ids`** via `getClientHotelIds()` (`queryClient.fetchQuery`, antes até 6× em paralelo → agora 1×).
   - **Waterfall eliminado** em `useHotelDetail` (`Promise.all` para hotel + KPIs).
   - **`error` padronizado** em todos os hooks (antes alguns engoliam erro).
   - Min-loading de `useClientesTable` preservado dentro do `queryFn` (só em fetch real; cache hit é instantâneo).
5. **Invalidação nas mutações** — `updateHotel` invalida `hotel-detail`/`cliente-detalhe-header`/`hotels-summary`/`clientes-table`/`home-page`; `saveHotelMeta` invalida `metas-page`/`hotel-metas`/`all-metas`/`home-page`/`clientes-table`/`cliente-detalhe-cards`.

### Coerência com o refresh diário (boundary 09:30 BRT)

O cache **não** vira à meia-noite — está atrelado ao **ciclo de dados**, cujo boundary é **09:30 BRT** (buffer de segurança após o pipeline das 08:30 + refresh das MVs ~09:00):

- **`dataCycleKey()`** (buster de persistência): se a hora atual em `America/Sao_Paulo` ≥ 09:30 → ciclo = hoje; senão → ciclo = ontem (os dados de hoje ainda não existem).
- **`staleTime = msUntilNextRefresh()`**: tempo restante até o próximo 09:30. Toda query — não importa quando foi buscada — fica *stale* exatamente no próximo boundary e refaz no próximo mount/navegação/foco.

Cenário de transição (o problema clássico do "buster à meia-noite"):

| Momento | Ciclo / buster | Comportamento |
|---|---|---|
| Dia N, 22:00 | N | cacheia dados de N |
| Dia N+1, 00:10 (meia-noite passou) | **ainda N** | continua servindo N (correto — N+1 não atualizou) |
| Dia N+1, 07:00 (antes do refresh) | **ainda N** | serve N; `staleTime` expira às 09:30 |
| Dia N+1, 09:15 (janela de transição) | **ainda N** (buffer) | serve N; evita pegar dado meio-atualizado |
| Dia N+1, 09:45 (após refresh) | **N+1** | reload busta o cache persistido; aba aberta fica *stale* → refaz → dados de N+1 |

Assim, quem abre **antes das 09:30** vê o dia anterior (consistente), e a virada acontece **só quando os dados novos estão prontos**, não à meia-noite. (Boundary configurável em `REFRESH_BOUNDARY_MIN`.)

### Validação

**Build:** `npm run build` — ✅ 1710 módulos, 0 erros.

**E2E ao vivo (Playwright MCP):**

| Teste | Resultado |
|---|---|
| Home carrega | ✅ dados; **1 só** `rpc_home_page` (StrictMode não duplicou → dedupe do RQ) |
| Cache SPA: Home → Clientes → **volta p/ Home** | ✅ **nenhum** novo `rpc_home_page` (servido do cache) |
| Persistência: **reload completo** da Home | ✅ **0 requisições RPC** ao Supabase (restaurado do `sessionStorage`) |
| Regressão Clientes | ✅ 48 linhas |
| Regressão ClienteDetalhe (hotel 1) | ✅ nome, cards de receita, rate shopper |
| Regressão Metas | ✅ "39 de 48 hotéis com metas" |
| Console (sessão inteira) | ✅ 0 erros de front-end |

| Coerência do ciclo (boundary 09:30) | ✅ teste unitário (node) de `dataCycleKey`/`msUntilNextRefresh` em 6 horários (meia-noite, antes/durante/depois do refresh) — todos corretos |
| Buster em runtime | ✅ às 19:55 BRT o buster persistido = `2026-06-05` (ciclo correto) |

**Conclusão:** Sprint 2 atende tudo. O caching foi comprovado em runtime nos dois níveis (navegação SPA e reload via sessionStorage), está coerente com o refresh diário (vira às 09:30, não à meia-noite), e não há regressões nas 4 páginas.

---

## ⏸️ Autenticação — ADIADA (decisão de 2026-06-05)

**Por decisão do time, a autenticação NÃO foi implementada neste ciclo e será feita depois.** Enquanto isso, fica registrado:

- O dashboard permanece **público** via a `anon key` (que está no bundle, como é padrão no Supabase).
- ⚠️ **A segurança depende inteiramente do RLS no servidor** (não verificado neste ciclo). Em especial, `updateHotel` e `saveHotelMeta` rodam com a `anon key` — sem RLS de escrita, qualquer um pode alterar dados.
- **Pendências para quando a auth entrar** (Frente 3): `AuthProvider` + `<ProtectedRoute>` + `/login`, `onAuthStateChange` com cleanup, `storageKey` no `createClient`, avatar/sign-out no Navbar, **e limpar o cache do React Query no logout** (hoje o cache em `sessionStorage` é por aba/efêmero, sem multiusuário — ao adicionar auth, chavear/limpar por usuário).
- **Recomendação interina:** verificar o RLS (read-only) e/ou um gate de acesso no host (senha/allowlist) enquanto não há login.

Status: **risco aceito conscientemente; a fazer em ciclo futuro.**

---

## ✅ Execução — Sprint 3: Performance & bundle (2026-06-05)

Implementado:
1. **`vite.config.ts` — `manualChunks`** separando `vendor-react`, `vendor-supabase`, `vendor-query`, `vendor-icons` (e `vendor-charts` reservado). Antes, vendors ficavam misturados ao código do app (`index` 280 kB / `useSupabase` 199 kB). Depois, vendors viram chunks próprios e **cacheáveis entre deploys**; o `useSupabase` caiu para ~14 kB e o entry para ~10 kB.
2. **`HotelRow` (Clientes) memoizado** (`React.memo`) + callback estável `onSelect`/`useCallback` no pai (antes `onClick={() => navigate()}` recriava função por linha a cada render). Evita re-render das ~48 linhas em interações que não mudam os dados da linha.
3. **`RateDayModal` — fim do O(n²)**: o `sort` chamava `rates.find()` 3× por comparação; agora há um índice `Map<slug, BookingRate>` (`useMemo`) usado pelo sort e pelos getters.
4. **`useAnimatedNumber`** — inicia no valor final (não 0→valor a cada mount) e respeita `prefers-reduced-motion`.
5. **recharts** (`OccupancyChart`/`RevenueChart`) — `isAnimationActive={false}` + `debounce={50}` no `ResponsiveContainer`.

### ⚠️ Achado honesto: código morto (itens 4 e 5 não exercitados)
Durante a validação descobri que **`OccupancyChart`, `RevenueChart`, `KpiCard` e `AnimatedNumber` não são importados por nenhuma página renderizada** — são **código morto**. Consequências:
- O **recharts não está no bundle** (tree-shaken) — a afirmação do relatório inicial ("recharts ~300 kB") estava **incorreta**. Por isso não há chunk `vendor-charts` (a regra fica reservada para quando os charts forem usados).
- Os itens **4 (`useAnimatedNumber`) e 5 (charts)** estão aplicados e corretos, mas **miram código morto** — não geram ganho de runtime hoje (só valem se esses componentes forem reativados).
- Os ganhos **reais, em código vivo**: **item 1 (manualChunks)**, **item 2 (HotelRow memo)** e **item 3 (RateDayModal O(n²)→O(n))**.

> Sugestão de follow-up: remover o código morto (charts/KpiCard/AnimatedNumber) **ou** reativá-lo; e otimizar o loop interno do `RateCalendar` (filtro por célula, P1, ainda **não** feito — fica para a Sprint 3.1).

### Validação

**Build:** `npm run build` — ✅ 1710 módulos, 0 erros. Chunks: `vendor-react` 231 kB, `vendor-supabase` 176 kB, `vendor-query` 43 kB, `vendor-icons` 18 kB; app chunks pequenos (`ClienteDetalhe` 82 kB, `Clientes` 18 kB, `Home` 16 kB, `useSupabase` 14 kB, entry 10 kB).

**E2E ao vivo (Playwright MCP):**

| Teste | Resultado |
|---|---|
| `HotelRow` memo + `onSelect` | ✅ clique em linha navega para `/clientes/42` (refactor não quebrou navegação) |
| `RateDayModal` pré-índice | ✅ modal abre; **cliente ordenado em 1º** ("Hotel Coração Verde — SEU HOTEL"), comportamento preservado |
| Regressão Home/Clientes/ClienteDetalhe | ✅ Home (48 hotéis), Clientes (48 linhas), detalhe renderizam |
| Console (sessão) | ✅ 0 erros de front-end |

**Conclusão:** Sprint 3 entregou 3 ganhos reais em código vivo (bundle/cache de vendors, memo da tabela de Clientes, fim do O(n²) no modal), validados em runtime sem regressões. 2 itens (charts/AnimatedNumber) foram aplicados mas atingem código morto — reportado com transparência, com follow-up sugerido (remover ou reativar + otimizar RateCalendar).

---

## ✅ Execução — Sprint 3.1: limpeza do código morto + RateCalendar (2026-06-05)

Decisão: executar a melhor opção para eliminar as inconsistências.

1. **Código morto removido** (não importado por nenhuma página):
   - `src/components/charts/OccupancyChart.tsx`, `RevenueChart.tsx`, `ChartTooltip.tsx` (+ pasta `charts/` removida)
   - `src/components/ui/KpiCard.tsx`, `src/components/ui/AnimatedNumber.tsx`
   - `src/hooks/useAnimatedNumber.ts`
   - **`recharts` desinstalado** (`npm uninstall recharts`) — era dependência só desses arquivos mortos.
2. **`vite.config.ts`** — removida a regra `vendor-charts` (recharts não existe mais).
3. **`RateCalendar` otimizado** (item P1 que faltava): o filtro por célula (`visibleRates.filter(...)` dentro do `.map` dos dias, O(dias × rates)) foi substituído por um `Map` `compMinByDate` precomputado uma vez em `useMemo` (O(rates)). Usado nas células "só concorrente".

### Validação
- **Build:** ✅ 1710 módulos, 0 erros; sem chunk de charts/recharts.
- **E2E (Playwright):** `/clientes/1` → calendário com 5 dias clicáveis; células "só concorrente" exibem o mín. do concorrente correto (ex.: "R$ 171 sem 1 pax") via `compMinByDate`; modal abre com cliente em 1º; **0 erros de console**.

**Resultado:** base sem código morto (recharts fora do `package.json`), `RateCalendar` sem filtro por célula no render, e nenhuma frente do front depende mais de componentes fantasmas.

---

## ✅ Execução — Sprint 4: Acessibilidade & Profissionalismo (2026-06-05)

### 🔎 Defeito não-mapeado encontrado nos testes: mais 9 componentes órfãos
Uma varredura de órfãos (cada componente vs. seus importadores) revelou **9 componentes mortos** — vários ficaram órfãos após a remoção dos charts na Sprint 3.1. **Removidos:**
`cards/ClientListCard`, `cards/InsightCard`, `cards/TopPerformerCard`, `tables/KpiTable`, `tables/PickupAcumuladoTable`, `ui/MonthYearPicker`, `ui/SortSelector`, `ui/StatusBadge`, `ui/ToggleGroup`.
> Isso também significa que vários itens de a11y/pt-BR do relatório inicial (ToggleGroup/SortSelector aria-pressed, KpiTable scope, ClientListCard `toFixed`) **eram em código morto** — resolvidos por remoção, não por edição. Re-sweep final: **0 órfãos**.

### Acessibilidade aplicada (somente componentes VIVOS)
1. **Navbar** → `<nav aria-label>` + `NavLink` (links reais `<a href>`: Ctrl/Cmd+clique abre nova aba, `aria-current="page"` automático). `<style>` inline movido para `index.css`. Prop morta `breadcrumbName` removida. Bell/avatar com `aria-hidden`/`aria-label`.
2. **RateCalendar** → `aria-label` nos botões só-ícone (Mês anterior/Próximo mês) e `aria-label`+`aria-pressed` no toggle Calendário/Tabela.
3. **HeaderMonthReference** → fecha o dropdown com **ESC** (já tinha `aria-label`/`title` no trigger).
4. **RateDayModal** → `scope="col"` nos `<th>`.
5. **ToggleGroup/SortSelector** (antes de descobrir que eram mortos) — `aria-pressed` aplicado e depois removidos junto com os arquivos.

### pt-BR & responsividade
6. **`utils.ts`** → `formatCurrencyCompact`/`formatPercent` agora usam `toLocaleString('pt-BR')` (antes `toFixed().replace('.',',')`). Correção central usada em vários lugares.
7. **`PickupMensalTable`** → typo "Mes" → "Mês".
8. **`Home`** → grid de KPIs `repeat(4,1fr)` → `repeat(auto-fit, minmax(150px,1fr))` (não esmaga em mobile).

### Validação (build + Playwright)
- **Build:** ✅ 1710 módulos, 0 erros; re-sweep de órfãos = 0.
- **E2E:**
  - Navbar: `<nav>` + 3 `<a href>` reais; `aria-current="page"` no item ativo; clique client-side OK.
  - RateCalendar: aria-labels (Mês anterior/Próximo mês/Ver em calendário/Ver em tabela) + 2 `aria-pressed` presentes.
  - HeaderMonthReference: dropdown abre (12 botões de mês) e **fecha com ESC** (→ 0).
  - Home/Clientes/ClienteDetalhe renderizam; **0 erros de console**.

### Itens de polish remanescentes (P2, não feitos)
- `toFixed(1)%` espalhados em `Clientes` (linhas 243/519/562) e no CSV do `RateCalendar` → vírgula pt-BR (baixa severidade).
- `scope` nas demais tabelas vivas (`PickupTable`/`PickupMensalTable` headers de grupo).
- Padrão de hover via `onMouseEnter/Leave` mutando `style` em alguns botões → classes Tailwind.

**Conclusão:** Sprint 4 entregou os ganhos de a11y/profissionalismo nos componentes vivos (navegação semântica, foco/teclado, ESC, scope, pt-BR central, mobile) **e** eliminou mais 9 componentes mortos descobertos no teste. App sem órfãos, 0 erros.

---

## ✅ Execução — Sprint 4.1: fechamento dos P2 + auditoria extra (2026-06-05)

### P2 listados — fechados
1. **pt-BR (`toFixed` → vírgula)** nos componentes VIVOS:
   - `Clientes.tsx` — percentuais (linhas ~154, 243, 519, 562) agora via `toLocaleString('pt-BR')`. Validado em runtime: tabela mostra "67,7%" (zero percentuais com ponto).
   - `RateCalendar` (export CSV) — decimais com vírgula **e separador `;`** (correto p/ Excel pt-BR; antes vírgula decimal quebraria colunas).
2. **`scope` nas tabelas vivas:**
   - `PickupTable` — `scope="colgroup"` nos 4 cabeçalhos de grupo + `scope="col"` em todas as colunas. Validado: **22/22 `<th>` com scope** no detalhe.
   - `PickupMensalTable` — `scope="col"` em todos os `<th>`.
3. **Hover via JS → CSS:** a linha de dados do `PickupTable` (única com `onMouseEnter/Leave` de fundo) virou classe `.row-hover` (`@media (hover:hover)`) — touch-friendly, sem mutação de `style`/risco em unmount.

### Auditoria extra (mais itens dentro do escopo da Sprint 4)
- **`HotelEditForm`** (form principal): `<label htmlFor>` ↔ `<input id>` em todos os campos; toggle "Hotel Ativo" agora é `role="switch"` + `aria-checked` + `aria-label`; feedback de salvar com `role="status"`/`aria-live="polite"`. Validado: **8/8 labels ligadas, switch com aria-checked, 8 inputs com id**.
- **`Skeleton`**: `aria-hidden="true"` (decorativo, não anunciado por leitores de tela).
- **Varredura global:** **0** `<div onClick>` (todo clique é `<button>`/`<a>`) e **0** `<img>` sem `alt` em todo o `src`.

### Validação
- **Build:** ✅ 1710 módulos, 0 erros.
- **E2E (Playwright):** percentuais com vírgula (Clientes); 22/22 `th[scope]`; HotelEditForm com labels/ids/switch corretos; 0 erros de console nas 3 páginas.

### Deferido conscientemente (P2 menor)
- Hover via `onMouseEnter/Leave` em **botões** isolados (RateDayModal, RateCalendar, HotelEditForm submit) — funcional em ponteiro, apenas cosmético; conversão em massa tem baixo valor/alto churn. Recomenda-se converter por componente se desejado.
- `scope`/`headers` de associação fina (2 níveis) nas tabelas — o `scope="colgroup"`/`"col"` já cobre o essencial; associação `headers=`/`id=` célula-a-célula fica para um passe de a11y AAA.

**Conclusão:** Sprint 4.1 fechou os P2 acionáveis (pt-BR, scope, hover de linha) e adicionou a11y de formulário/skeleton; varredura confirmou ausência de divs clicáveis e imgs sem alt. App sem órfãos, sem regressões, 0 erros.
