import { Hotel, LayoutDashboard, Search, Bell, ArrowLeft, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavbarProps {
  breadcrumbName?: string;
}

const tabs = [
  { id: '/', label: 'Home', icon: LayoutDashboard },
];

export default function Navbar({ breadcrumbName }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <header
      className="flex items-center justify-between sticky top-0 z-50"
      style={{
        padding: '0 28px',
        height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center gap-6">
        {/* Brand */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div
            className="flex items-center justify-center rounded-lg text-white"
            style={{
              width: 30,
              height: 30,
              background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
            }}
          >
            <Hotel size={18} />
          </div>
          <span className="text-[15px] font-bold" style={{ letterSpacing: '-0.3px' }}>HoGrow</span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5">
          {!breadcrumbName && tabs.map((t) => {
            const Icon = t.icon;
            const isActive = currentPath === t.id;
            return (
              <button
                key={t.id}
                className="flex items-center gap-1.5 rounded-[var(--rx)] text-[13px] font-medium transition-all duration-150"
                style={{
                  padding: '8px 14px',
                  color: isActive ? 'var(--accent-d)' : 'var(--text-s)',
                  background: isActive ? 'var(--accent-l)' : 'transparent',
                }}
                onClick={() => navigate(t.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--surface-h)';
                    e.currentTarget.style.color = 'var(--text)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-s)';
                  }
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}

          {/* Breadcrumb */}
          {breadcrumbName && (
            <div
              className="flex items-center gap-1 rounded-[var(--rx)] text-[13px] font-medium"
              style={{
                padding: '8px 14px',
                color: 'var(--accent-d)',
                background: 'var(--accent-l)',
              }}
            >
              <button
                className="flex items-center gap-1 text-[13px] font-medium transition-colors duration-150"
                style={{ color: 'var(--text-m)' }}
                onClick={() => navigate('/')}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-m)'; }}
              >
                <ArrowLeft size={14} />
                Home
              </button>
              <ChevronRight size={12} style={{ color: 'var(--text-m)' }} />
              <span>{breadcrumbName}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center gap-[7px] rounded-full transition-colors duration-150"
          style={{
            padding: '6px 14px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            fontSize: '12.5px',
            color: 'var(--text-m)',
          }}
        >
          <Search size={14} />
          <span>Buscar hotel...</span>
        </div>
        <button
          className="relative flex items-center justify-center rounded-full border transition-all duration-150"
          style={{
            width: 34,
            height: 34,
            borderColor: 'var(--border)',
            color: 'var(--text-s)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text-s)';
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
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
          }}
        >
          VA
        </div>
      </div>
    </header>
  );
}
