import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { buildHotelSummary, parseKpiRow, deriveStatus } from '@/data/transforms';
import type { HotelRow, ReceitaDiariaRow, KpiDiario, HotelSummary, PickupRow, BookingRate, HotelMeta } from '@/data/types';

// ─── Fetch all hotels via pre-aggregated view ────────────────────────

export function useHotels() {
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error: err } = await supabase
          .from('vw_hotel_summary')
          .select('*');

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
          avgOcc:          (r.occ_mes_atual  as number) ?? 0,
          avgRevpar:       0,
          avgDm:           null,
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
          occMesAtual:            (r.occ_mes_atual            as number) ?? 0,
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
          latestRevpar:    0,
          latestDm:         r.latest_dm        as number | null,
          latestRecTotal:  (r.latest_rec_total as number) ?? 0,

          status: deriveStatus((r.occ_mes_atual as number) ?? 0),
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
          .from('hotel_receita_diaria')
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
      const from = `${yearMonth}-01`;
      const [y, mo] = yearMonth.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const to = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('booking_rates')
        .select('*')
        .eq('hotel_id', hotelId)
        .gte('checkin_date', from)
        .lte('checkin_date', to)
        .order('checkin_date', { ascending: true });

      if (!error && data) {
        setRates((data as Record<string, unknown>[]).map(r => ({
          id: r.id as number,
          hotelId: r.hotel_id as number,
          checkinDate: r.checkin_date as string,
          slug: r.slug as string,
          label: r.label as string,
          type: r.type as 'cliente' | 'concorrente',
          roomName: r.room_name as string,
          roomId: r.room_id as string | null,
          maxPersons: r.max_persons as number,
          mealPlan: r.meal_plan as string | null,
          cancellation: r.cancellation as string | null,
          priceBrl: r.price_brl as number,
          scrapedAt: r.scraped_at as string,
        })));
      }
      setLoading(false);
    }
    load();
  }, [hotelId, yearMonth]);

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
      const { data, error } = await supabase
        .from('vw_hotel_monthly_kpis')
        .select('*');
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
      setLoading(false);
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
      const { data, error } = await supabase
        .from('hotel_metas')
        .select('*')
        .eq('mes_ano', mesAno);

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
      setLoading(false);
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
      const { data, error } = await supabase
        .from('vw_pickup_diario')
        .select('*')
        .eq('hotel_id', hotelId)
        .order('data_referencia', { ascending: true });

      if (!error && data) setRows(data as PickupRow[]);
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
      const { data, error } = await supabase
        .from('hotel_metas')
        .select('*');

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
      setLoading(false);
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

export function usePickupSummary() {
  const [summaries, setSummaries] = useState<PickupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const now = new Date();
      const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const from = `${mesAtual}-01`;
      const [y, mo] = mesAtual.split('-').map(Number);
      const lastDay = new Date(y, mo, 0).getDate();
      const to = `${mesAtual}-${String(lastDay).padStart(2, '0')}`;

      const { data, error } = await supabase
        .from('vw_pickup_diario')
        .select('hotel_id, pu_tt_uh, pu_rec_hosp, data_extracao_ant')
        .gte('data_referencia', from)
        .lte('data_referencia', to);

      if (!error && data) {
        const byHotel = new Map<number, { uhs: number; rec: number }>();
        for (const r of data as Record<string, unknown>[]) {
          if (r.data_extracao_ant == null) continue;
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
      setLoading(false);
    }
    load();
  }, []);

  return { summaries, loading };
}

// ─── Pickup Acumulado ────────────────────────────────────────────────

export interface PickupAcumuladoRow {
  hotelId:               number;
  dataReferencia:        string;   // YYYY-MM-DD
  dataExtracao:          string;   // YYYY-MM-DD
  uhsTotal:              number;
  uhsOcupadas:           number;
  occPct:                number;
  reservas:              number;
  checkins:              number;
  checkouts:             number;
  recTotal:              number;
  recDiarias:            number;
  adr:                   number;
  revpar:                number;
  pickupUhsDia:          number;
  pickupUhsAcumulado:    number;
  pickupReceitaDia:      number;
  pickupReceitaAcumulado: number;
  totalSnapshots:        number;
}

function mesAnoToRange(mesAno: string): [string, string] {
  const [y, m] = mesAno.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return [`${mesAno}-01`, `${mesAno}-${String(last).padStart(2, '0')}`];
}

export function usePickupAcumulado(hotelId: number, selectedMeses: string[]) {
  const [rows, setRows]       = useState<PickupAcumuladoRow[]>([]);
  const [loading, setLoading] = useState(true);

  const key = selectedMeses.slice().sort().join(',');

  useEffect(() => {
    if (!hotelId || selectedMeses.length === 0) { setRows([]); setLoading(false); return; }

    async function load() {
      setLoading(true);
      const ranges = selectedMeses.map(mesAnoToRange);
      const from = ranges.reduce((min, [s]) => s < min ? s : min, ranges[0][0]);
      const to   = ranges.reduce((max, [, e]) => e > max ? e : max, ranges[0][1]);

      const { data, error } = await supabase
        .from('pickup_acumulado')
        .select('*')
        .eq('hotel_id', hotelId)
        .gte('data_referencia', from)
        .lte('data_referencia', to)
        .order('data_referencia', { ascending: true })
        .order('data_extracao',   { ascending: true });

      if (!error && data) {
        // Keep only the latest extraction per data_referencia
        const latest = new Map<string, PickupAcumuladoRow>();
        for (const r of data as Record<string, unknown>[]) {
          const dr = r.data_referencia as string;
          const parsed: PickupAcumuladoRow = {
            hotelId:               r.hotel_id              as number,
            dataReferencia:        dr,
            dataExtracao:          r.data_extracao         as string,
            uhsTotal:              (r.uhs_total            as number) ?? 0,
            uhsOcupadas:           (r.uhs_ocupadas         as number) ?? 0,
            occPct:                parseFloat(String(r.occ_pct))           || 0,
            reservas:              (r.reservas             as number) ?? 0,
            checkins:              (r.checkins             as number) ?? 0,
            checkouts:             (r.checkouts            as number) ?? 0,
            recTotal:              parseFloat(String(r.rec_total))          || 0,
            recDiarias:            parseFloat(String(r.rec_diarias))        || 0,
            adr:                   parseFloat(String(r.adr))                || 0,
            revpar:                parseFloat(String(r.revpar))             || 0,
            pickupUhsDia:          (r.pickup_uhs_dia       as number) ?? 0,
            pickupUhsAcumulado:    (r.pickup_uhs_acumulado as number) ?? 0,
            pickupReceitaDia:      parseFloat(String(r.pickup_receita_dia))      || 0,
            pickupReceitaAcumulado: parseFloat(String(r.pickup_receita_acumulado)) || 0,
            totalSnapshots:        (r.total_snapshots      as number) ?? 0,
          };
          // Always overwrite — since rows are ordered asc by data_extracao, last write = latest
          latest.set(dr, parsed);
        }
        setRows([...latest.values()].sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia)));
      }
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, key]);

  return { rows, loading };
}
