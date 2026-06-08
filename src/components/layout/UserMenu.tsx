import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, ChevronDown, Target } from 'lucide-react';

const ITEMS = [
  { to: '/metas', label: 'Metas', desc: 'Receita, ocupação e diária por hotel', Icon: Target },
  { to: '/feriados', label: 'Feriados', desc: 'Nacionais e locais por hotel', Icon: CalendarDays },
];

// Menu da conta (estilo GitHub): clica na bolinha → dropdown com as páginas de definição.
export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu da conta"
        onClick={() => setOpen(o => !o)}
        className="flex items-center cursor-pointer"
        style={{ gap: 5, padding: 2, paddingRight: 4, borderRadius: 999, border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`, background: open ? 'var(--accent-l)' : 'var(--surface)', transition: 'all .12s' }}
      >
        <span className="flex items-center justify-center rounded-full text-[11px] font-semibold text-white" style={{ width: 30, height: 30, background: 'linear-gradient(135deg, #1D2C5C, #FFAA01)' }}>VA</span>
        <ChevronDown size={14} style={{ color: 'var(--text-m)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 60,
            width: 272, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--rs)', boxShadow: 'var(--sh-m)', overflow: 'hidden',
            animation: 'hg-menu-in .12s ease-out',
          }}
        >
          {/* Cabeçalho da conta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border-l)' }}>
            <span className="flex items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ width: 36, height: 36, flexShrink: 0, background: 'linear-gradient(135deg, #1D2C5C, #FFAA01)' }}>VA</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>Administrador</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-m)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>HoGrow · Revenue Intelligence</div>
            </div>
          </div>

          {/* Seção de definições */}
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-m)', textTransform: 'uppercase', padding: '6px 10px 4px' }}>Definições</div>
            {ITEMS.map(it => (
              <NavLink
                key={it.to}
                to={it.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 'var(--rx)',
                  textDecoration: 'none', background: isActive ? 'var(--accent-l)' : 'transparent', transition: 'background .1s',
                })}
                className="hg-menu-item"
              >
                {({ isActive }) => (
                  <>
                    <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isActive ? 'var(--accent)' : 'var(--surface-h)', color: isActive ? '#fff' : 'var(--accent)' }}>
                      <it.Icon size={16} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>{it.label}</span>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-m)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.desc}</span>
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
