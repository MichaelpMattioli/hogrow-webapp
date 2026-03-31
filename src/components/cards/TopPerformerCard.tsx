import type { HotelSummary } from '@/data/types';

interface TopPerformerCardProps {
  hotels: HotelSummary[];
  onSelect: (hotel: HotelSummary) => void;
}

export default function TopPerformerCard({ hotels, onSelect }: TopPerformerCardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '22px',
      }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ letterSpacing: '-0.2px' }}>
        <span style={{ marginRight: 6, color: 'var(--green)' }}>⚡</span>
        Top RevPAR
      </h3>
      <div className="flex flex-col gap-2.5">
        {hotels.map((c, i) => (
          <button
            key={c.id}
            className="flex items-center gap-3 w-full text-left rounded-[var(--rs)] transition-colors duration-150"
            style={{ padding: '10px 12px' }}
            onClick={() => onSelect(c)}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span
              className="flex items-center justify-center flex-shrink-0 rounded-full text-xs font-bold"
              style={{
                width: 24,
                height: 24,
                background: 'var(--accent-l)',
                color: 'var(--accent)',
              }}
            >
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-semibold block">{c.name}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>{c.city}</span>
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
              R$ {Math.round(c.avgRevpar).toLocaleString('pt-BR')}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
