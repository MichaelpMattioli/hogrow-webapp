import { LayoutDashboard, Hotel, Search, Bell } from 'lucide-react';
import { NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import UserMenu from './UserMenu';

const tabs = [
  { id: '/',         label: 'Home',     icon: LayoutDashboard },
  { id: '/clientes', label: 'Clientes', icon: Hotel },
];

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isClientes = location.pathname === '/clientes';
  const [searchParams, setSearchParams] = useSearchParams();

  const searchValue = isClientes ? (searchParams.get('q') ?? '') : '';

  function handleSearch(value: string) {
    if (!isClientes) {
      navigate(value ? `/clientes?q=${encodeURIComponent(value)}` : '/clientes');
      return;
    }
    setSearchParams(value ? { q: value } : {}, { replace: true });
  }

  return (
    <header
      className="navbar-shell flex items-center justify-between sticky top-0 z-50"
      style={{
        padding: '0 28px',
        height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--sh)',
      }}
    >
      <div className="navbar-left flex items-center gap-6">
        {/* Brand */}
        <button
          type="button"
          aria-label="Ir para Home"
          className="flex items-center cursor-pointer"
          style={{ border: 'none', background: 'transparent', padding: 0 }}
          onClick={() => navigate('/')}
        >
          <img src="/logo-hogrow-navy.svg" alt="HoGrow" style={{ height: 28, width: 'auto' }} />
        </button>

        {/* Tabs — real links (Ctrl/Cmd+click, aria-current, screen-reader nav) */}
        <nav className="navbar-tabs flex items-center gap-0.5" aria-label="Navegação principal">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.id}
                to={t.id}
                end={t.id === '/'}
                title={t.label}
                className="navbar-tab flex items-center gap-1.5 text-[13px] font-medium transition-all duration-150"
                style={({ isActive }) => ({
                  padding: '8px 14px',
                  color: isActive ? 'var(--accent)' : 'var(--text-s)',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  borderRadius: 0,
                  marginBottom: -1,
                  textDecoration: 'none',
                })}
              >
                <Icon size={16} />
                <span className="navbar-tab-label">{t.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Search — visible on /clientes */}
        {isClientes && (
          <div
            className="flex items-center gap-[7px] rounded-full transition-colors duration-150 focus-within:border-[var(--accent)] focus-within:bg-[var(--surface)]"
            style={{ padding: '0 14px', background: 'var(--bg)', border: '1px solid var(--border)' }}
          >
            <Search size={14} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchValue}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar hotel..."
              aria-label="Buscar hotel"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                fontSize: '12.5px', color: 'var(--text)', width: 160, height: 34,
                fontFamily: 'var(--font)',
              }}
            />
            {searchValue && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => handleSearch('')}
                style={{ color: 'var(--text-m)', lineHeight: 1, padding: '0 2px' }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          aria-label="Notificações"
          className="relative flex items-center justify-center rounded-full border transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ width: 34, height: 34, borderColor: 'var(--border)', color: 'var(--text-s)' }}
        >
          <Bell size={17} />
          <span
            className="absolute rounded-full"
            aria-hidden="true"
            style={{ top: 5, right: 6, width: 6, height: 6, background: 'var(--red)', border: '1.5px solid var(--surface)' }}
          />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}
