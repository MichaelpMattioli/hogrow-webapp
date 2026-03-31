interface SortSelectorProps {
  options: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}

export default function SortSelector({ options, active, onChange }: SortSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[11.5px] font-medium mr-1" style={{ color: 'var(--text-m)' }}>Ordenar</span>
      {options.map((s) => (
        <button
          key={s.key}
          className="rounded-[var(--rx)] text-xs font-medium transition-all duration-150"
          style={{
            padding: '5px 12px',
            color: active === s.key ? 'var(--accent-d)' : 'var(--text-m)',
            background: active === s.key ? 'var(--accent-l)' : 'transparent',
          }}
          onClick={() => onChange(s.key)}
          onMouseEnter={(e) => {
            if (active !== s.key) {
              e.currentTarget.style.background = 'var(--surface-h)';
              e.currentTarget.style.color = 'var(--text)';
            }
          }}
          onMouseLeave={(e) => {
            if (active !== s.key) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-m)';
            }
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
