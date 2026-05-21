import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

export interface PerfData {
  value: number;
  formatted: string;
}

export interface MetaData {
  value: number;
  formatted: string;
}

interface PerformanceCardProps {
  title: string;
  icon: LucideIcon;
  currentValue: number;
  currentFormatted: string;
  prevYear: PerfData | null;
  ytd: PerfData | null;
  meta?: MetaData | null;
  metaCumulative?: boolean;   // true = Receita (acumula); false = Occ, DM (média alvo)
  highlight?: boolean;
  delay?: number;
}

function monthElapsedRatio(): number {
  const now = new Date();
  return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function pctDelta(current: number, prev: number): number {
  if (prev === 0) return 0;
  return ((current - prev) / Math.abs(prev)) * 100;
}

// ─── vs Ano Ant. column ───────────────────────────────────────────────

function YoyColumn({ prevData, currentValue }: { prevData: PerfData | null; currentValue: number }) {
  const hasData = prevData && prevData.value !== 0;
  return (
    <div>
      <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-m)', marginBottom: 5 }}>
        vs Ano Ant.
      </div>
      {hasData ? (() => {
        const pct = pctDelta(currentValue, prevData.value);
        const isPos = pct >= 0;
        const Icon = isPos ? TrendingUp : TrendingDown;
        return (
          <>
            <div className="flex items-center gap-1" style={{ marginBottom: 3 }}>
              <Icon size={11} style={{ color: isPos ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
              <span style={{ fontSize: '12.5px', fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)' }}>
                {isPos ? '+' : ''}{pct.toFixed(1)}%
              </span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-m)', fontFamily: 'var(--mono)' }}>
              {prevData.formatted}
            </div>
          </>
        );
      })() : (
        <div style={{ fontSize: 11, color: 'var(--text-m)' }}>—</div>
      )}
    </div>
  );
}

// ─── YTD column ───────────────────────────────────────────────────────

function YtdColumn({ data }: { data: PerfData | null }) {
  return (
    <div>
      <div style={{ fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-d)', marginBottom: 5 }}>
        Acum. Ano
      </div>
      {data && data.value !== 0 ? (
        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
          {data.formatted}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-m)' }}>—</div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

// ─── Meta strip ──────────────────────────────────────────────────────

function MetaStrip({
  meta, currentValue, isCumulative,
}: { meta: MetaData; currentValue: number; isCumulative: boolean }) {
  const pct     = meta.value > 0 ? (currentValue / meta.value) * 100 : 0;
  const elapsed = monthElapsedRatio() * 100;
  const exceeded = currentValue > meta.value;

  // For cumulative (Receita): pace against time elapsed
  // For averages (Occ, DM): just compare to target directly
  const color = isCumulative
    ? (pct >= 100          ? 'var(--green)'
      : pct >= elapsed * 0.9 ? 'var(--green)'
      : pct >= elapsed * 0.7 ? 'var(--gold)'
      : 'var(--red)')
    : (pct >= 100  ? 'var(--green)'
      : pct >= 90  ? 'var(--green)'
      : pct >= 75  ? 'var(--gold)'
      : 'var(--red)');

  const barPct = Math.min(pct, 100);

  return (
    <div style={{ marginTop: 2, marginBottom: 14 }}>
      {/* Progress bar */}
      <div style={{
        position: 'relative', height: 5,
        background: 'var(--border-l)', borderRadius: 99,
        overflow: 'visible', marginBottom: 7,
      }}>
        {/* Elapsed-time marker — only for cumulative metrics */}
        {isCumulative && (
          <div style={{
            position: 'absolute',
            left: `${Math.min(elapsed, 100)}%`,
            top: -2, bottom: -2, width: 1.5,
            background: 'var(--text-m)', opacity: 0.4,
            borderRadius: 99, zIndex: 2,
          }} />
        )}
        {/* Realizado bar */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${barPct}%`, background: color,
          borderRadius: 99, transition: 'width .5s ease', zIndex: 1,
        }} />
      </div>

      {/* Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Target size={9} style={{ color, flexShrink: 0 }} />
          <span style={{ fontSize: 10, fontWeight: 700, color }}>
            {pct.toFixed(1)}%
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 500 }}>
            {exceeded ? '· superou' : '· da meta'}
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text-m)' }}>
          {meta.formatted}
        </span>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

export default function PerformanceCard({
  title, icon: Icon, currentValue, currentFormatted,
  prevYear, ytd, meta, metaCumulative = false, highlight = false, delay = 0,
}: PerformanceCardProps) {
  return (
    <div
      className="card-in hover:shadow-[var(--sh-m)] transition-shadow duration-200"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderTop: highlight ? '3px solid var(--gold)' : '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '18px 20px',
        animationDelay: `${delay}ms`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-s)' }}>
          {title}
        </span>
        <div className="flex items-center justify-center rounded-[var(--rx)]"
          style={{ width: 26, height: 26, background: 'var(--gold-l)', color: 'var(--gold)' }}>
          <Icon size={13} />
        </div>
      </div>

      {/* Primary value */}
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.7px', color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: meta ? 10 : 14 }}>
        {currentFormatted}
      </div>

      {/* Meta strip */}
      {meta && meta.value > 0 && (
        <MetaStrip meta={meta} currentValue={currentValue} isCumulative={metaCumulative} />
      )}

      {/* Comparisons */}
      <div className="grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border-l)', paddingTop: 12 }}>
        <YoyColumn prevData={prevYear} currentValue={currentValue} />
        <YtdColumn data={ytd} />
      </div>
    </div>
  );
}
