import { useState } from 'react';
import { ChevronRight, Loader2, Target } from 'lucide-react';
import type { HotelMeta, HotelSummary } from '@/data/types';

interface GoalAchievementCardProps {
  hotels: HotelSummary[];
  metas: HotelMeta[];
  referenceMonth: string;
  loading?: boolean;
  onSelect: (hotelId: number) => void;
}

type GoalMetric = {
  pct: number | null;
  actual: number | null;
  meta: number | null;
  cumulative: boolean;
  formatter: (value: number) => string;
};

type SortKey = 'cliente' | 'receita' | 'occ' | 'dm';

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: 'cliente', label: 'Cliente' },
  { key: 'receita', label: 'Receita' },
  { key: 'occ', label: 'Ocupação' },
  { key: 'dm', label: 'Diária média' },
];

const ok = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const cleanLocationPart = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '--' || trimmed === '—' || trimmed === 'â€”') return null;
  return trimmed;
};

const formatLocation = (hotel: HotelSummary) =>
  [hotel.city, hotel.state]
    .map(cleanLocationPart)
    .filter((part): part is string => Boolean(part))
    .join(', ');

const fmtBRL = (value: number) =>
  `R$ ${Math.round(value).toLocaleString('pt-BR')}`;

const fmtCompactBRL = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}M`;
  }
  if (abs >= 1_000) return `R$ ${Math.round(value / 1_000).toLocaleString('pt-BR')}k`;
  return fmtBRL(value);
};

const fmtPct = (value: number) =>
  `${Math.round(value).toLocaleString('pt-BR')}%`;

function formatMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return yearMonth;
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1))
    .replace(' de ', ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function monthElapsedPct(): number {
  const now = new Date();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (now.getDate() / days) * 100;
}

function achievement(actual: number | null | undefined, meta: number | null | undefined): number | null {
  if (!ok(actual) || !ok(meta) || meta <= 0) return null;
  return (actual / meta) * 100;
}

function metricColor(metric: GoalMetric, elapsedPct: number) {
  if (!ok(metric.pct)) return 'var(--text-m)';

  const target = metric.cumulative ? elapsedPct : 100;
  if (metric.pct >= 100) return 'var(--green)';
  if (metric.pct >= target * 0.9) return 'var(--green)';
  if (metric.pct >= target * 0.7) return 'var(--gold)';
  return 'var(--red)';
}

function MetricCell({ metric, elapsedPct }: { metric: GoalMetric; elapsedPct: number }) {
  const color = metricColor(metric, elapsedPct);
  const pct = metric.pct ?? 0;
  const title = ok(metric.actual) && ok(metric.meta)
    ? `${metric.formatter(metric.actual)} / ${metric.formatter(metric.meta)}`
    : 'Sem meta';

  return (
    <div title={title} style={{ minWidth: 0 }}>
      <div
        className="text-[12px] font-extrabold"
        style={{ color, fontFamily: 'var(--mono)', lineHeight: 1.1 }}
      >
        {ok(metric.pct) ? fmtPct(metric.pct) : '--'}
      </div>
      <div
        style={{
          height: 4,
          marginTop: 5,
          background: 'var(--border-l)',
          borderRadius: 99,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(Math.max(pct, 0), 100)}%`,
            background: color,
            borderRadius: 99,
          }}
        />
      </div>
    </div>
  );
}

export default function GoalAchievementCard({ hotels, metas, referenceMonth, loading = false, onSelect }: GoalAchievementCardProps) {
  const [sortKey, setSortKey] = useState<SortKey>('cliente');
  const elapsedPct = monthElapsedPct();
  const referenceMonthLabel = formatMonthLabel(referenceMonth);
  const metaByHotel = new Map(metas.map(meta => [meta.hotelId, meta]));

  const rows = hotels
    .map((hotel) => {
      const meta = metaByHotel.get(hotel.id);
      const dm = ok(hotel.avgDm)
        ? hotel.avgDm
        : hotel.ocupadosMesAtual > 0
          ? hotel.receitaMesAtual / hotel.ocupadosMesAtual
          : null;

      const metrics = {
        receita: {
          pct: achievement(hotel.receitaMesAtual, meta?.receitaMeta),
          actual: hotel.receitaMesAtual,
          meta: meta?.receitaMeta ?? null,
          cumulative: true,
          formatter: fmtCompactBRL,
        },
        occ: {
          pct: achievement(hotel.occMesAtual, meta?.occMeta),
          actual: hotel.occMesAtual,
          meta: meta?.occMeta ?? null,
          cumulative: false,
          formatter: fmtPct,
        },
        dm: {
          pct: achievement(dm, meta?.dmMeta),
          actual: dm,
          meta: meta?.dmMeta ?? null,
          cumulative: false,
          formatter: fmtBRL,
        },
      } satisfies Record<string, GoalMetric>;

      const available = Object.values(metrics).map(metric => metric.pct).filter(ok);
      return {
        hotel,
        location: formatLocation(hotel),
        metrics,
        hasMeta: available.length > 0,
      };
    })
    .filter(row => row.hasMeta)
    .sort((a, b) => {
      if (sortKey === 'cliente') {
        return a.hotel.name.localeCompare(b.hotel.name, 'pt-BR');
      }

      const aValue = a.metrics[sortKey].pct;
      const bValue = b.metrics[sortKey].pct;

      if (ok(aValue) && ok(bValue)) {
        return bValue - aValue || a.hotel.name.localeCompare(b.hotel.name, 'pt-BR');
      }
      if (ok(aValue)) return -1;
      if (ok(bValue)) return 1;
      return a.hotel.name.localeCompare(b.hotel.name, 'pt-BR');
    });

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '22px',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>
          Atingimento de metas
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full text-[11px] font-bold"
          style={{ padding: '3px 8px', color: 'var(--accent-d)', background: 'var(--accent-l)' }}
        >
          <Target size={12} />
          {referenceMonthLabel}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[13px]" style={{ color: 'var(--text-m)' }}>
          <Loader2 size={15} className="animate-spin" />
          Carregando metas...
        </div>
      ) : rows.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-m)' }}>
          Nenhuma meta cadastrada para {referenceMonthLabel}.
        </p>
      ) : (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {sortOptions.map(option => {
              const active = option.key === sortKey;

              return (
                <button
                  key={option.key}
                  type="button"
                  className="text-[11px] font-bold transition-colors duration-150"
                  style={{
                    borderRadius: 999,
                    padding: '6px 10px',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent-l)' : 'transparent',
                    color: active ? 'var(--accent-d)' : 'var(--text-m)',
                  }}
                  onClick={() => setSortKey(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div
            className="grid items-center gap-3 px-3 pb-2 text-[10px] font-extrabold uppercase"
            style={{
              gridTemplateColumns: 'minmax(150px,1.5fr) repeat(3,minmax(72px,1fr)) 14px',
              color: 'var(--text-m)',
              letterSpacing: '0.5px',
            }}
          >
            <span>Cliente</span>
            <span>Receita</span>
            <span>Ocupação</span>
            <span>Diária média</span>
            <span />
          </div>
          <div
            className="flex flex-col gap-2 overflow-y-auto pr-1"
            style={{
              maxHeight: 314,
              scrollbarWidth: 'thin',
              scrollbarColor: 'var(--border) transparent',
            }}
          >
            {rows.map(({ hotel, location, metrics }) => (
              <button
                key={hotel.id}
                className="grid items-center gap-3 w-full text-left rounded-[var(--rs)] transition-colors duration-150"
                style={{
                  gridTemplateColumns: 'minmax(150px,1.5fr) repeat(3,minmax(72px,1fr)) 14px',
                  padding: '10px 12px',
                }}
                onClick={() => onSelect(hotel.id)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold block truncate">
                    {hotel.name}
                  </span>
                  {location && (
                    <span className="text-[11px] block truncate" style={{ color: 'var(--text-m)' }}>
                      {location}
                    </span>
                  )}
                </div>
                <MetricCell metric={metrics.receita} elapsedPct={elapsedPct} />
                <MetricCell metric={metrics.occ} elapsedPct={elapsedPct} />
                <MetricCell metric={metrics.dm} elapsedPct={elapsedPct} />
                <ChevronRight size={14} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
