import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, RefreshCw, CalendarDays, Table2, Download, Users } from 'lucide-react';
import type { BookingRate, RateDaySummary } from '@/data/types';
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
function buildCalendarDays(yearMonth: string): (string | null)[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDay   = new Date(y, m - 1, 1);
  const lastDay    = new Date(y, m, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= lastDay; d++) {
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
) {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) dates.push(`${yearMonth}-${String(d).padStart(2,'0')}`);

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
    const nossa = s?.clientMin != null ? s.clientMin.toFixed(2) : '';
    const pct   = s?.pctVsCompetitor != null ? `${s.pctVsCompetitor.toFixed(1)}%` : '';
    const compPrices = competitors.map(c => {
      const p = compLookup.get(date)?.get(c.slug);
      return p !== undefined ? p.toFixed(2) : '';
    });
    return [date, dia, nossa, pct, ...compPrices];
  });

  const csv  = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
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
  onSelectDate:    (d: string) => void;
}

function TableView({
  yearMonth, selectedPersons, summaries, rates, competitors, today, onSelectDate,
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
    for (let d = 1; d <= lastDay; d++) arr.push(`${yearMonth}-${String(d).padStart(2,'0')}`);
    return arr;
  }, [yearMonth, lastDay]);

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
}

export default function RateCalendar({ rates, loading, yearMonth, onMonthChange }: RateCalendarProps) {
  // All unique pax values across all rates for this month
  const allPersonsOptions = useMemo(() => {
    const set = new Set<number>();
    for (const r of rates) set.add(r.maxPersons);
    return [...set].sort((a, b) => a - b);
  }, [rates]);

  // Pax values the CLIENT offers
  const clientPersonsSet = useMemo(() => {
    const set = new Set<number>();
    for (const r of rates) if (r.type === 'cliente') set.add(r.maxPersons);
    return set;
  }, [rates]);

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

  const containerRef    = useRef<HTMLDivElement>(null);
  const [modalAnchorTop, setModalAnchorTop] = useState(0);

  useEffect(() => {
    if (selectedDate && containerRef.current) {
      setModalAnchorTop(containerRef.current.getBoundingClientRect().top);
    }
  }, [selectedDate]);

  const summaries    = useMemo(() => buildDaySummaries(rates, selectedPersons), [rates, selectedPersons]);
  const calendarDays = useMemo(() => buildCalendarDays(yearMonth), [yearMonth]);

  const competitors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rates) if (r.type === 'concorrente' && !seen.has(r.slug)) seen.set(r.slug, r.label);
    return [...seen.entries()].map(([slug, label]) => ({ slug, label }));
  }, [rates]);

  const lastScrapedAt = useMemo(() => {
    if (rates.length === 0) return null;
    return rates.reduce((max, r) => r.scrapedAt > max ? r.scrapedAt : max, rates[0].scrapedAt);
  }, [rates]);

  const fmtScraped = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const [y, m] = yearMonth.split('-').map(Number);
  const today  = new Date().toISOString().slice(0,10);

  const prevMonth = () => { const pm=m===1?12:m-1; const py=m===1?y-1:y; onMonthChange(`${py}-${String(pm).padStart(2,'0')}`); };
  const nextMonth = () => { const nm=m===12?1:m+1;  const ny=m===12?y+1:y; onMonthChange(`${ny}-${String(nm).padStart(2,'0')}`); };

  const selectedDayRates = selectedDate ? rates.filter(r => r.checkinDate === selectedDate) : [];
  const hasAnyData = rates.length > 0;

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s',
    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
  });

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
            {lastScrapedAt && (
              <div className="flex items-center gap-1.5" style={{
                padding: '5px 11px', borderRadius: 'var(--rx)',
                background: 'var(--bg)', border: '1px solid var(--border-l)',
              }}>
                <RefreshCw size={10} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-m)', fontWeight: 500 }}>
                  Atualizado{' '}
                  <strong style={{ color: 'var(--text)', fontWeight: 700 }}>{fmtScraped(lastScrapedAt)}</strong>
                </span>
              </div>
            )}

            {/* Month nav */}
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--rx)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'transparent' }}>
                <ChevronLeft size={14} style={{ color: 'var(--text-m)' }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 130, textAlign: 'center' }}>
                {MONTH_LABELS[m - 1]} {y}
              </span>
              <button onClick={nextMonth} style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--rx)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'transparent' }}>
                <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

            {/* Calendar / Table toggle */}
            <div className="flex items-center gap-1">
              <button title="Calendário" style={toggleBtn(view === 'calendar')} onClick={() => setView('calendar')}>
                <CalendarDays size={14} style={{ color: view === 'calendar' ? 'var(--accent)' : 'var(--text-m)' }} />
              </button>
              <button title="Tabela" style={toggleBtn(view === 'table')} onClick={() => setView('table')}>
                <Table2 size={14} style={{ color: view === 'table' ? 'var(--accent)' : 'var(--text-m)' }} />
              </button>
            </div>

            {/* Download */}
            <button
              title="Baixar CSV"
              onClick={() => downloadCSV(yearMonth, selectedPersons, summaries, rates, competitors)}
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

        {/* ── Content ── */}
        {loading ? (
          <div className="flex items-center justify-center" style={{ padding: '48px 0' }}>
            <span style={{ fontSize: 12, color: 'var(--text-m)' }}>Carregando tarifas...</span>
          </div>
        ) : !hasAnyData ? (
          <div className="flex flex-col items-center justify-center" style={{ padding: '48px 0' }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-m)' }}>
              Sem dados de tarifas para este mês
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4 }}>
              Execute o scraper para popular os dados
            </span>
          </div>
        ) : view === 'table' ? (
          <TableView
            yearMonth={yearMonth}
            selectedPersons={selectedPersons}
            summaries={summaries}
            rates={rates}
            competitors={competitors}
            today={today}
            onSelectDate={setSelectedDate}
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
                  const compFiltered = rates.filter(r => r.type === 'concorrente' && r.checkinDate === date && r.maxPersons === selectedPersons);
                  const compMin = compFiltered.length > 0 ? Math.min(...compFiltered.map(r => r.priceBrl)) : null;
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
                    onClick={() => clickable && setSelectedDate(date)}
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
