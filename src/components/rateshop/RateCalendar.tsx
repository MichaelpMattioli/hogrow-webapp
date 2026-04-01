import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { BookingRate, RateDaySummary } from '@/data/types';
import RateDayModal from './RateDayModal';

// ─── Helpers ──────────────────────────────────────────────────────────

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

    // 1. Menor preço do cliente
    const clientMin = clientRates.length > 0
      ? Math.min(...clientRates.map(r => r.priceBrl))
      : null;

    // 2. maxPersons do quarto mais barato do cliente (referência para comparação)
    const refPersons = clientMin !== null
      ? (clientRates.find(r => r.priceBrl === clientMin)?.maxPersons ?? null)
      : null;

    // 3. Menor preço do concorrente na mesma capacidade de pessoas
    const compFiltered = refPersons !== null
      ? compRates.filter(r => r.maxPersons === refPersons)
      : compRates;
    const competitorMin = compFiltered.length > 0
      ? Math.min(...compFiltered.map(r => r.priceBrl))
      : null;

    const pctVsCompetitor =
      clientMin !== null && competitorMin !== null && competitorMin > 0
        ? parseFloat((((clientMin - competitorMin) / competitorMin) * 100).toFixed(1))
        : null;

    result.set(date, { date, clientMin, competitorMin, pctVsCompetitor, hasData: dayRates.length > 0 });
  }
  return result;
}

// Monday-based calendar grid: returns YYYY-MM-DD strings or null for padding
function buildCalendarDays(yearMonth: string): (string | null)[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  const days: (string | null)[] = Array(startOffset).fill(null);
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${yearMonth}-${String(d).padStart(2, '0')}`);
  }
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

const MONTH_LABELS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

// ─── Props ────────────────────────────────────────────────────────────

interface RateCalendarProps {
  rates: BookingRate[];
  loading: boolean;
  yearMonth: string;
  onMonthChange: (ym: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export default function RateCalendar({ rates, loading, yearMonth, onMonthChange }: RateCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const summaries = useMemo(() => buildDaySummaries(rates), [rates]);
  const calendarDays = useMemo(() => buildCalendarDays(yearMonth), [yearMonth]);

  const [y, m] = yearMonth.split('-').map(Number);
  const today = new Date().toISOString().slice(0, 10);

  const prevMonth = () => {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    onMonthChange(`${py}-${String(pm).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    onMonthChange(`${ny}-${String(nm).padStart(2, '0')}`);
  };

  const selectedDayRates = selectedDate ? rates.filter(r => r.checkinDate === selectedDate) : [];

  const hasAnyData = rates.length > 0;

  return (
    <>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          padding: '20px 24px',
        }}
      >
        {/* Section header */}
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
            <button
              onClick={prevMonth}
              className="flex items-center justify-center rounded-[var(--rx)] transition-colors hover:bg-[var(--surface-h)]"
              style={{ width: 28, height: 28, border: '1px solid var(--border)' }}
            >
              <ChevronLeft size={14} style={{ color: 'var(--text-m)' }} />
            </button>
            <span
              style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text)',
                minWidth: 130, textAlign: 'center',
              }}
            >
              {MONTH_LABELS[m - 1]} {y}
            </span>
            <button
              onClick={nextMonth}
              className="flex items-center justify-center rounded-[var(--rx)] transition-colors hover:bg-[var(--surface-h)]"
              style={{ width: 28, height: 28, border: '1px solid var(--border)' }}
            >
              <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
            </button>
          </div>
        </div>

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
        ) : (
          <>
            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1" style={{ marginBottom: 4 }}>
              {DAY_LABELS.map(d => (
                <div
                  key={d}
                  style={{
                    textAlign: 'center', fontSize: 10, fontWeight: 600,
                    color: 'var(--text-m)', textTransform: 'uppercase',
                    letterSpacing: '0.4px', padding: '4px 0',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, i) => {
                if (!date) return <div key={`pad-${i}`} />;

                const s = summaries.get(date);
                const day = parseInt(date.slice(8));
                const isToday = date === today;

                // ── Estado 1: sem nenhum dado de scraping ──────────────────
                if (!s) {
                  return (
                    <div
                      key={date}
                      style={{
                        background: '#E2E4EE',
                        border: isToday ? '1.5px solid var(--accent)' : '1px solid #CDD0DF',
                        borderRadius: 'var(--rx)',
                        padding: '7px 5px',
                        minHeight: 72,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11, fontWeight: isToday ? 700 : 500,
                          color: isToday ? 'var(--accent)' : '#8A96B4',
                          alignSelf: 'flex-end',
                          paddingRight: 2,
                        }}
                      >
                        {day}
                      </span>
                      <X
                        size={14}
                        strokeWidth={2.5}
                        style={{ color: '#A0A8C0', marginBottom: 6 }}
                      />
                    </div>
                  );
                }

                // ── Estado 2: tem dados, calcula cores ─────────────────────
                const clickable = s.hasData;
                let cellBg = 'var(--surface-h)';   // só cliente, sem concorrente
                let borderColor = 'var(--border-l)';
                let pctColor = 'var(--text-m)';

                if (s.pctVsCompetitor !== null) {
                  if (s.pctVsCompetitor < 0) {
                    cellBg = 'var(--green-l)'; borderColor = '#A7F3D0'; pctColor = 'var(--green)';
                  } else if (s.pctVsCompetitor <= 30) {
                    cellBg = 'var(--amber-l)'; borderColor = '#FDE68A'; pctColor = 'var(--amber)';
                  } else {
                    cellBg = 'var(--red-l)'; borderColor = '#FECACA'; pctColor = 'var(--red)';
                  }
                }

                return (
                  <button
                    key={date}
                    onClick={() => clickable && setSelectedDate(date)}
                    className={clickable ? 'hover:shadow-[var(--sh-m)]' : ''}
                    style={{
                      background: cellBg,
                      border: isToday ? '1.5px solid var(--accent)' : `1px solid ${borderColor}`,
                      borderRadius: 'var(--rx)',
                      padding: '7px 5px',
                      cursor: clickable ? 'pointer' : 'default',
                      minHeight: 72,
                      textAlign: 'center',
                      transition: 'box-shadow 0.15s',
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? 'var(--accent)' : 'var(--text-s)',
                        marginBottom: 5,
                      }}
                    >
                      {day}
                    </div>

                    {s.clientMin !== null ? (
                      <>
                        <div
                          style={{
                            fontSize: 11, fontWeight: 700, color: 'var(--text)',
                            fontFamily: 'var(--mono)', lineHeight: 1.2,
                          }}
                        >
                          {s.clientMin.toLocaleString('pt-BR', {
                            style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
                          })}
                        </div>
                        {s.pctVsCompetitor !== null ? (
                          <div style={{ fontSize: 10, fontWeight: 700, color: pctColor, marginTop: 4 }}>
                            {s.pctVsCompetitor >= 0 ? '+' : ''}
                            {s.pctVsCompetitor.toFixed(0)}%
                          </div>
                        ) : (
                          <div style={{ fontSize: 9, color: 'var(--text-m)', marginTop: 4 }}>
                            sem concorrente
                          </div>
                        )}
                      </>
                    ) : (
                      /* Tem dados de concorrente mas não do cliente */
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

              {/* No data */}
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    width: 10, height: 10, borderRadius: 3,
                    background: '#E2E4EE', border: '1px solid #CDD0DF',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <X size={6} strokeWidth={3} style={{ color: '#A0A8C0' }} />
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-m)' }}>Sem dados</span>
              </div>

              {/* Colored states */}
              {[
                { color: 'var(--green)', bg: 'var(--green-l)', border: '#A7F3D0', label: 'Abaixo da concorrência' },
                { color: 'var(--amber)', bg: 'var(--amber-l)', border: '#FDE68A', label: 'Até 30% acima' },
                { color: 'var(--red)',   bg: 'var(--red-l)',   border: '#FECACA', label: 'Mais de 30% acima' },
              ].map(({ bg, border, color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: 3,
                      background: bg, border: `1px solid ${border}`,
                      display: 'inline-block', flexShrink: 0,
                    }}
                  />
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
