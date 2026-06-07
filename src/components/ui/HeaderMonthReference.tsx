import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { localDateKey } from '@/lib/utils';

const MES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const EXTRACAO_COLOR = '#9A7657';
const EXTRACAO_SOFT = '#F0EDE8';
const EXTRACAO_BORDER = '#D6C8BA';

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

function monthDayCells(ym: string) {
  const [year, month] = ym.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  return {
    daysInMonth,
    firstWeekday,
    blanks: Array.from({ length: firstWeekday }),
    days: Array.from({ length: daysInMonth }, (_, index) => index + 1),
  };
}

export interface DayRange {
  ini: number;
  fim: number;
}

interface HeaderMonthReferenceProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelect: (month: string) => void;
  selectedPosition?: string;
  availablePositionDates?: string[];
  onPositionSelect?: (date: string) => void;
  onCurrentMonthSelect?: () => void;
  // Eixo "Diárias" (faixa de dias do mês). Opcional — só Clientes/ClienteDetalhe usam.
  dayRange?: DayRange | null;
  onDayRangeChange?: (range: DayRange | null) => void;
}

export default function HeaderMonthReference({
  selectedMonth,
  availableMonths,
  onSelect,
  selectedPosition,
  availablePositionDates,
  onPositionSelect,
  onCurrentMonthSelect,
  dayRange,
  onDayRangeChange,
}: HeaderMonthReferenceProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(selectedMonth.slice(0, 4)));
  const [positionMonth, setPositionMonth] = useState(() => (selectedPosition || selectedMonth).slice(0, 7));
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);
  // Drill-down ano→mês→dias: quando o eixo Diárias está ativo, alternamos entre o
  // calendário de dias e o seletor de mês (clicando no título do mês).
  const [monthPicker, setMonthPicker] = useState(false);
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

  // ── Eixo "Diárias" (faixa de dias) ─────────────────────────────────────
  const monthDays = useMemo(() => monthDayCells(selectedMonth), [selectedMonth]);
  const lastDay = monthDays.daysInMonth;
  const rangeIni = Math.min(Math.max(dayRange?.ini ?? 1, 1), lastDay);
  const rangeFim = Math.min(dayRange?.fim ?? lastDay, lastDay);
  const isFullMonth = rangeIni === 1 && rangeFim === lastDay;
  const rangeLabel = isFullMonth
    ? 'Mês todo'
    : rangeIni === rangeFim ? `Dia ${rangeIni}` : `Dias ${rangeIni}–${rangeFim}`;
  const dayPresets = useMemo(() => [
    { label: 'Mês todo', ini: 1, fim: lastDay },
    { label: '1–10', ini: 1, fim: Math.min(10, lastDay) },
    { label: '11–20', ini: 11, fim: Math.min(20, lastDay) },
    { label: `21–${lastDay}`, ini: 21, fim: lastDay },
  ], [lastDay]);

  // Faixa "efetiva" para render — com preview ao vivo enquanto se escolhe (cobrinha)
  let effIni = rangeIni;
  let effFim = rangeFim;
  let showBand = !isFullMonth;
  if (pendingStart != null) {
    const h = hoverDay ?? pendingStart;
    effIni = Math.min(pendingStart, h);
    effFim = Math.max(pendingStart, h);
    showBand = true;
  }
  const singleDay = effIni === effFim;

  const applyRange = (ini: number, fim: number) => {
    if (!onDayRangeChange) return;
    const a = Math.max(1, Math.min(ini, fim));
    const b = Math.min(lastDay, Math.max(ini, fim));
    onDayRangeChange(a === 1 && b === lastDay ? null : { ini: a, fim: b });
  };

  const handleDayClick = (day: number) => {
    if (pendingStart == null) {
      setPendingStart(day);
      applyRange(day, day);
    } else {
      applyRange(pendingStart, day);
      setPendingStart(null);
      setHoverDay(null);
    }
  };

  useEffect(() => {
    setYear(Number(selectedMonth.slice(0, 4)));
    setPendingStart(null);
    setHoverDay(null);
  }, [selectedMonth]);

  useEffect(() => { if (!open) { setMonthPicker(false); setPendingStart(null); } }, [open]);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
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
    setMonthPicker(false);
    if (!onPositionSelect && !onDayRangeChange) setOpen(false);
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
    setMonthPicker(false);
    setOpen(false);
  };

  // ── Grade de meses (drill-down / modo clássico do PickupTable) ──
  const monthGrid = (
    <>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => prevYear != null && setYear(prevYear)}
          disabled={prevYear == null}
          style={{
            padding: '4px 8px', borderRadius: 'var(--rx)', color: 'var(--text-m)',
            opacity: prevYear == null ? 0.35 : 1, cursor: prevYear == null ? 'default' : 'pointer',
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
            padding: '4px 8px', borderRadius: 'var(--rx)', color: 'var(--text-m)',
            opacity: nextYear == null ? 0.35 : 1, cursor: nextYear == null ? 'default' : 'pointer',
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
                padding: '8px 4px',
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
    </>
  );

  return (
    <div ref={ref} style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '30px minmax(150px, 230px) 30px',
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
        {onDayRangeChange && !isFullMonth && (
          <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 850, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
            Diárias: {rangeLabel}
          </div>
        )}
        {selectedPosition && (
          <div style={{ marginTop: 2, fontSize: 10.5, fontWeight: 850, color: EXTRACAO_COLOR, whiteSpace: 'nowrap' }}>
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
          width: onDayRangeChange ? 312 : (onPositionSelect ? 306 : 260),
          maxHeight: '78vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: 'var(--sh-m)',
          padding: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, color: 'var(--accent)', textTransform: 'uppercase' }}>
              {onDayRangeChange ? 'Período das diárias' : 'Dados do mês'}
            </div>
            <button
              type="button"
              onClick={selectCurrentMonth}
              disabled={!canSelectCurrentMonth}
              title="Selecionar mês atual e última extração"
              aria-label="Selecionar mês atual e última extração"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, minHeight: 24, padding: '3px 7px',
                borderRadius: 'var(--rx)', border: '1px solid var(--border)',
                background: selectedMonth === currentMonth && isFullMonth ? 'var(--accent-l)' : 'var(--surface)',
                color: canSelectCurrentMonth ? 'var(--text)' : 'var(--text-m)',
                opacity: canSelectCurrentMonth ? 1 : 0.4,
                cursor: canSelectCurrentMonth ? 'pointer' : 'default',
                fontSize: 10.5, fontWeight: 800,
              }}
            >
              <CalendarDays size={12} />
              Mês atual
            </button>
          </div>

          {onDayRangeChange ? (
            <>
              {/* Presets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 11 }}>
                {dayPresets.map(p => {
                  const active = rangeIni === p.ini && rangeFim === p.fim;
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => { setPendingStart(null); setHoverDay(null); applyRange(p.ini, p.fim); }}
                      style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent)' : 'var(--bg)',
                        color: active ? '#fff' : 'var(--text)', transition: 'all .1s',
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {monthPicker ? (
                monthGrid
              ) : (
                <>
                  {/* Nav do mês com drill-down (clica no título => grade de meses) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 30px', alignItems: 'center', gap: 6, marginBottom: 9 }}>
                    <button
                      onClick={() => prevMonth && onSelect(prevMonth)}
                      disabled={!prevMonth}
                      aria-label="Mês anterior"
                      style={navButton(Boolean(prevMonth))}
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthPicker(true)}
                      title="Escolher mês / ano"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        height: 30, borderRadius: 'var(--rx)', border: '1px solid var(--border)',
                        background: 'var(--bg)', cursor: 'pointer',
                        fontSize: 13, fontWeight: 850, color: 'var(--text)',
                      }}
                    >
                      {fmtMonthTitle(selectedMonth)}
                      <ChevronRight size={13} style={{ color: 'var(--text-m)', transform: 'rotate(90deg)' }} />
                    </button>
                    <button
                      onClick={() => nextMonth && onSelect(nextMonth)}
                      disabled={!nextMonth}
                      aria-label="Próximo mês"
                      style={navButton(Boolean(nextMonth))}
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  <div style={{ fontSize: 10, fontWeight: 650, color: 'var(--text-m)', marginBottom: 7 }}>
                    {pendingStart != null
                      ? `Início no dia ${pendingStart} — clique no dia final (ou no mesmo p/ 1 dia)`
                      : 'Clique num dia p/ início e outro p/ fim — ou um único dia'}
                  </div>

                  {/* Cabeçalho dos dias da semana */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: 0, marginBottom: 4 }}>
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                      <span key={`${d}-${i}`} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--text-m)' }}>
                        {d}
                      </span>
                    ))}
                  </div>

                  {/* Grade de dias — "cobrinha" (banda contínua) */}
                  <div
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: 0, rowGap: 2 }}
                    onMouseLeave={() => { if (pendingStart != null) setHoverDay(null); }}
                  >
                    {monthDays.blanks.map((_, i) => <span key={`db-${i}`} />)}
                    {monthDays.days.map(day => {
                      const inBand = showBand && day >= effIni && day <= effFim;
                      const isStart = showBand && day === effIni;
                      const isEnd = showBand && day === effFim;
                      const endpoint = isStart || isEnd;
                      const dow = (monthDays.firstWeekday + day - 1) % 7;
                      const leftRound = isStart || dow === 0 || day === 1;
                      const rightRound = isEnd || dow === 6 || day === lastDay;
                      return (
                        <div
                          key={day}
                          onMouseEnter={() => { if (pendingStart != null) setHoverDay(day); }}
                          style={{
                            height: 34,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: inBand && !singleDay ? 'var(--accent-l)' : 'transparent',
                            borderTopLeftRadius: leftRound ? 99 : 0,
                            borderBottomLeftRadius: leftRound ? 99 : 0,
                            borderTopRightRadius: rightRound ? 99 : 0,
                            borderBottomRightRadius: rightRound ? 99 : 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleDayClick(day)}
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: '50%',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: endpoint ? 850 : 600,
                              background: endpoint ? 'var(--accent)' : 'transparent',
                              color: endpoint ? '#fff' : inBand ? 'var(--accent-d)' : 'var(--text)',
                              transition: 'background .1s',
                            }}
                          >
                            {day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            monthGrid
          )}

          {onPositionSelect && (
            <>
              <div style={{ height: 1, background: 'var(--border-l)', margin: '14px 0 11px' }} />
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, color: EXTRACAO_COLOR, textTransform: 'uppercase' }}>
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
                      width: 26, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--rx)', color: 'var(--text-m)',
                      opacity: prevPositionMonth ? 1 : 0.35, cursor: prevPositionMonth ? 'pointer' : 'default',
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
                      width: 26, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 'var(--rx)', color: 'var(--text-m)',
                      opacity: nextPositionMonth ? 1 : 0.35, cursor: nextPositionMonth ? 'pointer' : 'default',
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
                        border: `1.5px solid ${selected ? EXTRACAO_COLOR : 'transparent'}`,
                        background: selected ? EXTRACAO_COLOR : disabled ? 'var(--bg)' : EXTRACAO_SOFT,
                        color: selected ? '#fff' : disabled ? 'var(--text-m)' : EXTRACAO_COLOR,
                        borderColor: selected ? EXTRACAO_COLOR : disabled ? 'transparent' : EXTRACAO_BORDER,
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
