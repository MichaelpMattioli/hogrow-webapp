import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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

interface HeaderMonthReferenceProps {
  selectedMonth: string;
  availableMonths: string[];
  onSelect: (month: string) => void;
}

export default function HeaderMonthReference({
  selectedMonth,
  availableMonths,
  onSelect,
}: HeaderMonthReferenceProps) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(selectedMonth.slice(0, 4)));
  const ref = useRef<HTMLDivElement>(null);
  const months = useMemo(() => [...new Set(availableMonths)].sort(), [availableMonths]);
  const availSet = useMemo(() => new Set(months), [months]);
  const availableYears = useMemo(
    () => [...new Set(months.map(ym => Number(ym.slice(0, 4))))].sort((a, b) => a - b),
    [months]
  );
  const activeIndex = months.indexOf(selectedMonth);
  const prevMonth = activeIndex > 0 ? months[activeIndex - 1] : null;
  const nextMonth = activeIndex >= 0 && activeIndex < months.length - 1 ? months[activeIndex + 1] : null;
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
          MÊS DE REFERÊNCIA
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
          width: 260,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          boxShadow: 'var(--sh-m)',
          padding: 14,
        }}>
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
        </div>
      )}
    </div>
  );
}
