import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { buildHotelSummary, parseKpiRow } from '@/data/transforms';
import type { HotelRow, ReceitaDiariaRow, KpiDiario, HotelSummary, PickupRow, BookingRate } from '@/data/types';

// ─── Fetch all hotels with their aggregated KPIs ────────────────────

export function useHotels() {
  const [hotels, setHotels] = useState<HotelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: hotelRows, error: hErr } = await supabase
          .from('hotel')
          .select('*')
          .eq('ativo', true)
          .order('nome_fantasia');

        if (hErr) throw hErr;
        if (!hotelRows?.length) {
          setHotels([]);
          return;
        }

        const hotelIds = hotelRows.map((h: HotelRow) => h.id);
        const { data: kpiRows, error: kErr } = await supabase
          .from('hotel_receita_diaria')
          .select('*')
          .in('hotel_id', hotelIds)
          .order('data_referencia', { ascending: true });

        if (kErr) throw kErr;

        const kpiByHotel = new Map<number, ReceitaDiariaRow[]>();
        for (const row of (kpiRows ?? []) as ReceitaDiariaRow[]) {
          const list = kpiByHotel.get(row.hotel_id) ?? [];
          list.push(row);
          kpiByHotel.set(row.hotel_id, list);
        }

        const summaries = (hotelRows as HotelRow[]).map(h =>
          buildHotelSummary(h, kpiByHotel.get(h.id) ?? [])
        );

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
