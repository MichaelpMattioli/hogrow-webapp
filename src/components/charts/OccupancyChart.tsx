import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import ToggleGroup from '@/components/ui/ToggleGroup';
import ChartTooltip from './ChartTooltip';
import type { KpiDiario } from '@/data/types';

const MONTH_COLORS = ['#1D2C5C', '#FFAA01', '#10B981', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6', '#E11D48', '#84CC16'];
const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]}/${year}`;
}

interface OccupancyChartProps {
  data: KpiDiario[];
  selectedMonths: string[];
}

export default function OccupancyChart({ data, selectedMonths }: OccupancyChartProps) {
  const [mode, setMode] = useState('occ');

  const allMonths = useMemo(() =>
    [...new Set(data.map(k => k.date.slice(0, 7)))].sort(),
    [data]
  );
  const displayMonths = selectedMonths.length > 0 ? selectedMonths : allMonths;

  // Build chart data: { day: 1, '2026-01': value, '2026-02': value, ... }
  const chartData = useMemo(() => {
    const dayMap = new Map<number, Record<string, number>>();
    for (let d = 1; d <= 31; d++) {
      dayMap.set(d, { day: d });
    }
    for (const k of data) {
      const ym = k.date.slice(0, 7);
      if (!displayMonths.includes(ym)) continue;
      const dayNum = parseInt(k.date.slice(8, 10));
      const row = dayMap.get(dayNum)!;
      row[ym] = mode === 'occ' ? k.occPct : mode === 'revpar' ? k.revpar : k.adr;
    }
    return Array.from(dayMap.values()).filter(row =>
      Object.keys(row).some(key => key !== 'day')
    );
  }, [data, displayMonths, mode]);

  return (
    <div
      className="card-in"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '20px',
        animationDelay: '0.05s',
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>Evolução Diária</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-m)' }}>Tendência por mês (dias 1–31)</p>
        </div>
        <ToggleGroup
          options={[
            { key: 'occ', label: 'OCC' },
            { key: 'revpar', label: 'RevPAR' },
            { key: 'dm', label: 'DM' },
          ]}
          active={mode}
          onChange={setMode}
        />
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            {displayMonths.map((_m, i) => (
              <linearGradient key={i} id={`g-evo-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MONTH_COLORS[i % MONTH_COLORS.length]} stopOpacity={0.12} />
                <stop offset="100%" stopColor={MONTH_COLORS[i % MONTH_COLORS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF4" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9CA3B8' }} axisLine={false} tickLine={false} />
          {mode === 'occ' && <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="4 4" strokeOpacity={0.5} />}
          <Tooltip content={<ChartTooltip />} />
          {displayMonths.map((m, i) => (
            <Area
              key={m}
              type="monotone"
              dataKey={m}
              name={monthLabel(m)}
              stroke={MONTH_COLORS[i % MONTH_COLORS.length]}
              strokeWidth={2}
              fill={`url(#g-evo-${i})`}
              dot={{ fill: MONTH_COLORS[i % MONTH_COLORS.length], r: 2, strokeWidth: 1.5, stroke: '#fff' }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {displayMonths.length > 1 && (
        <div className="flex gap-3 justify-center pt-2 flex-wrap">
          {displayMonths.map((m, i) => (
            <span key={m} className="flex items-center gap-1.5 text-[10.5px]" style={{ color: 'var(--text-m)' }}>
              <span className="w-[7px] h-[7px] rounded-full" style={{ background: MONTH_COLORS[i % MONTH_COLORS.length] }} />
              {monthLabel(m)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
