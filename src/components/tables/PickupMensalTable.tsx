import React, { useMemo, useState } from 'react';
import {
  BedDouble,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Percent,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { usePickupMensalKpis, type PickupMensalKpi } from '@/hooks/useSupabase';
import type { PickupRow } from '@/data/types';
import { Skeleton } from '@/components/ui/Skeleton';

const MES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type Tone = 'positive' | 'negative' | 'warning' | 'neutral' | 'muted' | 'accent' | 'change';

const TONES: Record<Tone, { bg: string; border: string; color: string }> = {
  positive: { bg: 'var(--green-l)', border: '#A7F3D0', color: 'var(--green)' },
  negative: { bg: 'var(--red-l)', border: '#FECACA', color: 'var(--red)' },
  warning:  { bg: 'var(--amber-l)', border: '#FDE68A', color: 'var(--amber)' },
  neutral:  { bg: 'var(--surface)', border: 'var(--border-l)', color: 'var(--text)' },
  muted:    { bg: 'var(--bg)', border: 'var(--border-l)', color: 'var(--text-m)' },
  accent:   { bg: 'var(--accent-l)', border: 'var(--border)', color: 'var(--accent)' },
  change:   { bg: '#F0EDE8', border: '#D6C8BA', color: '#6F5D4B' },
};

function fmtBRL(value: number) {
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}R$ ${Math.round(abs).toLocaleString('pt-BR')}`;
}

function fmtSignedBRL(value: number | null) {
  if (value == null) return '--';
  return `${value > 0 ? '+' : ''}${fmtBRL(value)}`;
}

function fmtNum(value: number | null) {
  if (value == null) return '--';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function fmtSignedNum(value: number | null) {
  if (value == null) return '--';
  return `${value > 0 ? '+' : ''}${fmtNum(value)}`;
}

function fmtPct(value: number | null) {
  if (value == null) return '--';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
}

function fmtPp(value: number | null) {
  if (value == null) return '--';
  return `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}pp`;
}

function deltaTone(value: number | null): Tone {
  if (value == null || value === 0) return 'muted';
  return value > 0 ? 'positive' : 'negative';
}

function achievementTone(value: number | null): Tone {
  if (value == null) return 'muted';
  if (value >= 100) return 'positive';
  if (value >= 80) return 'warning';
  return 'negative';
}

function cellStyle(tone: Tone, align: React.CSSProperties['textAlign'] = 'right'): React.CSSProperties {
  const t = TONES[tone];
  return {
    padding: '7px 9px',
    textAlign: align,
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    fontWeight: 700,
    color: t.color,
    background: t.bg,
    border: `1px solid ${t.border}`,
  };
}

function summaryTone(value: number): Tone {
  if (value === 0) return 'muted';
  return value > 0 ? 'positive' : 'negative';
}

function SummaryMetric({
  label,
  value,
  tone = 'neutral',
  icon,
}: {
  label: string;
  value: string;
  tone?: Tone;
  icon: React.ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div style={{
      minWidth: 150,
      padding: '10px 12px',
      borderRight: '1px solid var(--border-l)',
      display: 'flex',
      alignItems: 'center',
      gap: 9,
    }}>
      <span style={{
        width: 28,
        height: 28,
        borderRadius: 'var(--rx)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{
          display: 'block',
          fontSize: 9.5,
          fontWeight: 700,
          color: 'var(--text-m)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          lineHeight: 1.2,
        }}>
          {label}
        </span>
        <span style={{
          display: 'block',
          marginTop: 2,
          fontSize: 13,
          fontWeight: 800,
          color: t.color,
          fontFamily: 'var(--mono)',
          lineHeight: 1.2,
        }}>
          {value}
        </span>
      </span>
    </div>
  );
}

function PickupMensalSkeletonRows() {
  return (
    <>
      {Array.from({ length: 12 }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: 10 }, (_, col) => (
            <td key={col} style={{ padding: '8px 10px', background: col === 0 ? 'var(--surface)' : 'var(--bg)', border: '1px solid var(--border-l)' }}>
              <Skeleton height={16} radius={4} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function TrendIcon({ value }: { value: number | null }) {
  if (value == null || value === 0) return null;
  return value > 0
    ? <TrendingUp size={10} style={{ marginRight: 3, verticalAlign: -1 }} />
    : <TrendingDown size={10} style={{ marginRight: 3, verticalAlign: -1 }} />;
}

interface MonthRow {
  mes: number;
  label: string;
  data: PickupMensalKpi | null;
  alteracoesDiarias: number | null;
}

interface Props {
  hotelId: number;
  pickupRows?: PickupRow[];
}

export default function PickupMensalTable({ hotelId }: Props) {
  const [ano, setAno] = useState(new Date().getFullYear());
  const { rows, loading, error } = usePickupMensalKpis(hotelId, ano);

  const rowsByMes = useMemo(() => new Map(rows.map(r => [r.mes, r])), [rows]);
  const monthRows = useMemo<MonthRow[]>(() => (
    MES_PT.map((label, idx) => {
      const mes = idx + 1;
      const data = rowsByMes.get(mes) ?? null;
      const alteracoesDiarias = data == null
        ? null
        : data.alteracoesDiariasMes;

      return {
        mes,
        label,
        data,
        alteracoesDiarias,
      };
    })
  ), [rowsByMes]);

  const totals = useMemo(() => ({
    pickupReceita: rows.reduce((sum, row) => sum + row.pickupReceita, 0),
    pickupUhs: rows.reduce((sum, row) => sum + row.pickupUhs, 0),
    alteracoes: monthRows.reduce((sum, row) => sum + (row.alteracoesDiarias ?? 0), 0),
    receitaReal: rows.reduce((sum, row) => sum + row.receitaReal, 0),
  }), [monthRows, rows]);

  const hotelNome = rows[0]?.hotelNome;

  const th: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-m)',
    background: 'var(--surface-h)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    borderBottom: '1px solid var(--border)',
  };

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>Pickup Mensal</span>
          <span style={{ fontSize: 11, color: 'var(--text-m)', marginLeft: 8 }}>
            {hotelNome ? `${hotelNome} · ${rows.length} meses com dados` : 'ano completo por meses disponiveis'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setAno(prev => prev - 1)}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 'var(--rx)', background: 'transparent' }}
          >
            <ChevronLeft size={14} style={{ color: 'var(--text-m)' }} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 54, textAlign: 'center' }}>
            {ano}
          </span>
          <button
            onClick={() => setAno(prev => prev + 1)}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 'var(--rx)', background: 'transparent' }}
          >
            <ChevronRight size={14} style={{ color: 'var(--text-m)' }} />
          </button>
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div style={{
          background: 'var(--bg)',
          borderBottom: '1px solid var(--border-l)',
          display: 'flex',
          overflowX: 'auto',
        }}>
          <SummaryMetric
            label="Pickup Receita"
            value={fmtSignedBRL(totals.pickupReceita)}
            tone={summaryTone(totals.pickupReceita)}
            icon={<DollarSign size={14} />}
          />
          <SummaryMetric
            label="Pickup UHs"
            value={fmtSignedNum(totals.pickupUhs)}
            tone={summaryTone(totals.pickupUhs)}
            icon={<BedDouble size={14} />}
          />
          <SummaryMetric
            label="Alterações diárias"
            value={fmtNum(totals.alteracoes)}
            tone={totals.alteracoes > 0 ? 'change' : 'muted'}
            icon={<CalendarRange size={14} />}
          />
          <SummaryMetric
            label="Receita Real"
            value={fmtBRL(totals.receitaReal)}
            tone="accent"
            icon={<Percent size={14} />}
          />
        </div>
      )}

      {loading ? (
        <div style={{ overflowX: 'auto', overflowY: 'hidden', maxHeight: 520 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12, minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', minWidth: 94 }}>Mes</th>
                <th style={{ ...th, textAlign: 'right' }}>Meta</th>
                <th style={{ ...th, textAlign: 'right' }}>Real</th>
                <th style={{ ...th, textAlign: 'right' }}>R x M</th>
                <th style={{ ...th, textAlign: 'right' }}>%</th>
                <th style={{ ...th, textAlign: 'right' }}>MoM</th>
                <th style={{ ...th, textAlign: 'right' }}>Pickup R$</th>
                <th style={{ ...th, textAlign: 'right' }}>Pickup UH</th>
                <th style={{ ...th, textAlign: 'right' }}>Occ</th>
                <th
                  style={{ ...th, textAlign: 'center' }}
                  title="Linhas do pick-up diário com alteração, considerando extração e referência dentro do mesmo mês."
                >
                  Alt. diárias
                </th>
              </tr>
            </thead>
            <tbody>
              <PickupMensalSkeletonRows />
            </tbody>
          </table>
        </div>
      ) : error ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-m)', fontSize: 12 }}>
          Nenhum dado de pickup mensal encontrado para {ano}.
        </div>
      ) : (
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 520 }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 3, fontSize: 12, minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', minWidth: 94 }}>Mes</th>
                <th style={{ ...th, textAlign: 'right' }}>Meta</th>
                <th style={{ ...th, textAlign: 'right' }}>Real</th>
                <th style={{ ...th, textAlign: 'right' }}>R x M</th>
                <th style={{ ...th, textAlign: 'right' }}>%</th>
                <th style={{ ...th, textAlign: 'right' }}>MoM</th>
                <th style={{ ...th, textAlign: 'right' }}>Pickup R$</th>
                <th style={{ ...th, textAlign: 'right' }}>Pickup UH</th>
                <th style={{ ...th, textAlign: 'right' }}>Occ</th>
                <th
                  style={{ ...th, textAlign: 'center' }}
                  title="Linhas do pick-up diário com alteração, considerando extração e referência dentro do mesmo mês."
                >
                  Alt. diárias
                </th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map(({ mes, label, data, alteracoesDiarias }) => {
                const hasData = data != null;
                const metaTone: Tone = data?.receitaMeta == null ? 'muted' : 'neutral';
                const realTone: Tone = !hasData ? 'muted' : data.receitaReal > 0 ? 'positive' : 'muted';
                const changeTone: Tone = alteracoesDiarias != null && alteracoesDiarias > 0 ? 'change' : 'muted';

                return (
                  <tr key={mes}>
                    <td style={{
                      padding: '8px 10px',
                      fontSize: 12,
                      fontWeight: 800,
                      color: hasData ? 'var(--text)' : 'var(--text-m)',
                      background: hasData ? 'var(--surface)' : 'var(--bg)',
                      border: '1px solid var(--border-l)',
                      whiteSpace: 'nowrap',
                    }}>
                      <span style={{ display: 'inline-block', minWidth: 28 }}>{label}</span>
                      {data?.ultimaExtracao && (
                        <span style={{ marginLeft: 8, fontSize: 9.5, fontWeight: 700, color: 'var(--text-m)' }}>
                          ext. {data.ultimaExtracao.slice(8, 10)}/{data.ultimaExtracao.slice(5, 7)}
                        </span>
                      )}
                    </td>
                    <td style={cellStyle(metaTone)}>{data?.receitaMeta != null ? fmtBRL(data.receitaMeta) : '--'}</td>
                    <td style={cellStyle(realTone)}>{data ? fmtBRL(data.receitaReal) : '--'}</td>
                    <td style={cellStyle(deltaTone(data?.receitaVsMeta ?? null))}>
                      <TrendIcon value={data?.receitaVsMeta ?? null} />
                      {fmtSignedBRL(data?.receitaVsMeta ?? null)}
                    </td>
                    <td style={cellStyle(achievementTone(data?.receitaMetaPct ?? null))}>
                      {fmtPct(data?.receitaMetaPct ?? null)}
                    </td>
                    <td style={cellStyle(deltaTone(data?.receitaMom ?? null))}>
                      <TrendIcon value={data?.receitaMom ?? null} />
                      {fmtSignedBRL(data?.receitaMom ?? null)}
                    </td>
                    <td style={cellStyle(deltaTone(data?.pickupReceita ?? null))}>
                      <TrendIcon value={data?.pickupReceita ?? null} />
                      {fmtSignedBRL(data?.pickupReceita ?? null)}
                    </td>
                    <td style={cellStyle(deltaTone(data?.pickupUhs ?? null))}>
                      <TrendIcon value={data?.pickupUhs ?? null} />
                      {fmtSignedNum(data?.pickupUhs ?? null)}
                    </td>
                    <td style={cellStyle(data ? 'accent' : 'muted')}>
                      {fmtPp(data?.pickupOccMediaPp ?? null)}
                    </td>
                    <td style={cellStyle(changeTone, 'center')}>
                      {alteracoesDiarias != null ? alteracoesDiarias : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
