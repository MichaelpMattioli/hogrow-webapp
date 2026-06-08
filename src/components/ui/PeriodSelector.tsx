import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
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
 * Seletor de período em 2 painéis (substitui o HeaderMonthReference):
 *  - "Mês de referência" (azul): a face é o gatilho; TODO o resto (Mês atual,
 *    navegação mês/ano e seleção de dias/faixa) fica DENTRO de um único popover —
 *    a faixa de dias é escolhida direto no calendário (sem presets).
 *  - "Visão da extração" (marrom): nav + calendário de extração.
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
  const [open, setOpen] = useState(false);       // popover do "Mês de referência"
  const [gridMode, setGridMode] = useState(false); // dentro do popover: grade de meses/ano vs calendário de dias
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
  const monthName = MES_PT_FULL[Number(selectedMonth.slice(5, 7)) - 1] ?? selectedMonth.slice(5, 7);
  const faceSubtitle = isFullMonth
    ? fmtMonthRange(selectedMonth)
    : (rangeIni === rangeFim ? `Dia ${rangeIni} de ${monthName}` : `Dias ${rangeIni}–${rangeFim} de ${monthName}`);

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
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setGridMode(false); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setGridMode(false); } };
    document.addEventListener('mousedown', onClickOut);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClickOut); document.removeEventListener('keydown', onKey); };
  }, []);

  const selectMonth = (m: string) => { onSelect(m); setGridMode(false); };
  const selectCurrent = () => {
    if (!canCurrentMonth) return;
    if (onCurrentMonthSelect) onCurrentMonthSelect(); else onSelect(currentMonth);
    setOpen(false); setGridMode(false);
  };

  const navBtn = (axis: typeof stayAxis, enabled: boolean, size = 30): React.CSSProperties => ({
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
        <div style={axisLabel(stayAxis)}>Mês de referência</div>

        {/* Face = gatilho do popover */}
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setGridMode(false); }}
          aria-label="Abrir calendário de período" aria-expanded={open}
          style={{ width: '100%', minWidth: 0, textAlign: 'left', background: 'transparent', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 26, lineHeight: 1.05, fontWeight: 900, color: stayAxis.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {fmtMonthTitle(selectedMonth)}
            </span>
            <ChevronRight size={15} style={{ color: stayAxis.text, flexShrink: 0, transform: open ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }} />
          </div>
          <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: isFullMonth ? 650 : 800, color: isFullMonth ? 'var(--text-m)' : stayAxis.text }}>
            {faceSubtitle}
          </div>
        </button>

        {/* Popover único: Mês atual + nav mês/ano + calendário de dias */}
        {open && (
          <div style={{
            position: 'absolute', top: 'calc(100% - 2px)', left: 14, zIndex: 90, width: 282,
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: 'var(--sh-m)', padding: 14,
          }}>
            {onCurrentMonthSelect && (
              <button
                type="button" onClick={selectCurrent} disabled={!canCurrentMonth}
                title="Voltar ao mês atual e à última extração"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, width: '100%', marginBottom: 10, padding: '6px 0',
                  borderRadius: 'var(--rx)', border: `1px solid ${stayAxis.border}`, background: 'var(--bg)', color: stayAxis.text,
                  fontSize: 11, fontWeight: 800, opacity: canCurrentMonth ? 1 : 0.4, cursor: canCurrentMonth ? 'pointer' : 'default',
                }}
              >
                <CalendarDays size={12} /> Mês atual
              </button>
            )}

            {/* Nav do mês (título abre a grade de meses/ano) */}
            <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr 30px', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <button onClick={() => prevMonth && onSelect(prevMonth)} disabled={!prevMonth} aria-label="Mês anterior" style={navBtn(stayAxis, Boolean(prevMonth))}>
                <ChevronLeft size={15} />
              </button>
              <button
                type="button" onClick={() => setGridMode(g => !g)} title="Escolher mês / ano"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, height: 30, borderRadius: 'var(--rx)',
                  border: `1px solid ${stayAxis.border}`, background: gridMode ? stayAxis.soft : 'var(--bg)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 850, color: stayAxis.text,
                }}
              >
                {fmtMonthTitle(selectedMonth)}
                <ChevronRight size={13} style={{ color: stayAxis.text, transform: gridMode ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform .15s' }} />
              </button>
              <button onClick={() => nextMonth && onSelect(nextMonth)} disabled={!nextMonth} aria-label="Próximo mês" style={navBtn(stayAxis, Boolean(nextMonth))}>
                <ChevronRight size={15} />
              </button>
            </div>

            {gridMode ? (
              /* Grade de meses + nav de ano */
              <>
                <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
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
              </>
            ) : (
              /* Calendário de dias (seleção de dia / faixa, sem presets) */
              <>
                {onDayRangeChange ? (
                  <>
                    <div style={{ fontSize: 10, fontWeight: 650, color: 'var(--text-m)', marginBottom: 7 }}>
                      {pendingStart != null
                        ? `Início no dia ${pendingStart} — clique no dia final (ou no mesmo p/ 1 dia)`
                        : 'Clique num dia p/ início e outro p/ fim — ou um único dia'}
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
                    <button type="button"
                      onClick={() => { setPendingStart(null); setHoverDay(null); applyRange(1, lastDay); }}
                      disabled={isFullMonth}
                      style={{
                        marginTop: 9, width: '100%', padding: '5px 0', borderRadius: 'var(--rx)',
                        border: `1px solid ${stayAxis.border}`, background: isFullMonth ? 'var(--accent)' : 'var(--surface)',
                        color: isFullMonth ? '#fff' : stayAxis.text, fontSize: 11, fontWeight: 800,
                        opacity: isFullMonth ? 0.9 : 1, cursor: isFullMonth ? 'default' : 'pointer',
                      }}>
                      {isFullMonth ? 'Mês inteiro selecionado' : 'Selecionar mês inteiro'}
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--text-m)', fontWeight: 600, padding: '4px 0' }}>
                    Use a navegação acima para escolher o mês.
                  </div>
                )}
              </>
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
