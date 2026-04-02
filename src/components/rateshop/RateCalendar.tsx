import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, RefreshCw, CalendarDays, Table2, Download } from 'lucide-react';
import type { BookingRate, RateDaySummary } from '@/data/types';
import RateDayModal from './RateDayModal';

// ─── Helpers ──────────────────────────────────────────────────────────

const MONTH_LABELS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAY_LABELS  = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const DAY_LABELS3 = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function buildDaySummaries(rates: BookingRate[]): Map<string, RateDaySummary> {
  const byDate = new Map<string, BookingRate[]>();
  for (const r of rates) {
    const list = byDate.get(r.checkinDate) ?? [];
    list.push(r);
    byDate.set(r.checkinDate, list);
  }

  const result = new Map<string, RateDaySummary>();
  for (const [date, dayRates] of byDate) {
    const clientRates = dayRates.filter(r => r.type === 'cliente');
    const compRates   = dayRates.filter(r => r.type === 'concorrente');

    // Reference capacity = minimum maxPersons the client offers for this day.
    // Both client and competitors are filtered to this same capacity for a fair comparison.
    const refPersons = clientRates.length > 0
      ? Math.min(...clientRates.map(r => r.maxPersons)) : null;

    const clientFiltered = refPersons !== null
      ? clientRates.filter(r => r.maxPersons === refPersons) : clientRates;
    const clientMin = clientFiltered.length > 0
      ? Math.min(...clientFiltered.map(r => r.priceBrl)) : null;

    const compFiltered = refPersons !== null
      ? compRates.filter(r => r.maxPersons === refPersons) : compRates;
    const competitorMin = compFiltered.length > 0
      ? Math.min(...compFiltered.map(r => r.priceBrl)) : null;

    const pctVsCompetitor =
      clientMin !== null && competitorMin !== null && competitorMin > 0
        ? parseFloat((((clientMin - competitorMin) / competitorMin) * 100).toFixed(1)) : null;

    result.set(date, { date, refPersons, clientMin, competitorMin, pctVsCompetitor, hasData: dayRates.length > 0 });
  }
  return result;
}

// Monday-based calendar grid
function buildCalendarDays(yearMonth: string): (string | null)[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay  = new Date(y, m, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7;
  const days: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function pctBgBorder(pct: number | null): { cellBg: string; borderColor: string; pctColor: string } {
  if (pct === null) return { cellBg: 'var(--surface-h)', borderColor: 'var(--border-l)', pctColor: 'var(--text-m)' };
  if (pct < 0)   return { cellBg: 'var(--green-l)', borderColor: '#A7F3D0', pctColor: 'var(--green)' };
  if (pct <= 30) return { cellBg: 'var(--amber-l)', borderColor: '#FDE68A', pctColor: 'var(--amber)' };
  return               { cellBg: 'var(--red-l)',   borderColor: '#FECACA', pctColor: 'var(--red)'   };
}

// ─── CSV Download ─────────────────────────────────────────────────────

function downloadCSV(
  yearMonth: string,
  summaries: Map<string, RateDaySummary>,
  rates: BookingRate[],
  competitors: { slug: string; label: string }[],
) {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const dates: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    dates.push(`${yearMonth}-${String(d).padStart(2,'0')}`);
  }

  // Build competitor min-price lookup: date → slug → min price
  // Only include rates matching refPersons for that date (same capacity as client baseline)
  const compLookup = new Map<string, Map<string, number>>();
  for (const r of rates) {
    if (r.type !== 'concorrente') continue;
    const refPersons = summaries.get(r.checkinDate)?.refPersons ?? null;
    if (refPersons !== null && r.maxPersons !== refPersons) continue;
    const bySlug = compLookup.get(r.checkinDate) ?? new Map<string, number>();
    const cur = bySlug.get(r.slug);
    if (cur === undefined || r.priceBrl < cur) bySlug.set(r.slug, r.priceBrl);
    compLookup.set(r.checkinDate, bySlug);
  }

  const headers = ['Data','Dia','Nossa Diária','% vs Concorrência', ...competitors.map(c => c.label)];
  const rows = dates.map(date => {
    const s = summaries.get(date);
    const d = new Date(date + 'T00:00:00');
    const dia = DAY_LABELS3[d.getDay()];
    const nossa = s?.clientMin != null ? s.clientMin.toFixed(2) : '';
    const pct   = s?.pctVsCompetitor != null ? `${s.pctVsCompetitor.toFixed(1)}%` : '';
    const compPrices = competitors.map(c => {
      const p = compLookup.get(date)?.get(c.slug);
      return p !== undefined ? p.toFixed(2) : '';
    });
    return [date, dia, nossa, pct, ...compPrices];
  });

  const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `rate-shopper-${yearMonth}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Props ────────────────────────────────────────────────────────────

interface RateCalendarProps {
  rates: BookingRate[];
  loading: boolean;
  yearMonth: string;
  onMonthChange: (ym: string) => void;
}

// ─── Table View ───────────────────────────────────────────────────────

interface TableViewProps {
  yearMonth: string;
  summaries: Map<string, RateDaySummary>;
  rates: BookingRate[];
  competitors: { slug: string; label: string }[];
  today: string;
  onSelectDate: (d: string) => void;
}

function TableView({ yearMonth, summaries, rates, competitors, today, onSelectDate }: TableViewProps) {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();

  // competitor min per date per slug — filtered to same refPersons as client baseline
  const compLookup = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const r of rates) {
      if (r.type !== 'concorrente') continue;
      const refPersons = summaries.get(r.checkinDate)?.refPersons ?? null;
      if (refPersons !== null && r.maxPersons !== refPersons) continue;
      const bySlug = map.get(r.checkinDate) ?? new Map<string, number>();
      const cur = bySlug.get(r.slug);
      if (cur === undefined || r.priceBrl < cur) bySlug.set(r.slug, r.priceBrl);
      map.set(r.checkinDate, bySlug);
    }
    return map;
  }, [rates, summaries]);

  const dates = useMemo(() => {
    const arr: string[] = [];
    for (let d = 1; d <= lastDay; d++) arr.push(`${yearMonth}-${String(d).padStart(2,'0')}`);
    return arr;
  }, [yearMonth, lastDay]);

  const th: React.CSSProperties = {
    padding: '8px 12px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-m)',
    background: 'var(--surface-2)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  };

  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border-l)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left',   minWidth: 110 }}>Data</th>
            <th style={{ ...th, textAlign: 'center', minWidth: 48  }}>Dia</th>
            <th style={{ ...th, textAlign: 'right',  minWidth: 100 }}>Nossa Diária</th>
            <th style={{ ...th, textAlign: 'center', minWidth: 70  }}>% vs Comp.</th>
            {competitors.map(c => (
              <th key={c.slug} style={{ ...th, textAlign: 'right', minWidth: 100 }}>
                {c.label.length > 18 ? c.label.slice(0, 16) + '…' : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map(date => {
            const s = summaries.get(date);
            const d = new Date(date + 'T00:00:00');
            const dayNum  = d.getDate();
            const dayName = DAY_LABELS3[d.getDay()];
            const isToday   = date === today;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const { pctColor } = pctBgBorder(s?.pctVsCompetitor ?? null);
            const hasPct = s?.pctVsCompetitor !== null && s?.pctVsCompetitor !== undefined;
            const hasData = (s?.hasData) ?? false;

            return (
              <tr
                key={date}
                onClick={() => hasData && onSelectDate(date)}
                style={{
                  borderBottom: '1px solid var(--border-l)',
                  cursor: hasData ? 'pointer' : 'default',
                  background: isToday ? 'rgba(var(--accent-rgb),0.04)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (hasData) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--surface-2)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isToday ? 'rgba(var(--accent-rgb),0.04)' : 'transparent'; }}
              >
                {/* Data */}
                <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 500,
                    color: isToday ? 'var(--accent)' : 'var(--text)',
                  }}>
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
                  <span style={{
                    fontSize: 11,
                    fontWeight: isWeekend ? 700 : 400,
                    color: isWeekend ? 'var(--amber)' : 'var(--text-m)',
                  }}>
                    {dayName}
                  </span>
                </td>

                {/* Nossa Diária */}
                <td style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {s?.clientMin != null ? (
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>
                      {fmtBRL(s.clientMin)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-m)', fontSize: 11 }}>—</span>
                  )}
                </td>

                {/* % vs Concorrência */}
                <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                  {hasPct ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 7px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      color: pctColor,
                      background: pctBgBorder(s!.pctVsCompetitor).cellBg,
                      border: `1px solid ${pctBgBorder(s!.pctVsCompetitor).borderColor}`,
                    }}>
                      {s!.pctVsCompetitor! >= 0 ? '+' : ''}{s!.pctVsCompetitor!.toFixed(0)}%
                    </span>
                  ) : (
                    <span style={{ color: 'var(--text-m)', fontSize: 11 }}>—</span>
                  )}
                </td>

                {/* Competitors */}
                {competitors.map(c => {
                  const price = compLookup.get(date)?.get(c.slug);
                  return (
                    <td key={c.slug} style={{ padding: '9px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {price !== undefined ? (
                        <span style={{ fontSize: 12, color: 'var(--text-m)' }}>
                          {fmtBRL(price)}
                        </span>
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

// ─── Main Component ────────────────────────────────────────────────────

type ViewMode = 'calendar' | 'table';

export default function RateCalendar({ rates, loading, yearMonth, onMonthChange }: RateCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('calendar');

  const summaries    = useMemo(() => buildDaySummaries(rates), [rates]);
  const calendarDays = useMemo(() => buildCalendarDays(yearMonth), [yearMonth]);

  // Unique competitors (preserve insertion order = first seen)
  const competitors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rates) {
      if (r.type === 'concorrente' && !seen.has(r.slug)) seen.set(r.slug, r.label);
    }
    return [...seen.entries()].map(([slug, label]) => ({ slug, label }));
  }, [rates]);

  // Last scrape timestamp
  const lastScrapedAt = useMemo(() => {
    if (rates.length === 0) return null;
    return rates.reduce((max, r) => r.scrapedAt > max ? r.scrapedAt : max, rates[0].scrapedAt);
  }, [rates]);

  const fmtScraped = (iso: string) => {
    const d = new Date(iso);
    const day   = String(d.getDate()).padStart(2,'0');
    const month = String(d.getMonth()+1).padStart(2,'0');
    const hour  = String(d.getHours()).padStart(2,'0');
    const min   = String(d.getMinutes()).padStart(2,'0');
    return `${day}/${month} às ${hour}:${min}`;
  };

  const [y, m] = yearMonth.split('-').map(Number);
  const today  = new Date().toISOString().slice(0, 10);

  const prevMonth = () => {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    onMonthChange(`${py}-${String(pm).padStart(2,'0')}`);
  };
  const nextMonth = () => {
    const nm = m === 12 ? 1  : m + 1;
    const ny = m === 12 ? y + 1 : y;
    onMonthChange(`${ny}-${String(nm).padStart(2,'0')}`);
  };

  const selectedDayRates = selectedDate ? rates.filter(r => r.checkinDate === selectedDate) : [];
  const hasAnyData = rates.length > 0;

  // ── Toggle button style ──────────────────────────────────────────────
  const toggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 6,
    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
    cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
  });

  return (
    <>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '20px 24px',
      }}>
        {/* ── Header ── */}
        <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              Rate Shopper
            </h3>
            <p style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 2 }}>
              Menor diária do cliente vs concorrência (mesma capacidade)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Last update badge */}
            {lastScrapedAt && (
              <div
                className="flex items-center gap-1.5"
                style={{
                  padding: '5px 11px', borderRadius: 'var(--rx)',
                  background: 'var(--bg)', border: '1px solid var(--border-l)',
                }}
              >
                <RefreshCw size={10} style={{ color: 'var(--green)', flexShrink: 0 }} />
                <span style={{ fontSize: 10.5, color: 'var(--text-m)', fontWeight: 500 }}>
                  Atualizado{' '}
                  <strong style={{ color: 'var(--text)', fontWeight: 700 }}>
                    {fmtScraped(lastScrapedAt)}
                  </strong>
                </span>
              </div>
            )}

            {/* Month navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="flex items-center justify-center transition-colors hover:bg-[var(--surface-h)]"
                style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--rx)' }}
              >
                <ChevronLeft size={14} style={{ color: 'var(--text-m)' }} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', minWidth: 130, textAlign: 'center' }}>
                {MONTH_LABELS[m - 1]} {y}
              </span>
              <button
                onClick={nextMonth}
                className="flex items-center justify-center transition-colors hover:bg-[var(--surface-h)]"
                style={{ width: 28, height: 28, border: '1px solid var(--border)', borderRadius: 'var(--rx)' }}
              >
                <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
              </button>
            </div>

            {/* Divider */}
            <div style={{ width: 1, height: 20, background: 'var(--border)', marginLeft: 4, marginRight: 2 }} />

            {/* Calendar / Table toggle */}
            <div className="flex items-center gap-1">
              <button
                title="Visualização calendário"
                style={toggleBtn(view === 'calendar')}
                onClick={() => setView('calendar')}
              >
                <CalendarDays size={14} style={{ color: view === 'calendar' ? 'var(--accent)' : 'var(--text-m)' }} />
              </button>
              <button
                title="Visualização tabela"
                style={toggleBtn(view === 'table')}
                onClick={() => setView('table')}
              >
                <Table2 size={14} style={{ color: view === 'table' ? 'var(--accent)' : 'var(--text-m)' }} />
              </button>
            </div>

            {/* Download */}
            <button
              title="Baixar CSV"
              onClick={() => downloadCSV(yearMonth, summaries, rates, competitors)}
              disabled={!hasAnyData}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 30, height: 30, borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'transparent',
                cursor: hasAnyData ? 'pointer' : 'not-allowed',
                opacity: hasAnyData ? 1 : 0.4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (hasAnyData) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-h)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <Download size={14} style={{ color: 'var(--text-m)' }} />
            </button>
          </div>
        </div>

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
          /* ── TABLE VIEW ── */
          <TableView
            yearMonth={yearMonth}
            summaries={summaries}
            rates={rates}
            competitors={competitors}
            today={today}
            onSelectDate={setSelectedDate}
          />
        ) : (
          /* ── CALENDAR VIEW ── */
          <>
            <div className="grid grid-cols-7 gap-1" style={{ marginBottom: 4 }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{
                  textAlign: 'center', fontSize: 10, fontWeight: 600,
                  color: 'var(--text-m)', textTransform: 'uppercase',
                  letterSpacing: '0.4px', padding: '4px 0',
                }}>
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} />;

                const s = summaries.get(date);
                const day = parseInt(date.slice(8));
                const isToday = date === today;

                if (!s) {
                  return (
                    <div key={date} style={{
                      background: '#E2E4EE',
                      border: isToday ? '1.5px solid var(--accent)' : '1px solid #CDD0DF',
                      borderRadius: 'var(--rx)', padding: '7px 5px', minHeight: 72,
                      textAlign: 'center', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: isToday ? 700 : 500,
                        color: isToday ? 'var(--accent)' : '#8A96B4',
                        alignSelf: 'flex-end', paddingRight: 2,
                      }}>{day}</span>
                      <X size={14} strokeWidth={2.5} style={{ color: '#A0A8C0', marginBottom: 6 }} />
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
                    <div style={{
                      fontSize: 11, fontWeight: isToday ? 700 : 500,
                      color: isToday ? 'var(--accent)' : 'var(--text-s)', marginBottom: 5,
                    }}>
                      {day}
                    </div>
                    {s.clientMin !== null ? (
                      <>
                        <div style={{
                          fontSize: 11, fontWeight: 700, color: 'var(--text)',
                          fontFamily: 'var(--mono)', lineHeight: 1.2,
                        }}>
                          {s.clientMin.toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 })}
                        </div>
                        {s.pctVsCompetitor !== null ? (
                          <div style={{ fontSize: 10, fontWeight: 700, color: pctColor, marginTop: 4 }}>
                            {s.pctVsCompetitor >= 0 ? '+' : ''}{s.pctVsCompetitor.toFixed(0)}%
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: 'var(--text-m)', marginTop: 4 }}>
                            sem concorrente
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: 'var(--text-m)', marginTop: 4, lineHeight: 1.4 }}>
                        só<br />concorrente
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
              style={{ marginTop: 16, borderTop: '1px solid var(--border-l)', paddingTop: 12 }}
            >
              <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 600 }}>Legenda:</span>
              <div className="flex items-center gap-1.5">
                <span style={{
                  width: 10, height: 10, borderRadius: 3, background: '#E2E4EE', border: '1px solid #CDD0DF',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <X size={6} strokeWidth={3} style={{ color: '#A0A8C0' }} />
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-m)' }}>Sem dados</span>
              </div>
              {[
                { color: 'var(--green)', bg: 'var(--green-l)', border: '#A7F3D0', label: 'Abaixo da concorrência' },
                { color: 'var(--amber)', bg: 'var(--amber-l)', border: '#FDE68A', label: 'Até 30% acima' },
                { color: 'var(--red)',   bg: 'var(--red-l)',   border: '#FECACA', label: 'Mais de 30% acima' },
              ].map(({ bg, border, color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span style={{
                    width: 10, height: 10, borderRadius: 3, background: bg, border: `1px solid ${border}`,
                    display: 'inline-block', flexShrink: 0,
                  }} />
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
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
