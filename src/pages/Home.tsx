import { useNavigate } from 'react-router-dom';
import { useHotels } from '@/hooks/useSupabase';
import { aggregatePortfolio } from '@/data/transforms';
import { Building2, Loader2 } from 'lucide-react';
import AnimatedNumber from '@/components/ui/AnimatedNumber';
import AlertCard from '@/components/cards/AlertCard';
import TopPerformerCard from '@/components/cards/TopPerformerCard';
import ClientListCard from '@/components/cards/ClientListCard';
import type { HotelSummary } from '@/data/types';

export default function Home() {
  const navigate = useNavigate();
  const { hotels, loading, error } = useHotels();
  const portfolio = aggregatePortfolio(hotels);

  const handleSelect = (hotel: HotelSummary) => {
    navigate(`/clientes/${hotel.id}`);
  };

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
    <div className="fade-in">
      {/* Hero */}
      <div
        className="flex justify-between items-center mb-8"
        style={{
          background: 'linear-gradient(135deg, #1A2744, #1E3E6E, #2D6CB5)',
          borderRadius: 'var(--r)',
          padding: '32px 36px',
          color: '#fff',
        }}
      >
        <div>
          <p className="text-[13px] font-medium mb-1" style={{ opacity: 0.6 }}>Painel de Receita</p>
          <h1 className="text-[26px] font-bold mb-1.5" style={{ letterSpacing: '-0.5px' }}>HoGrow Revenue Intelligence</h1>
          <p className="text-[13px]" style={{ opacity: 0.55 }}>
            {portfolio.totalHotels} {portfolio.totalHotels === 1 ? 'hotel gerenciado' : 'hotéis gerenciados'} · {portfolio.totalDias} dias de dados
          </p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-5">
        <AlertCard hotels={portfolio.alerts} onSelect={handleSelect} />
        <TopPerformerCard hotels={portfolio.topRevpar} onSelect={handleSelect} />

        {/* All Hotels */}
        <div
          className="col-span-2"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            padding: '22px',
          }}
        >
          <h3 className="text-sm font-semibold mb-5" style={{ letterSpacing: '-0.2px' }}>
            <Building2 size={15} className="inline mr-1.5 align-middle" style={{ color: 'var(--accent)' }} />
            Todos os Hotéis
          </h3>
          <div
            className="flex flex-col gap-3 overflow-y-auto pr-1"
            style={{
              maxHeight: '600px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--border) transparent'
            }}
          >
            {hotels.map((h, i) => (
              <ClientListCard key={h.id} hotel={h} onClick={() => handleSelect(h)} delay={i * 30} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
