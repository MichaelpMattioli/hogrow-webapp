import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';
import { localDateKey } from '@/lib/utils';
import { buildHotelSummary, parseKpiRow, deriveStatus } from '@/data/transforms';
import type { HotelRow, ReceitaDiariaRow, KpiDiario, HotelSummary, PickupRow, BookingRate, HotelMeta } from '@/data/types';

const CLIENTES_PAGE_MIN_LOADING_MS = 1000;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function errMsg(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

async function fetchClientHotelIds(): Promise<number[]> {
  const { data, error } = await supabase
    .from('hotel')
    .select('id')
    .eq('tipo', 'cliente');

  if (error) throw error;
  return ((data ?? []) as Array<{ id: number }>).map(r => r.id);
}

/**
 * Shared, deduplicated access to the client hotel ids. Many hooks need this list;
 * routing every call through one cached query means the underlying request runs
 * once per session instead of N times in parallel.
 */
function getClientHotelIds(): Promise<number[]> {
  return queryClient.fetchQuery({
    queryKey: ['client-hotel-ids'],
    queryFn: fetchClientHotelIds,
    staleTime: Infinity,
  });
}

function isPickupExtractionAllowed(dataExtracao: string | null | undefined, dataReferencia: string | null | undefined): boolean {
  if (!dataExtracao || !dataReferencia) return false;
  return dataExtracao.slice(0, 7) <= dataReferencia.slice(0, 7);
}

function parseBookingRate(r: Record<string, unknown>): BookingRate {
  return {
    id: num(r.id),
    hotelId: num(r.hotel_id),
    checkinDate: String(r.checkin_date ?? ''),
    slug: String(r.slug ?? ''),
    label: String(r.label ?? ''),
    type: r.type as 'cliente' | 'concorrente',
    roomName: String(r.room_name ?? ''),
    roomId: r.room_id == null ? null : String(r.room_id),
    maxPersons: num(r.max_persons),
    mealPlan: r.meal_plan == null ? null : String(r.meal_plan),
    cancellation: r.cancellation == null ? null : String(r.cancellation),
    priceBrl: num(r.price_brl),
    scrapedAt: String(r.scraped_at ?? ''),
    url: (r.url as string | null) ?? null,
    searchUrl: (r.search_url as string | null) ?? null,
  };
}

async function fetchBookingRatesRange(hotelId: number, from: string, to: string): Promise<BookingRate[]> {
  if (!hotelId || from > to) return [];

  const pageSize = 1000;
  const rawRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('vw_booking_rates_latest')
      .select('*')
      .eq('hotel_id', hotelId)
      .eq('booking_info_ativo', true)
      .gte('checkin_date', from)
      .lte('checkin_date', to)
      .order('checkin_date', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    const page = (data ?? []) as Record<string, unknown>[];
    rawRows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  // vw_booking_rates_latest já devolve só a última extração por (concorrente, checkin),
  // então não há dedup no cliente.
  return rawRows.map(parseBookingRate).filter(r => r.checkinDate >= from);
}

// ─── Fetch all hotels via pre-aggregated view ────────────────────────

export function useHotels() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hotels-summary'],
    queryFn: async (): Promise<HotelSummary[]> => {
      const clientIds = await getClientHotelIds();
      if (clientIds.length === 0) return [];

      const { data, error } = await supabase
        .from('vw_hotel_summary')
        .select('*')
        .in('id', clientIds);

      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map(r => ({
        id:          r.id          as number,
        name:        r.nome_fantasia as string,
        razaoSocial: r.razao_social  as string,
        city:        (r.cidade       as string) ?? '—',
        state:       (r.estado       as string) ?? '—',
        uhs:         r.total_uhs     as number,
        leitos:      r.total_leitos  as number | null,
        ativo:       r.ativo         as boolean,

        avgOcc:          num(r.occ_mes_atual),
        avgRevpar:       num(r.revpar_mes_atual),
        avgDm:           nullableNum(r.dm_mes_atual),
        totalReceita:    (r.receita_ytd    as number) ?? 0,
        totalRecDiarias: 0,
        totalRecAb:      0,
        diasComDados:    (r.dias_mes_atual as number) ?? 0,

        receitaMesAtual:        (r.receita_mes_atual        as number) ?? 0,
        recDiariasMesAtual:     (r.rec_diarias_mes_atual    as number) ?? 0,
        receitaMesAnterior:     (r.receita_mes_anterior     as number) ?? 0,
        recDiariasMesAnterior:  (r.rec_diarias_mes_anterior as number) ?? 0,
        receitaMesQueVem:       0,
        occMesAtual:            num(r.occ_mes_atual),
        occMesAnterior:         (r.occ_mes_anterior         as number) ?? 0,
        occMesQueVem:           0,
        ocupadosMesAtual:       (r.ocupados_mes_atual       as number) ?? 0,
        ocupadosMesAnterior:    (r.ocupados_mes_anterior    as number) ?? 0,
        cortesiaMesAtual:       (r.cortesia_mes_atual       as number) ?? 0,
        hospedesMesAtual:       (r.hospedes_mes_atual       as number) ?? 0,
        diasMesAtual:           (r.dias_mes_atual           as number) ?? 0,

        receitaAnoAnterior:     (r.receita_ano_anterior     as number) ?? 0,
        recDiariasAnoAnterior:  (r.rec_diarias_ano_anterior as number) ?? 0,
        occAnoAnterior:         (r.occ_ano_anterior         as number) ?? 0,
        ocupadosAnoAnterior:    (r.ocupados_ano_anterior    as number) ?? 0,

        receitaYTD:   (r.receita_ytd   as number) ?? 0,
        occAvgYTD:    (r.occ_avg_ytd   as number) ?? 0,
        ocupadosYTD:  (r.ocupados_ytd  as number) ?? 0,
        hospedesYTD:  (r.hospedes_ytd  as number) ?? 0,
        dmYTD:         r.dm_ytd        as number | null,

        latestDate:      (r.latest_date      as string) ?? '—',
        latestExtracao:  (r.latest_extracao  as string) ?? '—',
        latestOcupados:  (r.latest_ocupados  as number) ?? 0,
        latestOcc:       (r.latest_occ       as number) ?? 0,
        latestRevpar:    num(r.latest_revpar),
        latestDm:         r.latest_dm        as number | null,
        latestRecTotal:  (r.latest_rec_total as number) ?? 0,

        status: deriveStatus(num(r.occ_mes_atual)),
      }));
    },
  });

  return { hotels: data ?? [], loading: isLoading, error: errMsg(error) };
}

// ─── Fetch a single hotel with full detail (parallelized) ────────────

export function useHotelDetail(id: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hotel-detail', id],
    enabled: !!id,
    queryFn: async () => {
      // Parallel: hotel record + KPI rows (was a sequential waterfall).
      const [hotelRes, kpiRes] = await Promise.all([
        supabase.from('hotel').select('*').eq('id', id).single(),
        supabase
          .from('vw_hotel_receita_diaria_atual')
          .select('*')
          .eq('hotel_id', id)
          .order('data_referencia', { ascending: true }),
      ]);

      if (hotelRes.error) throw hotelRes.error;
      if (kpiRes.error) throw kpiRes.error;

      const hotelData = hotelRes.data as HotelRow;
      const kpiRows = (kpiRes.data ?? []) as ReceitaDiariaRow[];

      return {
        hotel: hotelData,
        kpis: kpiRows.map(parseKpiRow),
        summary: buildHotelSummary(hotelData, kpiRows),
      };
    },
  });

  const reload = useCallback(() => { void refetch(); }, [refetch]);

  return {
    hotel: data?.hotel ?? null,
    kpis: (data?.kpis ?? []) as KpiDiario[],
    summary: data?.summary ?? null,
    loading: isLoading,
    error: errMsg(error),
    reload,
  };
}

// ─── Update a hotel record ──────────────────────────────────────────

export async function updateHotel(
  id: number,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('hotel')
    .update(data)
    .eq('id', id);

  if (error) return { success: false, error: error.message };

  // Refresh anything that shows hotel attributes.
  void queryClient.invalidateQueries({ queryKey: ['hotel-detail'] });
  void queryClient.invalidateQueries({ queryKey: ['cliente-detalhe-header'] });
  void queryClient.invalidateQueries({ queryKey: ['hotels-summary'] });
  void queryClient.invalidateQueries({ queryKey: ['clientes-table'] });
  void queryClient.invalidateQueries({ queryKey: ['home-page'] });
  return { success: true };
}

// ─── Fetch booking rates (rate shopper) for a hotel + month ─────────

export function useBookingRates(hotelId: number, yearMonth: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['booking-rates', hotelId, yearMonth],
    enabled: !!hotelId && !!yearMonth,
    queryFn: async () => {
      const monthStart = `${yearMonth}-01`;
      const today = localDateKey();
      const from = monthStart < today ? today : monthStart;
      const [y, mo] = yearMonth.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const to = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
      return fetchBookingRatesRange(hotelId, from, to);
    },
    // Sem cache no shopper: sempre busca o estado atual (o on-demand muda os preços fora
    // do ciclo das 09:30, então não dá pra servir cache "fresh" como no resto do app).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  return { rates: data ?? [], loading: isLoading };
}

export function useBookingRatesForMonths(hotelId: number, yearMonths: string[]) {
  const monthsKey = yearMonths.join('|');
  const { data, isLoading } = useQuery({
    queryKey: ['booking-rates-months', hotelId, monthsKey],
    enabled: !!hotelId && monthsKey.length > 0,
    queryFn: async () => {
      const months = [...new Set(monthsKey.split('|').filter(Boolean))].sort();
      const today = localDateKey();
      if (!hotelId || months.length === 0) return [];

      const firstMonth = months[0];
      const lastMonth = months[months.length - 1];
      const [lastY, lastM] = lastMonth.split('-').map(Number);
      const lastDay = new Date(lastY, lastM, 0).getDate();
      const monthStart = `${firstMonth}-01`;
      const from = monthStart < today ? today : monthStart;
      const to = `${lastMonth}-${String(lastDay).padStart(2, '0')}`;

      const loaded = await fetchBookingRatesRange(hotelId, from, to);
      return loaded.filter(r => months.includes(r.checkinDate.slice(0, 7)));
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  return { rates: data ?? [], loading: isLoading };
}

// ─── Hotel Monthly KPIs (history for Metas page) ────────────────────

export interface MonthlyKpi {
  hotelId: number;
  mesAno:  string;
  receita: number;
  recDiarias: number;
  occ:     number;
  dm:      number | null;
  revpar:  number | null;
  ocupados: number;
  cortesia: number;
  hospedes: number;
  dias:    number;
}

export function useHotelsMonthly() {
  const { data, isLoading } = useQuery({
    queryKey: ['hotels-monthly'],
    queryFn: async (): Promise<MonthlyKpi[]> => {
      const clientIds = await getClientHotelIds();
      if (clientIds.length === 0) return [];

      const { data, error } = await supabase
        .from('vw_hotel_monthly_kpis')
        .select('*')
        .in('hotel_id', clientIds);
      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map(r => ({
        hotelId:   r.hotel_id    as number,
        mesAno:    r.mes_ano     as string,
        receita:   (r.receita    as number) ?? 0,
        recDiarias:(r.rec_diarias as number) ?? 0,
        occ:       (r.occ        as number) ?? 0,
        dm:         r.dm         as number | null,
        revpar:     r.revpar     as number | null,
        ocupados:  (r.ocupados   as number) ?? 0,
        cortesia:  (r.cortesia   as number) ?? 0,
        hospedes:  (r.hospedes   as number) ?? 0,
        dias:      (r.dias       as number) ?? 0,
      }));
    },
  });

  return { rows: data ?? [], loading: isLoading };
}

// ─── Hotel Metas (goals) ─────────────────────────────────────────────

function mapHotelMeta(r: Record<string, unknown>): HotelMeta {
  return {
    id:           r.id          as number,
    hotelId:      r.hotel_id    as number,
    mesAno:       r.mes_ano     as string,
    receitaMeta:  r.receita_meta as number | null,
    occMeta:      r.occ_meta    as number | null,
    dmMeta:       r.dm_meta     as number | null,
    revparMeta:   r.revpar_meta as number | null,
  };
}

export function useHotelMetas(mesAno: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['hotel-metas', mesAno],
    enabled: !!mesAno,
    queryFn: async (): Promise<HotelMeta[]> => {
      const clientIds = await getClientHotelIds();
      if (clientIds.length === 0) return [];

      const { data, error } = await supabase
        .from('hotel_metas')
        .select('*')
        .eq('mes_ano', mesAno)
        .in('hotel_id', clientIds);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapHotelMeta);
    },
  });

  const reload = useCallback(() => { void refetch(); }, [refetch]);
  return { metas: data ?? [], loading: isLoading, reload };
}

export async function saveHotelMeta(
  meta: Omit<HotelMeta, 'id'>
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('hotel_metas')
    .upsert(
      {
        hotel_id:     meta.hotelId,
        mes_ano:      meta.mesAno,
        receita_meta: meta.receitaMeta,
        occ_meta:     meta.occMeta,
        dm_meta:      meta.dmMeta,
        revpar_meta:  meta.revparMeta,
        updated_at:   new Date().toISOString(),
      },
      { onConflict: 'hotel_id,mes_ano' }
    );
  if (error) return { success: false, error: error.message };

  // Refresh anything that depends on goals.
  void queryClient.invalidateQueries({ queryKey: ['metas-page'] });
  void queryClient.invalidateQueries({ queryKey: ['hotel-metas'] });
  void queryClient.invalidateQueries({ queryKey: ['all-metas'] });
  void queryClient.invalidateQueries({ queryKey: ['home-page'] });
  void queryClient.invalidateQueries({ queryKey: ['clientes-table'] });
  void queryClient.invalidateQueries({ queryKey: ['cliente-detalhe-cards'] });
  return { success: true };
}

// ─── Fetch pick-up data for a hotel ─────────────────────────────────

export function usePickup(hotelId: number) {
  const { data, isLoading } = useQuery({
    queryKey: ['pickup', hotelId],
    enabled: !!hotelId,
    queryFn: async (): Promise<PickupRow[]> => {
      const pageSize = 1000;
      const allRows: PickupRow[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from('vw_pickup_diario')
          .select('*')
          .eq('hotel_id', hotelId)
          .order('data_referencia', { ascending: true })
          .order('data_extracao', { ascending: true })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const page = (data ?? []) as PickupRow[];
        allRows.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      return allRows.filter(r => isPickupExtractionAllowed(r.data_extracao, r.data_referencia));
    },
  });

  return { rows: data ?? [], loading: isLoading };
}

// ─── All metas (for history table with meta columns) ─────────────────

export function useAllMetas() {
  const { data, isLoading } = useQuery({
    queryKey: ['all-metas'],
    queryFn: async (): Promise<HotelMeta[]> => {
      const clientIds = await getClientHotelIds();
      if (clientIds.length === 0) return [];

      const { data, error } = await supabase
        .from('hotel_metas')
        .select('*')
        .in('hotel_id', clientIds);
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapHotelMeta);
    },
  });

  return { metas: data ?? [], loading: isLoading };
}

// ─── Pickup summary (aggregate per hotel for current month) ──────────

export interface PickupSummary {
  hotelId: number;
  pu7dUhs: number;
  pu7dReceita: number;
}

export interface TodayPickupAlert {
  hotelId: number;
  dataExtracao: string;
  alteracoes: number;
  pickupUhs: number;
  pickupReceita: number;
  referencias: string[];
}

export function usePickupSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ['pickup-summary'],
    queryFn: async (): Promise<PickupSummary[]> => {
      const clientIds = await getClientHotelIds();
      if (clientIds.length === 0) return [];

      const now = new Date();
      const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const from = `${mesAtual}-01`;
      const [y, mo] = mesAtual.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const to = `${mesAtual}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('vw_pickup_diario')
        .select('hotel_id, pu_tt_uh, pu_rec_hosp, data_extracao, data_extracao_ant, data_referencia')
        .in('hotel_id', clientIds)
        .gte('data_referencia', from)
        .lte('data_referencia', to);
      if (error) throw error;

      const byHotel = new Map<number, { uhs: number; rec: number }>();
      for (const r of (data ?? []) as Record<string, unknown>[]) {
        if (r.data_extracao_ant == null) continue;
        if (!isPickupExtractionAllowed(r.data_extracao as string | null, r.data_referencia as string | null)) continue;
        const hid = r.hotel_id as number;
        const acc = byHotel.get(hid) ?? { uhs: 0, rec: 0 };
        acc.uhs += (r.pu_tt_uh as number) || 0;
        acc.rec += parseFloat(String(r.pu_rec_hosp)) || 0;
        byHotel.set(hid, acc);
      }
      return [...byHotel.entries()].map(([hid, v]) => ({
        hotelId: hid,
        pu7dUhs: v.uhs,
        pu7dReceita: v.rec,
      }));
    },
  });

  return { summaries: data ?? [], loading: isLoading };
}

function hasPickupChange(row: Record<string, unknown>): boolean {
  return (
    num(row.pu_tt_uh) !== 0 ||
    num(row.pu_rec_hosp) !== 0 ||
    num(row.pu_dm_tt) !== 0 ||
    num(row.pu_occ_tt) !== 0 ||
    num(row.pu_revpar_tt) !== 0
  );
}

export function useTodayPickupAlerts() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['today-pickup-alerts'],
    queryFn: async (): Promise<TodayPickupAlert[]> => {
      const clientIds = await getClientHotelIds();
      if (clientIds.length === 0) return [];

      const today = localDateKey();
      const { data, error } = await supabase
        .from('vw_pickup_diario')
        .select('hotel_id,data_extracao,data_extracao_ant,data_referencia,pu_tt_uh,pu_rec_hosp,pu_dm_tt,pu_occ_tt,pu_revpar_tt')
        .in('hotel_id', clientIds)
        .eq('data_extracao', today)
        .order('hotel_id', { ascending: true })
        .order('data_referencia', { ascending: true });
      if (error) throw error;

      const byHotel = new Map<number, {
        dataExtracao: string;
        alteracoes: number;
        pickupUhs: number;
        pickupReceita: number;
        referencias: Set<string>;
      }>();

      for (const row of (data ?? []) as Record<string, unknown>[]) {
        if (row.data_extracao_ant == null) continue;
        if (!isPickupExtractionAllowed(row.data_extracao as string | null, row.data_referencia as string | null)) continue;
        if (!hasPickupChange(row)) continue;

        const hotelId = num(row.hotel_id);
        if (!hotelId) continue;

        const acc = byHotel.get(hotelId) ?? {
          dataExtracao: String(row.data_extracao ?? today),
          alteracoes: 0,
          pickupUhs: 0,
          pickupReceita: 0,
          referencias: new Set<string>(),
        };

        acc.alteracoes += 1;
        acc.pickupUhs += num(row.pu_tt_uh);
        acc.pickupReceita += num(row.pu_rec_hosp);
        if (row.data_referencia) acc.referencias.add(String(row.data_referencia));
        byHotel.set(hotelId, acc);
      }

      return [...byHotel.entries()]
        .map(([hotelId, alert]) => ({
          hotelId,
          dataExtracao: alert.dataExtracao,
          alteracoes: alert.alteracoes,
          pickupUhs: alert.pickupUhs,
          pickupReceita: alert.pickupReceita,
          referencias: [...alert.referencias].sort(),
        }))
        .sort((a, b) => b.alteracoes - a.alteracoes || Math.abs(b.pickupReceita) - Math.abs(a.pickupReceita));
    },
  });

  return { alerts: data ?? [], loading: isLoading, error: errMsg(error) };
}

export interface HomePageRow {
  selectedMesAno: string;
  selectedDataExtracao: string;
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
  ocupadosMesAtual: number;
  recDiariasMesAtual: number;
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

function dateArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item)).filter(Boolean);
}

function mapHomePageRow(row: Record<string, unknown>): HomePageRow {
  return {
    selectedMesAno: (row.selected_mes_ano as string) ?? '',
    selectedDataExtracao: (row.selected_data_extracao as string) ?? '',
    hotelId: num(row.hotel_id),
    hotelNome: (row.hotel_nome as string) ?? '',
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    totalUhs: num(row.total_uhs),
    receitaPeriodo: num(row.receita_periodo),
    occAtual: num(row.occ_atual),
    revparAtual: num(row.revpar_atual),
    dmAtual: nullableNum(row.dm_atual),
    receitaMesAtual: num(row.receita_mes_atual),
    ocupadosMesAtual: num(row.ocupados_mes_atual),
    recDiariasMesAtual: num(row.rec_diarias_mes_atual),
    metaId: nullableNum(row.meta_id),
    receitaMeta: nullableNum(row.receita_meta),
    occMeta: nullableNum(row.occ_meta),
    dmMeta: nullableNum(row.dm_meta),
    receitaMetaPct: nullableNum(row.receita_meta_pct),
    occMetaPct: nullableNum(row.occ_meta_pct),
    dmMetaPct: nullableNum(row.dm_meta_pct),
    goalScore: nullableNum(row.goal_score),
    pickupDataExtracao: (row.pickup_data_extracao as string | null) ?? null,
    pickupAlteracoes: num(row.pickup_alteracoes),
    pickupUhs: num(row.pickup_uhs),
    pickupReceita: num(row.pickup_receita),
    pickupReferencias: dateArray(row.pickup_referencias),
  };
}

export function useHomePage(mesAno?: string, dataExtracao?: string) {
  const date = dataExtracao || localDateKey();
  const month = mesAno || date.slice(0, 7);

  const { data, isLoading, error } = useQuery({
    queryKey: ['home-page', month, date],
    queryFn: async (): Promise<HomePageRow[]> => {
      const { data, error } = await supabase.rpc('rpc_home_page', {
        p_mes_ano: month,
        p_data_extracao: date,
      });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapHomePageRow);
    },
  });

  return { rows: data ?? [], loading: isLoading, error: errMsg(error) };
}

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

function mapMetasPageRow(row: Record<string, unknown>): MetasPageRow {
  return {
    hotelId: num(row.hotel_id),
    hotelNome: (row.hotel_nome as string) ?? '',
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    totalUhs: num(row.total_uhs),
    metaId: nullableNum(row.meta_id),
    mesAno: (row.mes_ano as string) ?? '',
    receitaMeta: nullableNum(row.receita_meta),
    occMeta: nullableNum(row.occ_meta),
    dmMeta: nullableNum(row.dm_meta),
    revparMeta: nullableNum(row.revpar_meta),
    metaUpdatedAt: (row.meta_updated_at as string | null) ?? null,
  };
}

export function useMetasPage(mesAno: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['metas-page', mesAno],
    enabled: !!mesAno,
    queryFn: async (): Promise<MetasPageRow[]> => {
      const { data, error } = await supabase.rpc('rpc_metas_page', { p_mes_ano: mesAno });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map(mapMetasPageRow);
    },
  });

  const reload = useCallback(() => { void refetch(); }, [refetch]);
  return { rows: data ?? [], loading: isLoading, error: errMsg(error), reload };
}

export interface ClientesPageRow {
  hotelId: number;
  hotelNome: string;
  cidade: string | null;
  estado: string | null;
  totalUhs: number;
  status: HotelSummary['status'];
  selectedMesAno: string;
  selectedDataExtracao: string;
  selectedDiaIni: number;
  selectedDiaFim: number;
  isFaixaParcial: boolean;
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

export interface ClientesCalendarState {
  requestedMesAno: string;
  requestedDataExtracao: string;
  selectedMesAno: string;
  selectedDataExtracao: string;
  availableMonths: string[];
  availableExtractionDates: string[];
}

function mapClientesCalendarState(
  row: Record<string, unknown>,
  requestedMesAno: string,
  requestedDataExtracao: string
): ClientesCalendarState {
  return {
    requestedMesAno,
    requestedDataExtracao,
    selectedMesAno: (row.selected_mes_ano as string) ?? '',
    selectedDataExtracao: (row.selected_data_extracao as string) ?? '',
    availableMonths: dateArray(row.available_months),
    availableExtractionDates: dateArray(row.available_extraction_dates),
  };
}

function mapClientesPageRow(row: Record<string, unknown>): ClientesPageRow {
  return {
    hotelId: num(row.hotel_id),
    hotelNome: (row.hotel_nome as string) ?? '',
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    totalUhs: num(row.total_uhs),
    status: (row.status as HotelSummary['status']) ?? 'critical',
    selectedMesAno: (row.selected_mes_ano as string) ?? '',
    selectedDataExtracao: (row.selected_data_extracao as string) ?? '',
    selectedDiaIni: num(row.selected_dia_ini),
    selectedDiaFim: num(row.selected_dia_fim),
    isFaixaParcial: Boolean(row.is_faixa_parcial),
    receitaMeta: nullableNum(row.receita_meta),
    receitaReal: num(row.receita_real),
    receitaMetaPct: nullableNum(row.receita_meta_pct),
    receitaMesAnterior: num(row.receita_mes_anterior),
    receitaMomAbs: num(row.receita_mom_abs),
    receitaMomPct: nullableNum(row.receita_mom_pct),
    receitaAnoAnterior: num(row.receita_ano_anterior),
    receitaYoyAbs: num(row.receita_yoy_abs),
    receitaYoyPct: nullableNum(row.receita_yoy_pct),
    receitaMetaYtd: nullableNum(row.receita_meta_ytd),
    receitaRealYtd: num(row.receita_real_ytd),
    receitaDeltaYtd: nullableNum(row.receita_delta_ytd),
    occReferencia: num(row.occ_referencia),
    dmReferencia: nullableNum(row.dm_referencia),
    revparReferencia: num(row.revpar_referencia),
  };
}

export function useClientesCalendar(mesAno?: string | null, dataExtracao?: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clientes-calendar', mesAno ?? '', dataExtracao ?? ''],
    queryFn: async (): Promise<ClientesCalendarState | null> => {
      const { data, error } = await supabase.rpc('rpc_clientes_calendar', {
        p_mes_ano: mesAno || null,
        p_data_extracao: dataExtracao || null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row
        ? mapClientesCalendarState(row as Record<string, unknown>, mesAno || '', dataExtracao || '')
        : null;
    },
  });

  return { calendar: data ?? null, loading: isLoading, error: errMsg(error) };
}

export function useClientesTable(mesAno?: string | null, dataExtracao?: string | null, diaIni?: number | null, diaFim?: number | null) {
  const enabled = !!mesAno && !!dataExtracao;
  const { data, isLoading, error } = useQuery({
    queryKey: ['clientes-table', mesAno ?? '', dataExtracao ?? '', diaIni ?? 0, diaFim ?? 0],
    enabled,
    queryFn: async (): Promise<ClientesPageRow[]> => {
      // Minimum loading window avoids a skeleton flash on fast fetches; only
      // applies on real fetches (cache hits skip the queryFn entirely).
      const startedAt = Date.now();
      const { data, error } = await supabase.rpc('rpc_clientes_table', {
        p_mes_ano: mesAno,
        p_data_extracao: dataExtracao,
        p_dia_ini: diaIni ?? null,
        p_dia_fim: diaFim ?? null,
      });
      if (error) throw error;
      const rows = ((data ?? []) as Record<string, unknown>[]).map(mapClientesPageRow);
      const remaining = CLIENTES_PAGE_MIN_LOADING_MS - (Date.now() - startedAt);
      if (remaining > 0) await sleep(remaining);
      return rows;
    },
  });

  return { rows: data ?? [], loading: isLoading, error: errMsg(error) };
}

export interface ClienteDetalheHeader {
  hotel: HotelRow;
  summary: HotelSummary;
  availableMonths: string[];
}

function mapClienteDetalheHeader(row: Record<string, unknown>): ClienteDetalheHeader {
  const hotel: HotelRow = {
    id: num(row.hotel_id),
    property_id: nullableNum(row.property_id),
    tipo: (row.tipo as HotelRow['tipo']) ?? 'cliente',
    razao_social: String(row.razao_social ?? ''),
    nome_fantasia: String(row.nome_fantasia ?? ''),
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    total_uhs: num(row.total_uhs),
    total_leitos: nullableNum(row.total_leitos),
    cadastur: (row.cadastur as string | null) ?? null,
    ativo: Boolean(row.ativo),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };

  const status = (row.status as HotelSummary['status']) ?? deriveStatus(0);
  const latestDate = (row.latest_date as string | null) ?? '-';
  const latestExtracao = (row.latest_extracao as string | null) ?? '-';
  const latestOcupados = num(row.latest_ocupados);
  const latestTotalUhs = num(row.latest_total_uhs) || hotel.total_uhs;

  return {
    hotel,
    availableMonths: dateArray(row.available_months),
    summary: {
      id: hotel.id,
      name: hotel.nome_fantasia,
      razaoSocial: hotel.razao_social,
      city: hotel.cidade ?? '-',
      state: hotel.estado ?? '-',
      uhs: latestTotalUhs || hotel.total_uhs,
      leitos: hotel.total_leitos,
      ativo: hotel.ativo,
      avgOcc: 0,
      avgRevpar: 0,
      avgDm: null,
      totalReceita: 0,
      totalRecDiarias: 0,
      totalRecAb: 0,
      diasComDados: 0,
      receitaMesAnterior: 0,
      receitaMesAtual: 0,
      receitaMesQueVem: 0,
      occMesAnterior: 0,
      occMesAtual: 0,
      occMesQueVem: 0,
      recDiariasMesAtual: 0,
      ocupadosMesAtual: latestOcupados,
      cortesiaMesAtual: 0,
      hospedesMesAtual: 0,
      diasMesAtual: 0,
      recDiariasMesAnterior: 0,
      ocupadosMesAnterior: 0,
      receitaAnoAnterior: 0,
      recDiariasAnoAnterior: 0,
      occAnoAnterior: 0,
      ocupadosAnoAnterior: 0,
      receitaYTD: 0,
      ocupadosYTD: 0,
      hospedesYTD: 0,
      occAvgYTD: 0,
      dmYTD: null,
      latestDate,
      latestExtracao,
      latestOcc: 0,
      latestRevpar: 0,
      latestDm: null,
      latestRecTotal: 0,
      latestOcupados,
      status,
    },
  };
}

export interface ClienteDetalheCalendarState {
  requestedMesAno: string;
  requestedDataExtracao: string;
  selectedMesAno: string;
  selectedDataExtracao: string;
  availableMonths: string[];
  availableExtractionDates: string[];
}

function mapClienteDetalheCalendarState(
  row: Record<string, unknown>,
  requestedMesAno: string,
  requestedDataExtracao: string
): ClienteDetalheCalendarState {
  return {
    requestedMesAno,
    requestedDataExtracao,
    selectedMesAno: (row.selected_mes_ano as string) ?? '',
    selectedDataExtracao: (row.selected_data_extracao as string) ?? '',
    availableMonths: dateArray(row.available_months),
    availableExtractionDates: dateArray(row.available_extraction_dates),
  };
}

export function useClienteDetalheCalendar(hotelId: number, mesAno?: string | null, dataExtracao?: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente-detalhe-calendar', hotelId, mesAno ?? '', dataExtracao ?? ''],
    enabled: !!hotelId,
    queryFn: async (): Promise<ClienteDetalheCalendarState | null> => {
      const { data, error } = await supabase.rpc('rpc_cliente_detalhe_calendar', {
        p_hotel_id: hotelId,
        p_mes_ano: mesAno || null,
        p_data_extracao: dataExtracao || null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row
        ? mapClienteDetalheCalendarState(row as Record<string, unknown>, mesAno || '', dataExtracao || '')
        : null;
    },
  });

  return { calendar: data ?? null, loading: isLoading, error: errMsg(error) };
}

export function useClienteDetalheHeader(hotelId: number) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['cliente-detalhe-header', hotelId],
    enabled: !!hotelId,
    queryFn: async (): Promise<ClienteDetalheHeader | null> => {
      const { data, error } = await supabase.rpc('rpc_cliente_detalhe_header', { p_hotel_id: hotelId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? mapClienteDetalheHeader(row as Record<string, unknown>) : null;
    },
  });

  const reload = useCallback(() => { void refetch(); }, [refetch]);
  return {
    hotel: data?.hotel ?? null,
    summary: data?.summary ?? null,
    availableMonths: data?.availableMonths ?? [],
    loading: isLoading,
    error: errMsg(error),
    reload,
  };
}

export interface ClienteDetalheCards {
  hotelId: number;
  selectedMesAno: string;
  selectedDataExtracao: string;
  selectedDiaIni: number;
  selectedDiaFim: number;
  isFaixaParcial: boolean;
  receitaAtual: number;
  occAtual: number;
  dmAtual: number;
  revparAtual: number;
  roomNightsAtual: number;
  hospedesAtual: number;
  receitaPrevYear: number;
  occPrevYear: number;
  dmPrevYear: number;
  revparPrevYear: number;
  roomNightsPrevYear: number;
  hospedesPrevYear: number;
  receitaYtd: number;
  occYtd: number;
  dmYtd: number;
  revparYtd: number;
  roomNightsYtd: number;
  hospedesYtd: number;
  receitaMeta: number | null;
  occMeta: number | null;
  dmMeta: number | null;
  revparMeta: number | null;
}

function mapClienteDetalheCards(row: Record<string, unknown>): ClienteDetalheCards {
  return {
    hotelId: num(row.hotel_id),
    selectedMesAno: String(row.selected_mes_ano ?? ''),
    selectedDataExtracao: String(row.selected_data_extracao ?? ''),
    selectedDiaIni: num(row.selected_dia_ini),
    selectedDiaFim: num(row.selected_dia_fim),
    isFaixaParcial: Boolean(row.is_faixa_parcial),
    receitaAtual: num(row.receita_atual),
    occAtual: num(row.occ_atual),
    dmAtual: num(row.dm_atual),
    revparAtual: num(row.revpar_atual),
    roomNightsAtual: num(row.room_nights_atual),
    hospedesAtual: num(row.hospedes_atual),
    receitaPrevYear: num(row.receita_prev_year),
    occPrevYear: num(row.occ_prev_year),
    dmPrevYear: num(row.dm_prev_year),
    revparPrevYear: num(row.revpar_prev_year),
    roomNightsPrevYear: num(row.room_nights_prev_year),
    hospedesPrevYear: num(row.hospedes_prev_year),
    receitaYtd: num(row.receita_ytd),
    occYtd: num(row.occ_ytd),
    dmYtd: num(row.dm_ytd),
    revparYtd: num(row.revpar_ytd),
    roomNightsYtd: num(row.room_nights_ytd),
    hospedesYtd: num(row.hospedes_ytd),
    receitaMeta: nullableNum(row.receita_meta),
    occMeta: nullableNum(row.occ_meta),
    dmMeta: nullableNum(row.dm_meta),
    revparMeta: nullableNum(row.revpar_meta),
  };
}

export function useClienteDetalheCards(hotelId: number, mesAno: string, dataExtracao?: string | null, diaIni?: number | null, diaFim?: number | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente-detalhe-cards', hotelId, mesAno, dataExtracao ?? '', diaIni ?? 0, diaFim ?? 0],
    enabled: !!hotelId && !!mesAno && !!dataExtracao,
    queryFn: async (): Promise<ClienteDetalheCards | null> => {
      const { data, error } = await supabase.rpc('rpc_cliente_detalhe_cards', {
        p_hotel_id: hotelId,
        p_mes_ano: mesAno,
        p_data_extracao: dataExtracao,
        p_dia_ini: diaIni ?? null,
        p_dia_fim: diaFim ?? null,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row ? mapClienteDetalheCards(row as Record<string, unknown>) : null;
    },
  });

  return { cards: data ?? null, loading: isLoading, error: errMsg(error) };
}

function mapClientePickupRow(row: Record<string, unknown>): PickupRow {
  return {
    hotel_id: num(row.hotel_id),
    data_extracao: String(row.data_extracao ?? ''),
    data_extracao_ant: row.data_extracao_ant == null ? null : String(row.data_extracao_ant),
    data_referencia: String(row.data_referencia ?? ''),
    pu_tt_uh: num(row.pu_tt_uh),
    pu_rec_hosp: String(row.pu_rec_hosp ?? 0),
    pu_dm_tt: String(row.pu_dm_tt ?? 0),
    pu_occ_tt: String(row.pu_occ_tt ?? 0),
    pu_revpar_tt: String(row.pu_revpar_tt ?? 0),
    tt_uhs_ocup: num(row.tt_uhs_ocup),
    rec_hosp: String(row.rec_hosp ?? 0),
    dm_cc_tt: String(row.dm_cc_tt ?? 0),
    occ_tt: String(row.occ_tt ?? 0),
    revp_tt: String(row.revp_tt ?? 0),
    tt_hosp: nullableNum(row.tt_hosp),
    chds: nullableNum(row.chds),
    uhs_disp: num(row.uhs_disp),
    uhs: num(row.uhs),
  };
}

export function useClientePickupDiario(hotelId: number, mesAno: string, dataExtracao?: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente-pickup-diario', hotelId, mesAno, dataExtracao ?? ''],
    enabled: !!hotelId && !!mesAno && !!dataExtracao,
    queryFn: async (): Promise<PickupRow[]> => {
      const pageSize = 1000;
      const loaded: Record<string, unknown>[] = [];

      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .rpc('rpc_cliente_pickup_diario', {
            p_hotel_id: hotelId,
            p_mes_ano: mesAno,
            p_data_extracao: dataExtracao,
          })
          .range(from, from + pageSize - 1);

        if (error) throw error;
        const page = (data ?? []) as Record<string, unknown>[];
        loaded.push(...page);
        if (page.length < pageSize) break;
      }

      return loaded.map(mapClientePickupRow);
    },
  });

  return { rows: data ?? [], loading: isLoading, error: errMsg(error) };
}

async function fetchClienteRateShopperMonth(
  hotelId: number,
  yearMonth: string,
  from: string,
  keepLatest: boolean
): Promise<BookingRate[]> {
  if (!hotelId || !yearMonth) return [];

  const { data, error } = await supabase.rpc('rpc_cliente_rate_shopper', {
    p_hotel_id: hotelId,
    p_mes_ano: yearMonth,
    p_from: from,
    p_keep_latest: keepLatest,
  });

  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(parseBookingRate);
}

export function useClienteRateShopper(
  hotelId: number,
  yearMonth: string,
  from = localDateKey(),
  keepLatest = true
) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente-rate-shopper', hotelId, yearMonth, from, keepLatest],
    enabled: !!hotelId && !!yearMonth,
    queryFn: () => fetchClienteRateShopperMonth(hotelId, yearMonth, from, keepLatest),
    // Sem cache no shopper: sempre busca o estado atual (o on-demand muda os preços fora
    // do ciclo das 09:30; servir cache "fresh" mostraria dado velho até fechar a aba).
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  return { rates: data ?? [], loading: isLoading, error: errMsg(error) };
}

export function useClienteRateShopperForMonths(hotelId: number, yearMonths: string[]) {
  const monthsKey = yearMonths.join('|');
  const { data, isLoading, error } = useQuery({
    queryKey: ['cliente-rate-shopper-months', hotelId, monthsKey],
    enabled: !!hotelId && [...new Set(monthsKey.split('|').filter(Boolean))].length > 0,
    queryFn: async (): Promise<BookingRate[]> => {
      const months = [...new Set(monthsKey.split('|').filter(Boolean))].sort();
      const loaded = await Promise.all(
        months.map(month => fetchClienteRateShopperMonth(hotelId, month, `${month}-01`, false))
      );
      return loaded.flat();
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  return { rates: data ?? [], loading: isLoading, error: errMsg(error) };
}

// Monthly pickup KPIs for the Pickup > Mensal tab.

export interface PickupMensalKpi {
  hotelId: number;
  hotelNome: string;
  hotelAtivo: boolean;
  ano: number;
  mes: number;
  mesAno: string;
  primeiraExtracao: string | null;
  ultimaExtracao: string | null;
  diasReferencia: number;
  extracoes: number;
  snapshotsComparaveis: number;
  diasComAlteracao: number;
  alteracoesDiariasMes: number;
  pickupUhs: number;
  pickupReceita: number;
  pickupOccMediaPp: number;
  pickupReceitaPorUh: number | null;
  receitaReal: number;
  uhsOcupadasReal: number;
  occRealMedia: number;
  dmRealMedia: number;
  revparRealMedia: number;
  receitaMeta: number | null;
  occMeta: number | null;
  dmMeta: number | null;
  revparMeta: number | null;
  receitaVsMeta: number | null;
  receitaMetaPct: number | null;
  receitaMom: number | null;
  receitaMomPct: number | null;
  pickupReceitaMom: number | null;
  pickupReceitaMomPct: number | null;
  pickupUhsMom: number | null;
}

export function usePickupMensalKpis(hotelId: number, ano: number) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['pickup-mensal-kpis', hotelId, ano],
    enabled: !!hotelId && !!ano,
    queryFn: async (): Promise<PickupMensalKpi[]> => {
      const { data, error } = await supabase.rpc('rpc_cliente_pickup_mensal', {
        p_hotel_id: hotelId,
        p_ano: ano,
      });
      if (error) throw error;

      return ((data ?? []) as Record<string, unknown>[]).map(r => ({
        hotelId: num(r.hotel_id),
        hotelNome: (r.hotel_nome as string) ?? '',
        hotelAtivo: Boolean(r.hotel_ativo),
        ano: num(r.ano),
        mes: num(r.mes),
        mesAno: (r.mes_ano as string) ?? '',
        primeiraExtracao: (r.primeira_extracao as string | null) ?? null,
        ultimaExtracao: (r.ultima_extracao as string | null) ?? null,
        diasReferencia: num(r.dias_referencia),
        extracoes: num(r.extracoes),
        snapshotsComparaveis: num(r.snapshots_comparaveis),
        diasComAlteracao: num(r.dias_com_alteracao),
        alteracoesDiariasMes: num(r.alteracoes_diarias_mes ?? r.dias_com_alteracao),
        pickupUhs: num(r.pickup_uhs),
        pickupReceita: num(r.pickup_receita),
        pickupOccMediaPp: num(r.pickup_occ_media_pp),
        pickupReceitaPorUh: nullableNum(r.pickup_receita_por_uh),
        receitaReal: num(r.receita_real),
        uhsOcupadasReal: num(r.uhs_ocupadas_real),
        occRealMedia: num(r.occ_real_media),
        dmRealMedia: num(r.dm_real_media),
        revparRealMedia: num(r.revpar_real_media),
        receitaMeta: nullableNum(r.receita_meta),
        occMeta: nullableNum(r.occ_meta),
        dmMeta: nullableNum(r.dm_meta),
        revparMeta: nullableNum(r.revpar_meta),
        receitaVsMeta: nullableNum(r.receita_vs_meta),
        receitaMetaPct: nullableNum(r.receita_meta_pct),
        receitaMom: nullableNum(r.receita_mom),
        receitaMomPct: nullableNum(r.receita_mom_pct),
        pickupReceitaMom: nullableNum(r.pickup_receita_mom),
        pickupReceitaMomPct: nullableNum(r.pickup_receita_mom_pct),
        pickupUhsMom: nullableNum(r.pickup_uhs_mom),
      }));
    },
  });

  return { rows: data ?? [], loading: isLoading, error: errMsg(error) };
}

export function useClientePickupMensal(hotelId: number, ano: number) {
  return usePickupMensalKpis(hotelId, ano);
}

// ─── Pickup Acumulado Mensal ─────────────────────────────────────────
// For each data_referencia, computes delta = last extraction of month − first extraction of month.

export interface PickupMensalRow {
  dataReferencia:    string;
  dataExtracaoFirst: string;
  dataExtracaoLast:  string;
  uhsTotal:          number;
  uhsFirst:          number;
  uhsLast:           number;
  occFirst:          number;
  occLast:           number;
  recFirst:          number;
  recLast:           number;
  deltaUhs:          number;
  deltaReceita:      number;
  deltaOcc:          number;
  totalSnapshots:    number;
}

export function usePickupAcumuladoMensal(hotelId: number, extracaoMes: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['pickup-acumulado-mensal', hotelId, extracaoMes],
    enabled: !!hotelId && !!extracaoMes,
    queryFn: async (): Promise<{ rows: PickupMensalRow[]; extracaoRange: { first: string; last: string } | null }> => {
      const [y, m] = extracaoMes.split('-').map(Number);
      const from = `${extracaoMes}-01`;
      const to   = `${extracaoMes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('pickup_acumulado')
        .select('hotel_id,data_referencia,data_extracao,uhs_total,uhs_ocupadas,occ_pct,rec_total,total_snapshots')
        .eq('hotel_id', hotelId)
        .gte('data_extracao',    from)
        .lte('data_extracao',    to)
        .gte('data_referencia',  from)
        .lte('data_referencia',  to)
        .order('data_referencia', { ascending: true })
        .order('data_extracao',   { ascending: true });

      if (error) throw error;
      const raw = (data ?? []) as Record<string, unknown>[];

      const byRef = new Map<string, Array<{
        dataExtracao: string; uhs: number; uhsTotal: number;
        occ: number; rec: number; snaps: number;
      }>>();
      for (const r of raw) {
        const dr  = r.data_referencia as string;
        const arr = byRef.get(dr) ?? [];
        arr.push({
          dataExtracao: r.data_extracao as string,
          uhs:     (r.uhs_ocupadas  as number) ?? 0,
          uhsTotal:(r.uhs_total     as number) ?? 0,
          occ:     parseFloat(String(r.occ_pct))  || 0,
          rec:     parseFloat(String(r.rec_total)) || 0,
          snaps:   (r.total_snapshots as number)  ?? 0,
        });
        byRef.set(dr, arr);
      }

      const allExtracoes = [...new Set(raw.map(r => r.data_extracao as string))].sort();
      const extracaoRange = allExtracoes.length > 0
        ? { first: allExtracoes[0], last: allExtracoes[allExtracoes.length - 1] }
        : null;

      const result: PickupMensalRow[] = [];
      for (const [dr, snaps] of byRef) {
        const sorted = snaps.sort((a, b) => a.dataExtracao.localeCompare(b.dataExtracao));
        const first  = sorted[0];
        const last   = sorted[sorted.length - 1];
        result.push({
          dataReferencia:    dr,
          dataExtracaoFirst: first.dataExtracao,
          dataExtracaoLast:  last.dataExtracao,
          uhsTotal:          last.uhsTotal,
          uhsFirst:          first.uhs,
          uhsLast:           last.uhs,
          occFirst:          first.occ,
          occLast:           last.occ,
          recFirst:          first.rec,
          recLast:           last.rec,
          deltaUhs:          last.uhs  - first.uhs,
          deltaReceita:      last.rec  - first.rec,
          deltaOcc:          parseFloat((last.occ - first.occ).toFixed(1)),
          totalSnapshots:    sorted.length,
        });
      }
      result.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia));

      return { rows: result, extracaoRange };
    },
  });

  return { rows: data?.rows ?? [], extracaoRange: data?.extracaoRange ?? null, loading: isLoading };
}
