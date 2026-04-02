import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, BedDouble } from 'lucide-react';
import type { PickupAcumuladoRow } from '@/hooks/useSupabase';

// ─── Helpers ─────────────────────────────────────────────────────────

const MES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIA_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  return {
    dd:  String(d.getDate()).padStart(2, '0'),
    mes: MES_PT[d.getMonth()],
    dia: DIA_PT[d.getDay()],
  };
}

function fmtBRL(v: number, compact = false): string {
  if (compact) {
    if (Math.abs(v) >= 1_000_000) return `R$${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
    if (Math.abs(v) >= 1_000)     return `R$${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  }
  return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }

function occColor(v: number) {
  if (v >= 80) return 'var(--green)';
  if (v >= 55) return 'var(--accent)';
  if (v >= 30) return 'var(--amber)';
  return 'var(--red)';
}

function deltaColor(v: number) {
  if (v > 0) return 'var(--green)';
  if (v < 0) return 'var(--red)';
  return 'var(--text-m)';
}

function DeltaIcon({ v }: { v: number }) {
  const size = 10;
  if (v > 0) return <TrendingUp size={size} style={{ color: 'var(--green)', flexShrink: 0 }} />;
  if (v < 0) return <TrendingDown size={size} style={{ color: 'var(--red)', flexShrink: 0 }} />;
  return <Minus size={size} style={{ color: 'var(--text-m)', flexShrink: 0 }} />;
}

function DeltaCell({ v, fmt }: { v: number; fmt: (n: number) => string }) {
  if (v === 0) return <span style={{ color: 'var(--text-m)' }}>—</span>;
  return (
    <span style={{ color: deltaColor(v), display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
      <DeltaIcon v={v} />
      {v > 0 ? '+' : ''}{fmt(v)}
    </span>
  );
}

// ─── Month group header ────────────────────────────────────────────────

interface GroupHeaderProps {
  mesAno: string;
  rows:   PickupAcumuladoRow[];
}

function GroupHeader({ mesAno, rows }: GroupHeaderProps) {
  const [y, m] = mesAno.split('-').map(Number);
  const label  = `${MES_PT[m - 1]} ${y}`;
  const totalDias = rows.length;

  // Use last row (latest data_referencia) for cumulative snapshot
  const latest = rows[rows.length - 1];

  return (
    <tr>
      <td colSpan={9} style={{
        background: 'var(--accent)',
        padding: '6px 14px',
        color: '#fff',
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>{label}</span>
          <span style={{ opacity: 0.8, fontWeight: 400 }}>{totalDias} dias com dados</span>
          {latest && (
            <>
              <span style={{ opacity: 0.7 }}>·</span>
              <span style={{ opacity: 0.85, fontWeight: 400 }}>
                Pickup acum.: <strong>+{latest.pickupUhsAcumulado} UHs</strong>
                {' · '}
                <strong>{fmtBRL(latest.pickupReceitaAcumulado, true)}</strong>
              </span>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

function DataRow({ row }: { row: PickupAcumuladoRow }) {
  const { dd, mes, dia } = fmtDate(row.dataReferencia);
  const isFuture   = row.dataReferencia > TODAY;
  const isWeekend  = new Date(row.dataReferencia + 'T00:00:00').getDay() % 6 === 0;
  const rowOpacity = isFuture ? 0.55 : 1;

  const occBar = Math.min(100, row.occPct);

  return (
    <tr style={{ opacity: rowOpacity, borderBottom: '1px solid var(--border)' }}>
      {/* Data */}
      <td style={{ padding: '7px 14px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontWeight: 700, fontSize: 13, color: isFuture ? 'var(--accent)' : 'var(--text)' }}>
            {dd}/{mes}
          </span>
          <span style={{
            fontSize: 10,
            color: isWeekend ? 'var(--amber)' : 'var(--text-m)',
            fontWeight: isWeekend ? 600 : 400,
          }}>
            {dia}
          </span>
          {isFuture && (
            <span style={{
              fontSize: 9, background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)',
              borderRadius: 3, padding: '1px 4px', fontWeight: 700, letterSpacing: '0.04em',
            }}>FUTURO</span>
          )}
        </div>
      </td>

      {/* UHs Ocup / Total */}
      <td style={{ padding: '7px 10px', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          <BedDouble size={11} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
            {row.uhsOcupadas}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-m)' }}>/ {row.uhsTotal}</span>
        </div>
      </td>

      {/* Occ% with mini bar */}
      <td style={{ padding: '7px 10px', textAlign: 'center', minWidth: 72 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: occColor(row.occPct), marginBottom: 2 }}>
          {fmtPct(row.occPct)}
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${occBar}%`, background: occColor(row.occPct), borderRadius: 2 }} />
        </div>
      </td>

      {/* Receita Total */}
      <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text)' }}>
        {fmtBRL(row.recTotal, true)}
      </td>

      {/* ADR */}
      <td style={{ padding: '7px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: 'var(--text-m)' }}>
        {fmtBRL(row.adr, false)}
      </td>

      {/* Pickup UHs dia | acum */}
      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
          <DeltaCell v={row.pickupUhsDia} fmt={n => String(Math.abs(n))} />
          <span style={{
            fontSize: 10, color: row.pickupUhsAcumulado > 0 ? 'var(--green)' : row.pickupUhsAcumulado < 0 ? 'var(--red)' : 'var(--text-m)',
            fontWeight: 700,
          }}>
            {row.pickupUhsAcumulado > 0 ? '+' : ''}{row.pickupUhsAcumulado} acum.
          </span>
        </div>
      </td>

      {/* Pickup Receita dia | acum */}
      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-end' }}>
          <DeltaCell v={row.pickupReceitaDia} fmt={n => fmtBRL(Math.abs(n), true)} />
          <span style={{
            fontSize: 10,
            color: row.pickupReceitaAcumulado > 0 ? 'var(--green)' : row.pickupReceitaAcumulado < 0 ? 'var(--red)' : 'var(--text-m)',
            fontWeight: 700,
          }}>
            {row.pickupReceitaAcumulado > 0 ? '+' : ''}{fmtBRL(row.pickupReceitaAcumulado, true)} acum.
          </span>
        </div>
      </td>

      {/* Snapshots badge */}
      <td style={{ padding: '7px 14px', textAlign: 'center' }}>
        <span style={{
          fontSize: 10, borderRadius: 4, padding: '1px 5px',
          background: 'var(--surface-2)', color: 'var(--text-m)', fontVariantNumeric: 'tabular-nums',
        }}>
          {row.totalSnapshots}
        </span>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────

interface Props {
  rows:          PickupAcumuladoRow[];
  selectedMeses: string[];
  loading:       boolean;
}

export default function PickupAcumuladoTable({ rows, selectedMeses, loading }: Props) {
  // Group rows by YYYY-MM, preserving selectedMeses order
  const groups = useMemo<Array<{ mesAno: string; rows: PickupAcumuladoRow[] }>>(() => {
    const byMonth = new Map<string, PickupAcumuladoRow[]>();
    for (const r of rows) {
      const m = r.dataReferencia.slice(0, 7);
      const arr = byMonth.get(m) ?? [];
      arr.push(r);
      byMonth.set(m, arr);
    }
    const ordered = [...selectedMeses].sort();
    return ordered
      .filter(m => byMonth.has(m))
      .map(m => ({ mesAno: m, rows: byMonth.get(m)! }));
  }, [rows, selectedMeses]);

  const card: React.CSSProperties = {
    background:   'var(--surface)',
    border:       '1px solid var(--border)',
    borderRadius: 12,
    overflow:     'hidden',
  };

  const thStyle: React.CSSProperties = {
    padding: '8px 10px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'var(--text-m)',
    background: 'var(--surface-2)',
    whiteSpace: 'nowrap',
  };

  if (loading) {
    return (
      <div style={card}>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-m)', fontSize: 13 }}>
          Carregando pickup acumulado…
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div style={card}>
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-m)', fontSize: 13 }}>
          Nenhum dado de pickup acumulado para o período selecionado.
        </div>
      </div>
    );
  }

  return (
    <div style={card}>
      {/* Header */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Pickup Acumulado</span>
        <span style={{ fontSize: 11, color: 'var(--text-m)', marginLeft: 2 }}>
          — visão dia a dia por extração mais recente
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left',   paddingLeft: 14  }}>Data</th>
              <th style={{ ...thStyle, textAlign: 'center'                   }}>UHs Ocup.</th>
              <th style={{ ...thStyle, textAlign: 'center'                   }}>Occ%</th>
              <th style={{ ...thStyle, textAlign: 'right'                    }}>Receita</th>
              <th style={{ ...thStyle, textAlign: 'right'                    }}>ADR</th>
              <th style={{ ...thStyle, textAlign: 'right'                    }}>Pickup UHs</th>
              <th style={{ ...thStyle, textAlign: 'right'                    }}>Pickup Rec.</th>
              <th style={{ ...thStyle, textAlign: 'center', paddingRight: 14 }}>Fotos</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.mesAno}>
                <GroupHeader mesAno={g.mesAno} rows={g.rows} />
                {g.rows.map(r => (
                  <DataRow key={r.dataReferencia} row={r} />
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
