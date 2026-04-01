import { LayoutDashboard, Hotel, Search, Bell, ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

interface NavbarProps {
  breadcrumbName?: string;
}

const tabs = [
  { id: '/',         label: 'Home',     icon: LayoutDashboard },
  { id: '/clientes', label: 'Clientes', icon: Hotel },
];

export default function Navbar({ breadcrumbName }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [searchParams, setSearchParams] = useSearchParams();

  const isClientes = currentPath === '/clientes';
  const searchValue = isClientes ? (searchParams.get('q') ?? '') : '';

  function handleSearch(value: string) {
    if (!isClientes) {
      navigate(value ? `/clientes?q=${encodeURIComponent(value)}` : '/clientes');
      return;
    }
    setSearchParams(value ? { q: value } : {}, { replace: true });
  }

  // Detect if we're on a detail page (breadcrumb mode)
  const isDetail = breadcrumbName != null;

  return (
    <header
      className="flex items-center justify-between sticky top-0 z-50"
      style={{
        padding: '0 28px',
        height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--sh)',
      }}
    >
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center cursor-pointer" onClick={() => navigate('/')}>
          <img
            src="/logo-hogrow-navy.svg"
            alt="HoGrow"
            style={{ height: 28, width: 'auto' }}
          />
        </div>

        {/* Tabs or Breadcrumb */}
        <div className="flex items-center gap-0.5">
          {!isDetail && tabs.map((t) => {
            const Icon = t.icon;
            // active if exact match, or if current path starts with tab id (for nested routes)
            const isActive = t.id === '/'
              ? currentPath === '/'
              : currentPath.startsWith(t.id);
            return (
              <button
                key={t.id}
                className={`flex items-center gap-1.5 text-[13px] font-medium transition-all duration-150 ${!isActive ? 'hover:text-[var(--text)]' : ''}`}
                style={{
                  padding: '8px 14px',
                  color: isActive ? 'var(--accent)' : 'var(--text-s)',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  borderRadius: 0,
                  marginBottom: -1,
                }}
                onClick={() => navigate(t.id)}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}

          {/* Breadcrumb on detail pages */}
          {isDetail && (
            <div className="flex items-center gap-1 text-[13px] font-medium">
              <button
                className="flex items-center gap-1 text-[13px] font-medium transition-colors duration-150 hover:text-[var(--accent)]"
                style={{ color: 'var(--text-m)' }}
                onClick={() => navigate('/clientes')}
              >
                <ArrowLeft size={14} />
                Clientes
              </button>
              <ChevronRight size={12} style={{ color: 'var(--text-m)' }} />
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{breadcrumbName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Search — visible on /clientes and detail pages */}
        {(isClientes || isDetail) && (
          <div
            className="flex items-center gap-[7px] rounded-full transition-colors duration-150 focus-within:border-[var(--accent)] focus-within:bg-[var(--surface)]"
            style={{
              padding: '0 14px',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
            }}
          >
            <Search size={14} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
            <input
              type="text"
              value={searchValue}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Buscar hotel..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '12.5px',
                color: 'var(--text)',
                width: 160,
                height: 34,
                fontFamily: 'var(--font)',
              }}
            />
            {searchValue && (
              <button
                onClick={() => handleSearch('')}
                style={{ color: 'var(--text-m)', lineHeight: 1, padding: '0 2px' }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        <button
          className="relative flex items-center justify-center rounded-full border transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{
            width: 34,
            height: 34,
            borderColor: 'var(--border)',
            color: 'var(--text-s)',
          }}
        >
          <Bell size={17} />
          <span
            className="absolute rounded-full"
            style={{
              top: 5,
              right: 6,
              width: 6,
              height: 6,
              background: 'var(--red)',
              border: '1.5px solid var(--surface)',
            }}
          />
        </button>
        <div
          className="flex items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{
            width: 34,
            height: 34,
            background: 'linear-gradient(135deg, #1D2C5C, #FFAA01)',
          }}
        >
          VA
        </div>
      </div>
    </header>
  );
}
