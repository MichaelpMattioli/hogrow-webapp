interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

export default function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-[var(--rx)]"
      style={{
        background: 'var(--text)',
        padding: '9px 13px',
        fontSize: '11.5px',
        color: '#fff',
      }}
    >
      <p className="font-semibold mb-1.5 text-[10.5px] opacity-60">{label}</p>
      {payload.filter(p => p.value != null).map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 mt-0.5" style={{ color: p.color }}>
          <span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background: p.color }} />
          {p.name}: <strong>{typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}</strong>
        </p>
      ))}
    </div>
  );
}
