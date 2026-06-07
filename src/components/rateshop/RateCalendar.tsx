import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, X, RefreshCw, CalendarDays, Table2, Download, Users, Loader2, Clock, CheckCircle2, HelpCircle } from 'lucide-react';
import type { BookingRate, RateDaySummary } from '@/data/types';
import { localDateKey } from '@/lib/utils';
import { useShopperRun } from '@/hooks/useShopperRun';
import RateDayModal from './RateDayModal';

// ─── Constants ────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAY_LABELS  = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
const DAY_LABELS3 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─── Helpers ──────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function dateOnly(value: string | null | undefined) {
  return value ? value.slice(0, 10) : null;
}

function pctBgBorder(pct: number | null) {
  if (pct === null) return { cellBg: 'var(--surface-h)', borderColor: 'var(--border-l)', pctColor: 'var(--text-m)' };
  if (pct < 0)   return { cellBg: 'var(--green-l)', borderColor: '#A7F3D0', pctColor: 'var(--green)' };
  if (pct <= 30) return { cellBg: 'var(--amber-l)', borderColor: '#FDE68A', pctColor: 'var(--amber)' };
  return               { cellBg: 'var(--red-l)',   borderColor: '#FECACA', pctColor: 'var(--red)'   };
}

/**
 * Build per-day summaries filtered to a specific `selectedPersons` capacity.
 * - clientMin: cheapest client rate for that capacity (null if client has no room at this pax)
 * - competitorMin: cheapest competitor rate for same capacity
 * - clientHasPax: whether the client has any room with this exact maxPersons
 */
function buildDaySummaries(
  rates: BookingRate[],
  selectedPersons: number,
): Map<string, RateDaySummary & { clientHasPax: boolean }> {
  const byDate = new Map<string, BookingRate[]>();
  for (const r of rates) {
    const list = byDate.get(r.checkinDate) ?? [];
    list.push(r);
    byDate.set(r.checkinDate, list);
  }

  const result = new Map<string, RateDaySummary & { clientHasPax: boolean }>();
  for (const [date, dayRates] of byDate) {
    const clientRates = dayRates.filter(r => r.type === 'cliente');
    const compRates   = dayRates.filter(r => r.type === 'concorrente');

    const clientFiltered = clientRates.filter(r => r.maxPersons === selectedPersons);
    const clientHasPax   = clientFiltered.length > 0;
    const clientMin      = clientHasPax
      ? Math.min(...clientFiltered.map(r => r.priceBrl)) : null;

    const compFiltered  = compRates.filter(r => r.maxPersons === selectedPersons);
    const competitorMin = compFiltered.length > 0
      ? Math.min(...compFiltered.map(r => r.priceBrl)) : null;

    const pctVsCompetitor =
      clientMin !== null && competitorMin !== null && competitorMin > 0
        ? parseFloat((((clientMin - competitorMin) / competitorMin) * 100).toFixed(1)) : null;

    result.set(date, {
      date,
      refPersons: selectedPersons,
      clientMin,
      competitorMin,
      pctVsCompetitor,
      hasData: dayRates.length > 0,
      clientHasPax,
    });
  }
  return result;
}

// Monday-based calendar grid
function buildCalendarDays(yearMonth: string, minDate: string): (string | null)[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay    = new Date(y, m, 0).getDate();
  const minMonth = minDate.slice(0, 7);
  if (yearMonth < minMonth) return [];

  const firstVisibleDay = yearMonth === minMonth ? Number(minDate.slice(8, 10)) : 1;
  const firstDay   = new Date(y, m - 1, firstVisibleDay);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (string | null)[] = Array(startOffset).fill(null);
  for (let d = firstVisibleDay; d <= lastDay; d++) {
    days.push(`${yearMonth}-${String(d).padStart(2,'0')}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

// ─── CSV Download ─────────────────────────────────────────────────────

function downloadCSV(
  yearMonth: string,
  selectedPersons: number,
  summaries: Map<string, RateDaySummary & { clientHasPax: boolean }>,
  rates: BookingRate[],
  competitors: { slug: string; label: string }[],
  minDate: string,
) {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    const date = `${yearMonth}-${String(d).padStart(2,'0')}`;
    if (date >= minDate) dates.push(date);
  }

  // competitor min per date per slug at selectedPersons
  const compLookup = new Map<string, Map<string, number>>();
  for (const r of rates) {
    if (r.type !== 'concorrente' || r.maxPersons !== selectedPersons) continue;
    const bySlug = compLookup.get(r.checkinDate) ?? new Map<string, number>();
    const cur = bySlug.get(r.slug);
    if (cur === undefined || r.priceBrl < cur) bySlug.set(r.slug, r.priceBrl);
    compLookup.set(r.checkinDate, bySlug);
  }

  const headers = ['Data','Dia',`Nossa Diária (${selectedPersons} pax)`, '% vs Concorrência',
    ...competitors.map(c => c.label)];
  const rows = dates.map(date => {
    const s   = summaries.get(date);
    const d   = new Date(date + 'T00:00:00');
    const dia = DAY_LABELS3[d.getDay()];
    const nossa = s?.clientMin != null ? s.clientMin.toFixed(2).replace('.', ',') : '';
    const pct   = s?.pctVsCompetitor != null ? `${s.pctVsCompetitor.toFixed(1).replace('.', ',')}%` : '';
    const compPrices = competitors.map(c => {
      const p = compLookup.get(date)?.get(c.slug);
      return p !== undefined ? p.toFixed(2).replace('.', ',') : '';
    });
    return [date, dia, nossa, pct, ...compPrices];
  });

  const csv  = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `rate-shopper-${yearMonth}-${selectedPersons}pax.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Pax Filter ───────────────────────────────────────────────────────

interface PaxFilterProps {
  options:         number[];          // all unique maxPersons found in data
  clientOptions:   Set<number>;       // maxPersons the client actually offers
  selected:        number;
  onSelect:        (p: number) => void;
}

function PaxFilter({ options, clientOptions, selected, onSelect }: PaxFilterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-1" style={{ color: 'var(--text-m)', marginRight: 2 }}>
        <Users size={11} />
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Pax
        </span>
      </div>
      {options.map(p => {
        const isActive  = p === selected;
        const hasClient = clientOptions.has(p);
        return (
          <button
            key={p}
            onClick={() => onSelect(p)}
            title={hasClient ? `${p} pessoas` : `${p} pessoas (cliente não oferece)`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
              padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
              border: isActive
                ? `1.5px solid ${hasClient ? 'var(--accent)' : 'var(--border)' }`
                : '1px solid var(--border)',
              background: isActive
                ? hasClient ? 'rgba(var(--accent-rgb),0.10)' : 'var(--surface-2)'
                : 'transparent',
              color: isActive
                ? hasClient ? 'var(--accent)' : 'var(--text-m)'
                : hasClient ? 'var(--text-m)' : 'var(--border)',
              opacity: !hasClient && !isActive ? 0.5 : 1,
            }}
          >
            {p}
            {!hasClient && (
              <span style={{
                fontSize: 8, background: 'var(--surface-2)', color: 'var(--text-m)',
                borderRadius: 3, padding: '0 3px', marginLeft: 1,
              }}>
                sem cliente
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Table View ───────────────────────────────────────────────────────

interface TableViewProps {
  yearMonth:       string;
  selectedPersons: number;
  summaries:       Map<string, RateDaySummary & { clientHasPax: boolean }>;
  rates:           BookingRate[];
  competitors:     { slug: string; label: string }[];
  today:           string;
  minDate:         string;
  onSelectDate:    (d: string) => void;
}

function TableView({
  yearMonth, selectedPersons, summaries, rates, competitors, today, minDate, onSelectDate,
}: TableViewProps) {
  const [, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(+yearMonth.slice(0,4), m, 0).getDate();

  // competitor min per date per slug at selectedPersons
  const compLookup = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of rates) {
      if (r.type !== 'concorrente' || r.maxPersons !== selectedPersons) continue;
      const bySlug = map.get(r.checkinDate) ?? new Map<string, number>();
      const cur = bySlug.get(r.slug);
      if (cur === undefined || r.priceBrl < cur) bySlug.set(r.slug, r.priceBrl);
      map.set(r.checkinDate, bySlug);
    }
    return map;
  }, [rates, selectedPersons]);

  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const date = `${yearMonth}-${String(d).padStart(2,'0')}`;
      if (date >= minDate) arr.push(date);
    }
    return arr;
  }, [yearMonth, lastDay, minDate]);

  const th: React.CSSProperties = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-m)', background: 'var(--surface-2)',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-l)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left',   minWidth: 110 }}>Data</th>
            <th style={{ ...th, textAlign: 'center', minWidth: 48  }}>Dia</th>
            <th style={{ ...th, textAlign: 'right',  minWidth: 100 }}>
              Nossa Diária
              <span style={{ fontWeight: 400, opacity: 0.65, marginLeft: 4 }}>({selectedPersons} pax)</span>
            </th>
            <th style={{ ...th, textAlign: 'center', minWidth: 80  }}>% vs Comp.</th>
            {competitors.map(c => (
              <th key={c.slug} style={{ ...th, textAlign: 'right', minWidth: 100 }}>
                {c.label.length > 18 ? c.label.slice(0,16) + '…' : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(date => {
            const s = summaries.get(date);
            const d = new Date(date + 'T00:00:00');
            const dayNum    = d.getDate();
            const dayName   = DAY_LABELS3[d.getDay()];
            const isToday   = date === today;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const hasPct    = s?.pctVsCompetitor != null;
            const hasData   = s?.hasData ?? false;
            const noClient  = hasData && s?.clientHasPax === false;
            const { pctColor } = pctBgBorder(s?.pctVsCompetitor ?? null);

            return (
              <tr
                key={date}
                onClick={() => hasData && onSelectDate(date)}
                style={{
                  borderBottom: '1px solid var(--border-l)',
                  cursor: hasData ? 'pointer' : 'default',
                  background: isToday ? 'rgba(var(--accent-rgb),0.04)' : 'transparent',
                  opacity: noClient ? 0.55 : 1,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (hasData) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isToday ? 'rgba(var(--accent-rgb),0.04)' : 'transparent'; }}
              >
                {/* Data */}
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text)' }}>
                    {String(dayNum).padStart(2,'0')}/{String(m).padStart(2,'0')}
                  </span>
                  {isToday && (
                    <span style={{
                      marginLeft: 6, fontSize: 9, background: 'var(--accent)', color: '#fff',
                      borderRadius: 3, padding: '1px 5px', fontWeight: 700, letterSpacing: '0.04em',
                    }}>HOJE</span>
                  )}
                </td>

                {/* Dia */}
                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: isWeekend ? 700 : 400, color: isWeekend ? 'var(--amber)' : 'var(--text-m)' }}>
                    {dayName}
                  </span>
                </td>

                {/* Nossa Diária */}
                <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {s?.clientMin != null ? (
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{fmtBRL(s.clientMin)}</span>
                  ) : noClient ? (
                    <span style={{ fontSize: 10, color: 'var(--text-m)', fontStyle: 'italic' }}>sem esse pax</span>
                  ) : (
                    <span style={{ color: 'var(--text-m)' }}>—</span>
                  )}
                </td>

                {/* % vs Concorrência */}
                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                  {hasPct ? (
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 4,
                      fontSize: 11, fontWeight: 700, color: pctColor,
                      background: pctBgBorder(s!.pctVsCompetitor).cellBg,
                      border: `1px solid ${pctBgBorder(s!.pctVsCompetitor).borderColor}`,
                    }}>
                      {s!.pctVsCompetitor! >= 0 ? '+' : ''}{s!.pctVsCompetitor!.toFixed(0)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>
                  )}
                </td>

                {/* Competitors */}
                {competitors.map(c => {
                  const price = compLookup.get(date)?.get(c.slug);
                  return (
                    <td key={c.slug} style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {price !== undefined ? (
                        <span style={{ fontSize: 12, color: 'var(--text-m)' }}>{fmtBRL(price)}</span>
                      ) : (
                        <span style={{ color: 'var(--border)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

type ViewMode = 'calendar' | 'table';

interface RateCalendarProps {
  rates: BookingRate[];
  loading: boolean;
  yearMonth: string;
  onMonthChange: (ym: string) => void;
  hotelId: number;
}

export default function RateCalendar({ rates, loading, yearMonth, onMonthChange, hotelId }: RateCalendarProps) {
  const today = localDateKey();
  const visibleRates = useMemo(
    () => rates.filter(r => r.checkinDate >= today),
    [rates, today]
  );

  // All unique pax values across all rates for this month
  const allPersonsOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of visibleRates) set.add(r.maxPersons);
    return [...set].sort((a, b) => a - b);
  }, [visibleRates]);

  // Pax values the CLIENT offers
  const clientPersonsSet = useMemo(() => {
    const set = new Set<number>();
    for (const r of visibleRates) if (r.type === 'cliente') set.add(r.maxPersons);
    return set;
  }, [visibleRates]);

  // Default = minimum pax the client offers (falls back to first option overall)
  const defaultPersons = useMemo(() => {
    if (clientPersonsSet.size > 0) return Math.min(...clientPersonsSet);
    return allPersonsOptions[0] ?? 2;
  }, [clientPersonsSet, allPersonsOptions]);

  const [selectedPersons, setSelectedPersons] = useState<number>(defaultPersons);
  // Reset when month changes and brings new data
  const [prevDefault, setPrevDefault] = useState<number>(defaultPersons);
  if (defaultPersons !== prevDefault) {
    setPrevDefault(defaultPersons);
    setSelectedPersons(defaultPersons);
  }

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView]                 = useState<ViewMode>('calendar');
  const shopper = useShopperRun(hotelId);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const containerRef    = useRef<HTMLDivElement>(null);
  const [modalAnchorTop, setModalAnchorTop] = useState(0);

  // Capture document-absolute top (getBoundingClientRect + scrollY) BEFORE
  // the modal renders so the layout hasn't shifted yet.
  const openModal = useCallback((date: string) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setModalAnchorTop(rect.top + window.scrollY);
    }
    setSelectedDate(date);
  }, []);

  const summaries    = useMemo(() => buildDaySummaries(visibleRates, selectedPersons), [visibleRates, selectedPersons]);
  const calendarDays = useMemo(() => buildCalendarDays(yearMonth, today), [yearMonth, today]);

  // Min competitor price per day (same pax), precomputed once — avoids filtering
  // visibleRates inside every day cell during render (was O(days × rates)).
  const compMinByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of visibleRates) {
      if (r.type !== 'concorrente' || r.maxPersons !== selectedPersons) continue;
      const cur = m.get(r.checkinDate);
      if (cur === undefined || r.priceBrl < cur) m.set(r.checkinDate, r.priceBrl);
    }
    return m;
  }, [visibleRates, selectedPersons]);

  const competitors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of visibleRates) if (r.type === 'concorrente' && !seen.has(r.slug)) seen.set(r.slug, r.label);
    return [...seen.entries()].map(([slug, label]) => ({ slug, label }));
  }, [visibleRates]);

  const lastScrapedAt = useMemo(() => {
    if (visibleRates.length === 0) return null;
    return visibleRates.reduce((max, r) => r.scrapedAt > max ? r.scrapedAt : max, visibleRates[0].scrapedAt);
  }, [visibleRates]);
  const lastScrapedDate = dateOnly(lastScrapedAt);
  const shopperNeedsUpdate = Boolean(lastScrapedDate && lastScrapedDate < today);

  // Tica o relógio (1s) enquanto há atualização rodando ou cooldown, p/ o contador.
  useEffect(() => {
    if (!shopper.isActive && !shopper.cooldownUntil) return;
    const iv = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(iv);
  }, [shopper.isActive, shopper.cooldownUntil]);

  const fmtScraped = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} às ${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
  };

  // Contagem regressiva do cooldown (mín. 15 min entre coletas) — formato M:SS.
  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const [y, m] = yearMonth.split('-').map(Number);

  const prevMonth = () => { const pm=m===1?12:m-1; const py=m===1?y-1:y; onMonthChange(`${py}-${String(pm).padStart(2,'0')}`); };
  const nextMonth = () => { const nm=m===12?1:m+1;  const ny=m===12?y+1:y; onMonthChange(`${ny}-${String(nm).padStart(2,'0')}`); };

  const cooldownLeftMs = shopper.cooldownUntil ? Math.max(0, shopper.cooldownUntil - nowTick) : 0;
  const dailyReached = shopper.dailyLimited || shopper.dailyUsed >= shopper.dailyLimit;
  const updateDisabled = shopper.isActive || cooldownLeftMs > 0 || dailyReached;
  const shopperPct = shopper.run?.progress_pct != null ? Math.round(Number(shopper.run.progress_pct)) : null;
  const dailyRemaining = Math.max(0, shopper.dailyLimit - shopper.dailyUsed);

  // "?" explicando por que o limite é 7/dia (controle de custo) — tooltip nativo.
  const helpQuota = (
    <span
      title={`Limite de ${shopper.dailyLimit} coletas por dia para controlar os custos de extração do Booking. Para aumentar, fale com o administrador.`}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help', flexShrink: 0 }}
    >
      <HelpCircle size={13} style={{ color: 'var(--text-m)' }} />
    </span>
  );

  const selectedDayRates = selectedDate ? visibleRates.filter(r => r.checkinDate === selectedDate) : [];
  const hasAnyData = visibleRates.length > 0;

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
  });

  // Botão "Atualizar agora" (on-demand). big = fonte/padding maiores.
  // Estados (precedência): rodando > limite diário > cooldown (15min) > normal.
  const updateButton = (big: boolean) => (
    <button
      type="button"
      onClick={() => { if (!updateDisabled) void shopper.trigger(); }}
      disabled={updateDisabled}
      aria-label="Atualizar preços do rate shopper agora"
      title={
        shopper.isActive ? 'Buscando preços atualizados…'
        : dailyReached ? `Limite de ${shopper.dailyLimit} atualizações por dia atingido — volta amanhã`
        : cooldownLeftMs > 0 ? `Disponível em ${fmtCountdown(cooldownLeftMs)} (mín. 15 min entre coletas)`
        : 'Buscar preços atualizados do Booking agora'
      }
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        padding: big ? '9px 16px' : '6px 12px',
        borderRadius: 'var(--rx)',
        border: `1px solid ${updateDisabled && !shopper.isActive ? 'var(--border)' : 'var(--accent)'}`,
        background: updateDisabled ? (shopper.isActive ? 'rgba(var(--accent-rgb),0.10)' : 'var(--surface)') : 'var(--accent)',
        color: updateDisabled ? 'var(--text-m)' : '#fff',
        fontSize: big ? 12.5 : 11, fontWeight: 750, whiteSpace: 'nowrap',
        cursor: updateDisabled ? 'not-allowed' : 'pointer',
        opacity: (updateDisabled && !shopper.isActive) ? 0.7 : 1,
        transition: 'all 0.15s',
      }}
    >
      {shopper.isActive ? (
        <><Loader2 size={big ? 14 : 11} className="animate-spin" /> Atualizando{shopperPct != null ? ` ${shopperPct}%` : '…'}</>
      ) : dailyReached ? (
        <><AlertTriangle size={big ? 13 : 10} /> Limite atingido</>
      ) : cooldownLeftMs > 0 ? (
        <><Clock size={big ? 13 : 10} /> Em {fmtCountdown(cooldownLeftMs)}</>
      ) : (
        <><RefreshCw size={big ? 14 : 11} /> Atualizar agora</>
      )}
    </button>
  );

  // Cluster de atualização (linha própria, abaixo do título): à esquerda o status
  // "Atualizado/Desatualizado em DD/MM às HHhMM" + "X de 7 coletas restantes hoje" (?);
  // à direita 1 único botão. Fica âmbar quando os dados são de outro dia.
  const updateCluster = () => {
    const amber = shopperNeedsUpdate;
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--rx)',
        background: amber ? 'var(--amber-l)' : 'var(--surface-2)',
        border: `1px solid ${amber ? '#FDE68A' : 'var(--border-l)'}`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' }}>
            {amber
              ? <AlertTriangle size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              : <CheckCircle2 size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />}
            <span style={{ color: 'var(--text)', fontWeight: 700 }}>
              {amber ? 'Desatualizado' : 'Atualizado'} em {fmtScraped(lastScrapedAt!)}
            </span>
            {amber && <span style={{ fontSize: 11.5, color: 'var(--amber)', fontWeight: 600 }}>— atualize para hoje</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-m)', flexWrap: 'wrap', paddingLeft: 23 }}>
            <span><strong style={{ color: 'var(--text)', fontWeight: 700 }}>{dailyRemaining}</strong> de {shopper.dailyLimit} coletas restantes hoje</span>
            {helpQuota}
            {(shopper.busy || shopper.run?.status === 'error' || shopper.rejection?.reason.startsWith('erro')) && (
              <span style={{ fontSize: 10.5, fontWeight: 600, color: shopper.busy ? 'var(--amber)' : 'var(--red)' }}>
                {shopper.busy ? '· ocupado, tente já já' : '· falhou, tente de novo'}
              </span>
            )}
          </div>
        </div>
        {/* Botão só quando ATUALIZADO; se desatualizado, o botão fica no overlay central (1 botão só) */}
        {!amber && <div style={{ flexShrink: 0 }}>{updateButton(true)}</div>}
      </div>
    );
  };

  return (
    <>
      <div ref={containerRef} style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--r)', padding: '20px 24px',
      }}>
        {/* ── Header row 1: title + controls ── */}
        <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              Rate Shopper
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 2 }}>
              Menor diária do cliente vs concorrência (mesma capacidade)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Month nav */}
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Mês anterior" onClick={prevMonth} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--rx)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'transparent' }}>
                <ChevronLeft size={14} style={{ color: 'var(--text-m)' }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 130, textAlign: 'center' }}>
                {MONTH_LABELS[m - 1]} {y}
              </span>
              <button type="button" aria-label="Próximo mês" onClick={nextMonth} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--rx)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'transparent' }}>
                <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

            {/* Calendar / Table toggle */}
            <div className="flex items-center gap-1">
              <button type="button" title="Calendário" aria-label="Ver em calendário" aria-pressed={view === 'calendar'} style={toggleBtn(view === 'calendar')} onClick={() => setView('calendar')}>
                <CalendarDays size={14} style={{ color: view === 'calendar' ? 'var(--accent)' : 'var(--text-m)' }} />
              </button>
              <button type="button" title="Tabela" aria-label="Ver em tabela" aria-pressed={view === 'table'} style={toggleBtn(view === 'table')} onClick={() => setView('table')}>
                <Table2 size={14} style={{ color: view === 'table' ? 'var(--accent)' : 'var(--text-m)' }} />
              </button>
            </div>

            {/* Download */}
            <button
              title="Baixar CSV"
              onClick={() => downloadCSV(yearMonth, selectedPersons, summaries, visibleRates, competitors, today)}
              disabled={!hasAnyData}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)',
                background: 'transparent', cursor: hasAnyData ? 'pointer' : 'not-allowed',
                opacity: hasAnyData ? 1 : 0.4, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (hasAnyData) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-h)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Download size={14} style={{ color: 'var(--text-m)' }} />
            </button>
          </div>
        </div>

        {/* ── Atualização (status + X/7 + botão), em linha própria ── */}
        {lastScrapedAt && updateCluster()}

        {/* ── Header row 2: Pax filter ── */}
        {hasAnyData && allPersonsOptions.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '8px 12px', marginBottom: 16, borderRadius: 8,
            background: 'var(--surface-2)', border: '1px solid var(--border-l)',
            gap: 10,
          }}>
            <PaxFilter
              options={allPersonsOptions}
              clientOptions={clientPersonsSet}
              selected={selectedPersons}
              onSelect={setSelectedPersons}
            />
            {!clientPersonsSet.has(selectedPersons) && (
              <span style={{
                fontSize: 10, color: 'var(--amber)', fontWeight: 500,
                padding: '2px 7px', borderRadius: 4,
                background: 'var(--amber-l)', border: '1px solid #FDE68A', marginLeft: 'auto',
              }}>
                Cliente não oferece quartos para {selectedPersons} pessoas neste mês
              </span>
            )}
          </div>
        )}

        {/* ── Content (com overlay de atualização) ── */}
        <div style={{ position: 'relative' }}>
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '48px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-m)' }}>Carregando tarifas...</span>
          </div>
        ) : !hasAnyData ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: '48px 0', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-m)' }}>
              Nenhum preço coletado ainda
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-m)', textAlign: 'center', maxWidth: 300 }}>
              O rate shopper é sob demanda — clique para buscar os preços do Booking agora.
            </span>
            {updateButton(true)}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: 'var(--text-m)' }}>
              {dailyRemaining} de {shopper.dailyLimit} coletas restantes hoje · mín. 15 min entre coletas
              {helpQuota}
            </span>
          </div>
        ) : view === 'table' ? (
          <TableView
            yearMonth={yearMonth}
            selectedPersons={selectedPersons}
            summaries={summaries}
            rates={visibleRates}
            competitors={competitors}
            today={today}
            minDate={today}
            onSelectDate={openModal}
          />
        ) : (
          <>
            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1" style={{ marginBottom: 4 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: 10, fontWeight: 600, color: 'var(--text-m)',
                  textTransform: 'uppercase', letterSpacing: '0.4px', padding: '4px 0',
                }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} />;

                const s         = summaries.get(date);
                const day       = parseInt(date.slice(8));
                const isToday   = date === today;
                const noClient  = s?.hasData && s?.clientHasPax === false;

                if (!s) {
                  return (
                    <div key={date} style={{
                      background: '#E2E4EE',
                      border: isToday ? '1.5px solid var(--accent)' : '1px solid #CDD0DF',
                      borderRadius: 'var(--rx)', padding: '7px 5px', minHeight: 72,
                      textAlign: 'center', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : '#8A96B4', alignSelf: 'flex-end', paddingRight: 2 }}>{day}</span>
                      <X size={14} strokeWidth={2.5} style={{ color: '#A0A8C0', marginBottom: 6 }} />
                    </div>
                  );
                }

                // Client has no room at this pax → grey cell regardless of competitors
                if (noClient) {
                  const compMin = compMinByDate.get(date) ?? null;
                  return (
                    <div key={date} style={{
                      background: 'var(--surface-2)',
                      border: isToday ? '1.5px solid var(--accent)' : '1px solid var(--border-l)',
                      borderRadius: 'var(--rx)', padding: '7px 5px', minHeight: 72,
                      textAlign: 'center', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                      opacity: 0.7,
                    }}>
                      <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent)' : 'var(--text-m)', alignSelf: 'flex-end', paddingRight: 2 }}>{day}</span>
                      <div style={{ textAlign: 'center' }}>
                        {compMin !== null && (
                          <div style={{ fontSize: 10, color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>
                            {fmtBRL(compMin)}
                          </div>
                        )}
                        <div style={{ fontSize: 8, color: 'var(--text-m)', marginTop: 2 }}>sem {selectedPersons} pax</div>
                      </div>
                    </div>
                  );
                }

                const clickable = s.hasData;
                const { cellBg, borderColor, pctColor } = pctBgBorder(s.pctVsCompetitor);

                return (
                  <button
                    key={date}
                    onClick={() => clickable && openModal(date)}
                    className={clickable ? 'hover:shadow-[var(--sh-m)]' : ''}
                    style={{
                      background: cellBg,
                      border: isToday ? '1.5px solid var(--accent)' : `1px solid ${borderColor}`,
                      borderRadius: 'var(--rx)', padding: '7px 5px',
                      cursor: clickable ? 'pointer' : 'default',
                      minHeight: 72, textAlign: 'center', transition: 'box-shadow 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--accent)' : 'var(--text-s)', marginBottom: 5 }}>
                      {day}
                    </div>
                    {s.clientMin !== null ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1.2 }}>
                          {s.clientMin.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 })}
                        </div>
                        {s.pctVsCompetitor !== null ? (
                          <div style={{ fontSize: 10, fontWeight: 700, color: pctColor, marginTop: 4 }}>
                            {s.pctVsCompetitor >= 0 ? '+' : ''}{s.pctVsCompetitor.toFixed(0)}%
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: 'var(--text-m)', marginTop: 4 }}>sem concorrente</div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: 'var(--text-m)', marginTop: 4, lineHeight: 1.4 }}>só<br />concorrente</div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ marginTop: 16, borderTop: '1px solid var(--border-l)', paddingTop: 12 }}>
              <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 600 }}>Legenda:</span>
              <div className="flex items-center gap-1.5">
                <span style={{ width:10, height:10, borderRadius:3, background:'#E2E4EE', border:'1px solid #CDD0DF', display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <X size={6} strokeWidth={3} style={{ color:'#A0A8C0' }} />
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-m)' }}>Sem dados</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span style={{ width:10, height:10, borderRadius:3, background:'var(--surface-2)', border:'1px solid var(--border-l)', display:'inline-block', flexShrink:0, opacity:0.7 }} />
                <span style={{ fontSize: 10, color: 'var(--text-m)' }}>Sem tarifa neste pax</span>
              </div>
              {[
                { color:'var(--green)', bg:'var(--green-l)', border:'#A7F3D0', label:'Abaixo da concorrência' },
                { color:'var(--amber)', bg:'var(--amber-l)', border:'#FDE68A', label:'Até 30% acima' },
                { color:'var(--red)',   bg:'var(--red-l)',   border:'#FECACA', label:'Mais de 30% acima' },
              ].map(({ bg, border, color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span style={{ width:10, height:10, borderRadius:3, background:bg, border:`1px solid ${border}`, display:'inline-block', flexShrink:0 }} />
                  <span style={{ fontSize: 10, color }}>{label}</span>
                </div>
              ))}
            </div>
          </>
        )}

          {/* Overlay de atualização: escurece os dados (ainda da coleta anterior) durante o refresh */}
          {shopper.isActive && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 'var(--rx)',
              background: 'rgba(255,255,255,0.74)', backdropFilter: 'blur(1.5px)',
              WebkitBackdropFilter: 'blur(1.5px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, zIndex: 5, textAlign: 'center', padding: 24,
            }}>
              <Loader2 size={26} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Atualizando preços do Booking{shopperPct != null ? ` — ${shopperPct}%` : '…'}
              </div>
              <div style={{
                width: 'min(280px, 70%)', height: 7, borderRadius: 999,
                background: 'var(--surface-2)', overflow: 'hidden', border: '1px solid var(--border-l)',
              }}>
                <div style={{
                  width: `${shopperPct ?? 5}%`, height: '100%',
                  background: 'var(--accent)', borderRadius: 999, transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-m)', maxWidth: 320 }}>
                Os valores exibidos ainda são da última coleta — serão substituídos ao concluir.
              </div>
            </div>
          )}

          {/* Overlay de DESATUALIZADO: esmaece os preços de outro dia + CTA central (1 botão só) */}
          {shopperNeedsUpdate && hasAnyData && !shopper.isActive && !loading && (
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 'var(--rx)',
              background: 'rgba(255,255,255,0.78)', backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 12, zIndex: 4, textAlign: 'center', padding: 24,
            }}>
              <AlertTriangle size={26} style={{ color: 'var(--amber)' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                Preços desatualizados{lastScrapedDate ? ` — coletados em ${lastScrapedDate.slice(8, 10)}/${lastScrapedDate.slice(5, 7)}` : ''}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-m)', maxWidth: 340 }}>
                Os valores abaixo não são de hoje. Atualize para ver os preços atuais do Booking.
              </div>
              {updateButton(true)}
            </div>
          )}
        </div>
      </div>

      {selectedDate && (
        <RateDayModal
          date={selectedDate}
          rates={selectedDayRates}
          anchorTop={modalAnchorTop}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
