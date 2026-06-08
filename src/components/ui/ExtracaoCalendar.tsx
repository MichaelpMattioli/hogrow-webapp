import { useMemo, useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { extractionAxis, changedAxis } from './axisPanel';

const DIAS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export interface ExtracaoCalendarProps {
  available: string[];     // YYYY-MM-DD com extração
  changed: string[];       // YYYY-MM-DD com alteração de pick-up (realce verde)
  selected: string | null;
  onSelect: (d: string) => void;
}

/** Dropdown de seleção da data de extração (eixo marrom). Compartilhado por PickupTable e PeriodSelector. */
export default function ExtracaoCalendar({ available, changed, selected, onSelect }: ExtracaoCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const changedSet = useMemo(() => new Set(changed), [changed]);
  const basePalette = {
    soft: extractionAxis.soft,
    border: extractionAxis.border,
    text: extractionAxis.text,
    selected: extractionAxis.strong,
  };
  const changedPalette = changedAxis;

  const initialYM = useMemo(() => {
    const base = selected ?? available[available.length - 1];
    return base ? base.slice(0, 7) : new Date().toISOString().slice(0, 7);
  }, [selected, available]);

  const [calYM, setCalYM] = useState(initialYM);
  useEffect(() => { setCalYM(initialYM); }, [initialYM]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const availSet = useMemo(() => new Set(available), [available]);
  const availableMonths = useMemo(
    () => [...new Set(available.map(d => d.slice(0, 7)))].sort(),
    [available]
  );

  const [cy, cm] = calYM.split('-').map(Number);
  const firstDay = new Date(cy, cm - 1, 1).getDay();
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const fmt = (d: string) => {
    const [, mo, day] = d.split('-');
    return `${day}/${mo}`;
  };

  const labelSelected = selected ? fmt(selected) : 'Selecionar extração';
  const prevAvailableYM = useMemo(
    () => [...availableMonths].reverse().find(ym => ym < calYM) ?? null,
    [availableMonths, calYM]
  );
  const nextAvailableYM = useMemo(
    () => availableMonths.find(ym => ym > calYM) ?? null,
    [availableMonths, calYM]
  );
  const prevYM = () => { if (prevAvailableYM) setCalYM(prevAvailableYM); };
  const nextYM = () => { if (nextAvailableYM) setCalYM(nextAvailableYM); };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 transition-all"
        aria-label="Selecionar data de extração"
        style={{
          padding: '6px 12px', borderRadius: 'var(--rx)',
          background: open ? extractionAxis.soft : 'var(--bg)',
          border: `1px solid ${open ? extractionAxis.strong : 'var(--border)'}`,
          color: open ? extractionAxis.text : 'var(--text)',
          fontSize: 12, fontWeight: 600,
        }}
      >
        <CalendarDays size={13} style={{ color: open ? extractionAxis.strong : 'var(--text-m)' }} />
        Data de extração: {labelSelected}
        <ChevronRight size={12} style={{ color: 'var(--text-m)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', boxShadow: 'var(--sh-m)', padding: '14px', width: 240,
        }}>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevYM}
              disabled={!prevAvailableYM}
              aria-label="Mês anterior"
              style={{
                padding: '3px 8px', borderRadius: 'var(--rx)', color: 'var(--text-m)',
                opacity: prevAvailableYM ? 1 : 0.35, cursor: prevAvailableYM ? 'pointer' : 'default',
              }}
              className="hover:bg-[var(--surface-h)]"
            >
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{MES_PT[cm - 1]} {cy}</span>
            <button
              onClick={nextYM}
              disabled={!nextAvailableYM}
              aria-label="Próximo mês"
              style={{
                padding: '3px 8px', borderRadius: 'var(--rx)', color: 'var(--text-m)',
                opacity: nextAvailableYM ? 1 : 0.35, cursor: nextAvailableYM ? 'pointer' : 'default',
              }}
              className="hover:bg-[var(--surface-h)]"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, marginBottom: 4 }}>
            {DIAS_PT.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-m)', padding: '2px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${cy}-${String(cm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const hasData = availSet.has(dateStr);
              const isSel = dateStr === selected;
              const hasChange = changedSet.has(dateStr);
              const palette = hasChange ? changedPalette : basePalette;
              return (
                <button
                  key={dateStr}
                  disabled={!hasData}
                  onClick={() => { onSelect(dateStr); setOpen(false); }}
                  title={hasData ? `Extração dos dados em ${fmt(dateStr)}` : undefined}
                  style={{
                    padding: '5px 2px', borderRadius: 6, textAlign: 'center',
                    fontSize: 11.5, fontWeight: hasData ? (isSel ? 800 : 700) : 400,
                    background: isSel ? palette.selected : hasData ? palette.soft : 'transparent',
                    color: isSel ? '#fff' : hasData ? palette.text : 'var(--text-m)',
                    border: `1.5px solid ${isSel ? palette.selected : hasData ? palette.border : 'transparent'}`,
                    opacity: !hasData ? 0.3 : 1,
                    cursor: !hasData ? 'default' : 'pointer',
                    transition: 'all .1s',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {available.length > 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border-l)' }}>
              <p style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>
                Datas de extração disponíveis
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[...available].reverse().map(d => {
                  const hasChange = changedSet.has(d);
                  const palette = hasChange ? changedPalette : basePalette;
                  return (
                    <button key={d} onClick={() => { onSelect(d); setCalYM(d.slice(0, 7)); setOpen(false); }}
                      style={{
                        fontSize: 10.5, fontWeight: 700, borderRadius: 99, padding: '2px 8px', cursor: 'pointer',
                        background: d === selected ? palette.selected : hasChange ? palette.soft : 'var(--bg)',
                        color: d === selected ? '#fff' : palette.text,
                        border: `1px solid ${d === selected ? palette.selected : palette.border}`,
                      }}>
                      {fmt(d)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
