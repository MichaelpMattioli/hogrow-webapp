# Supabase RPC Map

Documento para registrar as RPCs/views dedicadas por tela antes de implementar no frontend.

Objetivo: cada tela deve ter uma fonte de dados clara, com contrato estavel, menor payload possivel e sem duplicar consultas no cliente.

## Convencoes

- Nome: `rpc_<tela>_<acao>` para funcoes chamadas pelo frontend.
- Views auxiliares podem usar `vw_<dominio>_<finalidade>`.
- Toda RPC deve documentar parametros, colunas retornadas, tabelas/views usadas e indices esperados.
- Preferir `security invoker` para respeitar RLS do Supabase.
- Evitar `select *` nos hooks; buscar apenas as colunas usadas pela UI.
- Retornos devem usar nomes em snake_case vindos do banco; o hook converte para camelCase.

## Mapa Inicial

| Tela | RPC/View | Status | Motivo |
| --- | --- | --- | --- |
| Metas (`/metas`) | `public.rpc_metas_page(p_mes_ano text)` | Implementada localmente | Carregar hoteis clientes e metas do mes em uma unica chamada leve. |
| Home (`/`) | `public.rpc_home_page(p_mes_ano text, p_data_extracao date)` | Implementada localmente | Carregar KPIs do portfolio, alertas de pick-up de hoje e atingimento de metas em uma unica chamada. |
| Clientes (`/clientes`) | `public.rpc_clientes_calendar(p_mes_ano text, p_data_extracao date)` + `public.rpc_clientes_table(p_mes_ano text, p_data_extracao date)` + `public.mv_clientes_reference_calendar` | Implementada no frontend e Supabase | Separar calendario leve da tabela de clientes, usando apenas datas reais de extracao e os meses disponiveis em cada visao. |
| Detalhamento Cliente (`/clientes/:id`) | `rpc_cliente_detalhe_header`, `rpc_cliente_detalhe_calendar`, `rpc_cliente_detalhe_cards`, `rpc_cliente_pickup_diario`, `rpc_cliente_pickup_mensal`, `rpc_cliente_rate_shopper` + MVs nao-shopper | Implementada com calendario de visao de extracao | Separar header/calendario/cards/pick-up, mantendo mes de referencia e data de extracao sincronizados entre topo e pick-up diario. Shopper permanece live. |

## Template Para Novas Telas

```md
### <Tela>

- Rota:
- Hook frontend:
- RPC/View:
- Parametros:
- Retorno:
- Tabelas/views base:
- Indices necessarios:
- Estrategia de cache:
- Observacoes de seguranca/RLS:
```

## RPC Proposta: Metas

### Contexto

A tela `src/pages/Metas.tsx` hoje carrega:

- `useHotels()`: busca ids de hoteis clientes e depois `vw_hotel_summary`.
- `useHotelMetas(mesAno)`: busca ids de hoteis clientes novamente e depois `hotel_metas`.

Para essa tela, `vw_hotel_summary` e pesada demais. A UI precisa somente de identificacao do hotel e metas do mes selecionado.

### Contrato

Nome:

```sql
public.rpc_metas_page(p_mes_ano text)
```

Parametro:

| Parametro | Tipo | Exemplo | Uso |
| --- | --- | --- | --- |
| `p_mes_ano` | `text` | `2026-05` | Mes de referencia das metas. |

Retorno:

| Coluna | Tipo sugerido | Uso no frontend |
| --- | --- | --- |
| `hotel_id` | `bigint` | `hotel.id` |
| `hotel_nome` | `text` | Nome exibido na lista |
| `cidade` | `text` | Subtitulo |
| `estado` | `text` | Subtitulo |
| `total_uhs` | `integer` | Subtitulo |
| `meta_id` | `bigint` | Id da linha em `hotel_metas`, quando existir |
| `mes_ano` | `text` | Referencia retornada |
| `receita_meta` | `numeric` | Campo Receita |
| `occ_meta` | `numeric` | Campo Ocupacao |
| `dm_meta` | `numeric` | Campo Diaria Media |
| `revpar_meta` | `numeric` | Campo RevPAR, mantido por compatibilidade |
| `meta_updated_at` | `timestamptz` | Auditoria/estado futuro |

### SQL Inicial

```sql
create or replace function public.rpc_metas_page(p_mes_ano text)
returns table (
  hotel_id bigint,
  hotel_nome text,
  cidade text,
  estado text,
  total_uhs integer,
  meta_id bigint,
  mes_ano text,
  receita_meta numeric,
  occ_meta numeric,
  dm_meta numeric,
  revpar_meta numeric,
  meta_updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    h.id::bigint as hotel_id,
    h.nome_fantasia::text as hotel_nome,
    h.cidade::text as cidade,
    h.estado::text as estado,
    h.total_uhs::integer as total_uhs,
    hm.id::bigint as meta_id,
    coalesce(hm.mes_ano, p_mes_ano)::text as mes_ano,
    hm.receita_meta::numeric as receita_meta,
    hm.occ_meta::numeric as occ_meta,
    hm.dm_meta::numeric as dm_meta,
    hm.revpar_meta::numeric as revpar_meta,
    hm.updated_at as meta_updated_at
  from public.hotel h
  left join public.hotel_metas hm
    on hm.hotel_id = h.id
   and hm.mes_ano = p_mes_ano
  where h.tipo::text = 'cliente'
    and h.ativo = true
  order by h.nome_fantasia;
$$;

grant execute on function public.rpc_metas_page(text) to anon, authenticated;
```

### Indices Recomendados

```sql
create unique index if not exists hotel_metas_hotel_mes_key
  on public.hotel_metas (hotel_id, mes_ano);

create index if not exists idx_hotel_metas_mes_hotel
  on public.hotel_metas (mes_ano, hotel_id);

create index if not exists idx_hotel_tipo_ativo_nome
  on public.hotel (tipo, ativo, nome_fantasia);
```

Observacao: se ja existir constraint unica equivalente em `hotel_metas (hotel_id, mes_ano)`, nao duplicar o indice.

### Hook Frontend Sugerido

```ts
export interface MetasPageRow {
  hotelId: number;
  hotelNome: string;
  cidade: string | null;
  estado: string | null;
  totalUhs: number;
  metaId: number | null;
  mesAno: string;
  receitaMeta: number | null;
  occMeta: number | null;
  dmMeta: number | null;
  revparMeta: number | null;
  metaUpdatedAt: string | null;
}

export async function fetchMetasPage(mesAno: string): Promise<MetasPageRow[]> {
  const { data, error } = await supabase.rpc('rpc_metas_page', {
    p_mes_ano: mesAno,
  });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map(row => ({
    hotelId: row.hotel_id as number,
    hotelNome: row.hotel_nome as string,
    cidade: row.cidade as string | null,
    estado: row.estado as string | null,
    totalUhs: row.total_uhs as number,
    metaId: row.meta_id as number | null,
    mesAno: row.mes_ano as string,
    receitaMeta: row.receita_meta as number | null,
    occMeta: row.occ_meta as number | null,
    dmMeta: row.dm_meta as number | null,
    revparMeta: row.revpar_meta as number | null,
    metaUpdatedAt: row.meta_updated_at as string | null,
  }));
}
```

### Uso Esperado Na Tela

- Substituir `useHotels()` + `useHotelMetas(mesAno)` por `useMetasPage(mesAno)`.
- Manter cache por `mesAno` no hook para navegacao entre meses.
- Ao salvar uma meta, atualizar apenas a linha alterada no estado local.
- Futuro: criar `rpc_upsert_hotel_meta` para retornar a linha salva e evitar `reload()` completo.

### Ganho Esperado

- Reduz de duas consultas com dependencias duplicadas para uma consulta.
- Evita carregar `vw_hotel_summary`, que agrega KPIs desnecessarios para a tela.
- Diminui payload e tempo de parse no navegador.
- Simplifica a regra de join entre hoteis clientes e metas.

## RPC Proposta: Home

### Contexto

A tela `src/pages/Home.tsx` hoje carrega:

- `useHotels()`: usa `vw_hotel_summary` para montar os KPIs do hero e fornecer nome/localizacao dos hoteis.
- `useHotelMetas(currentMonth)`: busca metas do mes atual para o card de atingimento.
- `useTodayPickupAlerts()`: busca `vw_pickup_diario` para a data de hoje e agrega alteracoes por hotel.

Isso gera chamadas separadas e repete a busca de ids de hoteis clientes. A Home tambem cruza os mesmos hoteis em dois cards.

### Informacoes Da Tela

Hero:

| Informacao | Origem atual | Uso |
| --- | --- | --- |
| Total de hoteis | `hotels.length` | Card "Hoteis gerenciados" |
| Receita total do periodo | Soma de `totalReceita` em `HotelSummary` | Card "Receita total" |
| OCC medio | Media de `avgOcc` | Card "OCC medio" |
| RevPAR medio | Media de `avgRevpar` | Card "RevPAR medio" |

Alertas de pick-up hoje:

| Informacao | Origem atual | Uso |
| --- | --- | --- |
| Hotel | `vw_hotel_summary` + `vw_pickup_diario.hotel_id` | Nome, busca e clique |
| Data de extracao | `vw_pickup_diario.data_extracao` | Alerta do dia |
| Quantidade de alteracoes | Contagem de linhas com pickup alterado | Badge/ordenacao |
| Pickup UHs | Soma de `pu_tt_uh` | Badge de impacto |
| Pickup Receita | Soma de `pu_rec_hosp` | Badge de impacto |
| Referencias alteradas | Datas distintas de `data_referencia` | Texto "ref. dd/mm-dd/mm" |

Atingimento de metas:

| Informacao | Origem atual | Uso |
| --- | --- | --- |
| Receita atual | `receita_mes_atual` | Percentual vs meta |
| Ocupacao atual | `occ_mes_atual` | Percentual vs meta |
| Diaria media atual | `dm_mes_atual` ou fallback por receita/ocupados | Percentual vs meta |
| Metas | `hotel_metas` para `mes_ano` atual | Receita, ocupacao e diaria media |
| Localizacao | Cidade/estado do hotel | Subtitulo |

### Contrato

Nome:

```sql
public.rpc_home_page(p_mes_ano text default null, p_data_extracao date default null)
```

Parametros:

| Parametro | Tipo | Default sugerido | Uso |
| --- | --- | --- | --- |
| `p_mes_ano` | `text` | `to_char(current_date, 'YYYY-MM')` | Mes de referencia das metas. |
| `p_data_extracao` | `date` | `current_date` | Data usada para alertas de pick-up hoje. |

Retorno: uma linha por hotel cliente ativo.

| Coluna | Tipo sugerido | Uso no frontend |
| --- | --- | --- |
| `hotel_id` | `bigint` | Navegacao para detalhe |
| `hotel_nome` | `text` | Alertas e metas |
| `cidade` | `text` | Subtitulo |
| `estado` | `text` | Subtitulo |
| `total_uhs` | `integer` | Contexto futuro |
| `receita_periodo` | `numeric` | Hero: soma da receita |
| `occ_atual` | `numeric` | Hero e metas |
| `revpar_atual` | `numeric` | Hero |
| `dm_atual` | `numeric` | Metas |
| `receita_mes_atual` | `numeric` | Metas |
| `meta_id` | `bigint` | Auditoria/edicao futura |
| `receita_meta` | `numeric` | Meta receita |
| `occ_meta` | `numeric` | Meta ocupacao |
| `dm_meta` | `numeric` | Meta diaria media |
| `receita_meta_pct` | `numeric` | Atingimento receita |
| `occ_meta_pct` | `numeric` | Atingimento ocupacao |
| `dm_meta_pct` | `numeric` | Atingimento diaria media |
| `goal_score` | `numeric` | Ordenacao do card de metas |
| `pickup_data_extracao` | `date` | Data do alerta |
| `pickup_alteracoes` | `integer` | Quantidade de alteracoes |
| `pickup_uhs` | `numeric` | Impacto UHs |
| `pickup_receita` | `numeric` | Impacto receita |
| `pickup_referencias` | `date[]` | Datas alteradas |

### SQL Inicial

Esta versao usa `vw_hotel_summary` como fonte dos KPIs atuais porque ela ja existe. Se a Home continuar lenta, o proximo passo e criar uma view/materialized view especifica para estes campos.

Implementacao local:

- [`../../supabase/migrations/20260526172000_create_rpc_home_page.sql`](../../supabase/migrations/20260526172000_create_rpc_home_page.sql)
- [`../../supabase/migrations/20260526173500_optimize_rpc_home_page.sql`](../../supabase/migrations/20260526173500_optimize_rpc_home_page.sql)

```sql
create or replace function public.rpc_home_page(
  p_mes_ano text default null,
  p_data_extracao date default null
)
returns table (
  hotel_id bigint,
  hotel_nome text,
  cidade text,
  estado text,
  total_uhs integer,
  receita_periodo numeric,
  occ_atual numeric,
  revpar_atual numeric,
  dm_atual numeric,
  receita_mes_atual numeric,
  meta_id bigint,
  receita_meta numeric,
  occ_meta numeric,
  dm_meta numeric,
  receita_meta_pct numeric,
  occ_meta_pct numeric,
  dm_meta_pct numeric,
  goal_score numeric,
  pickup_data_extracao date,
  pickup_alteracoes integer,
  pickup_uhs numeric,
  pickup_receita numeric,
  pickup_referencias date[]
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      coalesce(p_mes_ano, to_char(current_date, 'YYYY-MM')) as mes_ano,
      coalesce(p_data_extracao, current_date)::date as data_extracao
  ),
  pickup_today as (
    select
      p.hotel_id,
      max(p.data_extracao::date) as pickup_data_extracao,
      count(*)::integer as pickup_alteracoes,
      coalesce(sum(coalesce(nullif(p.pu_tt_uh::text, '')::numeric, 0)), 0) as pickup_uhs,
      coalesce(sum(coalesce(nullif(p.pu_rec_hosp::text, '')::numeric, 0)), 0) as pickup_receita,
      array_agg(distinct p.data_referencia::date order by p.data_referencia::date) as pickup_referencias
    from public.vw_pickup_diario p
    cross join params prm
    where p.data_extracao::date = prm.data_extracao
      and p.data_extracao_ant is not null
      and to_char(p.data_extracao::date, 'YYYY-MM') <= to_char(p.data_referencia::date, 'YYYY-MM')
      and (
        coalesce(nullif(p.pu_tt_uh::text, '')::numeric, 0) <> 0
        or coalesce(nullif(p.pu_rec_hosp::text, '')::numeric, 0) <> 0
        or coalesce(nullif(p.pu_dm_tt::text, '')::numeric, 0) <> 0
        or coalesce(nullif(p.pu_occ_tt::text, '')::numeric, 0) <> 0
        or coalesce(nullif(p.pu_revpar_tt::text, '')::numeric, 0) <> 0
      )
    group by p.hotel_id
  ),
  base as (
    select
      h.id,
      s.nome_fantasia,
      s.cidade,
      s.estado,
      s.total_uhs,
      s.receita_ytd,
      s.occ_mes_atual,
      s.revpar_mes_atual,
      s.dm_mes_atual,
      s.receita_mes_atual
    from public.hotel h
    join public.vw_hotel_summary s on s.id = h.id
    where h.tipo::text = 'cliente'
      and h.ativo = true
  )
  select
    b.id::bigint as hotel_id,
    b.nome_fantasia::text as hotel_nome,
    b.cidade::text as cidade,
    b.estado::text as estado,
    b.total_uhs::integer as total_uhs,
    coalesce(b.receita_ytd, 0)::numeric as receita_periodo,
    coalesce(b.occ_mes_atual, 0)::numeric as occ_atual,
    coalesce(b.revpar_mes_atual, 0)::numeric as revpar_atual,
    b.dm_mes_atual::numeric as dm_atual,
    coalesce(b.receita_mes_atual, 0)::numeric as receita_mes_atual,
    hm.id::bigint as meta_id,
    hm.receita_meta::numeric as receita_meta,
    hm.occ_meta::numeric as occ_meta,
    hm.dm_meta::numeric as dm_meta,
    case
      when hm.receita_meta is not null and hm.receita_meta <> 0
        then round((coalesce(b.receita_mes_atual, 0) / hm.receita_meta) * 100, 2)
      else null
    end::numeric as receita_meta_pct,
    case
      when hm.occ_meta is not null and hm.occ_meta <> 0
        then round((coalesce(b.occ_mes_atual, 0) / hm.occ_meta) * 100, 2)
      else null
    end::numeric as occ_meta_pct,
    case
      when hm.dm_meta is not null and hm.dm_meta <> 0 and b.dm_mes_atual is not null
        then round((b.dm_mes_atual / hm.dm_meta) * 100, 2)
      else null
    end::numeric as dm_meta_pct,
    least(
      case when hm.receita_meta is not null and hm.receita_meta <> 0 then round((coalesce(b.receita_mes_atual, 0) / hm.receita_meta) * 100, 2) else null end,
      case when hm.occ_meta is not null and hm.occ_meta <> 0 then round((coalesce(b.occ_mes_atual, 0) / hm.occ_meta) * 100, 2) else null end,
      case when hm.dm_meta is not null and hm.dm_meta <> 0 and b.dm_mes_atual is not null then round((b.dm_mes_atual / hm.dm_meta) * 100, 2) else null end
    )::numeric as goal_score,
    pt.pickup_data_extracao,
    coalesce(pt.pickup_alteracoes, 0)::integer as pickup_alteracoes,
    coalesce(pt.pickup_uhs, 0)::numeric as pickup_uhs,
    coalesce(pt.pickup_receita, 0)::numeric as pickup_receita,
    coalesce(pt.pickup_referencias, array[]::date[]) as pickup_referencias
  from base b
  cross join params prm
  left join public.hotel_metas hm
    on hm.hotel_id = b.id
   and hm.mes_ano = prm.mes_ano
  left join pickup_today pt on pt.hotel_id = b.id
  order by b.nome_fantasia;
$$;

grant execute on function public.rpc_home_page(text, date) to anon, authenticated;
```

### Indices Recomendados

```sql
create index if not exists idx_hotel_tipo_ativo_nome
  on public.hotel (tipo, ativo, nome_fantasia);

create index if not exists idx_hotel_metas_mes_hotel
  on public.hotel_metas (mes_ano, hotel_id);
```

Para o pickup, o indice deve ficar na tabela base que alimenta `vw_pickup_diario`, nao na view comum:

```sql
-- Ajustar o nome da tabela base conforme o schema real.
create index if not exists idx_pickup_base_extracao_hotel_ref
  on public.<pickup_base_table> (data_extracao, hotel_id, data_referencia);
```

Se `vw_pickup_diario` continuar custosa, considerar uma view/materialized view agregada por `data_extracao + hotel_id`.

### Hook Frontend Sugerido

```ts
export interface HomePageRow {
  hotelId: number;
  hotelNome: string;
  cidade: string | null;
  estado: string | null;
  totalUhs: number;
  receitaPeriodo: number;
  occAtual: number;
  revparAtual: number;
  dmAtual: number | null;
  receitaMesAtual: number;
  metaId: number | null;
  receitaMeta: number | null;
  occMeta: number | null;
  dmMeta: number | null;
  receitaMetaPct: number | null;
  occMetaPct: number | null;
  dmMetaPct: number | null;
  goalScore: number | null;
  pickupDataExtracao: string | null;
  pickupAlteracoes: number;
  pickupUhs: number;
  pickupReceita: number;
  pickupReferencias: string[];
}

export async function fetchHomePage(mesAno: string, dataExtracao: string): Promise<HomePageRow[]> {
  const { data, error } = await supabase.rpc('rpc_home_page', {
    p_mes_ano: mesAno,
    p_data_extracao: dataExtracao,
  });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map(row => ({
    hotelId: row.hotel_id as number,
    hotelNome: row.hotel_nome as string,
    cidade: row.cidade as string | null,
    estado: row.estado as string | null,
    totalUhs: row.total_uhs as number,
    receitaPeriodo: row.receita_periodo as number,
    occAtual: row.occ_atual as number,
    revparAtual: row.revpar_atual as number,
    dmAtual: row.dm_atual as number | null,
    receitaMesAtual: row.receita_mes_atual as number,
    metaId: row.meta_id as number | null,
    receitaMeta: row.receita_meta as number | null,
    occMeta: row.occ_meta as number | null,
    dmMeta: row.dm_meta as number | null,
    receitaMetaPct: row.receita_meta_pct as number | null,
    occMetaPct: row.occ_meta_pct as number | null,
    dmMetaPct: row.dm_meta_pct as number | null,
    goalScore: row.goal_score as number | null,
    pickupDataExtracao: row.pickup_data_extracao as string | null,
    pickupAlteracoes: row.pickup_alteracoes as number,
    pickupUhs: row.pickup_uhs as number,
    pickupReceita: row.pickup_receita as number,
    pickupReferencias: (row.pickup_referencias as string[] | null) ?? [],
  }));
}
```

### Uso Esperado Na Tela

- Substituir `useHotels()`, `useHotelMetas(currentMonth)` e `useTodayPickupAlerts()` por `useHomePage(currentMonth, today)`.
- Hero:
  - `totalHotels`: quantidade de linhas.
  - `totalReceita`: soma de `receitaPeriodo`.
  - `avgOcc`: media de `occAtual`.
  - `avgRevpar`: media de `revparAtual`.
- Alertas:
  - Filtrar `pickupAlteracoes > 0`.
  - Ordenar localmente por alteracoes, `abs(pickupUhs)` ou `abs(pickupReceita)`.
  - Busca local por `hotelNome`.
- Metas:
  - Filtrar linhas com pelo menos uma meta cadastrada.
  - Ordenar por `goalScore`, mantendo os menores atingimentos primeiro.

### Ganho Esperado

- Reduz tres carregamentos independentes para uma RPC.
- Remove chamadas duplicadas para buscar ids de hoteis clientes.
- Evita transportar todos os campos de `HotelSummary` para a Home.
- Mantem filtros de busca/ordenacao no frontend, sem novas consultas.

## RPC Proposta: Clientes

### Contexto

A tela `src/pages/Clientes.tsx` hoje carrega:

- `useHotels()`: busca ids de hoteis clientes e depois `vw_hotel_summary`.
- `useHotelsMonthly()`: busca todo o historico mensal em `vw_hotel_monthly_kpis` para todos os hoteis clientes.
- `useHotelMetas(selectedMonth)`: busca metas do mes selecionado.
- `useAllMetas()`: busca todas as metas para somar meta acumulada do ano.

O frontend entao cruza tudo em memoria para montar a linha do hotel, calcular MoM, YoY, YTD, meta acumulada, delta anual, meses disponiveis, status e ordenacao.

### Informacoes Da Tela

Cabecalho:

| Informacao | Origem atual | Uso |
| --- | --- | --- |
| Quantidade de hoteis | `hotels.length` | Subtitulo da pagina |
| Mes selecionado | Estado local + `HeaderMonthReference` | Referencia da tabela |
| Meses disponiveis | `vw_hotel_monthly_kpis.mes_ano` + mes atual | Navegacao de referencia |
| Busca `q` | Query string | Filtro local por hotel/cidade/estado |

Tabela:

| Coluna | Dado necessario | Calculo atual |
| --- | --- | --- |
| Propriedade | Nome, cidade, estado, UHs, status | `HotelSummary` + `deriveStatus(occ)` |
| Meta mes | `hotel_metas.receita_meta` do mes selecionado | `metaMap` |
| Real mes | Receita do mes selecionado | `MonthlyKpi.receita` ou fallback do resumo atual |
| Delta Real vs Meta | `real / meta * 100` | Calculado no row |
| MoM | Real mes vs mes anterior | `(receita - receita_mes_anterior)` e `%` |
| YoY | Real mes vs mesmo mes do ano anterior | `(receita - receita_ano_anterior)` e `%` |
| Meta acumulada | Soma de `receita_meta` do ano ate o mes selecionado | `useAllMetas()` |
| Real acumulado | Soma de receita mensal do ano ate o mes selecionado | `vw_hotel_monthly_kpis` ou fallback YTD |
| Delta acumulado | Real acumulado - meta acumulada | Calculado no row |

Ordenacao atual:

| SortCol | Dado usado |
| --- | --- |
| `nome` | Nome do hotel |
| `meta` | Meta de receita do mes |
| `receita` | Receita real do mes |
| `metaPct` | Percentual real/meta |
| `mom` | Percentual MoM |
| `yoy` | Percentual YoY |
| `metaYtd` | Meta acumulada |
| `ytd` | Real acumulado |
| `deltaYtd` | Delta acumulado |

### Contrato

Nome:

```sql
public.rpc_clientes_page(p_mes_ano text default null)
```

Parametro:

| Parametro | Tipo | Default sugerido | Uso |
| --- | --- | --- | --- |
| `p_mes_ano` | `text` | `to_char(current_date, 'YYYY-MM')` | Mes de referencia da tabela. |

Retorno: uma linha por hotel cliente ativo.

| Coluna | Tipo sugerido | Uso no frontend |
| --- | --- | --- |
| `hotel_id` | `bigint` | Navegacao e key |
| `hotel_nome` | `text` | Propriedade, busca e ordenacao |
| `cidade` | `text` | Subtitulo e busca |
| `estado` | `text` | Subtitulo e busca |
| `total_uhs` | `integer` | Subtitulo |
| `status` | `text` | Cor/legenda da linha |
| `available_months` | `text[]` | Seletor de mes |
| `selected_mes_ano` | `text` | Mes efetivamente retornado |
| `receita_meta` | `numeric` | Meta mes |
| `receita_real` | `numeric` | Real mes |
| `receita_meta_pct` | `numeric` | Delta Real vs Meta |
| `receita_mes_anterior` | `numeric` | Base MoM |
| `receita_mom_abs` | `numeric` | MoM valor |
| `receita_mom_pct` | `numeric` | MoM percentual |
| `receita_ano_anterior` | `numeric` | Base YoY |
| `receita_yoy_abs` | `numeric` | YoY valor |
| `receita_yoy_pct` | `numeric` | YoY percentual |
| `receita_meta_ytd` | `numeric` | Meta acumulada |
| `receita_real_ytd` | `numeric` | Real acumulado |
| `receita_delta_ytd` | `numeric` | Delta acumulado |
| `occ_referencia` | `numeric` | Derivar/confirmar status |
| `dm_referencia` | `numeric` | Campo futuro se a lista expandir |
| `revpar_referencia` | `numeric` | Campo futuro se a lista expandir |

### SQL Inicial

Atualizacao de performance em 2026-05-27: a implementacao ativa passou a consultar `public.mv_pickup_mensal_kpis`, materializada a partir de `public.vw_pickup_mensal_kpis`. O contrato da RPC nao muda. A MV evita que o PostgREST recalcule a view mensal em chamadas concorrentes da aba Clientes e deve ser atualizada apos cargas/ETLs que alterem `hotel_receita_diaria` ou as fontes de pick-up.

Esta v1 usa `vw_hotel_monthly_kpis` para o mes de referencia, mes anterior, mesmo mes do ano anterior e YTD. Para o mes atual sem linha mensal, faz fallback em `vw_hotel_summary`, preservando o comportamento atual da tela.

```sql
create or replace function public.rpc_clientes_page(p_mes_ano text default null)
returns table (
  hotel_id bigint,
  hotel_nome text,
  cidade text,
  estado text,
  total_uhs integer,
  status text,
  available_months text[],
  selected_mes_ano text,
  receita_meta numeric,
  receita_real numeric,
  receita_meta_pct numeric,
  receita_mes_anterior numeric,
  receita_mom_abs numeric,
  receita_mom_pct numeric,
  receita_ano_anterior numeric,
  receita_yoy_abs numeric,
  receita_yoy_pct numeric,
  receita_meta_ytd numeric,
  receita_real_ytd numeric,
  receita_delta_ytd numeric,
  occ_referencia numeric,
  dm_referencia numeric,
  revpar_referencia numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      coalesce(p_mes_ano, to_char(current_date, 'YYYY-MM')) as mes_ano,
      to_char(current_date, 'YYYY-MM') as current_mes_ano
  ),
  months as (
    select array_agg(distinct mes_ano order by mes_ano) as available_months
    from (
      select mes_ano from public.vw_hotel_monthly_kpis
      union
      select to_char(current_date, 'YYYY-MM')
    ) m
  ),
  client_hotels as (
    select
      h.id,
      h.nome_fantasia,
      h.cidade,
      h.estado,
      h.total_uhs
    from public.hotel h
    where h.tipo::text = 'cliente'
      and h.ativo = true
  ),
  selected_month as (
    select
      ch.id as hotel_id,
      mk.receita,
      mk.rec_diarias,
      mk.occ,
      mk.dm,
      mk.revpar,
      mk.ocupados,
      mk.hospedes,
      mk.dias
    from client_hotels ch
    cross join params prm
    left join public.vw_hotel_monthly_kpis mk
      on mk.hotel_id = ch.id
     and mk.mes_ano = prm.mes_ano
  ),
  previous_month as (
    select
      ch.id as hotel_id,
      mk.receita
    from client_hotels ch
    cross join params prm
    left join public.vw_hotel_monthly_kpis mk
      on mk.hotel_id = ch.id
     and mk.mes_ano = to_char((prm.mes_ano || '-01')::date - interval '1 month', 'YYYY-MM')
  ),
  previous_year as (
    select
      ch.id as hotel_id,
      mk.receita
    from client_hotels ch
    cross join params prm
    left join public.vw_hotel_monthly_kpis mk
      on mk.hotel_id = ch.id
     and mk.mes_ano = to_char((prm.mes_ano || '-01')::date - interval '1 year', 'YYYY-MM')
  ),
  ytd as (
    select
      mk.hotel_id,
      coalesce(sum(mk.receita), 0)::numeric as receita_real_ytd,
      coalesce(sum(mk.ocupados), 0)::numeric as ocupados_ytd,
      coalesce(sum(mk.hospedes), 0)::numeric as hospedes_ytd,
      coalesce(sum(mk.dias), 0)::numeric as dias_ytd
    from public.vw_hotel_monthly_kpis mk
    cross join params prm
    where mk.mes_ano >= left(prm.mes_ano, 4) || '-01'
      and mk.mes_ano <= prm.mes_ano
    group by mk.hotel_id
  ),
  meta_ytd as (
    select
      hm.hotel_id,
      sum(hm.receita_meta) filter (where hm.receita_meta is not null)::numeric as receita_meta_ytd
    from public.hotel_metas hm
    cross join params prm
    where hm.mes_ano >= left(prm.mes_ano, 4) || '-01'
      and hm.mes_ano <= prm.mes_ano
    group by hm.hotel_id
  ),
  base as (
    select
      ch.id,
      ch.nome_fantasia,
      ch.cidade,
      ch.estado,
      ch.total_uhs,
      coalesce(sm.receita, case when prm.mes_ano = prm.current_mes_ano then hs.receita_mes_atual else 0 end, 0)::numeric as receita_real,
      coalesce(sm.occ, case when prm.mes_ano = prm.current_mes_ano then hs.occ_mes_atual else 0 end, 0)::numeric as occ_referencia,
      coalesce(sm.dm, case when prm.mes_ano = prm.current_mes_ano then hs.dm_mes_atual else null end)::numeric as dm_referencia,
      coalesce(sm.revpar, case when prm.mes_ano = prm.current_mes_ano then hs.revpar_mes_atual else 0 end, 0)::numeric as revpar_referencia,
      coalesce(pm.receita, case when prm.mes_ano = prm.current_mes_ano then hs.receita_mes_anterior else 0 end, 0)::numeric as receita_mes_anterior,
      coalesce(py.receita, case when prm.mes_ano = prm.current_mes_ano then hs.receita_ano_anterior else 0 end, 0)::numeric as receita_ano_anterior,
      case
        when prm.mes_ano = prm.current_mes_ano and sm.receita is null
          then coalesce(hs.receita_ytd, 0)
        else coalesce(ytd.receita_real_ytd, 0)
      end::numeric as receita_real_ytd
    from client_hotels ch
    cross join params prm
    left join selected_month sm on sm.hotel_id = ch.id
    left join previous_month pm on pm.hotel_id = ch.id
    left join previous_year py on py.hotel_id = ch.id
    left join ytd on ytd.hotel_id = ch.id
    left join public.vw_hotel_summary hs on hs.id = ch.id
  )
  select
    b.id::bigint as hotel_id,
    b.nome_fantasia::text as hotel_nome,
    b.cidade::text as cidade,
    b.estado::text as estado,
    b.total_uhs::integer as total_uhs,
    case
      when b.occ_referencia < 25 then 'critical'
      when b.occ_referencia < 45 then 'warning'
      when b.occ_referencia < 70 then 'healthy'
      else 'excellent'
    end::text as status,
    coalesce(months.available_months, array[]::text[]) as available_months,
    prm.mes_ano::text as selected_mes_ano,
    hm.receita_meta::numeric as receita_meta,
    b.receita_real,
    case
      when hm.receita_meta is not null and hm.receita_meta <> 0
        then round((b.receita_real / hm.receita_meta) * 100, 2)
      else null
    end::numeric as receita_meta_pct,
    b.receita_mes_anterior,
    (b.receita_real - b.receita_mes_anterior)::numeric as receita_mom_abs,
    case
      when b.receita_mes_anterior <> 0
        then round(((b.receita_real - b.receita_mes_anterior) / abs(b.receita_mes_anterior)) * 100, 2)
      else null
    end::numeric as receita_mom_pct,
    b.receita_ano_anterior,
    (b.receita_real - b.receita_ano_anterior)::numeric as receita_yoy_abs,
    case
      when b.receita_ano_anterior <> 0
        then round(((b.receita_real - b.receita_ano_anterior) / abs(b.receita_ano_anterior)) * 100, 2)
      else null
    end::numeric as receita_yoy_pct,
    my.receita_meta_ytd,
    b.receita_real_ytd,
    case
      when my.receita_meta_ytd is not null
        then b.receita_real_ytd - my.receita_meta_ytd
      else null
    end::numeric as receita_delta_ytd,
    b.occ_referencia,
    b.dm_referencia,
    b.revpar_referencia
  from base b
  cross join params prm
  cross join months
  left join public.hotel_metas hm
    on hm.hotel_id = b.id
   and hm.mes_ano = prm.mes_ano
  left join meta_ytd my on my.hotel_id = b.id
  order by b.receita_real desc, b.nome_fantasia;
$$;

grant execute on function public.rpc_clientes_page(text) to anon, authenticated;
```

### Indices Recomendados

```sql
create index if not exists idx_hotel_tipo_ativo_nome
  on public.hotel (tipo, ativo, nome_fantasia);

create index if not exists idx_hotel_metas_mes_hotel
  on public.hotel_metas (mes_ano, hotel_id);

create index if not exists idx_hotel_metas_hotel_mes
  on public.hotel_metas (hotel_id, mes_ano);
```

Para a implementacao ativa da aba Clientes, os indices ficam na materialized view mensal:

```sql
create unique index if not exists mv_pickup_mensal_kpis_hotel_mes_key
  on public.mv_pickup_mensal_kpis (hotel_id, mes_ano);

create index if not exists idx_mv_pickup_mensal_kpis_mes_hotel
  on public.mv_pickup_mensal_kpis (mes_ano, hotel_id);
```

Apos carga de dados, refrescar a MV com `public.refresh_mv_pickup_mensal_kpis()` usando uma role de backend/servico. Historico: este contrato v1 usava `public.rpc_clientes_page`; a versao atual da aba Clientes usa `public.rpc_clientes_calendar` e `public.rpc_clientes_table`.

### Plano V2: Separar Calendario Da Tabela

Status: implementado na migration `20260529194500_split_clientes_calendar_and_table.sql`. A RPC legada `rpc_clientes_page` foi removida na migration `20260529201500_drop_legacy_clientes_page_rpc.sql`; o frontend usa somente `rpc_clientes_calendar` e `rpc_clientes_table`. A `rpc_clientes_table` foi ajustada na migration `20260529203000_rpc_clientes_table_trusts_resolved_selection.sql` para nao chamar o calendario internamente.

#### Diagnostico

A aba Clientes mistura dois conceitos que precisam ficar independentes:

| Conceito | Campo base | Semantica |
| --- | --- | --- |
| Dados do mes | `data_referencia` truncada para `YYYY-MM` | Mes visualizado na tabela. Pode conter historico, previsto, ou os dois. |
| Visao da extracao | `data_extracao` | Snapshot real capturado em uma data. Define como os meses eram vistos naquele dia. |

Exemplo esperado:

- Se o usuario escolhe a visao `2026-05-26`, ele pode navegar por todos os meses de referencia capturados nessa extracao, como `2026-05`, `2026-06` ou meses futuros.
- Se o usuario escolhe a visao `2026-05-01`, a navegacao de meses deve ficar limitada aos meses que existiam nessa extracao.
- Trocar o mes de referencia nao deve alterar automaticamente a data da visao, exceto quando a extracao escolhida nao contem aquele mes.

O contrato atual de `rpc_clientes_page(p_mes_ano, p_data_posicao)` consegue funcionar, mas obriga a RPC pesada da tabela a tambem resolver a navegacao do calendario. Isso aumenta payload, acoplamento e chance de regressao quando a UI so precisa saber quais meses e extracoes existem.

#### Proposta

Criar uma MV pequena, em grao normalizado `data_extracao + mes_ano`, para servir apenas o calendario da aba Clientes. A `data_extracao` precisa ser uma data real de captura, mas os meses disponiveis devem vir da visao mensal calculada naquela data (`data_posicao`), para permitir navegar tanto meses historicos quanto meses previstos sem reintroduzir datas geradas como `2026-05-28` e `2026-05-29`.

Nome sugerido:

```sql
public.mv_clientes_reference_calendar
```

Grao:

```text
1 linha por data_extracao real + mes_ano disponivel na visao mensal calculada para essa data
```

Campos sugeridos:

| Coluna | Tipo | Uso |
| --- | --- | --- |
| `data_extracao` | `date` | Data da visao selecionavel. |
| `mes_ano` | `text` | Mes de referencia disponivel nessa visao. |
| `mes_inicio` | `date` | Ordenacao e comparacoes. |
| `hoteis_count` | `integer` | Diagnostico/cobertura da extracao. |
| `referencias_count` | `integer` | Quantidade de datas de referencia cobertas. |
| `min_data_referencia` | `date` | Diagnostico de cobertura. |
| `max_data_referencia` | `date` | Diagnostico de cobertura. |

SQL base:

```sql
create materialized view public.mv_clientes_reference_calendar as
with real_extractions as (
  select distinct
    p.data_extracao::date as data_extracao
  from public.mv_cliente_pickup_diario p
  where p.data_extracao::date <= current_date
)
select
  e.data_extracao,
  k.mes_ano::text as mes_ano,
  k.mes_inicio::date as mes_inicio,
  count(distinct k.hotel_id)::integer as hoteis_count,
  coalesce(sum(k.dias), 0)::integer as referencias_count,
  k.mes_inicio::date as min_data_referencia,
  (k.mes_inicio + interval '1 month - 1 day')::date as max_data_referencia
from real_extractions e
join public.mv_clientes_page_position_kpis k
  on k.data_posicao = e.data_extracao
where k.data_posicao <= current_date
group by
  e.data_extracao,
  k.mes_ano,
  k.mes_inicio
with data;

create unique index mv_clientes_reference_calendar_key
  on public.mv_clientes_reference_calendar (data_extracao, mes_ano);

create index idx_mv_clientes_reference_calendar_mes_extracao
  on public.mv_clientes_reference_calendar (mes_ano, data_extracao);

create index idx_mv_clientes_reference_calendar_extracao_mes
  on public.mv_clientes_reference_calendar (data_extracao, mes_inicio);
```

#### RPC De Calendario

Nome sugerido:

```sql
public.rpc_clientes_calendar(
  p_mes_ano text default null,
  p_data_extracao date default null
)
```

Responsabilidade:

- Resolver a selecao default.
- Retornar meses disponiveis na visao calculada para a data de extracao selecionada, incluindo meses anteriores e posteriores ao mes atual quando existirem.
- Retornar datas de extracao disponiveis para o mes de referencia selecionado.
- Nao retornar metricas da tabela de clientes.

Contrato sugerido:

```sql
returns table (
  selected_mes_ano text,
  selected_data_extracao date,
  available_months text[],
  available_extraction_dates date[]
)
```

Regras:

1. Se `p_data_extracao` vier nulo, usar a maior `data_extracao <= current_date`.
2. Se `p_mes_ano` vier nulo, preferir `to_char(current_date, 'YYYY-MM')` se existir na extracao selecionada; caso contrario, usar o menor mes futuro da extracao; se nao houver futuro, usar o maior mes disponivel.
3. Se o usuario trocar `p_mes_ano`, manter `p_data_extracao` quando essa extracao contem o mes escolhido.
4. Se a extracao escolhida nao contem o mes escolhido, escolher a maior extracao que contenha o mes e seja menor ou igual a `p_data_extracao`; se nao houver, usar a maior extracao disponivel para o mes.

#### RPC Da Tabela

Nome sugerido:

```sql
public.rpc_clientes_table(
  p_mes_ano text,
  p_data_extracao date
)
```

Responsabilidade:

- Receber uma selecao ja resolvida pela RPC de calendario.
- Retornar somente as linhas da tabela de clientes.
- Nao retornar `available_months` nem `available_position_dates`.
- Nao chamar `rpc_clientes_calendar` internamente; fallback e resolucao pertencem ao calendario.

Retorno sugerido:

| Coluna | Uso |
| --- | --- |
| `hotel_id`, `hotel_nome`, `cidade`, `estado`, `total_uhs`, `status` | Identidade e status |
| `selected_mes_ano`, `selected_data_extracao` | Eco da selecao aplicada |
| `receita_meta`, `receita_real`, `receita_meta_pct` | Meta vs real |
| `receita_mes_anterior`, `receita_mom_abs`, `receita_mom_pct` | MoM na mesma data de extracao |
| `receita_ano_anterior`, `receita_yoy_abs`, `receita_yoy_pct` | YoY na mesma data de extracao |
| `receita_meta_ytd`, `receita_real_ytd`, `receita_delta_ytd` | Acumulado ate o mes selecionado na mesma data de extracao |
| `occ_referencia`, `dm_referencia`, `revpar_referencia` | KPIs do mes |

Regra importante: a mesma `p_data_extracao` deve ser usada para mes atual, mes anterior, YoY e YTD. A comparacao deve responder: "como esses meses estavam na visao capturada em X?", e nao "qual era a visao equivalente um mes/ano antes?".

#### Fluxo Frontend

1. Ao abrir `/clientes`, chamar `rpc_clientes_calendar(null, null)`.
2. Guardar `selected_mes_ano` e `selected_data_extracao` vindos da RPC de calendario.
3. Chamar `rpc_clientes_table(selected_mes_ano, selected_data_extracao)`.
4. Ao trocar a data em "Visao da extracao", chamar `rpc_clientes_calendar(selected_mes_ano, nova_data_extracao)` e depois `rpc_clientes_table`.
5. Ao trocar o mes em "Dados do mes", chamar `rpc_clientes_calendar(novo_mes_ano, selected_data_extracao)` e depois `rpc_clientes_table`.
6. O componente de calendario deve receber dois conjuntos separados:
   - `available_months`: meses disponiveis na extracao selecionada.
   - `available_extraction_dates`: extracoes reais que contem o mes selecionado.

#### Beneficios

- O calendario passa a ser barato e semanticamente explicito.
- A tabela deixa de carregar arrays repetidos em cada linha de hotel.
- Evita confundir `data_posicao` gerada por MV com `data_extracao` real.
- Facilita cache no frontend: calendario muda pouco e tabela muda por par `(mes_ano, data_extracao)`.
- Reduz risco de bugs de sincronizacao entre mes de referencia e visao da extracao.

#### Plano De Implementacao

1. Criar `mv_clientes_reference_calendar`.
2. Incluir a nova MV no refresh backend `refresh_cliente_detail_materialized_views()`.
3. Criar `rpc_clientes_calendar(p_mes_ano, p_data_extracao)`.
4. Criar `rpc_clientes_table(p_mes_ano, p_data_extracao)` copiando a parte de metricas da RPC atual e removendo os arrays de calendario.
5. Atualizar `useClientesPage` para dois hooks:
   - `useClientesCalendar(mesAno, dataExtracao)`
   - `useClientesTable(mesAno, dataExtracao)`
6. Ajustar `HeaderMonthReference` para tratar os dois seletores como independentes.
7. Validar cenarios:
   - `2026-05-26` permite navegar pelos meses historicos e previstos disponiveis na visao dessa data, incluindo `2026-04`, `2026-05` e `2026-06`.
   - `2026-05-01` permite apenas meses existentes na visao calculada para essa data real de extracao.
   - `2026-05-28` e `2026-05-29` nao aparecem se nao houver `data_extracao` real.
   - Trocar de `2026-05` para `2026-06` preserva `2026-05-26` quando a extracao contem ambos.
   - Trocar para um mes nao contido na extracao selecionada aplica fallback explicito pela RPC de calendario.

### Hook Frontend Sugerido

```ts
export interface ClientesCalendarState {
  selectedMesAno: string;
  selectedDataExtracao: string;
  availableMonths: string[];
  availableExtractionDates: string[];
}

export interface ClientesPageRow {
  hotelId: number;
  hotelNome: string;
  cidade: string | null;
  estado: string | null;
  totalUhs: number;
  status: 'excellent' | 'healthy' | 'warning' | 'critical';
  selectedMesAno: string;
  selectedDataExtracao: string;
  receitaMeta: number | null;
  receitaReal: number;
  receitaMetaPct: number | null;
  receitaMesAnterior: number;
  receitaMomAbs: number;
  receitaMomPct: number | null;
  receitaAnoAnterior: number;
  receitaYoyAbs: number;
  receitaYoyPct: number | null;
  receitaMetaYtd: number | null;
  receitaRealYtd: number;
  receitaDeltaYtd: number | null;
  occReferencia: number;
  dmReferencia: number | null;
  revparReferencia: number;
}

export async function fetchClientesCalendar(mesAno: string | null, dataExtracao: string | null): Promise<ClientesCalendarState | null> {
  const { data, error } = await supabase.rpc('rpc_clientes_calendar', {
    p_mes_ano: mesAno,
    p_data_extracao: dataExtracao,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    selectedMesAno: row.selected_mes_ano as string,
    selectedDataExtracao: row.selected_data_extracao as string,
    availableMonths: (row.available_months as string[] | null) ?? [],
    availableExtractionDates: (row.available_extraction_dates as string[] | null) ?? [],
  };
}

export async function fetchClientesTable(mesAno: string, dataExtracao: string): Promise<ClientesPageRow[]> {
  const { data, error } = await supabase.rpc('rpc_clientes_table', {
    p_mes_ano: mesAno,
    p_data_extracao: dataExtracao,
  });

  if (error) throw error;

  return ((data ?? []) as Record<string, unknown>[]).map(row => ({
    hotelId: row.hotel_id as number,
    hotelNome: row.hotel_nome as string,
    cidade: row.cidade as string | null,
    estado: row.estado as string | null,
    totalUhs: row.total_uhs as number,
    status: row.status as ClientesPageRow['status'],
    selectedMesAno: row.selected_mes_ano as string,
    selectedDataExtracao: row.selected_data_extracao as string,
    receitaMeta: row.receita_meta as number | null,
    receitaReal: row.receita_real as number,
    receitaMetaPct: row.receita_meta_pct as number | null,
    receitaMesAnterior: row.receita_mes_anterior as number,
    receitaMomAbs: row.receita_mom_abs as number,
    receitaMomPct: row.receita_mom_pct as number | null,
    receitaAnoAnterior: row.receita_ano_anterior as number,
    receitaYoyAbs: row.receita_yoy_abs as number,
    receitaYoyPct: row.receita_yoy_pct as number | null,
    receitaMetaYtd: row.receita_meta_ytd as number | null,
    receitaRealYtd: row.receita_real_ytd as number,
    receitaDeltaYtd: row.receita_delta_ytd as number | null,
    occReferencia: row.occ_referencia as number,
    dmReferencia: row.dm_referencia as number | null,
    revparReferencia: row.revpar_referencia as number,
  }));
}
```

### Uso Esperado Na Tela

- Substituir `useClientesPage(selectedMonth, selectedPosition)` por dois hooks: `useClientesCalendar(selectedMonth, selectedExtraction)` e `useClientesTable(calendar.selectedMesAno, calendar.selectedDataExtracao)`.
- `availableMonths` vem somente da RPC de calendario e representa meses disponiveis na visao da extracao selecionada.
- `availableExtractionDates` vem somente da RPC de calendario e representa datas reais de extracao que podem mostrar o mes selecionado.
- Busca continua local por `hotelNome`, `cidade` e `estado`.
- Ordenacao continua local usando os campos ja calculados pela RPC:
  - `meta`: `receitaMeta`
  - `receita`: `receitaReal`
  - `metaPct`: `receitaMetaPct`
  - `mom`: `receitaMomPct`
  - `yoy`: `receitaYoyPct`
  - `metaYtd`: `receitaMetaYtd`
  - `ytd`: `receitaRealYtd`
  - `deltaYtd`: `receitaDeltaYtd`
- A tela nao usa mais arrays repetidos em cada linha da tabela para controlar o calendario.

### Ganho Esperado

- Reduz o calendario para uma RPC leve e deixa a tabela em uma RPC focada nos dados dos clientes.
- Evita buscar todo o historico mensal quando a tela precisa somente do mes selecionado, mes anterior, YoY e YTD.
- Evita buscar todas as metas no cliente apenas para somar o acumulado do ano.
- Move agregacoes pesadas para o banco, onde indices e plano de execucao ajudam mais.
- Mantem busca, ordenacao e toggle inteiro/abreviado no frontend sem consultas adicionais.

## RPC Proposta: Detalhamento Cliente v2

### Contexto

A rota `src/pages/ClienteDetalhe.tsx` mistura quatro familias de dados:

- Header/formulario: cadastro basico de `hotel`.
- Cards: agregados do mes selecionado, YoY, YTD e metas.
- Pick-up: tabela diaria por mes de referencia e resumo mensal por ano.
- Rate shopper: tarifas por mes, usadas no calendario e como colunas auxiliares do pick-up diario.

A estrategia v2 separa a tela por modulos. O primeiro paint usa header e cards; pick-up e shopper carregam sob demanda quando a area esta visivel.

### Mapa Modular

Implementacao local:

- [`../../supabase/migrations/20260526180500_create_cliente_detalhe_module_rpcs.sql`](../../supabase/migrations/20260526180500_create_cliente_detalhe_module_rpcs.sql)
- [`../../supabase/migrations/20260526182000_fix_cliente_detalhe_cards_current_date.sql`](../../supabase/migrations/20260526182000_fix_cliente_detalhe_cards_current_date.sql)
- [`../../supabase/migrations/20260526183500_fix_rpc_cliente_pickup_diario_full_reference_month.sql`](../../supabase/migrations/20260526183500_fix_rpc_cliente_pickup_diario_full_reference_month.sql)
- [`../../supabase/migrations/20260527124500_materialize_cliente_detalhe_non_shopper.sql`](../../supabase/migrations/20260527124500_materialize_cliente_detalhe_non_shopper.sql)

| Modulo | RPC | Quando carregar | Motivo |
| --- | --- | --- | --- |
| Header | `public.rpc_cliente_detalhe_header(p_hotel_id bigint)` | Ao abrir a pagina | Le em `mv_cliente_detalhe_latest_daily` para identidade, ultimo snapshot e status. |
| Calendario | `public.rpc_cliente_detalhe_calendar(p_hotel_id bigint, p_mes_ano text, p_data_extracao date)` | Ao abrir e ao trocar mes/data | Resolve meses de referencia disponiveis na visao e datas reais de extracao disponiveis para o mes. |
| Cards | `public.rpc_cliente_detalhe_cards(p_hotel_id bigint, p_mes_ano text, p_data_extracao date)` | Ao abrir e ao trocar mes/data | Le em `mv_clientes_page_position_kpis` usando a mesma data de extracao selecionada. |
| Pick-up diario | `public.rpc_cliente_pickup_diario(p_hotel_id bigint, p_mes_ano text, p_data_extracao date)` | Ao abrir bloco de pick-up diario e ao trocar mes/data | Monta a visao diaria do mes na data de extracao selecionada, comparando contra a visao anterior. |
| Pick-up mensal | `public.rpc_cliente_pickup_mensal(p_hotel_id bigint, p_ano integer)` | Ao abrir visao mensal ou trocar ano | Le em `mv_pickup_mensal_kpis` e usa `mv_cliente_pickup_diario` para o contador de alteracoes diarias. |
| Shopper | `public.rpc_cliente_rate_shopper(p_hotel_id bigint, p_mes_ano text, p_from date, p_keep_latest boolean)` | Ao abrir calendario ou para meses do pick-up | Restringe tarifas por mes e opcionalmente mantem apenas a ultima coleta. |

### Materialized Views: Detalhamento Cliente

Atualizacao de performance em 2026-05-27: os modulos nao-shopper do detalhe passaram a usar materialized views. O contrato das RPCs nao muda.

| MV | Alimenta | Conteudo |
| --- | --- | --- |
| `public.mv_cliente_detalhe_latest_daily` | Header | Ultimo snapshot por hotel cliente e data de referencia. |
| `public.mv_cliente_pickup_diario` | Pick-up diario e contador mensal | Linhas comparaveis de pick-up diario por hotel, data de referencia e data de extracao. |
| `public.mv_cliente_detalhe_monthly_kpis` | Cards | KPIs mensais calculados a partir do ultimo snapshot comparavel de cada data de referencia. |
| `public.mv_pickup_mensal_kpis` | Pick-up mensal e Clientes | KPIs mensais de pick-up ja materializados para evitar recalculo de `vw_pickup_mensal_kpis`. |

O shopper nao foi materializado nesta etapa porque depende de coletas e filtros de disponibilidade/preco por `scraped_at`, `checkin_date` e `p_keep_latest`.

### Contrato: Header

Nome:

```sql
public.rpc_cliente_detalhe_header(p_hotel_id bigint)
```

Retorno: uma linha por hotel cliente.

| Coluna | Tipo sugerido | Uso |
| --- | --- | --- |
| `hotel_id` | `bigint` | Rota/key |
| `property_id` | `text` | Formulario |
| `tipo` | `text` | Deve ser `cliente` |
| `razao_social` | `text` | Formulario |
| `nome_fantasia` | `text` | Titulo |
| `cidade` | `text` | Subtitulo |
| `estado` | `text` | Subtitulo |
| `total_uhs` | `integer` | Header/formulario |
| `total_leitos` | `integer` | Formulario |
| `cadastur` | `text` | Formulario |
| `ativo` | `boolean` | Formulario |
| `created_at` | `timestamptz` | Auditoria |
| `updated_at` | `timestamptz` | Auditoria |
| `status` | `text` | Cor do header |
| `available_months` | `text[]` | Seletor de mes |
| `latest_date` | `date` | Ultima referencia |
| `latest_extracao` | `date` | Ultima extracao |
| `latest_ocupados` | `numeric` | Ocupacao atual |
| `latest_total_uhs` | `numeric` | Denominador do header |

### Contrato: Calendario

Nome:

```sql
public.rpc_cliente_detalhe_calendar(
  p_hotel_id bigint,
  p_mes_ano text default null,
  p_data_extracao date default null
)
```

Retorno: uma linha com a selecao resolvida.

| Coluna | Tipo sugerido | Uso |
| --- | --- | --- |
| `selected_mes_ano` | `text` | Mes de referencia aplicado |
| `selected_data_extracao` | `date` | Data real da visao de extracao aplicada |
| `available_months` | `text[]` | Meses disponiveis na visao selecionada |
| `available_extraction_dates` | `date[]` | Datas reais de extracao que contem o mes selecionado |

### Contrato: Cards

Nome:

```sql
public.rpc_cliente_detalhe_cards(
  p_hotel_id bigint,
  p_mes_ano text default null,
  p_data_extracao date default null
)
```

Retorno: uma linha por hotel/mes.

| Coluna | Tipo sugerido | Uso |
| --- | --- | --- |
| `hotel_id` | `bigint` | Key |
| `selected_mes_ano` | `text` | Mes aplicado |
| `selected_data_extracao` | `date` | Visao da extracao aplicada |
| `receita_atual`, `occ_atual`, `dm_atual`, `revpar_atual` | `numeric` | Cards principais |
| `room_nights_atual`, `hospedes_atual` | `numeric` | Cards secundarios |
| `receita_prev_year`, `occ_prev_year`, `dm_prev_year`, `revpar_prev_year` | `numeric` | Comparacao YoY |
| `room_nights_prev_year`, `hospedes_prev_year` | `numeric` | Comparacao YoY |
| `receita_ytd`, `occ_ytd`, `dm_ytd`, `revpar_ytd` | `numeric` | Comparacao YTD |
| `room_nights_ytd`, `hospedes_ytd` | `numeric` | Comparacao YTD |
| `receita_meta`, `occ_meta`, `dm_meta`, `revpar_meta` | `numeric` | Metas do mes |

### Contrato: Pick-up Diario

Nome:

```sql
public.rpc_cliente_pickup_diario(
  p_hotel_id bigint,
  p_mes_ano text,
  p_data_extracao date default null
)
```

Retorno: apenas as colunas usadas por `PickupTable`.

| Coluna | Tipo sugerido |
| --- | --- |
| `hotel_id` | `bigint` |
| `data_extracao`, `data_extracao_ant`, `data_referencia` | `date` |
| `pu_tt_uh` | `integer` |
| `pu_rec_hosp`, `pu_dm_tt`, `pu_occ_tt`, `pu_revpar_tt` | `numeric` |
| `tt_uhs_ocup` | `integer` |
| `rec_hosp`, `dm_cc_tt`, `occ_tt`, `revp_tt` | `numeric` |
| `tt_hosp`, `chds`, `uhs_disp`, `uhs` | `integer` |

Filtro esperado:

- `data_referencia` dentro de `p_mes_ano`.
- `data_extracao` e a data real da visao selecionada.
- Para cada diaria, usar o ultimo snapshot conhecido ate `p_data_extracao`.
- Calcular pick-up contra a visao de extracao imediatamente anterior do hotel.
- Ordenar por `data_referencia`.

### Contrato: Pick-up Mensal

Nome:

```sql
public.rpc_cliente_pickup_mensal(p_hotel_id bigint, p_ano integer)
```

Retorno: colunas de `vw_pickup_mensal_kpis` usadas na UI, mais `alteracoes_diarias_mes`.

| Coluna adicional | Tipo sugerido | Uso |
| --- | --- | --- |
| `alteracoes_diarias_mes` | `integer` | Conta linhas do pick-up diario com alteracao real e extracao no proprio mes. |

### Contrato: Rate Shopper

Nome:

```sql
public.rpc_cliente_rate_shopper(
  p_hotel_id bigint,
  p_mes_ano text,
  p_from date default current_date,
  p_keep_latest boolean default true
)
```

Retorno: apenas as colunas usadas por `RateCalendar`, `RateDayModal` e colunas shopper do pick-up.

| Coluna | Tipo sugerido |
| --- | --- |
| `id`, `hotel_id` | `bigint` |
| `checkin_date` | `date` |
| `slug`, `label`, `type`, `room_name`, `room_id` | `text` |
| `max_persons` | `integer` |
| `meal_plan`, `cancellation` | `text` |
| `price_brl` | `numeric` |
| `scraped_at` | `timestamptz` |
| `url`, `search_url` | `text` |

Regras:

- `p_keep_latest = true`: manter a ultima coleta por `slug + checkin_date`.
- `p_keep_latest = false`: retornar todas as coletas do periodo para o pick-up cruzar com `data_extracao`.
- `p_from` limita datas antigas no calendario; para pick-up, usar o primeiro dia do menor mes necessario.

### Indices Recomendados

```sql
create index if not exists idx_receita_hotel_ref_extracao_desc
  on public.hotel_receita_diaria (hotel_id, data_referencia, data_extracao desc);

create index if not exists idx_hotel_tipo_ativo_nome
  on public.hotel (tipo, ativo, nome_fantasia);

create index if not exists idx_hotel_metas_mes_hotel
  on public.hotel_metas (mes_ano, hotel_id);

create index if not exists idx_booking_rates_hotel_checkin_scraped
  on public.booking_rates (hotel_id, checkin_date, scraped_at desc);

create index if not exists idx_booking_rates_hotel_slug_checkin_scraped
  on public.booking_rates (hotel_id, slug, checkin_date, scraped_at desc);
```

Para `vw_pickup_diario`, os indices devem ficar na tabela base real. Se a fonte continuar sendo `hotel_receita_diaria`, priorizar `(hotel_id, data_referencia, data_extracao desc)`.

Na implementacao com MVs do detalhe, os indices principais sao:

```sql
create unique index if not exists mv_cliente_detalhe_latest_daily_hotel_ref_key
  on public.mv_cliente_detalhe_latest_daily (hotel_id, data_referencia);

create index if not exists idx_mv_cliente_pickup_diario_hotel_ref_ext
  on public.mv_cliente_pickup_diario (hotel_id, data_referencia, data_extracao);

create index if not exists idx_mv_cliente_pickup_diario_hotel_ext_ref
  on public.mv_cliente_pickup_diario (hotel_id, data_extracao, data_referencia);

create unique index if not exists mv_cliente_detalhe_monthly_kpis_hotel_mes_key
  on public.mv_cliente_detalhe_monthly_kpis (hotel_id, mes_ano);
```

Apos carga de dados, refrescar as MVs nao-shopper com `public.refresh_cliente_detail_materialized_views()` usando uma role de backend/servico. O entrypoint antigo `public.refresh_mv_pickup_mensal_kpis()` tambem foi mantido e passa a refrescar o conjunto do detalhe por compatibilidade.

### Uso Esperado Na Tela

- Substituir `useHotelDetail(id)` por `useClienteDetalheHeader(id)` + `useClienteDetalheCalendar(id, selectedMes, selectedDataExtracao)` + `useClienteDetalheCards(id, resolvedMes, resolvedDataExtracao)`.
- Manter `updateHotel(id, data)` direto em `hotel` por enquanto.
- Substituir `useHotelMetas(metaMes)` no detalhe pelo retorno da RPC de cards.
- Substituir `usePickup(id)` por `useClientePickupDiario(id, resolvedMes, resolvedDataExtracao)`.
- Substituir `usePickupMensalKpis(id, ano)` por `useClientePickupMensal(id, ano)`.
- Substituir `useBookingRates` e `useBookingRatesForMonths` por `useClienteRateShopper`.
- O `HeaderMonthReference` do topo e o seletor dentro do pick-up diario compartilham o mesmo estado de mes de referencia e data de extracao.

### Ganho Esperado

- Primeiro carregamento deixa de trafegar historico diario completo.
- Pick-up diario passa a buscar apenas o mes visivel.
- Pick-up mensal nao depende de recalculo no frontend para contar alteracoes.
- Shopper reduz payload por mes e evita duplicidade quando o calendario precisa apenas da ultima coleta.

## Historico: Detalhamento Cliente v1 substituida

### Contexto

A tela `src/pages/ClienteDetalhe.tsx` hoje carrega dados por varias fontes:

- `useHotelDetail(id)`: busca `hotel` completo e todo o historico de `vw_hotel_receita_diaria_atual` do cliente.
- `useHotelMetas(metaMes)`: busca metas de todos os clientes para depois filtrar o hotel atual.
- `usePickup(id)`: busca todo o historico de `vw_pickup_diario` do hotel, paginado no frontend.
- `usePickupMensalKpis(hotelId, ano)`: busca `vw_pickup_mensal_kpis` por ano.
- `useBookingRates(id, mes)` e `useBookingRatesForMonths(id, meses)`: buscam `vw_booking_rates` para calendario/rate shopper e colunas shopper do pick-up.

Para esta tela, a melhor estrategia e separar o carregamento em uma RPC inicial leve e RPCs auxiliares por bloco pesado. A tela renderiza header, cards e metas primeiro; pick-up diario, pick-up mensal e rate shopper carregam sob demanda conforme aba/mes visivel.

### Informacoes Da Tela

Header e formulario de edicao precisam de:

| Fonte atual | Campos usados |
| --- | --- |
| `hotel` | `id`, `property_id`, `tipo`, `razao_social`, `nome_fantasia`, `cidade`, `estado`, `total_uhs`, `total_leitos`, `cadastur`, `ativo`, `created_at`, `updated_at` |

Cards iniciais precisam de agregados do mes selecionado, YoY e YTD:

| Card | Valor atual | Comparacoes | Meta |
| --- | --- | --- | --- |
| Receita | soma de `rec_total` | ano anterior e YTD | `hotel_metas.receita_meta` |
| Ocupacao | `sum(ocupados) / sum(uhs ou total_uhs)` | ano anterior e YTD | `hotel_metas.occ_meta` |
| Diaria media | `sum(rec_diarias) / sum(ocupados)` | ano anterior e YTD | `hotel_metas.dm_meta` |
| RevPAR | `sum(rec_diarias) / sum(uhs ou total_uhs)` | ano anterior e YTD | sem meta no card |
| Room Nights | soma de `ocupados` | ano anterior e YTD | sem meta |
| Hospedes | soma de `pax + chd` | ano anterior e YTD | sem meta |

Pick-up diario precisa de `vw_pickup_diario` apenas para o mes de referencia selecionado:

| Campo | Uso |
| --- | --- |
| `data_referencia`, `data_extracao`, `data_extracao_ant` | navegacao por data, datas com alteracao e comparacao entre extracoes |
| `pu_tt_uh`, `pu_rec_hosp`, `pu_dm_tt`, `pu_occ_tt`, `pu_revpar_tt` | variacoes de pick-up |
| `tt_uhs_ocup`, `rec_hosp`, `dm_cc_tt`, `occ_tt`, `revp_tt`, `tt_hosp`, `chds`, `uhs_disp`, `uhs` | valores consolidados exibidos nas colunas |

Pick-up mensal precisa de `vw_pickup_mensal_kpis` por ano e do contador de alteracoes diarias dentro do mes corrente.

Rate shopper precisa de `vw_booking_rates` para o hotel/mes:

| Campo | Uso |
| --- | --- |
| `checkin_date`, `scraped_at` | calendario e comparacao com extracao do pick-up |
| `slug`, `label`, `type` | cliente versus concorrentes |
| `room_name`, `room_id`, `max_persons`, `meal_plan`, `cancellation` | detalhe/modal |
| `price_brl`, `url`, `search_url` | preco e links |

### Contrato Principal

Nome:

```sql
public.rpc_cliente_detalhe_shell(p_hotel_id bigint, p_mes_ano text default null)
```

Parametro:

| Parametro | Tipo | Exemplo | Uso |
| --- | --- | --- | --- |
| `p_hotel_id` | `bigint` | `123` | Cliente exibido na rota `/clientes/:id`. |
| `p_mes_ano` | `text` | `2026-05` | Mes de referencia dos cards e metas. Se vier nulo, usar o mes atual. |

Retorno:

| Coluna | Tipo sugerido | Uso no frontend |
| --- | --- | --- |
| `hotel_id` | `bigint` | Id do hotel |
| `property_id` | `bigint` | Formulario de edicao |
| `tipo` | `text` | Deve ser `cliente` |
| `razao_social` | `text` | Formulario |
| `nome_fantasia` | `text` | Titulo/header |
| `cidade`, `estado` | `text` | Subtitulo/header |
| `total_uhs`, `total_leitos` | `integer` | Header e formulario |
| `cadastur`, `ativo`, `created_at`, `updated_at` | varios | Formulario |
| `status` | `text` | Cor/status do header |
| `available_months` | `text[]` | Seletor de mes |
| `selected_mes_ano` | `text` | Mes aplicado na consulta |
| `latest_date`, `latest_extracao` | `date` | Snapshot mais recente |
| `latest_ocupados`, `latest_total_uhs` | `numeric` | Ocupacao atual no header |
| `receita_atual`, `occ_atual`, `dm_atual`, `revpar_atual`, `room_nights_atual`, `hospedes_atual` | `numeric` | Cards do mes selecionado |
| `receita_prev_year`, `occ_prev_year`, `dm_prev_year`, `revpar_prev_year`, `room_nights_prev_year`, `hospedes_prev_year` | `numeric` | Comparacao YoY |
| `receita_ytd`, `occ_ytd`, `dm_ytd`, `revpar_ytd`, `room_nights_ytd`, `hospedes_ytd` | `numeric` | Comparacao YTD |
| `receita_meta`, `occ_meta`, `dm_meta`, `revpar_meta` | `numeric` | Meta do mes selecionado |

### SQL Inicial

```sql
create or replace function public.rpc_cliente_detalhe_shell(
  p_hotel_id bigint,
  p_mes_ano text default null
)
returns table (
  hotel_id bigint,
  property_id bigint,
  tipo text,
  razao_social text,
  nome_fantasia text,
  cidade text,
  estado text,
  total_uhs integer,
  total_leitos integer,
  cadastur text,
  ativo boolean,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  available_months text[],
  selected_mes_ano text,
  latest_date date,
  latest_extracao date,
  latest_ocupados numeric,
  latest_total_uhs numeric,
  receita_atual numeric,
  occ_atual numeric,
  dm_atual numeric,
  revpar_atual numeric,
  room_nights_atual numeric,
  hospedes_atual numeric,
  receita_prev_year numeric,
  occ_prev_year numeric,
  dm_prev_year numeric,
  revpar_prev_year numeric,
  room_nights_prev_year numeric,
  hospedes_prev_year numeric,
  receita_ytd numeric,
  occ_ytd numeric,
  dm_ytd numeric,
  revpar_ytd numeric,
  room_nights_ytd numeric,
  hospedes_ytd numeric,
  receita_meta numeric,
  occ_meta numeric,
  dm_meta numeric,
  revpar_meta numeric
)
language sql
stable
security invoker
as $$
with params as (
  select
    p_hotel_id::bigint as hotel_id,
    coalesce(p_mes_ano, to_char(current_date, 'YYYY-MM')) as mes_ano,
    to_date(coalesce(p_mes_ano, to_char(current_date, 'YYYY-MM')) || '-01', 'YYYY-MM-DD') as mes_inicio
),
daily_ranked as (
  select
    r.*,
    row_number() over (
      partition by r.hotel_id, r.data_referencia::date
      order by r.data_extracao::date desc
    ) as rn
  from public.vw_hotel_receita_diaria_atual r
  join params p on p.hotel_id = r.hotel_id
),
daily as (
  select
    hotel_id::bigint as hotel_id,
    data_referencia::date as data_referencia,
    data_extracao::date as data_extracao,
    coalesce(ocupados, 0)::numeric as ocupados,
    coalesce(uhs, 0)::numeric as uhs,
    coalesce(pax, 0)::numeric + coalesce(chd, 0)::numeric as hospedes,
    coalesce(rec_total, 0)::numeric as rec_total,
    coalesce(rec_diarias, 0)::numeric as rec_diarias,
    coalesce(occ_pct, 0)::numeric as occ_pct,
    coalesce(revpar, 0)::numeric as revpar
  from daily_ranked
  where rn = 1
),
months as (
  select array_agg(distinct to_char(data_referencia, 'YYYY-MM') order by to_char(data_referencia, 'YYYY-MM')) as available_months
  from daily
),
latest_day as (
  select *
  from daily
  order by data_referencia desc, data_extracao desc
  limit 1
),
all_avg as (
  select avg(occ_pct) as avg_occ
  from daily
),
scoped_rows as (
  select 'atual'::text as bucket, d.*
  from daily d
  join params p on true
  where d.data_referencia >= p.mes_inicio
    and d.data_referencia < (p.mes_inicio + interval '1 month')::date

  union all

  select 'prev_year'::text as bucket, d.*
  from daily d
  join params p on true
  where d.data_referencia >= (p.mes_inicio - interval '1 year')::date
    and d.data_referencia < (p.mes_inicio - interval '1 year' + interval '1 month')::date

  union all

  select 'ytd'::text as bucket, d.*
  from daily d
  where d.data_referencia >= date_trunc('year', current_date)::date
    and d.data_referencia <= current_date
),
agg as (
  select
    s.bucket,
    sum(s.rec_total) as receita,
    (sum(s.ocupados) / nullif(sum(coalesce(nullif(s.uhs, 0), h.total_uhs, 0)), 0)) * 100 as occ,
    sum(s.rec_diarias) / nullif(sum(s.ocupados), 0) as dm,
    sum(s.rec_diarias) / nullif(sum(coalesce(nullif(s.uhs, 0), h.total_uhs, 0)), 0) as revpar,
    sum(s.ocupados) as room_nights,
    sum(s.hospedes) as hospedes
  from scoped_rows s
  join public.hotel h on h.id = s.hotel_id
  group by s.bucket
)
select
  h.id::bigint as hotel_id,
  h.property_id::bigint,
  h.tipo::text,
  h.razao_social,
  h.nome_fantasia,
  h.cidade,
  h.estado,
  h.total_uhs,
  h.total_leitos,
  h.cadastur,
  h.ativo,
  h.created_at,
  h.updated_at,
  case
    when coalesce(aa.avg_occ, 0) < 25 then 'critical'
    when coalesce(aa.avg_occ, 0) < 45 then 'warning'
    when coalesce(aa.avg_occ, 0) < 70 then 'healthy'
    else 'excellent'
  end as status,
  coalesce(m.available_months, array[]::text[]) as available_months,
  p.mes_ano as selected_mes_ano,
  l.data_referencia as latest_date,
  l.data_extracao as latest_extracao,
  coalesce(l.ocupados, 0) as latest_ocupados,
  coalesce(nullif(l.uhs, 0), h.total_uhs, 0) as latest_total_uhs,
  coalesce(cur.receita, 0) as receita_atual,
  coalesce(cur.occ, 0) as occ_atual,
  cur.dm as dm_atual,
  coalesce(cur.revpar, 0) as revpar_atual,
  coalesce(cur.room_nights, 0) as room_nights_atual,
  coalesce(cur.hospedes, 0) as hospedes_atual,
  coalesce(yoy.receita, 0) as receita_prev_year,
  coalesce(yoy.occ, 0) as occ_prev_year,
  yoy.dm as dm_prev_year,
  coalesce(yoy.revpar, 0) as revpar_prev_year,
  coalesce(yoy.room_nights, 0) as room_nights_prev_year,
  coalesce(yoy.hospedes, 0) as hospedes_prev_year,
  coalesce(ytd.receita, 0) as receita_ytd,
  coalesce(ytd.occ, 0) as occ_ytd,
  ytd.dm as dm_ytd,
  coalesce(ytd.revpar, 0) as revpar_ytd,
  coalesce(ytd.room_nights, 0) as room_nights_ytd,
  coalesce(ytd.hospedes, 0) as hospedes_ytd,
  hm.receita_meta,
  hm.occ_meta,
  hm.dm_meta,
  hm.revpar_meta
from public.hotel h
join params p on p.hotel_id = h.id
left join months m on true
left join latest_day l on true
left join all_avg aa on true
left join agg cur on cur.bucket = 'atual'
left join agg yoy on yoy.bucket = 'prev_year'
left join agg ytd on ytd.bucket = 'ytd'
left join public.hotel_metas hm
  on hm.hotel_id = h.id
 and hm.mes_ano = p.mes_ano
where h.tipo = 'cliente';
$$;
```

### RPCs Auxiliares

#### Pick-up Diario

Nome:

```sql
public.rpc_cliente_pickup_diario(p_hotel_id bigint, p_mes_ano text)
```

Retorno: uma linha por `data_referencia` e `data_extracao` do mes selecionado, com os campos usados por `PickupTable`.

SQL base:

```sql
create or replace function public.rpc_cliente_pickup_diario(
  p_hotel_id bigint,
  p_mes_ano text
)
returns setof public.vw_pickup_diario
language sql
stable
security invoker
as $$
  select *
  from public.vw_pickup_diario p
  where p.hotel_id = p_hotel_id
    and p.data_referencia::date >= to_date(p_mes_ano || '-01', 'YYYY-MM-DD')
    and p.data_referencia::date < (to_date(p_mes_ano || '-01', 'YYYY-MM-DD') + interval '1 month')::date
    and to_char(p.data_extracao::date, 'YYYY-MM') <= to_char(p.data_referencia::date, 'YYYY-MM')
  order by p.data_extracao::date, p.data_referencia::date;
$$;
```

Observacao: em uma versao final, substituir `returns setof public.vw_pickup_diario` por `returns table (...)` com apenas as colunas exibidas. Isso evita payload desnecessario se a view crescer.

#### Pick-up Mensal

Nome:

```sql
public.rpc_cliente_pickup_mensal(p_hotel_id bigint, p_ano integer)
```

Retorno: as colunas de `vw_pickup_mensal_kpis`, acrescidas de `alteracoes_diarias_mes`, que representa a quantidade de linhas com alteracao real dentro do proprio mes.

SQL base:

```sql
create or replace function public.rpc_cliente_pickup_mensal(
  p_hotel_id bigint,
  p_ano integer
)
returns table (
  hotel_id bigint,
  hotel_nome text,
  hotel_ativo boolean,
  ano integer,
  mes integer,
  mes_ano text,
  primeira_extracao date,
  ultima_extracao date,
  dias_referencia integer,
  extracoes integer,
  snapshots_comparaveis integer,
  dias_com_alteracao integer,
  alteracoes_diarias_mes integer,
  pickup_uhs numeric,
  pickup_receita numeric,
  pickup_occ_media_pp numeric,
  pickup_receita_por_uh numeric,
  receita_real numeric,
  uhs_ocupadas_real numeric,
  occ_real_media numeric,
  dm_real_media numeric,
  revpar_real_media numeric,
  receita_meta numeric,
  occ_meta numeric,
  dm_meta numeric,
  revpar_meta numeric,
  receita_vs_meta numeric,
  receita_meta_pct numeric,
  receita_mom numeric,
  receita_mom_pct numeric,
  pickup_receita_mom numeric,
  pickup_receita_mom_pct numeric,
  pickup_uhs_mom numeric
)
language sql
stable
security invoker
as $$
with alteracoes as (
  select
    p.hotel_id::bigint as hotel_id,
    extract(year from p.data_referencia::date)::integer as ano,
    extract(month from p.data_referencia::date)::integer as mes,
    count(*)::integer as alteracoes_diarias_mes
  from public.vw_pickup_diario p
  where p.hotel_id = p_hotel_id
    and extract(year from p.data_referencia::date)::integer = p_ano
    and p.data_extracao_ant is not null
    and to_char(p.data_extracao::date, 'YYYY-MM') = to_char(p.data_referencia::date, 'YYYY-MM')
    and (
      coalesce(p.pu_tt_uh, 0)::numeric <> 0
      or coalesce(p.pu_rec_hosp, 0)::numeric <> 0
      or coalesce(p.pu_dm_tt, 0)::numeric <> 0
      or coalesce(p.pu_occ_tt, 0)::numeric <> 0
      or coalesce(p.pu_revpar_tt, 0)::numeric <> 0
    )
  group by p.hotel_id, extract(year from p.data_referencia::date), extract(month from p.data_referencia::date)
)
select
  v.hotel_id::bigint,
  v.hotel_nome,
  v.hotel_ativo,
  v.ano,
  v.mes,
  v.mes_ano,
  v.primeira_extracao,
  v.ultima_extracao,
  v.dias_referencia,
  v.extracoes,
  v.snapshots_comparaveis,
  v.dias_com_alteracao,
  coalesce(a.alteracoes_diarias_mes, 0) as alteracoes_diarias_mes,
  v.pickup_uhs,
  v.pickup_receita,
  v.pickup_occ_media_pp,
  v.pickup_receita_por_uh,
  v.receita_real,
  v.uhs_ocupadas_real,
  v.occ_real_media,
  v.dm_real_media,
  v.revpar_real_media,
  v.receita_meta,
  v.occ_meta,
  v.dm_meta,
  v.revpar_meta,
  v.receita_vs_meta,
  v.receita_meta_pct,
  v.receita_mom,
  v.receita_mom_pct,
  v.pickup_receita_mom,
  v.pickup_receita_mom_pct,
  v.pickup_uhs_mom
from public.vw_pickup_mensal_kpis v
left join alteracoes a
  on a.hotel_id = v.hotel_id
 and a.ano = v.ano
 and a.mes = v.mes
where v.hotel_id = p_hotel_id
  and v.ano = p_ano
order by v.mes;
$$;
```

#### Rate Shopper

Nome:

```sql
public.rpc_cliente_rate_shopper(
  p_hotel_id bigint,
  p_mes_ano text,
  p_from date default current_date,
  p_keep_latest boolean default true
)
```

Uso:

- `p_keep_latest = true`: calendario principal, mantendo apenas a ultima coleta por `slug` e `checkin_date`.
- `p_keep_latest = false`: colunas shopper do pick-up diario, porque a tabela compara o preco da data de extracao ativa.

SQL base:

```sql
create or replace function public.rpc_cliente_rate_shopper(
  p_hotel_id bigint,
  p_mes_ano text,
  p_from date default current_date,
  p_keep_latest boolean default true
)
returns table (
  id bigint,
  hotel_id bigint,
  checkin_date date,
  slug text,
  label text,
  type text,
  room_name text,
  room_id text,
  max_persons integer,
  meal_plan text,
  cancellation text,
  price_brl numeric,
  scraped_at timestamptz,
  url text,
  search_url text
)
language sql
stable
security invoker
as $$
with params as (
  select
    greatest(p_from, to_date(p_mes_ano || '-01', 'YYYY-MM-DD')) as dt_ini,
    (to_date(p_mes_ano || '-01', 'YYYY-MM-DD') + interval '1 month' - interval '1 day')::date as dt_fim
),
ranked as (
  select
    r.*,
    max(r.scraped_at) over (partition by r.slug, r.checkin_date) as latest_scraped_at
  from public.vw_booking_rates r
  cross join params p
  where r.hotel_id = p_hotel_id
    and r.booking_info_ativo = true
    and r.checkin_date::date >= p.dt_ini
    and r.checkin_date::date <= p.dt_fim
)
select
  id::bigint,
  hotel_id::bigint,
  checkin_date::date,
  slug,
  label,
  type,
  room_name,
  room_id,
  max_persons,
  meal_plan,
  cancellation,
  price_brl,
  scraped_at,
  url,
  search_url
from ranked
where p_keep_latest = false
   or scraped_at = latest_scraped_at
order by checkin_date::date, type, price_brl;
$$;
```

### Indices Recomendados

- `hotel(id)` e, para listagens, `hotel(tipo, ativo, id)`.
- `hotel_metas(hotel_id, mes_ano)` com unicidade para evitar metas duplicadas por cliente/mes.
- Tabela base de `vw_hotel_receita_diaria_atual`: indice composto em `(hotel_id, data_referencia, data_extracao desc)`.
- Tabela base de `vw_pickup_diario`: indices em `(hotel_id, data_referencia, data_extracao)` e `(hotel_id, data_extracao)`.
- `vw_pickup_mensal_kpis`: se for view materializada, indice unico em `(hotel_id, ano, mes)`.
- Tabela base de `vw_booking_rates`: indice em `(hotel_id, booking_info_ativo, checkin_date, scraped_at desc)` e, se houver muito concorrente, `(hotel_id, slug, checkin_date, scraped_at desc)`.

### Hook Frontend Sugerido

```ts
type MetricComparison = {
  current: number;
  prevYear: number;
  ytd: number;
};

type MetricWithGoal = MetricComparison & {
  meta: number | null;
  achievementPct: number | null;
};

export interface ClienteDetalheShell {
  hotelId: number;
  propertyId: number | null;
  tipo: 'cliente';
  razaoSocial: string;
  nomeFantasia: string;
  cidade: string | null;
  estado: string | null;
  totalUhs: number;
  totalLeitos: number | null;
  cadastur: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  status: 'excellent' | 'healthy' | 'warning' | 'critical';
  availableMonths: string[];
  selectedMesAno: string;
  latestDate: string | null;
  latestExtracao: string | null;
  latestOcupados: number;
  latestTotalUhs: number;
  cards: {
    receita: MetricWithGoal;
    ocupacao: MetricWithGoal;
    diariaMedia: MetricWithGoal;
    revpar: MetricComparison;
    roomNights: MetricComparison;
    hospedes: MetricComparison;
  };
}

export async function fetchClienteDetalheShell(
  hotelId: number,
  mesAno: string
): Promise<ClienteDetalheShell | null> {
  const { data, error } = await supabase.rpc('rpc_cliente_detalhe_shell', {
    p_hotel_id: hotelId,
    p_mes_ano: mesAno,
  });

  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;

  return mapClienteDetalheShell(row);
}
```

### Uso Esperado Na Tela

- Substituir `useHotelDetail(id)` por `useClienteDetalheShell(id, selectedMesAno)` para header, cards, meses disponiveis e meta do mes.
- Manter `updateHotel(id, data)` direto na tabela `hotel` por enquanto. Uma RPC de update so e necessaria se regras de permissao/auditoria ficarem mais complexas.
- Substituir `useHotelMetas(metaMes)` no detalhe pelo retorno `receita_meta`, `occ_meta`, `dm_meta` e `revpar_meta` da shell.
- Substituir `usePickup(id)` por `useClientePickupDiario(id, selectedMesAno)`, evitando carregar todo o historico.
- Substituir `usePickupMensalKpis(id, ano)` por `useClientePickupMensal(id, ano)` para trazer tambem `alteracoes_diarias_mes`.
- Substituir `useBookingRates`/`useBookingRatesForMonths` por `useClienteRateShopper`; usar `p_keep_latest=true` no calendario e `false` no pick-up diario.
- Fazer lazy load: iniciar shell imediatamente, carregar pick-up/rate shopper somente quando o bloco correspondente estiver visivel.

### Ganho Esperado

- Reduz o primeiro carregamento da pagina para uma unica RPC leve.
- Evita trafegar todo o historico diario e todo o pick-up do hotel quando a tela abre.
- Evita buscar metas de todos os clientes para filtrar apenas um hotel.
- Mantem os cards consistentes com as regras atuais de calculo e com as metas do mes.
- Deixa os blocos pesados escalarem por mes/ano, com cache independente no frontend.
