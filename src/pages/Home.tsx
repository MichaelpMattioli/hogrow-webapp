import { useNavigate } from 'react-router-dom';
import { useHotels } from '@/hooks/useSupabase';
import { aggregatePortfolio } from '@/data/transforms';
import { Loader2, ArrowRight, TrendingUp, Hotel, BarChart2, Users } from 'lucide-react';
import AlertCard from '@/components/cards/AlertCard';
import TopPerformerCard from '@/components/cards/TopPerformerCard';
import type { HotelSummary } from '@/data/types';

const fmtRec = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (v >= 1_000)     return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
};

const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function StatTile({ icon, label, value }: StatTileProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '18px 20px',
        background: 'rgba(255,255,255,0.07)',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div style={{ opacity: 0.6 }}>{icon}</div>
      <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </span>
      <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-1px', fontFamily: 'var(--mono)', lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { hotels, loading, error } = useHotels();
  const portfolio = aggregatePortfolio(hotels);

  const handleSelect = (hotel: HotelSummary) => navigate(`/clientes/${hotel.id}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="ml-2 text-[var(--text-m)]">Carregando dados...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--red)] font-semibold mb-2">Erro ao carregar dados</p>
        <p className="text-[13px] text-[var(--text-m)]">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in flex flex-col gap-6">

      {/* ── Hero banner ── */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1A2744, #1E3E6E, #2D6CB5)',
          borderRadius: 'var(--r)',
          padding: '32px 36px',
          color: '#fff',
        }}
      >
        <p className="text-[13px] font-medium mb-1" style={{ opacity: 0.55 }}>Painel de Receita</p>
        <h1 className="text-[26px] font-bold mb-6" style={{ letterSpacing: '-0.5px' }}>
          HoGrow Revenue Intelligence
        </h1>

        {/* KPI tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          <StatTile
            icon={<Hotel size={16} color="#fff" />}
            label="Hotéis gerenciados"
            value={String(portfolio.totalHotels)}
          />
          <StatTile
            icon={<BarChart2 size={16} color="#fff" />}
            label="Receita total (período)"
            value={fmtRec(portfolio.totalReceita)}
          />
          <StatTile
            icon={<TrendingUp size={16} color="#fff" />}
            label="OCC médio"
            value={fmtPct(portfolio.avgOcc)}
          />
          <StatTile
            icon={<Users size={16} color="#fff" />}
            label="RevPAR médio"
            value={`R$ ${Math.round(portfolio.avgRevpar).toLocaleString('pt-BR')}`}
          />
        </div>

        {/* CTA */}
        <button
          className="flex items-center gap-2 text-[13px] font-semibold transition-all duration-150 hover:gap-3"
          style={{
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 99,
            padding: '9px 20px',
            color: '#fff',
          }}
          onClick={() => navigate('/clientes')}
        >
          Ver todos os clientes
          <ArrowRight size={14} />
        </button>
      </div>

      {/* ── Alertas + Top performers ── */}
      <div className="grid grid-cols-2 gap-5">
        <AlertCard       hotels={portfolio.alerts}    onSelect={handleSelect} />
        <TopPerformerCard hotels={portfolio.topRevpar} onSelect={handleSelect} />
      </div>

    </div>
  );
}
