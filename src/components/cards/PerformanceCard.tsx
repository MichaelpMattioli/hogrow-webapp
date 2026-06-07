import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';

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
  referenceMonth?: string;
  highlight?: boolean;
  delay?: number;
  loading?: boolean;
  partialRange?: boolean;   // faixa de dias parcial ativa -> meta (mensal) nao se aplica
}

function monthElapsedRatio(referenceMonth?: string): number {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (referenceMonth) {
    const [year, month] = referenceMonth.split('-').map(Number);
    if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
      const selectedMonthStart = new Date(year, month - 1, 1);
      if (selectedMonthStart < currentMonthStart) return 1;
      if (selectedMonthStart > currentMonthStart) return 0;
    }
  }

  return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function pctDelta(current: number, prev: number): number {
  if (prev === 0) return 0;
  return ((current - prev) / Math.abs(prev)) * 100;
}

function fmtPct(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}

function yoyTooltipText(metric: string, value: number) {
  if (Math.abs(value) < 0.5) return `${metric} estável vs mesmo mês do ano anterior.`;

  const direction = value > 0 ? 'maior' : 'menor';
  return `${metric} ${Math.abs(Math.round(value)).toLocaleString('pt-BR')}% ${direction} vs mesmo mês do ano anterior.`;
}

function VariationTooltip({ text, children }: { text: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      aria-label={text}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'calc(100% + 7px)',
            transform: 'translateX(-50%)',
            zIndex: 30,
            width: 'max-content',
            maxWidth: 190,
            whiteSpace: 'normal',
            textAlign: 'center',
            padding: '6px 8px',
            borderRadius: 6,
            background: 'var(--text)',
            color: 'var(--surface)',
            boxShadow: '0 8px 20px rgba(13, 27, 62, 0.18)',
            fontFamily: 'var(--font, inherit)',
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1.25,
            pointerEvents: 'none',
          }}
        >
          {text}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid var(--text)',
            }}
          />
        </span>
      )}
    </div>
  );
}

// ─── vs Ano Ant. column ───────────────────────────────────────────────

function YoyColumn({ label, prevData, currentValue }: { label: string; prevData: PerfData | null; currentValue: number }) {
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
            <VariationTooltip text={yoyTooltipText(label, pct)}>
              <div className="flex items-center gap-1" style={{ marginBottom: 3 }}>
                <Icon size={11} style={{ color: isPos ? 'var(--green)' : 'var(--red)', flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: isPos ? 'var(--green)' : 'var(--red)' }}>
                  {isPos ? '+' : ''}{fmtPct(pct)}%
                </span>
              </div>
            </VariationTooltip>
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
  meta, currentValue, isCumulative, referenceMonth,
}: { meta: MetaData; currentValue: number; isCumulative: boolean; referenceMonth?: string }) {
  const pct     = meta.value > 0 ? (currentValue / meta.value) * 100 : 0;
  const elapsed = monthElapsedRatio(referenceMonth) * 100;
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
            {fmtPct(pct)}%
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 500 }}>
            {exceeded ? '· superou' : '· da meta'}
          </span>
        </div>
        <span style={{ fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', color: 'var(--text-m)' }}>
          Meta {meta.formatted}
        </span>
      </div>
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────

function CardValueSkeleton({ meta }: { meta: boolean }) {
  return (
    <>
      <Skeleton width="68%" height={27} style={{ marginBottom: meta ? 12 : 16 }} />
      {meta && (
        <div style={{ marginTop: 2, marginBottom: 14 }}>
          <Skeleton width="100%" height={5} radius={99} style={{ marginBottom: 9 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <Skeleton width={82} height={10} />
            <Skeleton width={112} height={10} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border-l)', paddingTop: 12 }}>
        <div>
          <Skeleton width={70} height={9} style={{ marginBottom: 7 }} />
          <Skeleton width={62} height={13} style={{ marginBottom: 6 }} />
          <Skeleton width={86} height={10} />
        </div>
        <div>
          <Skeleton width={66} height={9} style={{ marginBottom: 7 }} />
          <Skeleton width={92} height={13} />
        </div>
      </div>
    </>
  );
}

export default function PerformanceCard({
  title, icon: Icon, currentValue, currentFormatted,
  prevYear, ytd, meta, metaCumulative = false, referenceMonth, highlight = false, delay = 0, loading = false, partialRange = false,
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

      {loading ? (
        <CardValueSkeleton meta={Boolean(meta)} />
      ) : (
        <>
          {/* Primary value */}
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.7px', color: 'var(--text)', fontFamily: 'var(--mono)', marginBottom: meta ? 10 : 14 }}>
            {currentFormatted}
          </div>

          {/* Meta strip — oculto sob faixa parcial (meta é mensal, não compara com faixa) */}
          {!partialRange && meta && meta.value > 0 && (
            <MetaStrip
              meta={meta}
              currentValue={currentValue}
              isCumulative={metaCumulative}
              referenceMonth={referenceMonth}
            />
          )}

          {/* Comparisons */}
          <div className="grid grid-cols-2 gap-3" style={{ borderTop: '1px solid var(--border-l)', paddingTop: 12 }}>
            <YoyColumn label={title} prevData={prevYear} currentValue={currentValue} />
            <YtdColumn data={ytd} />
          </div>
        </>
      )}
    </div>
  );
}
