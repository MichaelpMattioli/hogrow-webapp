import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface PerfData {
  value: number;
  formatted: string;
}

interface PerformanceCardProps {
  title: string;
  icon: LucideIcon;
  currentValue: number;
  currentFormatted: string;
  prevYear: PerfData | null;
  ytd: PerfData | null;           // YTD absolute value
  highlight?: boolean;
  delay?: number;
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

export default function PerformanceCard({
  title, icon: Icon, currentValue, currentFormatted,
  prevYear, ytd, highlight = false, delay = 0,
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
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.7px', color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: 14 }}>
        {currentFormatted}
      </div>

      {/* Comparisons */}
      <div className="grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border-l)', paddingTop: 12 }}>
        <YoyColumn prevData={prevYear}  currentValue={currentValue} />
        <YtdColumn data={ytd} />
      </div>
    </div>
  );
}
