import { ChevronRight } from 'lucide-react';
import type { HotelSummary } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';

interface AlertCardProps {
  hotels: HotelSummary[];
  onSelect: (hotel: HotelSummary) => void;
}

const iconMap = {
  warning: '⚠',
  critical: '⚠',
  healthy: '✓',
  excellent: '⚡',
};

export default function AlertCard({ hotels, onSelect }: AlertCardProps) {
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
        <span style={{ marginRight: 6, color: 'var(--amber)' }}>⚠</span>
        Requer Atenção
      </h3>
      {hotels.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-m)' }}>Nenhum alerta no momento</p>
      ) : (
        <div 
          className="flex flex-col gap-2.5 overflow-y-auto pr-1" 
          style={{ 
            maxHeight: '315px', // Exatamente ~5.5 itens (52px por item + 6px gap)
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent'
          }}
        >
          {hotels.map((c) => {
            const cfg = STATUS_CONFIG[c.status];
            return (
              <button
                key={c.id}
                className="flex items-center gap-3 w-full text-left rounded-[var(--rs)] transition-colors duration-150"
                style={{ padding: '10px 12px' }}
                onClick={() => onSelect(c)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0 rounded-[var(--rx)]"
                  style={{
                    width: 32,
                    height: 32,
                    background: cfg.bg,
                    color: cfg.color,
                    fontSize: 14,
                  }}
                >
                  {iconMap[c.status]}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold block">{c.name}</span>
                  <span className="text-[11.5px]" style={{ color: 'var(--text-m)' }}>
                    Occ {c.avgOcc}% · RevPAR R${c.avgRevpar} · {c.diasComDados} dias
                  </span>
                </div>
                <ChevronRight size={14} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
