import { ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { HotelSummary } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';

interface ClientListCardProps {
  hotel: HotelSummary;
  onClick: () => void;
  delay?: number;
}

// ─── Safe helpers ─────────────────────────────────────────────────────

const ok = (v: unknown): v is number =>
  typeof v === 'number' && isFinite(v) && !isNaN(v);

const fmtR$ = (v: number | null | undefined): string => {
  if (!ok(v)) return '?';
  return 'R$ ' + Math.round(v).toLocaleString('pt-BR');
};

const fmtRec = (v: number | null | undefined): string => {
  if (!ok(v)) return '?';
  if (v >= 1_000_000)
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (v >= 1_000)
    return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  return fmtR$(v);
};

const fmtPct = (v: number | null | undefined, dec = 1): string => {
  if (!ok(v)) return '?';
  return `${v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })}%`;
};

const fmtN = (v: number | null | undefined): string => {
  if (!ok(v)) return '?';
  return v.toLocaleString('pt-BR');
};

const pctDelta = (curr: number | null | undefined, prev: number | null | undefined): number | null => {
  if (!ok(curr) || !ok(prev) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
};

const ppDelta = (curr: number | null | undefined, prev: number | null | undefined): number | null => {
  if (!ok(curr) || !ok(prev)) return null;
  return curr - prev;
};

// ─── Delta badge ──────────────────────────────────────────────────────

type DeltaType = 'pct' | 'pp';

interface DeltaBadgeProps {
  delta: number | null | undefined;
  type: DeltaType;
  label: string;
}

function DeltaBadge({ delta, type, label }: DeltaBadgeProps) {
  const valid = ok(delta) && Math.abs(delta as number) >= 0.05;

  if (!valid) {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontSize: 9.5, fontWeight: 600, color: 'var(--text-m)',
          background: 'var(--surface-h)', borderRadius: 99,
          padding: '2px 6px',
        }}
      >
        <Minus size={8} strokeWidth={2.5} />
        {label}
      </span>
    );
  }

  const d = delta as number;
  const positive = d > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive ? 'var(--green)' : 'var(--red)';
  const bg    = positive ? 'var(--green-l)' : 'var(--red-l)';
  const sign  = positive ? '+' : '';

  const valueStr = type === 'pct'
    ? `${sign}${d.toFixed(1)}%`
    : `${sign}${d.toFixed(1)}pp`;

  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        fontSize: 9.5, fontWeight: 700, color, background: bg,
        borderRadius: 99, padding: '2px 6px',
      }}
    >
      <Icon size={8} strokeWidth={2.5} />
      {valueStr} {label}
    </span>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: string;
  momDelta: number | null | undefined;
  yoyDelta: number | null | undefined;
  momType: DeltaType;
  yoyType: DeltaType;
  accent?: boolean;
  sub?: string; // optional subtitle below value
}

function KpiTile({ label, value, momDelta, yoyDelta, momType, yoyType, accent, sub }: KpiTileProps) {
  const missing = value === '?';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '12px 14px',
        background: accent ? 'var(--accent-l)' : 'var(--bg)',
        borderRadius: 'var(--rx)',
        border: `1px solid ${accent ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--border-l)'}`,
      }}
    >
      <span
        style={{
          fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.6px',
          color: accent ? 'var(--accent-d)' : 'var(--text-m)',
        }}
      >
        {label}
      </span>

      <span
        style={{
          fontSize: 20, fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1,
          color: missing
            ? 'var(--text-m)'
            : accent
              ? 'var(--accent-d)'
              : 'var(--text)',
          fontFamily: 'var(--mono)',
        }}
      >
        {value}
      </span>

      {sub && (
        <span style={{ fontSize: 9.5, color: 'var(--text-m)', marginTop: -2 }}>
          {sub}
        </span>
      )}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
        <DeltaBadge delta={momDelta} type={momType} label="MoM" />
        <DeltaBadge delta={yoyDelta} type={yoyType} label="YoY" />
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

export default function ClientListCard({ hotel, onClick, delay = 0 }: ClientListCardProps) {
  const cfg = STATUS_CONFIG[hotel.status];

  // ── Derived current values ──────────────────────────────────────────
  const dm = ok(hotel.ocupadosMesAtual) && hotel.ocupadosMesAtual > 0
    ? hotel.receitaMesAtual / hotel.ocupadosMesAtual
    : null;

  const revpar = ok(dm) && ok(hotel.occMesAtual)
    ? dm * hotel.occMesAtual / 100
    : null;

  // ── Derived previous-month values ───────────────────────────────────
  const dmMesAnterior = ok(hotel.ocupadosMesAnterior) && hotel.ocupadosMesAnterior > 0
    ? hotel.receitaMesAnterior / hotel.ocupadosMesAnterior
    : null;

  const revparMesAnterior = ok(dmMesAnterior) && ok(hotel.occMesAnterior)
    ? dmMesAnterior * hotel.occMesAnterior / 100
    : null;

  // ── Derived YoY values ──────────────────────────────────────────────
  const dmAnoAnterior = ok(hotel.ocupadosAnoAnterior) && hotel.ocupadosAnoAnterior > 0
    ? hotel.receitaAnoAnterior / hotel.ocupadosAnoAnterior
    : null;

  const revparAnoAnterior = ok(dmAnoAnterior) && ok(hotel.occAnoAnterior)
    ? dmAnoAnterior * hotel.occAnoAnterior / 100
    : null;

  // ── Deltas ──────────────────────────────────────────────────────────
  const recMom  = pctDelta(hotel.receitaMesAtual,    hotel.receitaMesAnterior);
  const recYoy  = pctDelta(hotel.receitaMesAtual,    hotel.receitaAnoAnterior);

  const rdMom   = pctDelta(hotel.recDiariasMesAtual, hotel.recDiariasMesAnterior);
  const rdYoy   = pctDelta(hotel.recDiariasMesAtual, hotel.recDiariasAnoAnterior);

  const dmMom   = pctDelta(dm,    dmMesAnterior);
  const dmYoy   = pctDelta(dm,    dmAnoAnterior);

  const occMom  = ppDelta(hotel.occMesAtual,   hotel.occMesAnterior);
  const occYoy  = ppDelta(hotel.occMesAtual,   hotel.occAnoAnterior);

  const rnMom   = pctDelta(hotel.ocupadosMesAtual,  hotel.ocupadosMesAnterior);
  const rnYoy   = pctDelta(hotel.ocupadosMesAtual,  hotel.ocupadosAnoAnterior);

  const rvMom   = pctDelta(revpar,  revparMesAnterior);
  const rvYoy   = pctDelta(revpar,  revparAnoAnterior);

  // ── Misc display ────────────────────────────────────────────────────
  const now = new Date();
  const refMonth = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })
    .format(now)
    .replace('.', '');

  const cortesiaStr = ok(hotel.cortesiaMesAtual) && hotel.cortesiaMesAtual > 0
    ? `${hotel.ocupadosMesAtual} occ · ${hotel.cortesiaMesAtual} cortesia`
    : undefined;

  return (
    <button
      className="card-in w-full text-left transition-all duration-200 hover:border-[var(--accent)] hover:shadow-[var(--sh-m)] hover:-translate-y-px"
      style={{
        position: 'relative',
        padding: '16px 20px 16px 24px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        animationDelay: `${delay}ms`,
        overflow: 'hidden',
      }}
      onClick={onClick}
    >
      {/* Status color bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: cfg.color }} />

      {/* ── Header ── */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-[14.5px] font-semibold truncate" style={{ letterSpacing: '-0.2px' }}>
            {hotel.name ?? '?'}
          </h3>
          <span
            className="text-[10px] font-medium rounded-full shrink-0"
            style={{ padding: '2px 8px', background: 'var(--surface-h)', color: 'var(--text-m)', border: '1px solid var(--border-l)' }}
          >
            {hotel.city ?? '?'}, {hotel.state ?? '?'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-[10px] font-semibold rounded-full"
            style={{ padding: '2px 9px', background: 'var(--accent-l)', color: 'var(--accent-d)' }}
          >
            Ref {refMonth}
          </span>
          <span
            className="text-[10px] font-semibold rounded-full"
            style={{ padding: '2px 9px', background: cfg.bg, color: cfg.color }}
          >
            Ext {hotel.latestExtracao ?? '?'}
          </span>
          <span
            className="text-[10px] font-semibold rounded-full"
            style={{
              padding: '2px 9px',
              background: 'var(--surface-h)',
              border: '1px solid var(--border-l)',
              color: 'var(--text-s)',
              fontFamily: 'var(--mono)',
            }}
          >
            {ok(hotel.latestOcupados) ? hotel.latestOcupados : '?'}/{hotel.uhs ?? '?'} UHs
          </span>
          <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
        </div>
      </div>

      {/* ── Indicadores de Performance ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {/* Row 1 */}
        <KpiTile
          label="Receita Total"
          value={fmtRec(hotel.receitaMesAtual)}
          momDelta={recMom}
          yoyDelta={recYoy}
          momType="pct"
          yoyType="pct"
          accent
        />
        <KpiTile
          label="Ocupação"
          value={fmtPct(hotel.occMesAtual)}
          momDelta={occMom}
          yoyDelta={occYoy}
          momType="pp"
          yoyType="pp"
        />
        <KpiTile
          label="Diária Média"
          value={fmtR$(dm)}
          momDelta={dmMom}
          yoyDelta={dmYoy}
          momType="pct"
          yoyType="pct"
        />
        {/* Row 2 */}
        <KpiTile
          label="Rec. de Diárias"
          value={fmtRec(hotel.recDiariasMesAtual)}
          momDelta={rdMom}
          yoyDelta={rdYoy}
          momType="pct"
          yoyType="pct"
        />
        <KpiTile
          label="Room Nights"
          value={fmtN(hotel.ocupadosMesAtual)}
          momDelta={rnMom}
          yoyDelta={rnYoy}
          momType="pct"
          yoyType="pct"
          sub={cortesiaStr}
        />
        <KpiTile
          label="RevPAR"
          value={fmtR$(revpar)}
          momDelta={rvMom}
          yoyDelta={rvYoy}
          momType="pct"
          yoyType="pct"
        />
      </div>
    </button>
  );
}
