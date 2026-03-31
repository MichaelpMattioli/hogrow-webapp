import { useState, useMemo, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import ChartTooltip from './ChartTooltip';
import type { KpiDiario } from '@/data/types';

const MONTH_COLORS = ['#1D2C5C', '#FFAA01', '#10B981', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6', '#E11D48', '#84CC16'];
const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  return `${MONTH_NAMES[parseInt(month) - 1]}/${year}`;
}

interface RevenueChartProps {
  data: KpiDiario[];
  selectedMonths: string[];
}

export default function RevenueChart({ data, selectedMonths }: RevenueChartProps) {
  const allMonths = useMemo(() =>
    [...new Set(data.map(k => k.date.slice(0, 7)))].sort(),
    [data]
  );

  const availableMonths = useMemo(() =>
    selectedMonths.length > 0 ? selectedMonths : allMonths,
    [selectedMonths, allMonths]
  );

  const [activeMonths, setActiveMonths] = useState<string[]>([]);

  // Reset internal filter when available months change
  useEffect(() => {
    setActiveMonths(availableMonths.slice(-3));
  }, [availableMonths]);

  // Build chart data: { day: 1, '2026-01': recTotal, ... }
  const chartData = useMemo(() => {
    const dayMap = new Map<number, Record<string, number>>();
    for (let d = 1; d <= 31; d++) {
      dayMap.set(d, { day: d });
    }
    for (const k of data) {
      const ym = k.date.slice(0, 7);
      if (!activeMonths.includes(ym)) continue;
      const dayNum = parseInt(k.date.slice(8, 10));
      const row = dayMap.get(dayNum)!;
      row[ym] = k.recTotal;
    }
    return Array.from(dayMap.values()).filter(row =>
      Object.keys(row).some(key => key !== 'day')
    );
  }, [data, activeMonths]);

  const toggleMonth = (m: string) => {
    setActiveMonths(prev => {
      if (prev.includes(m)) {
        return prev.length > 1 ? prev.filter(x => x !== m) : prev;
      }
      return prev.length < 3 ? [...prev, m].sort() : prev;
    });
  };

  const colorIndex = (m: string) => allMonths.indexOf(m) % MONTH_COLORS.length;

  return (
    <div
      className="card-in"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '20px',
        animationDelay: '0.1s',
      }}
    >
      <div className="flex justify-between items-start mb-4 gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>Receita por Dia</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-m)' }}>Comparação mensal (máx. 3 meses)</p>
        </div>
        <div className="flex gap-1 flex-wrap justify-end">
          {availableMonths.map(m => {
            const isActive = activeMonths.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                className="rounded-[var(--rx)] text-[10.5px] font-medium transition-all duration-150"
                style={{
                  padding: '3px 8px',
                  color: isActive ? '#fff' : 'var(--text-m)',
                  background: isActive ? MONTH_COLORS[colorIndex(m)] : 'transparent',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--border)'}`,
                }}
              >
                {monthLabel(m)}
              </button>
            );
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8ECF4" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3B8' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9CA3B8' }} axisLine={false} tickLine={false} />
          <Tooltip content={<ChartTooltip />} />
          {activeMonths.map(m => (
            <Bar
              key={m}
              dataKey={m}
              name={monthLabel(m)}
              fill={MONTH_COLORS[colorIndex(m)]}
              fillOpacity={0.8}
              radius={[3, 3, 0, 0]}
              maxBarSize={activeMonths.length > 1 ? 16 : 24}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
