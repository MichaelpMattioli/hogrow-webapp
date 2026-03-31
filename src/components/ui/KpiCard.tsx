import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import AnimatedNumber from './AnimatedNumber';

interface KpiCardProps {
  title: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  delta: number;
  deltaLabel: string;
  icon: LucideIcon;
  delay?: number;
}

export default function KpiCard({ title, value, prefix = '', suffix = '', decimals = 0, delta, deltaLabel, icon: Icon, delay = 0 }: KpiCardProps) {
  const isPositive = delta >= 0;

  return (
    <div
      className="card-in hover:shadow-[var(--sh-m)] transition-shadow duration-200"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '18px',
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex justify-between items-center mb-2.5">
        <span className="font-medium" style={{ color: 'var(--text-m)', fontSize: '11px' }}>{title}</span>
        <div
          className="flex items-center justify-center rounded-[var(--rx)]"
          style={{
            width: 30,
            height: 30,
            background: 'var(--gold-l)',
            color: 'var(--gold)',
          }}
        >
          <Icon size={15} />
        </div>
      </div>
      <div className="font-bold mb-1" style={{ letterSpacing: '-0.6px', fontSize: '17px' }}>
        <AnimatedNumber value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      {(delta !== 0 || deltaLabel) && (
        <span
          className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold rounded-full"
          style={{
            padding: '2px 8px',
            background: isPositive ? 'var(--green-l)' : 'var(--red-l)',
            color: isPositive ? 'var(--green)' : 'var(--red)',
          }}
        >
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {isPositive ? '+' : ''}{delta}{deltaLabel}
        </span>
      )}
    </div>
  );
}
