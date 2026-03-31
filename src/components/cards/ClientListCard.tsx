import { ChevronRight } from 'lucide-react';
import type { HotelSummary } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';

interface ClientListCardProps {
  hotel: HotelSummary;
  onClick: () => void;
  delay?: number;
}

const fmtR$ = (v: number) =>
  'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtRec = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
    : v >= 1_000
      ? `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`
      : fmtR$(v);

export default function ClientListCard({ hotel, onClick, delay = 0 }: ClientListCardProps) {
  const cfg = STATUS_CONFIG[hotel.status];

  const dm = hotel.ocupadosMesAtual > 0 ? hotel.receitaMesAtual / hotel.ocupadosMesAtual : 0;
  const occ = hotel.occMesAtual;
  const revp = dm * occ / 100;
  const mdUhDia = hotel.diasMesAtual > 0 ? hotel.ocupadosMesAtual / hotel.diasMesAtual : 0;

  const refMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
    .format(new Date())
    .replace('.', '');

  const kpis = [
    { label: 'UHs TT', value: String(hotel.uhs) },
    { label: 'Receita', value: fmtRec(hotel.receitaMesAtual) },
    { label: 'DM C/C TT', value: fmtR$(dm) },
    { label: 'OCC TT', value: `${occ.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` },
    { label: 'REVP', value: fmtR$(revp) },
    { label: 'MD UH/DIA', value: mdUhDia.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) },
    { label: 'HOSP TT', value: hotel.hospedesMesAtual.toLocaleString('pt-BR') },
  ];

  return (
    <button
      className="card-in w-full text-left transition-all duration-200 hover:border-[var(--accent)] hover:shadow-[var(--sh-m)] hover:-translate-y-px"
      style={{
        position: 'relative',
        padding: '16px 22px 16px 26px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        animationDelay: `${delay}ms`,
        overflow: 'hidden',
      }}
      onClick={onClick}
    >
      {/* Color bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: cfg.color,
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[14.5px] font-semibold" style={{ letterSpacing: '-0.2px' }}>
            {hotel.name}
          </h3>
          <span
            className="text-[10px] font-medium rounded-full"
            style={{
              padding: '2px 8px',
              background: 'var(--surface-h)',
              color: 'var(--text-m)',
              border: '1px solid var(--border-l)',
            }}
          >
            {hotel.city}, {hotel.state}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-semibold rounded-full"
            style={{
              padding: '2px 9px',
              background: 'var(--accent-l)',
              color: 'var(--accent-d)',
            }}
          >
            Ref {refMonth}
          </span>
          <span
            className="text-[10px] font-semibold rounded-full"
            style={{
              padding: '2px 9px',
              background: cfg.bg,
              color: cfg.color,
            }}
          >
            Ext {hotel.latestExtracao}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
        </div>
      </div>

      {/* KPI Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 8,
          textAlign: 'center',
        }}
      >
        {kpis.map((k) => (
          <div key={k.label}>
            <div
              className="text-[11px] font-semibold uppercase"
              style={{ color: 'var(--text-s)', letterSpacing: '0.5px', marginBottom: 2 }}
            >
              {k.label}
            </div>
            <div
              className="text-[13px] font-bold"
              style={{ fontFamily: 'var(--mono)', color: 'var(--text)' }}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>
    </button>
  );
}
