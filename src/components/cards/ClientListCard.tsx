import { ChevronRight, TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import type { HotelSummary, HotelMeta } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';

interface ClientListCardProps {
  hotel: HotelSummary;
  meta?: HotelMeta;
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

// ─── YTD badge ────────────────────────────────────────────────────────

function YtdBadge({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 9.5, fontWeight: 700,
        color: 'var(--accent-d)',
        background: 'var(--accent-l)',
        borderRadius: 99,
        padding: '2px 6px',
      }}
    >
      <span style={{ fontSize: 8, fontWeight: 800, opacity: 0.7 }}>YTD</span>
      {value}
    </span>
  );
}

// ─── KPI Tile ─────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: string;
  yoyDelta: number | null | undefined;
  yoyType: DeltaType;
  ytdValue?: string | null;   // formatted YTD value (e.g. "R$ 1.2M" or "68.5%")
  accent?: boolean;
  sub?: string;
}

function KpiTile({ label, value, yoyDelta, yoyType, ytdValue, accent, sub }: KpiTileProps) {
  const missing = value === '?';
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: '12px 14px',
        background: accent ? 'var(--accent-l)' : 'var(--bg)',
        borderRadius: 'var(--rx)',
        border: `1px solid ${accent ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--border-l)'}`,
      }}
    >
      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: accent ? 'var(--accent-d)' : 'var(--text-m)' }}>
        {label}
      </span>

      <span style={{
        fontSize: 20, fontWeight: 800, letterSpacing: '-0.8px', lineHeight: 1,
        color: missing ? 'var(--text-m)' : accent ? 'var(--accent-d)' : 'var(--text)',
        fontFamily: 'var(--mono)',
      }}>
        {value}
      </span>

      {sub && <span style={{ fontSize: 9.5, color: 'var(--text-m)', marginTop: -2 }}>{sub}</span>}

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
        <DeltaBadge delta={yoyDelta} type={yoyType} label="a/a" />
        <YtdBadge value={ytdValue ?? null} />
      </div>
    </div>
  );
}

// ─── Meta strip (IO-style) ────────────────────────────────────────────

// How far we are through the current month (0–1), used for "previsto"
function monthElapsedRatio(): number {
  const now  = new Date();
  const day  = now.getDate();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return day / days;
}

interface MetaPanelProps {
  title: string;
  metaVal:   number | null;   // target
  actual:    number | null;   // current actual
  fmt:       (v: number) => string;
  unit?:     string;          // suffix for display (e.g. '%')
  isCurrency?: boolean;
}

function MetaPanel({ title, metaVal, actual, fmt, isCurrency }: MetaPanelProps) {
  if (!ok(metaVal) || metaVal <= 0) return null;

  const elapsed  = monthElapsedRatio();
  const realPct  = ok(actual) ? (actual / metaVal) * 100 : 0;           // % achieved
  const prevPct  = elapsed * 100;                                         // % expected by now
  const surplus  = ok(actual) ? actual - metaVal : null;                  // positive = superou
  const surpassed = ok(surplus) && surplus > 0;
  const barPct   = Math.min(realPct, 100);

  const color = realPct >= 100
    ? 'var(--green)'
    : realPct >= prevPct * 0.9
      ? 'var(--green)'
      : realPct >= prevPct * 0.7
        ? 'var(--gold)'
        : 'var(--red)';

  return (
    <div
      style={{
        flex: 1, minWidth: 0,
        background: 'var(--bg)',
        border: '1px solid var(--border-l)',
        borderRadius: 'var(--rx)',
        padding: '12px 14px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Title */}
      <span style={{
        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: '0.6px', color: 'var(--text-m)',
      }}>
        {title}
      </span>

      {/* Numbers row: META | ATUAL | RESTAM/SUPEROU */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        {/* META */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
            Meta
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
            {fmt(metaVal)}
          </div>
        </div>
        {/* ATUAL */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>
            {isCurrency ? 'Receita' : title}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1 }}>
            {ok(actual) ? fmt(actual) : '—'}
          </div>
        </div>
        {/* RESTAM / SUPEROU */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3, color: surpassed ? 'var(--green)' : 'var(--red)' }}>
            {surpassed ? 'Superou ↑' : 'Restam ↓'}
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 800, fontFamily: 'var(--mono)', lineHeight: 1, color: surpassed ? 'var(--green)' : 'var(--text)' }}>
            {ok(surplus) ? fmt(Math.abs(surplus)) : '—'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ position: 'relative', height: 12, background: 'var(--border-l)', borderRadius: 99, overflow: 'hidden' }}>
          {/* Previsto marker (expected by now) */}
          <div
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.min(prevPct, 100)}%`,
              background: 'color-mix(in srgb, var(--text-m) 18%, transparent)',
              borderRadius: 99,
            }}
          />
          {/* Realizado bar */}
          <div
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${barPct}%`,
              background: color,
              borderRadius: 99,
              transition: 'width .5s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 6,
              minWidth: realPct > 8 ? undefined : 0,
            }}
          />
          {/* % label inside bar */}
          {realPct > 12 && (
            <span style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${barPct}%`,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              paddingRight: 5,
              fontSize: 8.5, fontWeight: 800, color: '#fff',
              fontFamily: 'var(--mono)',
              pointerEvents: 'none',
            }}>
              {realPct.toFixed(1)}%
            </span>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Realizado {realPct <= 12 ? `${realPct.toFixed(1)}%` : ''}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            Previsto {prevPct.toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

interface MetaStripProps {
  meta: HotelMeta;
  receita: number;
  occ: number;
  dm: number | null;
}

function MetaStrip({ meta, receita, occ, dm }: MetaStripProps) {
  const hasAny = ok(meta.receitaMeta) || ok(meta.occMeta) || ok(meta.dmMeta);
  if (!hasAny) return null;

  const fmtR$Compact = (v: number) => {
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `R$ ${Math.round(v / 1_000)}k`;
    return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  };
  const fmtPctVal = (v: number) => `${v.toFixed(1)}%`;
  const fmtDm     = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;

  return (
    <div
      style={{
        marginTop: 12,
        paddingTop: 14,
        borderTop: '1px solid var(--border-l)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-1.5">
        <Target size={11} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent)' }}>
          Metas do mês
        </span>
      </div>

      {/* 3 panels side by side */}
      <div style={{ display: 'flex', gap: 8 }}>
        <MetaPanel
          title="Receita"
          metaVal={meta.receitaMeta}
          actual={receita}
          fmt={fmtR$Compact}
          isCurrency
        />
        <MetaPanel
          title="Ocupação"
          metaVal={meta.occMeta}
          actual={occ}
          fmt={fmtPctVal}
        />
        <MetaPanel
          title="Diária Média"
          metaVal={meta.dmMeta}
          actual={dm}
          fmt={fmtDm}
          isCurrency
        />
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

export default function ClientListCard({ hotel, meta, onClick, delay = 0 }: ClientListCardProps) {
  const cfg = STATUS_CONFIG[hotel.status];

  // ── Derived current values ──────────────────────────────────────────
  const dm = ok(hotel.ocupadosMesAtual) && hotel.ocupadosMesAtual > 0
    ? hotel.receitaMesAtual / hotel.ocupadosMesAtual
    : null;

  const revpar = ok(dm) && ok(hotel.occMesAtual)
    ? dm * hotel.occMesAtual / 100
    : null;

  // ── YoY derived values ───────────────────────────────────────────────
  const dmAnoAnterior = ok(hotel.ocupadosAnoAnterior) && hotel.ocupadosAnoAnterior > 0
    ? hotel.receitaAnoAnterior / hotel.ocupadosAnoAnterior
    : null;

  const revparAnoAnterior = ok(dmAnoAnterior) && ok(hotel.occAnoAnterior)
    ? dmAnoAnterior * hotel.occAnoAnterior / 100
    : null;

  // ── YoY deltas ──────────────────────────────────────────────────────
  const recYoy = pctDelta(hotel.receitaMesAtual,    hotel.receitaAnoAnterior);
  const rdYoy  = pctDelta(hotel.recDiariasMesAtual, hotel.recDiariasAnoAnterior);
  const dmYoy  = pctDelta(dm,                       dmAnoAnterior);
  const occYoy = ppDelta(hotel.occMesAtual,          hotel.occAnoAnterior);
  const rnYoy  = pctDelta(hotel.ocupadosMesAtual,   hotel.ocupadosAnoAnterior);
  const rvYoy  = pctDelta(revpar,                   revparAnoAnterior);

  // ── YTD values (formatted) ───────────────────────────────────────────
  const revparYTD = ok(hotel.dmYTD) && ok(hotel.occAvgYTD)
    ? hotel.dmYTD! * hotel.occAvgYTD / 100
    : null;

  const ytdReceita   = ok(hotel.receitaYTD)   ? fmtRec(hotel.receitaYTD)                  : null;
  const ytdOcc       = ok(hotel.occAvgYTD)    ? fmtPct(hotel.occAvgYTD)                   : null;
  const ytdDm        = ok(hotel.dmYTD)        ? fmtR$(hotel.dmYTD)                        : null;
  const ytdRn        = ok(hotel.ocupadosYTD)  ? fmtN(hotel.ocupadosYTD)                   : null;
  const ytdRevpar    = ok(revparYTD)           ? fmtR$(revparYTD)                          : null;
  // recDiarias YTD not in view — skip

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
          yoyDelta={recYoy}
          yoyType="pct"
          ytdValue={ytdReceita}
          accent
        />
        <KpiTile
          label="Ocupação"
          value={fmtPct(hotel.occMesAtual)}
          yoyDelta={occYoy}
          yoyType="pp"
          ytdValue={ytdOcc}
        />
        <KpiTile
          label="Diária Média"
          value={fmtR$(dm)}
          yoyDelta={dmYoy}
          yoyType="pct"
          ytdValue={ytdDm}
        />
        {/* Row 2 */}
        <KpiTile
          label="Rec. de Diárias"
          value={fmtRec(hotel.recDiariasMesAtual)}
          yoyDelta={rdYoy}
          yoyType="pct"
          ytdValue={null}
        />
        <KpiTile
          label="Room Nights"
          value={fmtN(hotel.ocupadosMesAtual)}
          yoyDelta={rnYoy}
          yoyType="pct"
          ytdValue={ytdRn}
          sub={cortesiaStr}
        />
        <KpiTile
          label="RevPAR"
          value={fmtR$(revpar)}
          yoyDelta={rvYoy}
          yoyType="pct"
          ytdValue={ytdRevpar}
        />
      </div>

      {/* ── Meta strip ── */}
      {meta && (
        <MetaStrip
          meta={meta}
          receita={hotel.receitaMesAtual}
          occ={hotel.occMesAtual}
          dm={dm}
        />
      )}
    </button>
  );
}
