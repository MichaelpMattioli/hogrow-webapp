import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BedDouble, DollarSign, TrendingUp, BarChart3, Loader2, ArrowLeft, MoreVertical, Pencil, Percent, Users } from 'lucide-react';
import { useHotelDetail, updateHotel, usePickup, useBookingRates, useBookingRatesForMonths, useHotelMetas } from '@/hooks/useSupabase';
import { getInsights } from '@/data/transforms';
import { localDateKey, localMonthKey, STATUS_CONFIG } from '@/lib/utils';
import type { HotelRow } from '@/data/types';
import PerformanceCard from '@/components/cards/PerformanceCard';
import type { PerfData, MetaData } from '@/components/cards/PerformanceCard';

import PickupSection from '@/components/tables/PickupSection';
import HotelEditForm from '@/components/forms/HotelEditForm';
import RateCalendar from '@/components/rateshop/RateCalendar';
import HeaderMonthReference from '@/components/ui/HeaderMonthReference';

type Tab = 'dashboard' | 'editar';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hotel, kpis, summary, loading, error, reload } = useHotelDetail(Number(id));
  const { rows: pickupRows } = usePickup(Number(id));
  const mesAtual = localMonthKey();
  const [selectedMeses, setSelectedMeses] = useState<string[]>([mesAtual]);
  const [rateMonth, setRateMonth] = useState(mesAtual);
  const { rates, loading: ratesLoading } = useBookingRates(Number(id), rateMonth);
  const pickupShopperMonths = useMemo(
    () => selectedMeses.length > 0 ? selectedMeses : [mesAtual],
    [selectedMeses, mesAtual]
  );
  const { rates: pickupShopperRates } = useBookingRatesForMonths(Number(id), pickupShopperMonths);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveHotel = useCallback(async (data: Partial<HotelRow>) => {
    const result = await updateHotel(Number(id), data as Record<string, unknown>);
    if (result.success) reload();
    return result;
  }, [id, reload]);

  const handleMesesChange = useCallback((months: string[]) => {
    const month = months[months.length - 1] ?? mesAtual;
    setSelectedMeses([month]);
    setRateMonth(month);
  }, [mesAtual]);

  // Deduplicate: keep latest extraction per reference date
  const latestKpis = useMemo(() => {
    const byRef = new Map<string, typeof kpis[0]>();
    for (const k of kpis) {
      const existing = byRef.get(k.date);
      if (!existing || k.dataExtracao > existing.dataExtracao) {
        byRef.set(k.date, k);
      }
    }
    return [...byRef.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [kpis]);

  // Available months
  const meses = useMemo(() =>
    [...new Set(latestKpis.map(k => k.date.slice(0, 7)))].sort(),
    [latestKpis]
  );
  const selectedMes = selectedMeses[0] ?? mesAtual;

  useEffect(() => {
    if (meses.length === 0 || meses.includes(selectedMes)) return;
    handleMesesChange([meses[meses.length - 1]]);
  }, [handleMesesChange, meses, selectedMes]);

  // Filtered latest KPIs
  const filteredKpis = useMemo(() => {
    if (selectedMeses.length === 0) return latestKpis;
    return latestKpis.filter(k => selectedMeses.includes(k.date.slice(0, 7)));
  }, [latestKpis, selectedMeses]);

  const hotelUhs = summary?.uhs && summary.uhs > 0
    ? summary.uhs
    : (filteredKpis.find(k => k.totalUhs > 0)?.totalUhs ?? 0);

  // Helper: aggregate KPIs for any set of rows + month keys
  function computeAgg(kpis: typeof filteredKpis) {
    if (kpis.length === 0) return null;
    const uhsTT = kpis.reduce((s, k) => s + k.ocupados, 0);
    const receita = kpis.reduce((s, k) => s + k.recTotal, 0);
    const recDiarias = kpis.reduce((s, k) => s + k.recDiarias, 0);
    const dmCcTT = uhsTT > 0 ? recDiarias / uhsTT : 0;
    const totalPossible = kpis.reduce((sum, k) => {
      const dailyUhs = k.totalUhs > 0 ? k.totalUhs : hotelUhs;
      return sum + Math.max(dailyUhs, 0);
    }, 0);
    const avgOcc = kpis.reduce((s, k) => s + k.occPct, 0) / kpis.length;
    const occTT = totalPossible > 0
      ? (uhsTT / totalPossible) * 100
      : avgOcc;
    const avgRevpar = kpis.reduce((s, k) => s + k.revpar, 0) / kpis.length;
    const revpTT = totalPossible > 0
      ? recDiarias / totalPossible
      : avgRevpar;
    const cortesia = kpis.reduce((s, k) => s + k.cortesia, 0);
    const hospedes = kpis.reduce((s, k) => s + (k.pax ?? 0) + (k.chd ?? 0), 0);
    return { uhsTT, receita, dmCcTT, occTT, revpTT, cortesia, hospedes };
  }

  // Current period
  const aggKpis = useMemo(
    () => computeAgg(filteredKpis),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredKpis, selectedMeses, hotelUhs]
  );

  // YTD: all months in the current calendar year up to today
  const currentYear = new Date().getFullYear().toString();
  const ytdMeses = useMemo(() => {
    const todayYM = localMonthKey();
    return [...new Set(latestKpis.map(k => k.date.slice(0, 7)))]
      .filter(m => m.startsWith(currentYear) && m <= todayYM);
  }, [latestKpis, currentYear]);

  const ytdKpis = useMemo(
    () => latestKpis.filter(k => ytdMeses.includes(k.date.slice(0, 7))),
    [latestKpis, ytdMeses]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ytdAgg = useMemo(() => computeAgg(ytdKpis), [ytdKpis, hotelUhs]);

  // Previous year keys (same months, -1 year)
  const prevAnoMeses = useMemo(() => {
    if (selectedMeses.length === 0) return [];
    return selectedMeses.map(m => {
      const [y, mo] = m.split('-').map(Number);
      return `${y - 1}-${String(mo).padStart(2, '0')}`;
    });
  }, [selectedMeses]);

  const prevAnoKpis = useMemo(
    () => latestKpis.filter(k => prevAnoMeses.includes(k.date.slice(0, 7))),
    [latestKpis, prevAnoMeses]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevAnoAgg = useMemo(() => computeAgg(prevAnoKpis), [prevAnoKpis, hotelUhs]);

  // Meta for the primary selected month (single-month) or current month
  const metaMes = selectedMeses.length === 1 ? selectedMeses[0] : mesAtual;
  const { metas: hotelMetasList } = useHotelMetas(metaMes);
  const hotelMeta = useMemo(
    () => hotelMetasList.find(m => m.hotelId === Number(id)) ?? null,
    [hotelMetasList, id]
  );

  // Build MetaData helpers
  const fmtNumber = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmtR = (v: number) => 'R$ ' + fmtNumber(v);
  const fmtRec = fmtR;
  const fmtOcc = (v: number) => `${Math.round(v).toLocaleString('pt-BR')}%`;
  const pd  = (v: number, fmt: (n: number) => string): PerfData => ({ value: v, formatted: fmt(v) });
  const pmd = (v: number | null | undefined, fmt: (n: number) => string): MetaData | null =>
    v != null && v > 0 ? { value: v, formatted: fmt(v) } : null;

  const insights = getInsights(filteredKpis);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="ml-2 text-[var(--text-m)]">Carregando detalhes...</span>
      </div>
    );
  }

  if (error || !hotel || !summary) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold mb-2">Hotel não encontrado</h2>
        <button className="text-[var(--accent)] font-medium" onClick={() => navigate('/clientes')}>
          Voltar para lista
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[summary.status];
  const hojeStr = localDateKey();
  const hoje = latestKpis.find(k => k.date === hojeStr) ?? (latestKpis.length > 0 ? latestKpis[latestKpis.length - 1] : null);

  return (
    <div className="fade-in">
      {/* Back */}
      <button
        className="flex items-center gap-1.5 text-[13px] font-medium mb-5 transition-colors duration-150 hover:text-[var(--accent)]"
        style={{ color: 'var(--text-m)' }}
        onClick={() => navigate('/clientes')}
      >
        <ArrowLeft size={14} />
        Voltar para clientes
      </button>

      {/* Header */}
      <div
        className="flex justify-between items-center rounded-[var(--rs)]"
        style={{
          borderLeft: `4px solid ${cfg.color}`,
          padding: '14px 18px',
          background: 'var(--surface)',
          marginBottom: 40,
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 220 }}>
          <h2 className="text-xl font-bold" style={{ letterSpacing: '-0.4px' }}>{summary.name}</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-m)' }}>
            {summary.city}, {summary.state}
            {hoje ? ` · ${hoje.ocupados}/${hoje.totalUhs} UHs` : ` · ${summary.uhs} UHs`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {meses.length > 0 && (
            <HeaderMonthReference
              selectedMonth={selectedMes}
              availableMonths={meses}
              onSelect={month => handleMesesChange([month])}
            />
          )}

          {/* 3-dot menu */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              className="flex items-center justify-center rounded-[var(--rx)] transition-colors duration-150 hover:bg-[var(--surface-h)]"
              style={{ width: 32, height: 32, background: menuOpen ? 'var(--surface-h)' : 'transparent' }}
              onClick={() => setMenuOpen(o => !o)}
            >
              <MoreVertical size={16} style={{ color: 'var(--text-m)' }} />
            </button>
            {menuOpen && (
              <div
                className="rounded-[var(--r)]"
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  boxShadow: 'var(--sh-m)', minWidth: 160, padding: '4px 0',
                }}
              >
                <button
                  className="flex items-center gap-2 w-full text-left text-[12px] font-medium transition-colors duration-100 hover:bg-[var(--surface-h)]"
                  style={{ padding: '7px 14px', color: 'var(--text)' }}
                  onClick={() => { setActiveTab('editar'); setMenuOpen(false); }}
                >
                  <Pencil size={13} style={{ color: 'var(--text-m)' }} />
                  Editar Hotel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'editar' ? (
        <>
          <button
            className="flex items-center gap-1.5 text-[13px] font-medium mb-5 transition-colors duration-150 hover:text-[var(--accent)]"
            style={{ color: 'var(--text-m)' }}
            onClick={() => setActiveTab('dashboard')}
          >
            <ArrowLeft size={14} />
            Voltar para dashboard
          </button>
          <HotelEditForm hotel={hotel} onSave={handleSaveHotel} />
        </>
      ) : (
      <>
      {/* Performance Indicators */}
      {aggKpis && (
        <>
          {/* Row 1 — Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 12 }}>
            <PerformanceCard
              title="Receita" icon={BarChart3} highlight delay={0}
              currentValue={aggKpis.receita} currentFormatted={fmtRec(aggKpis.receita)}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.receita, fmtRec) : null}
              ytd={ytdAgg ? pd(ytdAgg.receita, fmtRec) : null}
              meta={pmd(hotelMeta?.receitaMeta, fmtRec)}
              metaCumulative
              referenceMonth={metaMes}
            />
            <PerformanceCard
              title="Ocupação" icon={Percent} highlight delay={60}
              currentValue={aggKpis.occTT} currentFormatted={fmtOcc(aggKpis.occTT)}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.occTT, fmtOcc) : null}
              ytd={ytdAgg ? pd(ytdAgg.occTT, fmtOcc) : null}
              meta={pmd(hotelMeta?.occMeta, fmtOcc)}
              referenceMonth={metaMes}
            />
            <PerformanceCard
              title="Diária Média" icon={DollarSign} highlight delay={120}
              currentValue={aggKpis.dmCcTT} currentFormatted={fmtR(aggKpis.dmCcTT)}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.dmCcTT, fmtR) : null}
              ytd={ytdAgg ? pd(ytdAgg.dmCcTT, fmtR) : null}
              meta={pmd(hotelMeta?.dmMeta, fmtR)}
              referenceMonth={metaMes}
            />
          </div>

          {/* Row 2 — Secondary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 40 }}>
            <PerformanceCard
              title="RevPAR" icon={TrendingUp} delay={180}
              currentValue={aggKpis.revpTT} currentFormatted={fmtR(aggKpis.revpTT)}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.revpTT, fmtR) : null}
              ytd={ytdAgg ? pd(ytdAgg.revpTT, fmtR) : null}
            />
            <PerformanceCard
              title="Room Nights" icon={BedDouble} delay={240}
              currentValue={aggKpis.uhsTT}
              currentFormatted={aggKpis.uhsTT.toLocaleString('pt-BR')}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.uhsTT, n => n.toLocaleString('pt-BR')) : null}
              ytd={ytdAgg ? pd(ytdAgg.uhsTT, n => n.toLocaleString('pt-BR')) : null}
            />
            <PerformanceCard
              title="Hóspedes" icon={Users} delay={300}
              currentValue={aggKpis.hospedes}
              currentFormatted={aggKpis.hospedes.toLocaleString('pt-BR')}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.hospedes, n => n.toLocaleString('pt-BR')) : null}
              ytd={ytdAgg ? pd(ytdAgg.hospedes, n => n.toLocaleString('pt-BR')) : null}
            />
          </div>
        </>
      )}

      {/* Pick-up (Diário / Mensal) */}
      <div style={{ marginBottom: 40 }}>
        <PickupSection
          hotelId={Number(id)}
          pickupRows={pickupRows}
          selectedMeses={selectedMeses}
          availableMeses={meses}
          onReferenceChange={handleMesesChange}
          shopperRates={pickupShopperRates}
        />
      </div>

      {/* Rate Shopper Calendar */}
      <div style={{ marginBottom: 40 }}>
        <RateCalendar
          rates={rates}
          loading={ratesLoading}
          yearMonth={rateMonth}
          onMonthChange={setRateMonth}
        />
      </div>

      {/* Insights */}
      </>
      )}
    </div>
  );
}
