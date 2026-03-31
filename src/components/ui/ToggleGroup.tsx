interface ToggleGroupProps {
  options: Array<{ key: string; label: string }>;
  active: string;
  onChange: (key: string) => void;
}

export default function ToggleGroup({ options, active, onChange }: ToggleGroupProps) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-[var(--rx)]" style={{ background: 'var(--bg)' }}>
      {options.map((t) => (
        <button
          key={t.key}
          className="rounded-[5px] transition-all duration-150"
          style={{
            padding: '4px 11px',
            fontSize: '11.5px',
            fontWeight: 500,
            color: active === t.key ? 'var(--text)' : 'var(--text-m)',
            background: active === t.key ? 'var(--surface)' : 'transparent',
            boxShadow: active === t.key ? 'var(--sh)' : 'none',
          }}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
