import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHomePage, type HomePageRow, type TodayPickupAlert } from '@/hooks/useSupabase';
import { aggregatePortfolio, deriveStatus } from '@/data/transforms';
import type { HotelMeta, HotelSummary } from '@/data/types';
import { Loader2, ArrowRight, TrendingUp, Hotel, BarChart2, Users } from 'lucide-react';
import AlertCard from '@/components/cards/AlertCard';
import GoalAchievementCard from '@/components/cards/GoalAchievementCard';
import { localDateKey } from '@/lib/utils';

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

function hasAnyMeta(row: HomePageRow) {
  return row.receitaMeta != null || row.occMeta != null || row.dmMeta != null;
}

function toHotelSummary(row: HomePageRow): HotelSummary {
  return {
    id: row.hotelId,
    name: row.hotelNome,
    razaoSocial: row.hotelNome,
    city: row.cidade ?? '--',
    state: row.estado ?? '--',
    uhs: row.totalUhs,
    leitos: null,
    ativo: true,
    avgOcc: row.occAtual,
    avgRevpar: row.revparAtual,
    avgDm: row.dmAtual,
    totalReceita: row.receitaPeriodo,
    totalRecDiarias: 0,
    totalRecAb: 0,
    diasComDados: 0,
    receitaMesAnterior: 0,
    receitaMesAtual: row.receitaMesAtual,
    receitaMesQueVem: 0,
    occMesAnterior: 0,
    occMesAtual: row.occAtual,
    occMesQueVem: 0,
    recDiariasMesAtual: 0,
    ocupadosMesAtual: 0,
    cortesiaMesAtual: 0,
    hospedesMesAtual: 0,
    diasMesAtual: 0,
    recDiariasMesAnterior: 0,
    ocupadosMesAnterior: 0,
    receitaAnoAnterior: 0,
    recDiariasAnoAnterior: 0,
    occAnoAnterior: 0,
    ocupadosAnoAnterior: 0,
    receitaYTD: row.receitaPeriodo,
    ocupadosYTD: 0,
    hospedesYTD: 0,
    occAvgYTD: row.occAtual,
    dmYTD: row.dmAtual,
    latestDate: '--',
    latestExtracao: '--',
    latestOcc: row.occAtual,
    latestRevpar: row.revparAtual,
    latestDm: row.dmAtual,
    latestRecTotal: row.receitaMesAtual,
    latestOcupados: 0,
    status: deriveStatus(row.occAtual),
  };
}

export default function Home() {
  const navigate = useNavigate();
  const currentDate = localDateKey();
  const currentMonth = currentDate.slice(0, 7);
  const { rows, loading, error } = useHomePage(currentMonth, currentDate);

  const hotels = useMemo(() => rows.map(toHotelSummary), [rows]);
  const metas = useMemo<HotelMeta[]>(() => (
    rows
      .filter(hasAnyMeta)
      .map(row => ({
        id: row.metaId ?? undefined,
        hotelId: row.hotelId,
        mesAno: currentMonth,
        receitaMeta: row.receitaMeta,
        occMeta: row.occMeta,
        dmMeta: row.dmMeta,
        revparMeta: null,
      }))
  ), [currentMonth, rows]);
  const pickupAlerts = useMemo<TodayPickupAlert[]>(() => (
    rows
      .filter(row => row.pickupAlteracoes > 0)
      .map(row => ({
        hotelId: row.hotelId,
        dataExtracao: row.pickupDataExtracao ?? currentDate,
        alteracoes: row.pickupAlteracoes,
        pickupUhs: row.pickupUhs,
        pickupReceita: row.pickupReceita,
        referencias: row.pickupReferencias,
      }))
  ), [currentDate, rows]);
  const portfolio = useMemo(() => aggregatePortfolio(hotels), [hotels]);

  const handleSelect = (hotelId: number) => navigate(`/clientes/${hotelId}`);

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
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AlertCard
          alerts={pickupAlerts}
          hotels={hotels}
          loading={false}
          error={null}
          onSelect={handleSelect}
        />
        <GoalAchievementCard
          hotels={hotels}
          metas={metas}
          referenceMonth={currentMonth}
          loading={false}
          onSelect={handleSelect}
        />
      </div>

    </div>
  );
}
