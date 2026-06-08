# Eventos e Feriados — planejamento do banco (Supabase)

> Plano para tirar a página `/feriados` do **mock** (`src/data/feriadosMock.ts`) e ligá-la a dados
> reais. Modelo por **abrangência** (escopo) + **recorrência**. Nada criado ainda — este doc é o
> desenho para aprovação; depois viram migrations aplicadas via `supabase db push`.

## 1. Conceito
Um **evento** (feriado ou data comemorativa) é registrado **uma vez** num **escopo** e vale para o
**grupo de hotéis** daquele escopo:

| Abrangência | Vale para | Campos do escopo |
|---|---|---|
| `nacional`  | todos os hotéis | — |
| `estadual`  | hotéis da UF | `uf` |
| `municipal` | hotéis da cidade | `uf` + `cidade` |
| `hotel`     | um hotel específico | `hotel_id` |

Cada evento tem uma **recorrência**: `unica` (data), `anual` (todo ano na data) ou `diaSemana`
(dia(s) da semana + frequência: toda semana / 1ª–4ª / última do mês, com mês opcional).

## 2. Tabela `evento`
```sql
create table public.evento (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  abrangencia  text not null check (abrangencia in ('nacional','estadual','municipal','hotel')),
  uf           char(2),                                  -- estadual/municipal
  cidade       text,                                     -- municipal
  hotel_id     integer references public.hotel(id),      -- hotel
  recorrencia  jsonb not null,                           -- ver §3
  ativo        boolean not null default true,
  observacoes  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- garante que os campos do escopo batem com a abrangência:
  constraint evento_escopo_chk check (
    (abrangencia='nacional'  and uf is null and cidade is null and hotel_id is null) or
    (abrangencia='estadual'  and uf is not null and cidade is null and hotel_id is null) or
    (abrangencia='municipal' and uf is not null and cidade is not null and hotel_id is null) or
    (abrangencia='hotel'     and hotel_id is not null and uf is null and cidade is null)
  )
);
create index idx_evento_escopo on public.evento (abrangencia, uf, cidade, hotel_id);
```

## 3. `recorrencia` (jsonb) — mesmo shape do front
Guardar como JSON evita criar várias colunas e bate 1:1 com o `Recorrencia` do TS:
```jsonc
// data única:        { "tipo": "unica",  "data": "2026-05-10" }
// anual:             { "tipo": "anual",  "data": "2026-12-25" }          // usa dia/mês
// dia da semana:     { "tipo": "diaSemana", "dias": [0], "ocorrencia": 2, "mes": 10 }
//                    // = "2º domingo de Outubro" (Círio de Nazaré)
//                    // ocorrencia: "toda" | 1 | 2 | 3 | 4 | -1 (última); mes: 1..12 | null
```
> A **expansão para datas concretas** (p/ marcar calendários) fica no **app** (JS), reaproveitando o
> `recorrenciaLabel`/lógica do mock — evita matemática de data recorrente em SQL. Se o pipeline
> precisar server-side depois, dá pra adicionar uma função `evento_datas(p_ano)`.

## 4. Resolver os eventos de um hotel
Um hotel H herda: nacionais + estaduais da sua UF + municipais da sua cidade + os exclusivos dele.
```sql
create or replace function public.rpc_eventos_hotel(p_hotel_id int)
returns setof public.evento
language sql stable
as $$
  select e.* from public.evento e
  join public.hotel h on h.id = p_hotel_id
  where e.ativo and (
    e.abrangencia = 'nacional'
    or (e.abrangencia = 'estadual'  and e.uf = h.uf)
    or (e.abrangencia = 'municipal' and e.uf = h.uf and e.cidade = h.cidade)
    or (e.abrangencia = 'hotel'     and e.hotel_id = h.id)
  );
$$;
```

### ⚠️ Pré-requisito: normalizar a UF do hotel
Hoje `hotel.estado` guarda o **nome por extenso** ("Pará") e a tabela acima compara por **código**
("PA"). Duas opções:
1. **(recomendado)** adicionar `hotel.uf char(2)` (derivar de `estado` numa migration) e usar `uf` nas
   joins. Mais robusto e barato.
2. usar o nome por extenso em `evento.uf` (mas char(2) é mais limpo p/ índice/escopo estadual).

Match de **cidade** por texto é frágil (acento/caixa). Para robustez futura: `cidade_normalizada`
(unaccent+lower) ou `municipio_ibge` (código IBGE) em `hotel` e `evento`.

## 5. Exceção por hotel (opcional, fase 2)
Para "desativar um feriado **nacional** só em 1 hotel", uma tabela de override:
```sql
create table public.evento_hotel_off (
  evento_id uuid    references public.evento(id) on delete cascade,
  hotel_id  integer references public.hotel(id) on delete cascade,
  primary key (evento_id, hotel_id)
);  -- presença = evento oculto/inativo para aquele hotel
```
v1 pode ficar só com `evento.ativo` global; este override entra quando for necessário.

## 6. RLS (espelha `metas_upload_log` / `shopper_runs`)
```sql
alter table public.evento enable row level security;
create policy evento_select_all on public.evento for select to anon, authenticated using (true);
grant select on public.evento to anon, authenticated;
grant all    on public.evento to service_role;
-- escrita (insert/update/delete) só service_role por enquanto; por papel quando a auth existir (#24).
```

## 7. Front — trocar o mock
- Hook `useEventos()` → lê `evento` (anon). A página agrupa por escopo (cidades/estados/nacionais/
  hotéis) exatamente como hoje, só que a partir dos dados reais.
- Escrita (criar/editar/excluir/toggle): direto via Supabase JS (service-role só no servidor) →
  enquanto não há auth, fazer por uma **Edge Function** `evento-write` (como `metas-upload`), ou abrir
  `insert/update` ao anon com RLS controlada. Decidir junto com a auth da página.
- Tipos: mover `Recorrencia`/`Abrangencia` de `feriadosMock.ts` para `data/types.ts`; o mock vira seed.

## 8. Sequência de implementação
1. Migration: `hotel.uf` (normalizar de `estado`).
2. Migration: tabela `evento` + RLS + `rpc_eventos_hotel`.
3. Seed: inserir nacionais (template BR) + os locais/hotel já conhecidos.
4. Front: `useEventos` (read) + caminho de escrita; remover o mock.
5. (Fase 2) `evento_hotel_off`; expansão de datas p/ os calendários do detalhamento (#22).
