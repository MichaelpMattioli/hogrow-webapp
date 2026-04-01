import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BedDouble, DollarSign, TrendingUp, BarChart3, Loader2, ArrowLeft, Calendar, MoreVertical, Pencil, ChevronDown, Check, Percent, Users } from 'lucide-react';
import { useHotelDetail, updateHotel, usePickup, useBookingRates } from '@/hooks/useSupabase';
import { getInsights } from '@/data/transforms';
import { STATUS_CONFIG } from '@/lib/utils';
import type { HotelRow } from '@/data/types';
import PerformanceCard from '@/components/cards/PerformanceCard';
import type { PerfData } from '@/components/cards/PerformanceCard';

import PickupTable from '@/components/tables/PickupTable';
import InsightCard from '@/components/cards/InsightCard';
import HotelEditForm from '@/components/forms/HotelEditForm';
import RateCalendar from '@/components/rateshop/RateCalendar';

type Tab = 'dashboard' | 'editar';

const MES_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hotel, kpis, summary, loading, error, reload } = useHotelDetail(Number(id));
  const { rows: pickupRows } = usePickup(Number(id));
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [selectedMeses, setSelectedMeses] = useState<string[]>([mesAtual]);
  const [rateMonth, setRateMonth] = useState(mesAtual);
  const { rates, loading: ratesLoading } = useBookingRates(Number(id), rateMonth);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [filterOpen, setFilterOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
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

  // Filtered latest KPIs
  const filteredKpis = useMemo(() => {
    if (selectedMeses.length === 0) return latestKpis;
    return latestKpis.filter(k => selectedMeses.includes(k.date.slice(0, 7)));
  }, [latestKpis, selectedMeses]);

  const hotelUhs = summary?.uhs ?? (filteredKpis[0]?.totalUhs ?? 1);

  // Helper: aggregate KPIs for any set of rows + month keys
  function computeAgg(kpis: typeof filteredKpis, monthSet: string[]) {
    if (kpis.length === 0) return null;
    const uhsTT = kpis.reduce((s, k) => s + k.ocupados, 0);
    const receita = Math.round(kpis.reduce((s, k) => s + k.recTotal, 0));
    const dmCcTT = uhsTT > 0 ? Math.round(receita / uhsTT) : 0;
    const effectiveMonths = monthSet.length > 0
      ? monthSet
      : [...new Set(kpis.map(k => k.date.slice(0, 7)))];
    const totalPossible = effectiveMonths.reduce((sum, m) => {
      const [y, mo] = m.split('-').map(Number);
      return sum + new Date(y, mo, 0).getDate() * hotelUhs;
    }, 0);
    const occTT = totalPossible > 0
      ? parseFloat(((uhsTT / totalPossible) * 100).toFixed(1))
      : 0;
    const revpTT = Math.round(dmCcTT * (occTT / 100));
    const cortesia = kpis.reduce((s, k) => s + k.cortesia, 0);
    const hospedes = kpis.reduce((s, k) => s + (k.pax ?? 0) + (k.chd ?? 0), 0);
    return { uhsTT, receita, dmCcTT, occTT, revpTT, cortesia, hospedes };
  }

  // Current period
  const aggKpis = useMemo(
    () => computeAgg(filteredKpis, selectedMeses),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredKpis, selectedMeses, hotelUhs]
  );

  // Previous month keys (for each selected month, go back 1 month)
  const prevMesMeses = useMemo(() => {
    if (selectedMeses.length === 0) return [];
    return selectedMeses.map(m => {
      const [y, mo] = m.split('-').map(Number);
      const pm = mo === 1 ? 12 : mo - 1;
      const py = mo === 1 ? y - 1 : y;
      return `${py}-${String(pm).padStart(2, '0')}`;
    });
  }, [selectedMeses]);

  // Previous year keys (same months, -1 year)
  const prevAnoMeses = useMemo(() => {
    if (selectedMeses.length === 0) return [];
    return selectedMeses.map(m => {
      const [y, mo] = m.split('-').map(Number);
      return `${y - 1}-${String(mo).padStart(2, '0')}`;
    });
  }, [selectedMeses]);

  const prevMesKpis = useMemo(
    () => latestKpis.filter(k => prevMesMeses.includes(k.date.slice(0, 7))),
    [latestKpis, prevMesMeses]
  );
  const prevAnoKpis = useMemo(
    () => latestKpis.filter(k => prevAnoMeses.includes(k.date.slice(0, 7))),
    [latestKpis, prevAnoMeses]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevMesAgg = useMemo(() => computeAgg(prevMesKpis, prevMesMeses), [prevMesKpis, prevMesMeses, hotelUhs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const prevAnoAgg = useMemo(() => computeAgg(prevAnoKpis, prevAnoMeses), [prevAnoKpis, prevAnoMeses, hotelUhs]);

  // Formatting helpers
  const fmtR = (v: number) => 'R$ ' + v.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  const fmtRec = (v: number) =>
    v >= 1_000_000
      ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M`
      : v >= 1_000
        ? `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`
        : fmtR(v);
  const fmtOcc = (v: number) => `${v.toFixed(1)}%`;
  const pd = (v: number, fmt: (n: number) => string): PerfData => ({ value: v, formatted: fmt(v) });

  const toggleMonth = (m: string) => {
    setSelectedMeses(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort()
    );
  };

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
  const hojeStr = new Date().toISOString().slice(0, 10);
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
        style={{ borderLeft: `4px solid ${cfg.color}`, padding: '14px 18px', background: 'var(--surface)', marginBottom: 40 }}
      >
        <div>
          <h2 className="text-xl font-bold" style={{ letterSpacing: '-0.4px' }}>{summary.name}</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-m)' }}>
            {summary.city}, {summary.state}
            {hoje ? ` · ${hoje.ocupados}/${hoje.totalUhs} UHs` : ` · ${summary.uhs} UHs`}
            {summary.leitos && hoje ? ` · ${(hoje.pax ?? 0) + (hoje.chd ?? 0)}/${summary.leitos} leitos` : ''}
          </p>
        </div>
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
      {/* Period filter (dropdown multi-select) */}
      <div className="flex items-center gap-2" ref={filterRef} style={{ position: 'relative', marginBottom: 40 }}>
        <Calendar size={14} style={{ color: 'var(--text-m)' }} />
        <button
          className="flex items-center gap-2 rounded-[var(--rx)] text-xs font-medium transition-all duration-150"
          style={{
            padding: '6px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
          onClick={() => setFilterOpen(o => !o)}
        >
          <span>Período</span>
          {selectedMeses.length > 0 && (
            <span className="rounded-full text-[10px] font-bold" style={{
              padding: '0 6px', background: 'var(--accent)', color: '#fff', lineHeight: '18px',
            }}>{selectedMeses.length}</span>
          )}
          <ChevronDown size={13} style={{ color: 'var(--text-m)', transform: filterOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
        {selectedMeses.length > 0 && (
          <button
            className="text-[10.5px] font-medium transition-colors duration-150 hover:text-[var(--accent)]"
            style={{ color: 'var(--text-m)' }}
            onClick={() => setSelectedMeses([])}
          >
            ✕ Limpar
          </button>
        )}
        {selectedMeses.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {selectedMeses.map(m => {
              const [year, month] = m.split('-');
              return (
                <span key={m} className="rounded-full text-[10.5px] font-medium" style={{
                  padding: '2px 10px', background: 'var(--accent-l)', color: 'var(--accent-d)',
                }}>
                  {MES_LABELS[parseInt(month) - 1]}/{year}
                </span>
              );
            })}
          </div>
        )}
        {filterOpen && (
          <div
            className="rounded-[var(--r)]"
            style={{
              position: 'absolute', top: '100%', left: 22, marginTop: 4, zIndex: 50,
              background: 'var(--surface)', border: '1px solid var(--border)',
              boxShadow: 'var(--sh-m)', minWidth: 180, padding: '4px 0',
            }}
          >
            <button
              className="flex items-center gap-2 w-full text-left text-[12px] font-medium transition-colors duration-100 hover:bg-[var(--surface-h)]"
              style={{ padding: '7px 14px', color: selectedMeses.length === 0 ? 'var(--accent)' : 'var(--text-m)' }}
              onClick={() => { setSelectedMeses([]); setFilterOpen(false); }}
            >
              {selectedMeses.length === 0 && <Check size={13} style={{ color: 'var(--accent)' }} />}
              {selectedMeses.length > 0 && <span style={{ width: 13 }} />}
              Todos os meses
            </button>
            <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />
            {meses.map(m => {
              const [year, month] = m.split('-');
              const label = `${MES_LABELS[parseInt(month) - 1]}/${year}`;
              const checked = selectedMeses.includes(m);
              return (
                <button
                  key={m}
                  className="flex items-center gap-2 w-full text-left text-[12px] font-medium transition-colors duration-100 hover:bg-[var(--surface-h)]"
                  style={{ padding: '7px 14px', color: checked ? 'var(--text)' : 'var(--text-m)' }}
                  onClick={() => toggleMonth(m)}
                >
                  <span
                    className="flex items-center justify-center rounded-[3px]"
                    style={{
                      width: 15, height: 15, flexShrink: 0,
                      border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                      background: checked ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {checked && <Check size={10} style={{ color: '#fff' }} />}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Performance Indicators */}
      {aggKpis && (
        <>
          {/* Row 1 — Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 12 }}>
            <PerformanceCard
              title="Receita" icon={BarChart3} highlight delay={0}
              currentValue={aggKpis.receita} currentFormatted={fmtRec(aggKpis.receita)}
              prevMonth={prevMesAgg ? pd(prevMesAgg.receita, fmtRec) : null}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.receita, fmtRec) : null}
            />
            <PerformanceCard
              title="Ocupação" icon={Percent} highlight delay={60}
              currentValue={aggKpis.occTT} currentFormatted={fmtOcc(aggKpis.occTT)}
              prevMonth={prevMesAgg ? pd(prevMesAgg.occTT, fmtOcc) : null}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.occTT, fmtOcc) : null}
            />
            <PerformanceCard
              title="Diária Média" icon={DollarSign} highlight delay={120}
              currentValue={aggKpis.dmCcTT} currentFormatted={fmtR(aggKpis.dmCcTT)}
              prevMonth={prevMesAgg ? pd(prevMesAgg.dmCcTT, fmtR) : null}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.dmCcTT, fmtR) : null}
            />
          </div>

          {/* Row 2 — Secondary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 40 }}>
            <PerformanceCard
              title="RevPAR" icon={TrendingUp} delay={180}
              currentValue={aggKpis.revpTT} currentFormatted={fmtR(aggKpis.revpTT)}
              prevMonth={prevMesAgg ? pd(prevMesAgg.revpTT, fmtR) : null}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.revpTT, fmtR) : null}
            />
            <PerformanceCard
              title="Room Nights" icon={BedDouble} delay={240}
              currentValue={aggKpis.uhsTT}
              currentFormatted={aggKpis.uhsTT.toLocaleString('pt-BR')}
              prevMonth={prevMesAgg ? pd(prevMesAgg.uhsTT, n => n.toLocaleString('pt-BR')) : null}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.uhsTT, n => n.toLocaleString('pt-BR')) : null}
            />
            <PerformanceCard
              title="Hóspedes" icon={Users} delay={300}
              currentValue={aggKpis.hospedes}
              currentFormatted={aggKpis.hospedes.toLocaleString('pt-BR')}
              prevMonth={prevMesAgg ? pd(prevMesAgg.hospedes, n => n.toLocaleString('pt-BR')) : null}
              prevYear={prevAnoAgg ? pd(prevAnoAgg.hospedes, n => n.toLocaleString('pt-BR')) : null}
            />
          </div>
        </>
      )}

      {/* Pick-Up Table */}
      <div style={{ marginBottom: 40 }}>
        <PickupTable data={pickupRows} selectedMonths={selectedMeses} />
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
      <InsightCard insights={insights} />
      </>
      )}
    </div>
  );
}
