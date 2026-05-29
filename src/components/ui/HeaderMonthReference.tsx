import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { localDateKey } from '@/lib/utils';

const MES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtMonthTitle(ym: string) {
  const [year, month] = ym.split('-');
  return `${MES_PT_FULL[Number(month) - 1] ?? month} ${year}`;
}

function fmtMonthRange(ym: string) {
  const [year, month] = ym.split('-');
  const lastDay = String(new Date(Number(year), Number(month), 0).getDate()).padStart(2, '0');
  return `01/${month}/${year} a ${lastDay}/${month}/${year}`;
}

function fmtDateBR(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

function calendarDays(ym: string) {
  const [year, month] = ym.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  return {
    blanks: Array.from({ length: firstWeekday }),
    days: Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      return `${ym}-${String(day).padStart(2, '0')}`;
    }),
  };
}

interface HeaderMonthReferenceProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelect: (month: string) => void;
  selectedPosition?: string;
  availablePositionDates?: string[];
  onPositionSelect?: (date: string) => void;
  onCurrentMonthSelect?: () => void;
}

export default function HeaderMonthReference({
  selectedMonth,
  availableMonths,
  onSelect,
  selectedPosition,
  availablePositionDates,
  onPositionSelect,
  onCurrentMonthSelect,
}: HeaderMonthReferenceProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(selectedMonth.slice(0, 4)));
  const [positionMonth, setPositionMonth] = useState(() => (selectedPosition || selectedMonth).slice(0, 7));
  const ref = useRef<HTMLDivElement>(null);
  const today = localDateKey();
  const currentMonth = today.slice(0, 7);
  const months = useMemo(() => [...new Set(availableMonths)].sort(), [availableMonths]);
  const availSet = useMemo(() => new Set(months), [months]);
  const currentMonthAvailable = availSet.has(currentMonth);
  const canSelectCurrentMonth = Boolean(onCurrentMonthSelect) || currentMonthAvailable;
  const positionMonths = useMemo(
    () => [...new Set((availablePositionDates ?? []).map(date => date.slice(0, 7)))].sort(),
    [availablePositionDates]
  );
  const availableYears = useMemo(
    () => [...new Set(months.map(ym => Number(ym.slice(0, 4))))].sort((a, b) => a - b),
    [months]
  );
  const activeIndex = months.indexOf(selectedMonth);
  const prevMonth = activeIndex > 0 ? months[activeIndex - 1] : null;
  const nextMonth = activeIndex >= 0 && activeIndex < months.length - 1 ? months[activeIndex + 1] : null;
  const positionCalendar = useMemo(() => calendarDays(positionMonth), [positionMonth]);
  const positionSet = useMemo(
    () => availablePositionDates ? new Set(availablePositionDates) : null,
    [availablePositionDates]
  );
  const positionMonthIndex = positionMonths.indexOf(positionMonth);
  const prevPositionMonth = positionMonthIndex > 0 ? positionMonths[positionMonthIndex - 1] : null;
  const nextPositionMonth = positionMonthIndex >= 0 && positionMonthIndex < positionMonths.length - 1
    ? positionMonths[positionMonthIndex + 1]
    : null;
  const prevYear = useMemo(
    () => [...availableYears].reverse().find(y => y < year) ?? null,
    [availableYears, year]
  );
  const nextYear = useMemo(
    () => availableYears.find(y => y > year) ?? null,
    [availableYears, year]
  );

  useEffect(() => {
    setYear(Number(selectedMonth.slice(0, 4)));
  }, [selectedMonth]);

  useEffect(() => {
    if (selectedPosition) {
      setPositionMonth(selectedPosition.slice(0, 7));
    }
  }, [selectedPosition]);

  useEffect(() => {
    if (selectedPosition || positionMonths.length === 0) return;
    setPositionMonth(current => positionMonths.includes(current)
      ? current
      : positionMonths[positionMonths.length - 1]);
  }, [positionMonths, selectedPosition]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navButton = (enabled: boolean): CSSProperties => ({
    width: 30,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--rx)',
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-m)',
    opacity: enabled ? 1 : 0.35,
    cursor: enabled ? 'pointer' : 'default',
    flexShrink: 0,
  });

  const selectMonth = (month: string) => {
    onSelect(month);
    if (!onPositionSelect) setOpen(false);
  };

  const selectPosition = (date: string) => {
    onPositionSelect?.(date);
    setOpen(false);
  };

  const selectCurrentMonth = () => {
    if (!canSelectCurrentMonth) return;
    if (onCurrentMonthSelect) {
      onCurrentMonthSelect();
    } else {
      onSelect(currentMonth);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '30px minmax(150px, 220px) 30px',
      alignItems: 'center',
      gap: 9,
      padding: '2px 0',
    }}>
      <button
        onClick={() => prevMonth && onSelect(prevMonth)}
        disabled={!prevMonth}
        title="Referência anterior"
        aria-label="Referência anterior"
        style={navButton(Boolean(prevMonth))}
      >
        <ChevronLeft size={16} />
      </button>

      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Selecionar mês de referência"
        aria-label="Selecionar mês de referência"
        style={{
          minWidth: 0,
          textAlign: 'left',
          border: '1px solid transparent',
          borderRadius: 'var(--rx)',
          padding: '5px 7px',
          background: open ? 'var(--accent-l)' : 'transparent',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, color: 'var(--accent)', marginBottom: 3 }}>
          DADOS DO MÊS
        </div>
        <div style={{
          fontSize: 20,
          lineHeight: 1.05,
          fontWeight: 900,
          color: 'var(--text)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {fmtMonthTitle(selectedMonth)}
        </div>
        <div style={{ marginTop: 3, fontSize: 10.5, fontWeight: 650, color: 'var(--text-m)', whiteSpace: 'nowrap' }}>
          {fmtMonthRange(selectedMonth)}
        </div>
        {selectedPosition && (
          <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 850, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
            Extração em {fmtDateBR(selectedPosition)}
          </div>
        )}
      </button>

      <button
        onClick={() => nextMonth && onSelect(nextMonth)}
        disabled={!nextMonth}
        title="Próxima referência"
        aria-label="Próxima referência"
        style={navButton(Boolean(nextMonth))}
      >
        <ChevronRight size={16} />
      </button>

      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 39,
          zIndex: 80,
          width: onPositionSelect ? 306 : 260,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: 'var(--sh-m)',
          padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, color: 'var(--accent)', textTransform: 'uppercase' }}>
              Dados do mês
            </div>
            <button
              type="button"
              onClick={selectCurrentMonth}
              disabled={!canSelectCurrentMonth}
              title="Selecionar mês atual e última extração"
              aria-label="Selecionar mês atual e última extração"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                minHeight: 24,
                padding: '3px 7px',
                borderRadius: 'var(--rx)',
                border: '1px solid var(--border)',
                background: selectedMonth === currentMonth ? 'var(--accent-l)' : 'var(--surface)',
                color: canSelectCurrentMonth ? 'var(--text)' : 'var(--text-m)',
                opacity: canSelectCurrentMonth ? 1 : 0.4,
                cursor: canSelectCurrentMonth ? 'pointer' : 'default',
                fontSize: 10.5,
                fontWeight: 800,
              }}
            >
              <CalendarDays size={12} />
              Mês atual
            </button>
          </div>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => prevYear != null && setYear(prevYear)}
              disabled={prevYear == null}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--rx)',
                color: 'var(--text-m)',
                opacity: prevYear == null ? 0.35 : 1,
                cursor: prevYear == null ? 'default' : 'pointer',
              }}
              className="hover:bg-[var(--surface-h)]"
            >
              <ChevronLeft size={15} />
            </button>
            <span style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{year}</span>
            <button
              onClick={() => nextYear != null && setYear(nextYear)}
              disabled={nextYear == null}
              style={{
                padding: '4px 8px',
                borderRadius: 'var(--rx)',
                color: 'var(--text-m)',
                opacity: nextYear == null ? 0.35 : 1,
                cursor: nextYear == null ? 'default' : 'pointer',
              }}
              className="hover:bg-[var(--surface-h)]"
            >
              <ChevronRight size={15} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
            {MES_PT.map((label, i) => {
              const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
              const hasData = availSet.has(ym);
              const selected = selectedMonth === ym;
              return (
                <button
                  key={ym}
                  disabled={!hasData}
                  onClick={() => selectMonth(ym)}
                  style={{
                    padding: '7px 4px',
                    borderRadius: 'var(--rx)',
                    fontSize: 11.5,
                    fontWeight: selected ? 850 : 650,
                    border: `1.5px solid ${selected ? 'var(--accent)' : 'transparent'}`,
                    background: selected ? 'var(--accent)' : 'var(--bg)',
                    color: selected ? '#fff' : hasData ? 'var(--text)' : 'var(--text-m)',
                    opacity: hasData ? 1 : 0.35,
                    cursor: hasData ? 'pointer' : 'default',
                    transition: 'all .1s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {onPositionSelect && (
            <>
              <div style={{ height: 1, background: 'var(--border-l)', margin: '13px 0 11px' }} />
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, color: 'var(--accent)', textTransform: 'uppercase' }}>
                  Visão da extração
                </div>
                <div style={{ marginTop: 2, fontSize: 11, fontWeight: 650, color: 'var(--text-m)' }}>
                  {selectedPosition ? `Extração em ${fmtDateBR(selectedPosition)}` : 'Selecione uma data'}
                </div>
                <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <button
                    onClick={() => prevPositionMonth && setPositionMonth(prevPositionMonth)}
                    disabled={!prevPositionMonth}
                    style={{
                      width: 26,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--rx)',
                      color: 'var(--text-m)',
                      opacity: prevPositionMonth ? 1 : 0.35,
                      cursor: prevPositionMonth ? 'pointer' : 'default',
                    }}
                    className="hover:bg-[var(--surface-h)]"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text)' }}>
                    {MES_PT[Number(positionMonth.slice(5, 7)) - 1] ?? positionMonth.slice(5, 7)}/{positionMonth.slice(0, 4)}
                  </span>
                  <button
                    onClick={() => nextPositionMonth && setPositionMonth(nextPositionMonth)}
                    disabled={!nextPositionMonth}
                    style={{
                      width: 26,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 'var(--rx)',
                      color: 'var(--text-m)',
                      opacity: nextPositionMonth ? 1 : 0.35,
                      cursor: nextPositionMonth ? 'pointer' : 'default',
                    }}
                    className="hover:bg-[var(--surface-h)]"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 5 }}>
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, index) => (
                  <span key={`${label}-${index}`} style={{ textAlign: 'center', fontSize: 9, fontWeight: 800, color: 'var(--text-m)' }}>
                    {label}
                  </span>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {positionCalendar.blanks.map((_, index) => (
                  <span key={`blank-${index}`} />
                ))}
                {positionCalendar.days.map(date => {
                  const day = Number(date.slice(-2));
                  const selected = selectedPosition === date;
                  const disabled = date > today || Boolean(positionSet && !positionSet.has(date));
                  return (
                    <button
                      key={date}
                      disabled={disabled}
                      onClick={() => selectPosition(date)}
                      style={{
                        height: 28,
                        borderRadius: 'var(--rx)',
                        fontSize: 11,
                        fontWeight: selected ? 850 : 650,
                        border: `1.5px solid ${selected ? 'var(--accent)' : 'transparent'}`,
                        background: selected ? 'var(--accent)' : 'var(--bg)',
                        color: selected ? '#fff' : disabled ? 'var(--text-m)' : 'var(--text)',
                        opacity: disabled ? 0.35 : 1,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all .1s',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
