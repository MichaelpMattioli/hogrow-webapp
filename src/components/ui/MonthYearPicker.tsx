import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

interface MonthYearPickerProps {
  selected: string[];          // YYYY-MM
  onChange: (months: string[]) => void;
  available: string[];         // YYYY-MM with data
}

export default function MonthYearPicker({ selected, onChange, available }: MonthYearPickerProps) {
  const [open, setOpen]   = useState(false);
  const [year, setYear]   = useState(() => {
    const now = new Date();
    return selected.length > 0
      ? parseInt(selected[selected.length - 1].split('-')[0])
      : now.getFullYear();
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (ym: string) => {
    onChange(selected.includes(ym) ? selected.filter(s => s !== ym) : [...selected, ym].sort());
  };

  const availSet = new Set(available);
  const nowYM = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`;

  // Label
  const label = selected.length === 0
    ? 'Todos os meses'
    : selected.length === 1
      ? (() => { const [y,m] = selected[0].split('-'); return `${MES_PT[+m-1]} ${y}`; })()
      : `${selected.length} meses`;

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-flex', alignItems:'center', gap:6 }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 transition-all duration-150"
        style={{
          padding:'6px 14px', borderRadius:'var(--rx)',
          background: open ? 'var(--accent-l)' : 'var(--surface)',
          border:`1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: open ? 'var(--accent-d)' : 'var(--text)',
          fontSize:12.5, fontWeight:600,
        }}
      >
        <Calendar size={13} style={{ color: open ? 'var(--accent)' : 'var(--text-m)' }}/>
        {label}
        {selected.length > 0 && (
          <span style={{ fontSize:10, fontWeight:800, background:'var(--accent)', color:'#fff', borderRadius:99, padding:'0 6px', lineHeight:'16px' }}>
            {selected.length}
          </span>
        )}
      </button>

      {/* Clear */}
      {selected.length > 0 && (
        <button onClick={() => onChange([])}
          className="flex items-center gap-1 transition-colors hover:text-[var(--red)]"
          style={{ fontSize:11, color:'var(--text-m)', padding:'2px 4px' }}>
          <X size={11}/> Limpar
        </button>
      )}

      {/* Selected chips */}
      {selected.length > 0 && selected.length <= 4 && (
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {selected.map(ym => {
            const [y,m] = ym.split('-');
            return (
              <button key={ym} onClick={() => toggle(ym)}
                style={{ fontSize:10.5, fontWeight:700, padding:'2px 8px', borderRadius:99,
                  background:'var(--accent-l)', color:'var(--accent-d)', border:'none', cursor:'pointer' }}>
                {MES_PT[+m-1]}/{y.slice(2)} ×
              </button>
            );
          })}
        </div>
      )}

      {/* Popup */}
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:'var(--r)', boxShadow:'var(--sh-m)',
          padding:'14px', minWidth:260,
        }}>
          {/* Year nav */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setYear(y => y-1)}
              style={{ padding:'4px 8px', borderRadius:'var(--rx)', color:'var(--text-m)' }}
              className="hover:bg-[var(--surface-h)]">
              <ChevronLeft size={15}/>
            </button>
            <span style={{ fontSize:14, fontWeight:800, color:'var(--text)' }}>{year}</span>
            <button onClick={() => setYear(y => y+1)}
              style={{ padding:'4px 8px', borderRadius:'var(--rx)', color:'var(--text-m)' }}
              className="hover:bg-[var(--surface-h)]">
              <ChevronRight size={15}/>
            </button>
          </div>

          {/* Month grid 4×3 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
            {MES_PT.map((label, i) => {
              const ym   = `${year}-${String(i+1).padStart(2,'0')}`;
              const has  = availSet.has(ym);
              const sel  = selected.includes(ym);
              const isNow = ym === nowYM;
              return (
                <button
                  key={ym}
                  disabled={!has}
                  onClick={() => toggle(ym)}
                  style={{
                    padding:'7px 4px',
                    borderRadius:'var(--rx)',
                    fontSize:11.5, fontWeight: sel || isNow ? 800 : 600,
                    border:`1.5px solid ${sel ? 'var(--accent)' : isNow ? 'color-mix(in srgb,var(--accent) 40%,transparent)' : 'transparent'}`,
                    background: sel ? 'var(--accent)' : isNow ? 'var(--accent-l)' : 'var(--bg)',
                    color: sel ? '#fff' : !has ? 'var(--text-m)' : isNow ? 'var(--accent-d)' : 'var(--text)',
                    opacity: !has ? 0.35 : 1,
                    cursor: !has ? 'default' : 'pointer',
                    transition:'all .1s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop:'1px solid var(--border-l)' }}>
            <button onClick={() => onChange([])}
              style={{ fontSize:11.5, color:'var(--text-m)', fontWeight:600 }}
              className="hover:text-[var(--accent)]">
              Limpar seleção
            </button>
            <button onClick={() => setOpen(false)}
              style={{ fontSize:12, fontWeight:700, background:'var(--accent)', color:'#fff',
                borderRadius:'var(--rx)', padding:'5px 14px', border:'none', cursor:'pointer' }}>
              Aplicar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
