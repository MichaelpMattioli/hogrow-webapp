import { TrendingUp, TrendingDown, Target } from 'lucide-react';
import { Eye } from 'lucide-react';

interface InsightCardProps {
  insights: Array<{ type: 'pos' | 'warn' | 'neg' | 'neutral'; title: string; text: string }>;
}

const iconMap = {
  pos: TrendingUp,
  warn: TrendingDown,
  neg: TrendingDown,
  neutral: Target,
};

const colorMap = {
  pos: { bg: 'var(--green-l)', iconColor: 'var(--green)' },
  warn: { bg: 'var(--amber-l)', iconColor: 'var(--amber)' },
  neg: { bg: 'var(--red-l)', iconColor: 'var(--red)' },
  neutral: { bg: 'var(--accent-l)', iconColor: 'var(--accent)' },
};

export default function InsightCard({ insights }: InsightCardProps) {

  return (
    <div
      className="card-in"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '20px',
        animationDelay: '0.15s',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>Leitura Consolidada</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-m)' }}>Síntese da tendência</p>
        </div>
        <Eye size={16} style={{ color: 'var(--text-m)' }} />
      </div>
      <div className="flex flex-col gap-2">
        {insights.map((ins, i) => {
          const Icon = ins.type === 'neutral' ? Target : ins.type === 'pos' ? TrendingUp : TrendingDown;
          const colors = colorMap[ins.type];

          return (
            <div
              key={i}
              className="flex gap-2.5 rounded-[var(--rs)] items-start"
              style={{ padding: '10px 12px', background: colors.bg }}
            >
              <Icon size={15} style={{ color: colors.iconColor, flexShrink: 0, marginTop: 1 }} />
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-s)' }}>
                <strong style={{ color: 'var(--text)' }}>{ins.title}</strong> — {ins.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
