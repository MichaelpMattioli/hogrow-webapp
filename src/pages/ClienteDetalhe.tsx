import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BedDouble, DollarSign, TrendingUp, BarChart3, Loader2, ArrowLeft, MoreVertical, Pencil, Percent, Users } from 'lucide-react';
import {
  updateHotel,
  useClienteDetalheCards,
  useClienteDetalheHeader,
  useClientePickupDiario,
  useClienteRateShopper,
  useClienteRateShopperForMonths,
} from '@/hooks/useSupabase';
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
  const hotelId = Number(id);
  const mesAtual = localMonthKey();
  const [selectedMeses, setSelectedMeses] = useState<string[]>([mesAtual]);
  const [rateMonth, setRateMonth] = useState(mesAtual);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { hotel, summary, availableMonths: meses, loading, error, reload } = useClienteDetalheHeader(hotelId);
  const selectedMes = selectedMeses[0] ?? mesAtual;
  const { cards, loading: cardsLoading, error: cardsError } = useClienteDetalheCards(hotelId, selectedMes);
  const { rows: pickupRows, loading: pickupLoading, error: pickupError } = useClientePickupDiario(hotelId, selectedMes);

  const rateFrom = useMemo(() => {
    const monthStart = `${rateMonth}-01`;
    const today = localDateKey();
    return monthStart < today ? today : monthStart;
  }, [rateMonth]);

  const { rates, loading: ratesLoading } = useClienteRateShopper(hotelId, rateMonth, rateFrom, true);
  const pickupShopperMonths = useMemo(
    () => selectedMeses.length > 0 ? selectedMeses : [mesAtual],
    [selectedMeses, mesAtual]
  );
  const { rates: pickupShopperRates } = useClienteRateShopperForMonths(hotelId, pickupShopperMonths);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveHotel = useCallback(async (data: Partial<HotelRow>) => {
    const result = await updateHotel(hotelId, data as Record<string, unknown>);
    if (result.success) reload();
    return result;
  }, [hotelId, reload]);

  const handleMesesChange = useCallback((months: string[]) => {
    const month = months[months.length - 1] ?? mesAtual;
    setSelectedMeses([month]);
    setRateMonth(month);
  }, [mesAtual]);

  useEffect(() => {
    if (meses.length === 0 || meses.includes(selectedMes)) return;
    handleMesesChange([meses[meses.length - 1]]);
  }, [handleMesesChange, meses, selectedMes]);

  const fmtNumber = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR');
  const fmtR = (v: number) => 'R$ ' + fmtNumber(v);
  const fmtRec = fmtR;
  const fmtOcc = (v: number) => `${Math.round(v).toLocaleString('pt-BR')}%`;
  const pd = (v: number, fmt: (n: number) => string): PerfData => ({ value: v, formatted: fmt(v) });
  const pmd = (v: number | null | undefined, fmt: (n: number) => string): MetaData | null =>
    v != null && v > 0 ? { value: v, formatted: fmt(v) } : null;

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
        <h2 className="text-xl font-bold mb-2">Hotel nao encontrado</h2>
        <button className="text-[var(--accent)] font-medium" onClick={() => navigate('/clientes')}>
          Voltar para lista
        </button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[summary.status] ?? STATUS_CONFIG.critical;
  const latestSnapshot = summary.latestDate !== '-'
    ? ` - ${summary.latestOcupados}/${summary.uhs} UHs`
    : ` - ${summary.uhs} UHs`;
  const cardReferenceMonth = cards?.selectedMesAno || selectedMes;

  return (
    <div className="fade-in">
      <button
        className="flex items-center gap-1.5 text-[13px] font-medium mb-5 transition-colors duration-150 hover:text-[var(--accent)]"
        style={{ color: 'var(--text-m)' }}
        onClick={() => navigate('/clientes')}
      >
        <ArrowLeft size={14} />
        Voltar para clientes
      </button>

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
            {summary.city}, {summary.state}{latestSnapshot}
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
          {cardsLoading && !cards ? (
            <div className="flex items-center justify-center" style={{ padding: '32px 0', marginBottom: 24 }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span className="ml-2 text-[12px]" style={{ color: 'var(--text-m)' }}>Carregando indicadores...</span>
            </div>
          ) : cardsError ? (
            <div style={{ padding: 24, marginBottom: 24, textAlign: 'center', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
              {cardsError}
            </div>
          ) : cards && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 12 }}>
                <PerformanceCard
                  title="Receita" icon={BarChart3} highlight delay={0}
                  currentValue={cards.receitaAtual} currentFormatted={fmtRec(cards.receitaAtual)}
                  prevYear={pd(cards.receitaPrevYear, fmtRec)}
                  ytd={pd(cards.receitaYtd, fmtRec)}
                  meta={pmd(cards.receitaMeta, fmtRec)}
                  metaCumulative
                  referenceMonth={cardReferenceMonth}
                />
                <PerformanceCard
                  title="Ocupacao" icon={Percent} highlight delay={60}
                  currentValue={cards.occAtual} currentFormatted={fmtOcc(cards.occAtual)}
                  prevYear={pd(cards.occPrevYear, fmtOcc)}
                  ytd={pd(cards.occYtd, fmtOcc)}
                  meta={pmd(cards.occMeta, fmtOcc)}
                  referenceMonth={cardReferenceMonth}
                />
                <PerformanceCard
                  title="Diaria Media" icon={DollarSign} highlight delay={120}
                  currentValue={cards.dmAtual} currentFormatted={fmtR(cards.dmAtual)}
                  prevYear={pd(cards.dmPrevYear, fmtR)}
                  ytd={pd(cards.dmYtd, fmtR)}
                  meta={pmd(cards.dmMeta, fmtR)}
                  referenceMonth={cardReferenceMonth}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 40 }}>
                <PerformanceCard
                  title="RevPAR" icon={TrendingUp} delay={180}
                  currentValue={cards.revparAtual} currentFormatted={fmtR(cards.revparAtual)}
                  prevYear={pd(cards.revparPrevYear, fmtR)}
                  ytd={pd(cards.revparYtd, fmtR)}
                />
                <PerformanceCard
                  title="Room Nights" icon={BedDouble} delay={240}
                  currentValue={cards.roomNightsAtual}
                  currentFormatted={fmtInt(cards.roomNightsAtual)}
                  prevYear={pd(cards.roomNightsPrevYear, fmtInt)}
                  ytd={pd(cards.roomNightsYtd, fmtInt)}
                />
                <PerformanceCard
                  title="Hospedes" icon={Users} delay={300}
                  currentValue={cards.hospedesAtual}
                  currentFormatted={fmtInt(cards.hospedesAtual)}
                  prevYear={pd(cards.hospedesPrevYear, fmtInt)}
                  ytd={pd(cards.hospedesYtd, fmtInt)}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: 40 }}>
            <PickupSection
              hotelId={hotelId}
              pickupRows={pickupRows}
              selectedMeses={selectedMeses}
              availableMeses={meses}
              onReferenceChange={handleMesesChange}
              shopperRates={pickupShopperRates}
              loading={pickupLoading}
              error={pickupError}
            />
          </div>

          <div style={{ marginBottom: 40 }}>
            <RateCalendar
              rates={rates}
              loading={ratesLoading}
              yearMonth={rateMonth}
              onMonthChange={setRateMonth}
            />
          </div>
        </>
      )}
    </div>
  );
}
