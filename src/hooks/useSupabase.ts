import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { localDateKey } from '@/lib/utils';
import { buildHotelSummary, parseKpiRow, deriveStatus } from '@/data/transforms';
import type { HotelRow, ReceitaDiariaRow, KpiDiario, HotelSummary, PickupRow, BookingRate, HotelMeta } from '@/data/types';

const CLIENTES_PAGE_MIN_LOADING_MS = 1000;

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function fetchClientHotelIds(): Promise<number[]> {
  const { data, error } = await supabase
    .from('hotel')
    .select('id')
    .eq('tipo', 'cliente');

  if (error) throw error;
  return ((data ?? []) as Array<{ id: number }>).map(r => r.id);
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

function keepLatestBookingRatesByHotelDate(rates: BookingRate[], minDate: string): BookingRate[] {
  const latestBySlugDate = new Map<string, string>();
  for (const r of rates) {
    const key = `${r.slug}|${r.checkinDate}`;
    const cur = latestBySlugDate.get(key);
    if (!cur || r.scrapedAt > cur) latestBySlugDate.set(key, r.scrapedAt);
  }

  return rates.filter(r => {
    const key = `${r.slug}|${r.checkinDate}`;
    return r.checkinDate >= minDate && r.scrapedAt === latestBySlugDate.get(key);
  });
}

async function fetchBookingRatesRange(hotelId: number, from: string, to: string, keepLatest = true): Promise<BookingRate[]> {
  if (!hotelId || from > to) return [];

  const pageSize = 1000;
  const rawRows: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('vw_booking_rates')
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

  const rates = rawRows.map(parseBookingRate).filter(r => r.checkinDate >= from);
  return keepLatest ? keepLatestBookingRatesByHotelDate(rates, from) : rates;
}

// ─── Fetch all hotels via pre-aggregated view ────────────────────────

export function useHotels() {
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const clientIds = await fetchClientHotelIds();

        if (clientIds.length === 0) {
          setHotels([]);
          return;
        }

        const { data, error: err } = await supabase
          .from('vw_hotel_summary')
          .select('*')
          .in('id', clientIds);

        if (err) throw err;

        const summaries: HotelSummary[] = ((data ?? []) as Record<string, unknown>[]).map(r => ({
          id:          r.id          as number,
          name:        r.nome_fantasia as string,
          razaoSocial: r.razao_social  as string,
          city:        (r.cidade       as string) ?? '—',
          state:       (r.estado       as string) ?? '—',
          uhs:         r.total_uhs     as number,
          leitos:      r.total_leitos  as number | null,
          ativo:       r.ativo         as boolean,

          // Aggregated — use view values as best proxies
          avgOcc:          num(r.occ_mes_atual),
          avgRevpar:       num(r.revpar_mes_atual),
          avgDm:           nullableNum(r.dm_mes_atual),
          totalReceita:    (r.receita_ytd    as number) ?? 0,
          totalRecDiarias: 0,
          totalRecAb:      0,
          diasComDados:    (r.dias_mes_atual as number) ?? 0,

          // Current month
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

          // YoY (mesmo mês ano anterior)
          receitaAnoAnterior:     (r.receita_ano_anterior     as number) ?? 0,
          recDiariasAnoAnterior:  (r.rec_diarias_ano_anterior as number) ?? 0,
          occAnoAnterior:         (r.occ_ano_anterior         as number) ?? 0,
          ocupadosAnoAnterior:    (r.ocupados_ano_anterior    as number) ?? 0,

          // YTD
          receitaYTD:   (r.receita_ytd   as number) ?? 0,
          occAvgYTD:    (r.occ_avg_ytd   as number) ?? 0,
          ocupadosYTD:  (r.ocupados_ytd  as number) ?? 0,
          hospedesYTD:  (r.hospedes_ytd  as number) ?? 0,
          dmYTD:         r.dm_ytd        as number | null,

          // Latest day snapshot
          latestDate:      (r.latest_date      as string) ?? '—',
          latestExtracao:  (r.latest_extracao  as string) ?? '—',
          latestOcupados:  (r.latest_ocupados  as number) ?? 0,
          latestOcc:       (r.latest_occ       as number) ?? 0,
          latestRevpar:    num(r.latest_revpar),
          latestDm:         r.latest_dm        as number | null,
          latestRecTotal:  (r.latest_rec_total as number) ?? 0,

          status: deriveStatus(num(r.occ_mes_atual)),
        }));

        setHotels(summaries);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar hotéis');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { hotels, loading, error };
}

// ─── Fetch a single hotel with full detail ──────────────────────────

export function useHotelDetail(id: number) {
  const [hotel, setHotel] = useState<HotelRow | null>(null);
  const [kpis, setKpis] = useState<KpiDiario[]>([]);
  const [summary, setSummary] = useState<HotelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: hotelData, error: hErr } = await supabase
          .from('hotel')
          .select('*')
          .eq('id', id)
          .single();

        if (hErr) throw hErr;

        const { data: kpiRows, error: kErr } = await supabase
          .from('vw_hotel_receita_diaria_atual')
          .select('*')
          .eq('hotel_id', id)
          .order('data_referencia', { ascending: true });

        if (kErr) throw kErr;

        const parsed = ((kpiRows ?? []) as ReceitaDiariaRow[]).map(parseKpiRow);

        setHotel(hotelData as HotelRow);
        setKpis(parsed);
        setSummary(buildHotelSummary(hotelData as HotelRow, (kpiRows ?? []) as ReceitaDiariaRow[]));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar hotel');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, version]);

  return { hotel, kpis, summary, loading, error, reload };
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
  return { success: true };
}

// ─── Fetch booking rates (rate shopper) for a hotel + month ─────────

export function useBookingRates(hotelId: number, yearMonth: string) {
  const [rates, setRates] = useState<BookingRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const monthStart = `${yearMonth}-01`;
      const today = localDateKey();
      const from = monthStart < today ? today : monthStart;
      const [y, mo] = yearMonth.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const to = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

      try {
        setRates(await fetchBookingRatesRange(hotelId, from, to));
      } catch {
        setRates([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [hotelId, yearMonth]);

  return { rates, loading };
}

export function useBookingRatesForMonths(hotelId: number, yearMonths: string[]) {
  const [rates, setRates] = useState<BookingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const monthsKey = yearMonths.join('|');

  useEffect(() => {
    async function load() {
      setLoading(true);
      const months = [...new Set(monthsKey.split('|').filter(Boolean))].sort();
      const today = localDateKey();

      if (!hotelId || months.length === 0) {
        setRates([]);
        setLoading(false);
        return;
      }

      const firstMonth = months[0];
      const lastMonth = months[months.length - 1];
      const [lastY, lastM] = lastMonth.split('-').map(Number);
      const lastDay = new Date(lastY, lastM, 0).getDate();
      const monthStart = `${firstMonth}-01`;
      const from = monthStart < today ? today : monthStart;
      const to = `${lastMonth}-${String(lastDay).padStart(2, '0')}`;

      try {
        const loaded = await fetchBookingRatesRange(hotelId, from, to, false);
        setRates(loaded.filter(r => months.includes(r.checkinDate.slice(0, 7))));
      } catch {
        setRates([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [hotelId, monthsKey]);

  return { rates, loading };
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
  const [rows, setRows]       = useState<MonthlyKpi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const clientIds = await fetchClientHotelIds();
        if (clientIds.length === 0) {
          setRows([]);
          return;
        }

        const { data, error } = await supabase
          .from('vw_hotel_monthly_kpis')
          .select('*')
          .in('hotel_id', clientIds);
        if (!error && data) {
          setRows((data as Record<string, unknown>[]).map(r => ({
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
          })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { rows, loading };
}

// ─── Hotel Metas (goals) ─────────────────────────────────────────────

export function useHotelMetas(mesAno: string) {
  const [metas, setMetas] = useState<HotelMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!mesAno) return;
    async function load() {
      setLoading(true);
      try {
        const clientIds = await fetchClientHotelIds();
        if (clientIds.length === 0) {
          setMetas([]);
          return;
        }

        const { data, error } = await supabase
          .from('hotel_metas')
          .select('*')
          .eq('mes_ano', mesAno)
          .in('hotel_id', clientIds);

        if (!error && data) {
          setMetas((data as Record<string, unknown>[]).map(r => ({
            id:           r.id          as number,
            hotelId:      r.hotel_id    as number,
            mesAno:       r.mes_ano     as string,
            receitaMeta:  r.receita_meta as number | null,
            occMeta:      r.occ_meta    as number | null,
            dmMeta:       r.dm_meta     as number | null,
            revparMeta:   r.revpar_meta as number | null,
          })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [mesAno, version]);

  return { metas, loading, reload };
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
  return { success: true };
}

// ─── Fetch pick-up data for a hotel ─────────────────────────────────

export function usePickup(hotelId: number) {
  const [rows, setRows] = useState<PickupRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
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

        if (error) break;
        const page = (data ?? []) as PickupRow[];
        allRows.push(...page);
        if (page.length < pageSize) break;
        from += pageSize;
      }

      setRows(allRows.filter(r => isPickupExtractionAllowed(r.data_extracao, r.data_referencia)));
      setLoading(false);
    }
    load();
  }, [hotelId]);

  return { rows, loading };
}

// ─── All metas (for history table with meta columns) ─────────────────

export function useAllMetas() {
  const [metas, setMetas] = useState<HotelMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const clientIds = await fetchClientHotelIds();
        if (clientIds.length === 0) {
          setMetas([]);
          return;
        }

        const { data, error } = await supabase
          .from('hotel_metas')
          .select('*')
          .in('hotel_id', clientIds);

        if (!error && data) {
          setMetas((data as Record<string, unknown>[]).map(r => ({
            id:           r.id           as number,
            hotelId:      r.hotel_id     as number,
            mesAno:       r.mes_ano      as string,
            receitaMeta:  r.receita_meta as number | null,
            occMeta:      r.occ_meta     as number | null,
            dmMeta:       r.dm_meta      as number | null,
            revparMeta:   r.revpar_meta  as number | null,
          })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { metas, loading };
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
  const [summaries, setSummaries] = useState<PickupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const clientIds = await fetchClientHotelIds();
        if (clientIds.length === 0) {
          setSummaries([]);
          return;
        }

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

        if (!error && data) {
          const byHotel = new Map<number, { uhs: number; rec: number }>();
          for (const r of data as Record<string, unknown>[]) {
            if (r.data_extracao_ant == null) continue;
            if (!isPickupExtractionAllowed(r.data_extracao as string | null, r.data_referencia as string | null)) continue;
            const hid = r.hotel_id as number;
            const acc = byHotel.get(hid) ?? { uhs: 0, rec: 0 };
            acc.uhs += (r.pu_tt_uh as number) || 0;
            acc.rec += parseFloat(String(r.pu_rec_hosp)) || 0;
            byHotel.set(hid, acc);
          }
          setSummaries([...byHotel.entries()].map(([hid, v]) => ({
            hotelId: hid,
            pu7dUhs: v.uhs,
            pu7dReceita: v.rec,
          })));
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { summaries, loading };
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
  const [alerts, setAlerts] = useState<TodayPickupAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const clientIds = await fetchClientHotelIds();
        if (clientIds.length === 0) {
          setAlerts([]);
          return;
        }

        const today = localDateKey();
        const { data, error: err } = await supabase
          .from('vw_pickup_diario')
          .select('hotel_id,data_extracao,data_extracao_ant,data_referencia,pu_tt_uh,pu_rec_hosp,pu_dm_tt,pu_occ_tt,pu_revpar_tt')
          .in('hotel_id', clientIds)
          .eq('data_extracao', today)
          .order('hotel_id', { ascending: true })
          .order('data_referencia', { ascending: true });

        if (err) throw err;

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

        setAlerts(
          [...byHotel.entries()]
            .map(([hotelId, alert]) => ({
              hotelId,
              dataExtracao: alert.dataExtracao,
              alteracoes: alert.alteracoes,
              pickupUhs: alert.pickupUhs,
              pickupReceita: alert.pickupReceita,
              referencias: [...alert.referencias].sort(),
            }))
            .sort((a, b) => b.alteracoes - a.alteracoes || Math.abs(b.pickupReceita) - Math.abs(a.pickupReceita))
        );
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar alertas de pick-up');
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { alerts, loading, error };
}

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

function dateArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => String(item)).filter(Boolean);
}

function mapHomePageRow(row: Record<string, unknown>): HomePageRow {
  return {
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
  const [rows, setRows] = useState<HomePageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const date = dataExtracao || localDateKey();
      const month = mesAno || date.slice(0, 7);

      try {
        const { data, error: err } = await supabase.rpc('rpc_home_page', {
          p_mes_ano: month,
          p_data_extracao: date,
        });

        if (err) throw err;
        setRows(((data ?? []) as Record<string, unknown>[]).map(mapHomePageRow));
      } catch (err: unknown) {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Erro ao carregar Home');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [dataExtracao, mesAno]);

  return { rows, loading, error };
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
  const [rows, setRows] = useState<MetasPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!mesAno) {
      setRows([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc('rpc_metas_page', {
          p_mes_ano: mesAno,
        });

        if (err) throw err;
        setRows(((data ?? []) as Record<string, unknown>[]).map(mapMetasPageRow));
      } catch (err: unknown) {
        setRows([]);
        setError(err instanceof Error ? err.message : 'Erro ao carregar metas');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [mesAno, version]);

  return { rows, loading, error, reload };
}

export interface ClientesPageRow {
  hotelId: number;
  hotelNome: string;
  cidade: string | null;
  estado: string | null;
  totalUhs: number;
  status: HotelSummary['status'];
  availableMonths: string[];
  selectedMesAno: string;
  selectedDataPosicao: string;
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

function mapClientesPageRow(row: Record<string, unknown>): ClientesPageRow {
  return {
    hotelId: num(row.hotel_id),
    hotelNome: (row.hotel_nome as string) ?? '',
    cidade: (row.cidade as string | null) ?? null,
    estado: (row.estado as string | null) ?? null,
    totalUhs: num(row.total_uhs),
    status: (row.status as HotelSummary['status']) ?? 'critical',
    availableMonths: (row.available_months as string[] | null) ?? [],
    selectedMesAno: (row.selected_mes_ano as string) ?? '',
    selectedDataPosicao: (row.selected_data_posicao as string) ?? '',
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

export function useClientesPage(mesAno: string, dataPosicao: string) {
  const [rows, setRows] = useState<ClientesPageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mesAno || !dataPosicao) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      const startedAt = Date.now();
      const waitForMinimumLoading = async () => {
        const remaining = CLIENTES_PAGE_MIN_LOADING_MS - (Date.now() - startedAt);
        if (remaining > 0) await sleep(remaining);
      };

      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc('rpc_clientes_page', {
          p_mes_ano: mesAno,
          p_data_posicao: dataPosicao,
        });

        if (err) throw err;
        const nextRows = ((data ?? []) as Record<string, unknown>[]).map(mapClientesPageRow);
        await waitForMinimumLoading();
        if (!cancelled) setRows(nextRows);
      } catch (err: unknown) {
        await waitForMinimumLoading();
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : 'Erro ao carregar clientes');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [mesAno, dataPosicao]);

  return { rows, loading, error };
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

export function useClienteDetalheHeader(hotelId: number) {
  const [header, setHeader] = useState<ClienteDetalheHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!hotelId) {
      setHeader(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc('rpc_cliente_detalhe_header', {
          p_hotel_id: hotelId,
        });

        if (err) throw err;
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled) setHeader(row ? mapClienteDetalheHeader(row as Record<string, unknown>) : null);
      } catch (err: unknown) {
        if (!cancelled) {
          setHeader(null);
          setError(err instanceof Error ? err.message : 'Erro ao carregar hotel');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [hotelId, version]);

  return {
    hotel: header?.hotel ?? null,
    summary: header?.summary ?? null,
    availableMonths: header?.availableMonths ?? [],
    loading,
    error,
    reload,
  };
}

export interface ClienteDetalheCards {
  hotelId: number;
  selectedMesAno: string;
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

export function useClienteDetalheCards(hotelId: number, mesAno: string) {
  const [cards, setCards] = useState<ClienteDetalheCards | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId || !mesAno) {
      setCards(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc('rpc_cliente_detalhe_cards', {
          p_hotel_id: hotelId,
          p_mes_ano: mesAno,
        });

        if (err) throw err;
        const row = Array.isArray(data) ? data[0] : data;
        if (!cancelled) setCards(row ? mapClienteDetalheCards(row as Record<string, unknown>) : null);
      } catch (err: unknown) {
        if (!cancelled) {
          setCards(null);
          setError(err instanceof Error ? err.message : 'Erro ao carregar indicadores');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [hotelId, mesAno]);

  return { cards, loading, error };
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

export function useClientePickupDiario(hotelId: number, mesAno: string) {
  const [rows, setRows] = useState<PickupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId || !mesAno) {
      setRows([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pageSize = 1000;
        const loaded: Record<string, unknown>[] = [];

        for (let from = 0; ; from += pageSize) {
          const { data, error: err } = await supabase
            .rpc('rpc_cliente_pickup_diario', {
              p_hotel_id: hotelId,
              p_mes_ano: mesAno,
            })
            .range(from, from + pageSize - 1);

          if (err) throw err;
          const page = (data ?? []) as Record<string, unknown>[];
          loaded.push(...page);
          if (cancelled || page.length < pageSize) break;
        }

        if (!cancelled) setRows(loaded.map(mapClientePickupRow));
      } catch (err: unknown) {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : 'Erro ao carregar pick-up diario');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [hotelId, mesAno]);

  return { rows, loading, error };
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
  const [rates, setRates] = useState<BookingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId || !yearMonth) {
      setRates([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await fetchClienteRateShopperMonth(hotelId, yearMonth, from, keepLatest);
        if (!cancelled) setRates(loaded);
      } catch (err: unknown) {
        if (!cancelled) {
          setRates([]);
          setError(err instanceof Error ? err.message : 'Erro ao carregar rate shopper');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [from, hotelId, keepLatest, yearMonth]);

  return { rates, loading, error };
}

export function useClienteRateShopperForMonths(hotelId: number, yearMonths: string[]) {
  const [rates, setRates] = useState<BookingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const monthsKey = yearMonths.join('|');

  useEffect(() => {
    const months = [...new Set(monthsKey.split('|').filter(Boolean))].sort();
    if (!hotelId || months.length === 0) {
      setRates([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const loaded = await Promise.all(months.map(month => {
          return fetchClienteRateShopperMonth(hotelId, month, `${month}-01`, false);
        }));

        if (!cancelled) setRates(loaded.flat());
      } catch (err: unknown) {
        if (!cancelled) {
          setRates([]);
          setError(err instanceof Error ? err.message : 'Erro ao carregar rate shopper');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [hotelId, monthsKey]);

  return { rates, loading, error };
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

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNum(value: unknown): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function usePickupMensalKpis(hotelId: number, ano: number) {
  const [rows, setRows] = useState<PickupMensalKpi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hotelId || !ano) {
      setRows([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: err } = await supabase.rpc('rpc_cliente_pickup_mensal', {
          p_hotel_id: hotelId,
          p_ano: ano,
        });

        if (err) throw err;

        setRows(((data ?? []) as Record<string, unknown>[]).map(r => ({
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
        })));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar pickup mensal');
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [hotelId, ano]);

  return { rows, loading, error };
}

export function useClientePickupMensal(hotelId: number, ano: number) {
  return usePickupMensalKpis(hotelId, ano);
}

// ─── Pickup Acumulado Mensal ─────────────────────────────────────────
// For each data_referencia, computes delta = last extraction of month − first extraction of month.
// This gives the true within-month accumulated pickup (not since first-ever extraction).

export interface PickupMensalRow {
  dataReferencia:    string;   // the night being analyzed
  dataExtracaoFirst: string;   // first extraction captured in this month
  dataExtracaoLast:  string;   // last extraction captured in this month
  uhsTotal:          number;
  uhsFirst:          number;   // UHs occupied at first extraction
  uhsLast:           number;   // UHs occupied at last extraction
  occFirst:          number;
  occLast:           number;
  recFirst:          number;
  recLast:           number;
  deltaUhs:          number;   // uhsLast − uhsFirst
  deltaReceita:      number;   // recLast − recFirst
  deltaOcc:          number;   // occLast − occFirst (pp)
  totalSnapshots:    number;   // how many extractions captured this night in the month
}

export function usePickupAcumuladoMensal(hotelId: number, extracaoMes: string) {
  const [rows, setRows]             = useState<PickupMensalRow[]>([]);
  const [extracaoRange, setRange]   = useState<{ first: string; last: string } | null>(null);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    if (!hotelId || !extracaoMes) { setRows([]); setRange(null); setLoading(false); return; }

    async function load() {
      setLoading(true);
      const [y, m] = extracaoMes.split('-').map(Number);
      const from = `${extracaoMes}-01`;
      const to   = `${extracaoMes}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('pickup_acumulado')
        .select('hotel_id,data_referencia,data_extracao,uhs_total,uhs_ocupadas,occ_pct,rec_total,total_snapshots')
        .eq('hotel_id', hotelId)
        .gte('data_extracao',    from)
        .lte('data_extracao',    to)
        .gte('data_referencia',  from)   // só noites do mesmo mês
        .lte('data_referencia',  to)
        .order('data_referencia', { ascending: true })
        .order('data_extracao',   { ascending: true });

      if (!error && data) {
        const raw = data as Record<string, unknown>[];

        // Group all snapshots by data_referencia
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

        // Collect extraction date range for the month
        const allExtracoes = [...new Set(raw.map(r => r.data_extracao as string))].sort();
        setRange(allExtracoes.length > 0
          ? { first: allExtracoes[0], last: allExtracoes[allExtracoes.length - 1] }
          : null);

        // Build per-referencia rows: delta = last − first within this extraction month
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

        setRows(result.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia)));
      }
      setLoading(false);
    }

    load();
  }, [hotelId, extracaoMes]);

  return { rows, extracaoRange, loading };
}
