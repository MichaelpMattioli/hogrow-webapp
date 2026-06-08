import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { localDateKey } from '@/lib/utils';
import { stayAxis, extractionAxis, axisPanel, axisLabel } from './axisPanel';
import ExtracaoCalendar from './ExtracaoCalendar';

const MES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const MES_PT_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export interface DayRange {
  ini: number;
  fim: number;
}

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

interface PeriodSelectorProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelect: (month: string) => void;
  selectedPosition?: string;
  availablePositionDates?: string[];
  onPositionSelect?: (date: string) => void;
  onCurrentMonthSelect?: () => void;
  // Eixo "diárias" (faixa de dias do mês). Opcional — só Clientes/ClienteDetalhe usam.
  dayRange?: DayRange | null;
  onDayRangeChange?: (range: DayRange | null) => void;
}

/**
 * Seletor de período em 2 painéis com divisão clara (substitui o HeaderMonthReference):
 *  - "Mês de referência" (eixo azul): mês + nav + grade de meses + "Mês atual" + faixa de dias
 *  - "Visão da extração" (eixo marrom): nav + calendário de extração
 * Drop-in: mesmas props do HeaderMonthReference.
 */
export default function PeriodSelector({
  selectedMonth,
  availableMonths,
  onSelect,
  selectedPosition,
  availablePositionDates,
  onPositionSelect,
  onCurrentMonthSelect,
  dayRange,
  onDayRangeChange,
}: PeriodSelectorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState(false);
  const [gridYear, setGridYear] = useState(() => Number(selectedMonth.slice(0, 4)));
  const [pendingStart, setPendingStart] = useState<number | null>(null);
  const [hoverDay, setHoverDay] = useState<number | null>(null);

  const today = localDateKey();
  const currentMonth = today.slice(0, 7);

  // ── Mês ──
  const months = useMemo(() => [...new Set(availableMonths)].sort(), [availableMonths]);
  const availSet = useMemo(() => new Set(months), [months]);
  const monthIndex = months.indexOf(selectedMonth);
  const prevMonth = monthIndex > 0 ? months[monthIndex - 1] : null;
  const nextMonth = monthIndex >= 0 && monthIndex < months.length - 1 ? months[monthIndex + 1] : null;
  const availableYears = useMemo(
    () => [...new Set(months.map(m => Number(m.slice(0, 4))))].sort((a, b) => a - b),
    [months]
  );
  const prevYear = useMemo(() => [...availableYears].reverse().find(y => y < gridYear) ?? null, [availableYears, gridYear]);
  const nextYear = useMemo(() => availableYears.find(y => y > gridYear) ?? null, [availableYears, gridYear]);
  const canCurrentMonth = Boolean(onCurrentMonthSelect) || availSet.has(currentMonth);

  // ── Extração ──
  const extr = useMemo(() => [...new Set(availablePositionDates ?? [])].sort(), [availablePositionDates]);
  const extrIndex = selectedPosition ? extr.indexOf(selectedPosition) : -1;
  const prevExtr = extrIndex > 0 ? extr[extrIndex - 1] : null;
  const nextExtr = extrIndex >= 0 && extrIndex < extr.length - 1 ? extr[extrIndex + 1] : null;

  // ── Faixa de dias ──
  const monthDays = useMemo(() => monthDayCells(selectedMonth), [selectedMonth]);
  const lastDay = monthDays.daysInMonth;
  const rangeIni = Math.min(Math.max(dayRange?.ini ?? 1, 1), lastDay);
  const rangeFim = Math.min(dayRange?.fim ?? lastDay, lastDay);
  const isFullMonth = rangeIni === 1 && rangeFim === lastDay;
  const dayPresets = useMemo(() => [
    { label: 'Mês todo', ini: 1, fim: lastDay },
    { label: '1–10', ini: 1, fim: Math.min(10, lastDay) },
    { label: '11–20', ini: 11, fim: Math.min(20, lastDay) },
    { label: `21–${lastDay}`, ini: 21, fim: lastDay },
  ], [lastDay]);

  let effIni = rangeIni, effFim = rangeFim, showBand = !isFullMonth;
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

  // ── Efeitos ──
  useEffect(() => {
    setGridYear(Number(selectedMonth.slice(0, 4)));
    setPendingStart(null);
    setHoverDay(null);
  }, [selectedMonth]);

  useEffect(() => {
    const onClickOut = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setMonthOpen(false); setDayOpen(false); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMonthOpen(false); setDayOpen(false); } };
    document.addEventListener('mousedown', onClickOut);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClickOut); document.removeEventListener('keydown', onKey); };
  }, []);

  const selectMonth = (m: string) => { onSelect(m); setMonthOpen(false); };
  const selectCurrent = () => {
    if (!canCurrentMonth) return;
    if (onCurrentMonthSelect) onCurrentMonthSelect(); else onSelect(currentMonth);
    setMonthOpen(false); setDayOpen(false);
  };

  const navBtn = (axis: typeof stayAxis, enabled: boolean, size = 34): React.CSSProperties => ({
    width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--rx)', border: `1px solid ${axis.border}`, background: 'var(--surface)',
    color: axis.text, flexShrink: 0, opacity: enabled ? 1 : 0.35, cursor: enabled ? 'pointer' : 'default',
  });

  return (
    <div ref={ref} style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 12, width: '100%',
    }}>
      {/* ── Painel A: Mês de referência ── */}
      <div style={{ ...axisPanel(stayAxis), position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
          <span style={{ ...axisLabel(stayAxis), marginBottom: 0 }}>Mês de referência</span>
          {onCurrentMonthSelect && (
            <button
              type="button" onClick={selectCurrent} disabled={!canCurrentMonth}
              title="Voltar ao mês atual e à última extração" aria-label="Voltar ao mês atual"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99,
                border: `1px solid ${stayAxis.border}`, background: 'var(--surface)', color: stayAxis.text,
                fontSize: 10, fontWeight: 800, opacity: canCurrentMonth ? 1 : 0.4, cursor: canCurrentMonth ? 'pointer' : 'default',
              }}
            >
              <CalendarDays size={11} /> Mês atual
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) 34px', alignItems: 'center', gap: 10 }}>
          <button onClick={() => prevMonth && onSelect(prevMonth)} disabled={!prevMonth}
            title="Mês anterior" aria-label="Mês anterior" style={navBtn(stayAxis, Boolean(prevMonth))}>
            <ChevronLeft size={17} />
          </button>

          <button
            type="button" onClick={() => { setMonthOpen(o => !o); setDayOpen(false); }}
            title="Escolher mês / ano" aria-label="Escolher mês"
            style={{ minWidth: 0, textAlign: 'left', background: 'transparent', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 26, lineHeight: 1.05, fontWeight: 900, color: stayAxis.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fmtMonthTitle(selectedMonth)}
              </span>
              <ChevronRight size={14} style={{ color: stayAxis.text, flexShrink: 0, transform: monthOpen ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }} />
            </div>
            <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 650, color: 'var(--text-m)' }}>{fmtMonthRange(selectedMonth)}</div>
          </button>

          <button onClick={() => nextMonth && onSelect(nextMonth)} disabled={!nextMonth}
            title="Próximo mês" aria-label="Próximo mês" style={navBtn(stayAxis, Boolean(nextMonth))}>
            <ChevronRight size={17} />
          </button>
        </div>

        {/* Grade de meses (dropdown) */}
        {monthOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% - 6px)', left: 14, zIndex: 90, width: 256,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--sh-m)', padding: 14,
          }}>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => prevYear != null && setGridYear(prevYear)} disabled={prevYear == null} aria-label="Ano anterior"
                style={{ padding: '4px 8px', borderRadius: 'var(--rx)', color: 'var(--text-m)', opacity: prevYear == null ? 0.35 : 1, cursor: prevYear == null ? 'default' : 'pointer' }}
                className="hover:bg-[var(--surface-h)]">
                <ChevronLeft size={15} />
              </button>
              <span style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{gridYear}</span>
              <button onClick={() => nextYear != null && setGridYear(nextYear)} disabled={nextYear == null} aria-label="Próximo ano"
                style={{ padding: '4px 8px', borderRadius: 'var(--rx)', color: 'var(--text-m)', opacity: nextYear == null ? 0.35 : 1, cursor: nextYear == null ? 'default' : 'pointer' }}
                className="hover:bg-[var(--surface-h)]">
                <ChevronRight size={15} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
              {MES_PT.map((label, i) => {
                const ym = `${gridYear}-${String(i + 1).padStart(2, '0')}`;
                const hasData = availSet.has(ym);
                const selected = selectedMonth === ym;
                return (
                  <button key={ym} disabled={!hasData} onClick={() => selectMonth(ym)}
                    style={{
                      padding: '8px 4px', borderRadius: 'var(--rx)', fontSize: 11.5, fontWeight: selected ? 850 : 650,
                      border: `1.5px solid ${selected ? 'var(--accent)' : 'transparent'}`,
                      background: selected ? 'var(--accent)' : 'var(--bg)',
                      color: selected ? '#fff' : hasData ? 'var(--text)' : 'var(--text-m)',
                      opacity: hasData ? 1 : 0.35, cursor: hasData ? 'pointer' : 'default', transition: 'all .1s',
                    }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Faixa de dias */}
        {onDayRangeChange && (
          <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${stayAxis.border}`, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Faixa de dias</span>
              {dayPresets.map(p => {
                const active = rangeIni === p.ini && rangeFim === p.fim;
                return (
                  <button key={p.label} type="button"
                    onClick={() => { setPendingStart(null); setHoverDay(null); setDayOpen(false); applyRange(p.ini, p.fim); }}
                    style={{
                      padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--accent)' : stayAxis.border}`,
                      background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : stayAxis.text, transition: 'all .1s',
                    }}>
                    {p.label}
                  </button>
                );
              })}
              <button type="button" onClick={() => { setDayOpen(o => !o); setMonthOpen(false); }}
                title="Escolher dias específicos" aria-label="Escolher dias específicos"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 99, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
                  border: `1px solid ${!isFullMonth && !dayPresets.some(p => p.ini === rangeIni && p.fim === rangeFim) ? 'var(--accent)' : stayAxis.border}`,
                  background: 'var(--surface)', color: stayAxis.text,
                }}>
                <SlidersHorizontal size={11} /> {isFullMonth ? 'Personalizar' : `Dias ${rangeIni}–${rangeFim}`}
              </button>
            </div>

            {/* Day picker (cobrinha) */}
            {dayOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 90, width: 256,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--sh-m)', padding: 14,
              }}>
                <div style={{ fontSize: 10, fontWeight: 650, color: 'var(--text-m)', marginBottom: 7 }}>
                  {pendingStart != null ? `Início no dia ${pendingStart} — clique no dia final (ou no mesmo p/ 1 dia)` : 'Clique num dia p/ início e outro p/ fim'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: 0, marginBottom: 4 }}>
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                    <span key={`${d}-${i}`} style={{ textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: 'var(--text-m)' }}>{d}</span>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', columnGap: 0, rowGap: 2 }}
                  onMouseLeave={() => { if (pendingStart != null) setHoverDay(null); }}>
                  {monthDays.blanks.map((_, i) => <span key={`b-${i}`} />)}
                  {monthDays.days.map(day => {
                    const inBand = showBand && day >= effIni && day <= effFim;
                    const isStart = showBand && day === effIni;
                    const isEnd = showBand && day === effFim;
                    const endpoint = isStart || isEnd;
                    const dow = (monthDays.firstWeekday + day - 1) % 7;
                    const leftRound = isStart || dow === 0 || day === 1;
                    const rightRound = isEnd || dow === 6 || day === lastDay;
                    return (
                      <div key={day} onMouseEnter={() => { if (pendingStart != null) setHoverDay(day); }}
                        style={{
                          height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: inBand && !singleDay ? 'var(--accent-l)' : 'transparent',
                          borderTopLeftRadius: leftRound ? 99 : 0, borderBottomLeftRadius: leftRound ? 99 : 0,
                          borderTopRightRadius: rightRound ? 99 : 0, borderBottomRightRadius: rightRound ? 99 : 0,
                        }}>
                        <button type="button" onClick={() => handleDayClick(day)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
                            fontSize: 12, fontWeight: endpoint ? 850 : 600,
                            background: endpoint ? 'var(--accent)' : 'transparent',
                            color: endpoint ? '#fff' : inBand ? 'var(--accent-d)' : 'var(--text)', transition: 'background .1s',
                          }}>
                          {day}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {!isFullMonth && (
                  <button type="button" onClick={() => { setPendingStart(null); setHoverDay(null); applyRange(1, lastDay); setDayOpen(false); }}
                    style={{ marginTop: 9, width: '100%', padding: '5px 0', borderRadius: 'var(--rx)', border: `1px solid ${stayAxis.border}`, background: 'var(--surface)', color: stayAxis.text, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                    Limpar (mês todo)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Painel B: Visão da extração ── */}
      <div style={{ ...axisPanel(extractionAxis), position: 'relative' }}>
        <div style={axisLabel(extractionAxis)}>Visão da extração</div>
        {extr.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => prevExtr && onPositionSelect?.(prevExtr)} disabled={!prevExtr}
              title="Extração anterior" aria-label="Extração anterior" style={navBtn(extractionAxis, Boolean(prevExtr), 28)}>
              <ChevronLeft size={14} />
            </button>
            <ExtracaoCalendar
              available={extr}
              changed={[]}
              selected={selectedPosition ?? null}
              onSelect={(d) => onPositionSelect?.(d)}
            />
            <button onClick={() => nextExtr && onPositionSelect?.(nextExtr)} disabled={!nextExtr}
              title="Próxima extração" aria-label="Próxima extração" style={navBtn(extractionAxis, Boolean(nextExtr), 28)}>
              <ChevronRight size={14} />
            </button>
            {selectedPosition && (
              <span style={{ fontSize: 12, fontWeight: 800, color: extractionAxis.text, marginLeft: 4 }}>
                {fmtDateBR(selectedPosition)}
              </span>
            )}
          </div>
        ) : (
          <button disabled style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 'var(--rx)',
            background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-m)', fontSize: 12, fontWeight: 600, opacity: 0.65, cursor: 'default',
          }}>
            <CalendarDays size={13} /> Sem extrações
          </button>
        )}
        <div style={{ marginTop: 7, fontSize: 11.5, color: 'var(--text-m)', fontWeight: 600 }}>
          Retrato dos dados usado para calcular os valores.
        </div>
      </div>
    </div>
  );
}
