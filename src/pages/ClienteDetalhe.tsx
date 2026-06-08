import { useState, useMemo, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BedDouble, DollarSign, TrendingUp, BarChart3, ArrowLeft, MoreVertical, Pencil, Percent, Users, CalendarRange } from 'lucide-react';
import {
  updateHotel,
  useClienteDetalheCards,
  useClienteDetalheCalendar,
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
import PeriodSelector, { type DayRange } from '@/components/ui/PeriodSelector';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';

type Tab = 'dashboard' | 'editar';

const skeletonPanel: CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r)',
};

function DetailCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="card-in"
      style={{
        ...skeletonPanel,
        padding: 18,
        minHeight: 154,
        animationDelay: `${delay}ms`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <Skeleton width={104} height={12} />
        <Skeleton width={30} height={30} radius="var(--rx)" />
      </div>
      <Skeleton width="62%" height={28} style={{ marginBottom: 18 }} />
      <SkeletonText lines={3} />
    </div>
  );
}

function PickupSkeletonPanel() {
  return (
    <div style={{ ...skeletonPanel, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <Skeleton width={130} height={14} style={{ marginBottom: 8 }} />
          <Skeleton width={210} height={10} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={74} height={30} radius="var(--rx)" />
          <Skeleton width={74} height={30} radius="var(--rx)" />
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 18,
        padding: '14px 0 16px',
        borderTop: '1px solid var(--border-l)',
        borderBottom: '1px solid var(--border-l)',
        marginBottom: 16,
      }}>
        <div>
          <Skeleton width={110} height={10} style={{ marginBottom: 10 }} />
          <Skeleton width="70%" height={30} style={{ marginBottom: 8 }} />
          <Skeleton width="52%" height={10} />
        </div>
        <div>
          <Skeleton width={132} height={10} style={{ marginBottom: 10 }} />
          <Skeleton width={190} height={30} style={{ marginBottom: 8 }} />
          <Skeleton width="64%" height={10} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {Array.from({ length: 9 }, (_, row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(6, 1fr)', gap: 8 }}>
            {Array.from({ length: 7 }, (_, col) => (
              <Skeleton key={col} height={18} radius={4} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClienteDetalhePageSkeleton() {
  return (
    <div className="fade-in">
      <Skeleton width={150} height={17} style={{ marginBottom: 20 }} />

      <div
        style={{
          ...skeletonPanel,
          borderLeft: '4px solid var(--border)',
          padding: '14px 18px',
          marginBottom: 40,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 240 }}>
          <Skeleton width={220} height={24} style={{ marginBottom: 9 }} />
          <Skeleton width={180} height={12} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Skeleton width={126} height={32} radius="var(--rx)" />
          <Skeleton width={32} height={32} radius="var(--rx)" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 12 }}>
        {[0, 60, 120].map(delay => <DetailCardSkeleton key={delay} delay={delay} />)}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 40 }}>
        {[180, 240, 300].map(delay => <DetailCardSkeleton key={delay} delay={delay} />)}
      </div>

      <div style={{ marginBottom: 40 }}>
        <PickupSkeletonPanel />
      </div>

      <div style={{ ...skeletonPanel, padding: 18, minHeight: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
          <div>
            <Skeleton width={130} height={14} style={{ marginBottom: 8 }} />
            <Skeleton width={220} height={10} />
          </div>
          <Skeleton width={150} height={32} radius="var(--rx)" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(40px, 1fr))', gap: 8 }}>
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} height={38} radius="var(--rx)" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const hotelId = Number(id);
  const isValidId = !!id && Number.isFinite(hotelId) && hotelId > 0;
  const mesAtual = localMonthKey();
  const [selectedMeses, setSelectedMeses] = useState<string[]>([mesAtual]);
  const [selectedPosition, setSelectedPosition] = useState('');
  const [dayRange, setDayRange] = useState<DayRange | null>(null);
  const [rateMonth, setRateMonth] = useState(mesAtual);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { hotel, summary, loading, error, reload } = useClienteDetalheHeader(hotelId);
  const selectedMes = selectedMeses[0] ?? mesAtual;
  const {
    calendar,
    loading: calendarLoading,
    error: calendarError,
  } = useClienteDetalheCalendar(hotelId, selectedMes || null, selectedPosition || null);
  const resolvedMes = calendar?.selectedMesAno ?? '';
  const resolvedPosition = calendar?.selectedDataExtracao ?? '';
  const calendarMatchesSelection = Boolean(
    calendar &&
    calendar.requestedMesAno === (selectedMes || '') &&
    calendar.requestedDataExtracao === (selectedPosition || '')
  );
  const dataMes = selectedMes && selectedPosition
    ? selectedMes
    : calendarMatchesSelection
      ? resolvedMes
      : '';
  const dataPosition = selectedMes && selectedPosition
    ? selectedPosition
    : calendarMatchesSelection
      ? resolvedPosition
      : '';
  const availableMonths = useMemo(() => [...(calendar?.availableMonths ?? [])].sort(), [calendar]);
  const availablePositionDates = useMemo(() => [...(calendar?.availableExtractionDates ?? [])].sort(), [calendar]);
  const calendarMonth = selectedMes || resolvedMes || availableMonths[availableMonths.length - 1] || '';
  const calendarPosition = selectedPosition || resolvedPosition || '';
  const { cards, loading: cardsLoading, error: cardsError } = useClienteDetalheCards(hotelId, dataMes, dataPosition, dayRange?.ini ?? null, dayRange?.fim ?? null);
  const { rows: pickupRows, loading: pickupLoading, error: pickupError } = useClientePickupDiario(hotelId, dataMes, dataPosition);

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
    setDayRange(null);
  }, [mesAtual]);

  useEffect(() => {
    if (calendarLoading || !calendar) return;
    if (calendar.requestedMesAno !== (selectedMes || '')) return;
    if (calendar.requestedDataExtracao !== (selectedPosition || '')) return;
    if (calendar.selectedMesAno !== selectedMes) handleMesesChange([calendar.selectedMesAno]);
    if (calendar.selectedDataExtracao !== selectedPosition) setSelectedPosition(calendar.selectedDataExtracao);
  }, [calendar, calendarLoading, handleMesesChange, selectedMes, selectedPosition]);

  const handlePositionSelect = useCallback((date: string) => {
    if (availablePositionDates.length > 0 && !availablePositionDates.includes(date)) return;
    setSelectedPosition(date);
  }, [availablePositionDates]);

  const handleCurrentMonthSelect = useCallback(() => {
    handleMesesChange([mesAtual]);
    setSelectedPosition('');
  }, [handleMesesChange, mesAtual]);

  const fmtNumber = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR');
  const fmtR = (v: number) => 'R$ ' + fmtNumber(v);
  const fmtRec = fmtR;
  const fmtOcc = (v: number) => `${Math.round(v).toLocaleString('pt-BR')}%`;
  const pd = (v: number, fmt: (n: number) => string): PerfData => ({ value: v, formatted: fmt(v) });
  const pmd = (v: number | null | undefined, fmt: (n: number) => string): MetaData | null =>
    v != null && v > 0 ? { value: v, formatted: fmt(v) } : null;

  if (isValidId && loading) return <ClienteDetalhePageSkeleton />;

  if (!isValidId || error || !hotel || !summary) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold mb-2">Hotel não encontrado</h2>
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
  const cardsValueLoading = calendarLoading || cardsLoading || !cards || cards.selectedMesAno !== dataMes || cards.selectedDataExtracao !== dataPosition;
  const cardReferenceMonth = cardsValueLoading ? (dataMes || selectedMes) : cards.selectedMesAno;
  const loadingMeta: MetaData = { value: 1, formatted: '' };

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
          {calendarMonth && (
            <div style={{ marginBottom: 20 }}>
              <PeriodSelector
                selectedMonth={calendarMonth}
                availableMonths={availableMonths}
                onSelect={month => handleMesesChange([month])}
                selectedPosition={calendarPosition}
                availablePositionDates={availablePositionDates}
                onPositionSelect={handlePositionSelect}
                onCurrentMonthSelect={handleCurrentMonthSelect}
                dayRange={dayRange}
                onDayRangeChange={setDayRange}
              />
            </div>
          )}
          {cardsError ? (
            <div style={{ padding: 24, marginBottom: 24, textAlign: 'center', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
              {cardsError}
            </div>
          ) : calendarError ? (
            <div style={{ padding: 24, marginBottom: 24, textAlign: 'center', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
              {calendarError}
            </div>
          ) : (
            <>
              {dayRange && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                  marginBottom: 14, padding: '9px 14px', borderRadius: 'var(--rx)',
                  background: 'var(--accent-l)', border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                  fontSize: 12, fontWeight: 600, color: 'var(--accent-d)',
                }}>
                  <CalendarRange size={14} style={{ flexShrink: 0 }} />
                  <span>
                    Faixa de dias <strong>{dayRange.ini}{dayRange.ini !== dayRange.fim ? `–${dayRange.fim}` : ''}</strong> — os cards refletem a faixa; <strong>vs ano ant.</strong> e <strong>acum. ano</strong> são do mês/ano completo.
                  </span>
                  <button onClick={() => setDayRange(null)} style={{
                    marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: 'var(--accent)',
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rx)',
                    padding: '3px 9px', cursor: 'pointer',
                  }}>
                    Limpar faixa
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 12 }}>
                <PerformanceCard
                  title="Receita" icon={BarChart3} highlight delay={0} partialRange={Boolean(dayRange)}
                  currentValue={cards?.receitaAtual ?? 0} currentFormatted={cards ? fmtRec(cards.receitaAtual) : ''}
                  prevYear={cards ? pd(cards.receitaPrevYear, fmtRec) : null}
                  ytd={cards ? pd(cards.receitaYtd, fmtRec) : null}
                  meta={cards ? pmd(cards.receitaMeta, fmtRec) : loadingMeta}
                  metaCumulative
                  referenceMonth={cardReferenceMonth}
                  loading={cardsValueLoading}
                />
                <PerformanceCard
                  title="Ocupacao" icon={Percent} highlight delay={60} partialRange={Boolean(dayRange)}
                  currentValue={cards?.occAtual ?? 0} currentFormatted={cards ? fmtOcc(cards.occAtual) : ''}
                  prevYear={cards ? pd(cards.occPrevYear, fmtOcc) : null}
                  ytd={cards ? pd(cards.occYtd, fmtOcc) : null}
                  meta={cards ? pmd(cards.occMeta, fmtOcc) : loadingMeta}
                  referenceMonth={cardReferenceMonth}
                  loading={cardsValueLoading}
                />
                <PerformanceCard
                  title="Diaria Media" icon={DollarSign} highlight delay={120} partialRange={Boolean(dayRange)}
                  currentValue={cards?.dmAtual ?? 0} currentFormatted={cards ? fmtR(cards.dmAtual) : ''}
                  prevYear={cards ? pd(cards.dmPrevYear, fmtR) : null}
                  ytd={cards ? pd(cards.dmYtd, fmtR) : null}
                  meta={cards ? pmd(cards.dmMeta, fmtR) : loadingMeta}
                  referenceMonth={cardReferenceMonth}
                  loading={cardsValueLoading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5" style={{ marginBottom: 40 }}>
                <PerformanceCard
                  title="RevPAR" icon={TrendingUp} delay={180}
                  currentValue={cards?.revparAtual ?? 0} currentFormatted={cards ? fmtR(cards.revparAtual) : ''}
                  prevYear={cards ? pd(cards.revparPrevYear, fmtR) : null}
                  ytd={cards ? pd(cards.revparYtd, fmtR) : null}
                  loading={cardsValueLoading}
                />
                <PerformanceCard
                  title="Room Nights" icon={BedDouble} delay={240}
                  currentValue={cards?.roomNightsAtual ?? 0}
                  currentFormatted={cards ? fmtInt(cards.roomNightsAtual) : ''}
                  prevYear={cards ? pd(cards.roomNightsPrevYear, fmtInt) : null}
                  ytd={cards ? pd(cards.roomNightsYtd, fmtInt) : null}
                  loading={cardsValueLoading}
                />
                <PerformanceCard
                  title="Hospedes" icon={Users} delay={300}
                  currentValue={cards?.hospedesAtual ?? 0}
                  currentFormatted={cards ? fmtInt(cards.hospedesAtual) : ''}
                  prevYear={cards ? pd(cards.hospedesPrevYear, fmtInt) : null}
                  ytd={cards ? pd(cards.hospedesYtd, fmtInt) : null}
                  loading={cardsValueLoading}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: 40 }}>
            <PickupSection
              hotelId={hotelId}
              pickupRows={pickupRows}
              selectedMeses={selectedMeses}
              availableMeses={availableMonths}
              onReferenceChange={handleMesesChange}
              selectedPosition={calendarPosition}
              availablePositionDates={availablePositionDates}
              onPositionChange={handlePositionSelect}
              onCurrentMonthSelect={handleCurrentMonthSelect}
              shopperRates={pickupShopperRates}
              loading={calendarLoading || pickupLoading}
              error={calendarError || pickupError}
            />
          </div>

          <div style={{ marginBottom: 40 }}>
            <RateCalendar
              rates={rates}
              loading={ratesLoading}
              yearMonth={rateMonth}
              onMonthChange={setRateMonth}
              hotelId={hotelId}
            />
          </div>
        </>
      )}
    </div>
  );
}
