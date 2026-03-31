import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { KpiDiario } from '@/data/types';

interface KpiTableProps {
  data: KpiDiario[];
  allData: KpiDiario[];
}

function formatDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

function formatR$(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function occColor(occ: number): string {
  if (occ >= 80) return 'var(--green)';
  if (occ >= 50) return 'var(--accent)';
  if (occ >= 25) return 'var(--amber)';
  return 'var(--red)';
}

function deltaColor(v: number | null): string {
  if (v === null) return 'var(--text-m)';
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-m)';
}

function formatDelta(v: number | null, suffix = ''): string {
  if (v === null) return '—';
  const sign = v > 0 ? '+' : '';
  if (suffix === 'pp') return `${sign}${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix}`;
  return `${sign}${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface AuditRow {
  date: string;
  latest: KpiDiario;
  deltaRec: number | null;
  deltaOcc: number | null;
  deltaRevpar: number | null;
  extractionCount: number;
}

const cellStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '7px 8px',
  borderBottom: '1px solid var(--border-l)',
  fontFamily: 'var(--mono)',
  ...extra,
});

export default function KpiTable({ data, allData }: KpiTableProps) {
  const extractionDates = useMemo(() =>
    [...new Set(allData.map(k => k.dataExtracao))].sort(),
    [allData]
  );

  const hasMultipleExtractions = extractionDates.length > 1;

  // Build audit rows with deltas between latest and previous extraction
  const auditRows: AuditRow[] = useMemo(() => {
    if (!hasMultipleExtractions) return [];
    const byRef = new Map<string, KpiDiario[]>();
    for (const k of allData) {
      const list = byRef.get(k.date) ?? [];
      list.push(k);
      byRef.set(k.date, list);
    }
    return [...byRef.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([refDate, rows]) => {
        rows.sort((a, b) => a.dataExtracao.localeCompare(b.dataExtracao));
        const latest = rows[rows.length - 1];
        const prev = rows.length > 1 ? rows[rows.length - 2] : null;
        return {
          date: refDate,
          latest,
          deltaRec: prev ? latest.recTotal - prev.recTotal : null,
          deltaOcc: prev ? latest.occPct - prev.occPct : null,
          deltaRevpar: prev ? latest.revpar - prev.revpar : null,
          extractionCount: rows.length,
        };
      });
  }, [allData, hasMultipleExtractions]);

  // Consolidated deltas
  const consolidated = useMemo(() => {
    if (!hasMultipleExtractions) return null;
    const withDeltas = auditRows.filter(r => r.deltaRec !== null);
    if (withDeltas.length === 0) return null;
    const n = withDeltas.length;
    return {
      avgDeltaRec: withDeltas.reduce((s, r) => s + (r.deltaRec ?? 0), 0) / n,
      totalDeltaRec: withDeltas.reduce((s, r) => s + (r.deltaRec ?? 0), 0),
      avgDeltaOcc: withDeltas.reduce((s, r) => s + (r.deltaOcc ?? 0), 0) / n,
      avgDeltaRevpar: withDeltas.reduce((s, r) => s + (r.deltaRevpar ?? 0), 0) / n,
      count: n,
    };
  }, [auditRows, hasMultipleExtractions]);

  const displayCount = hasMultipleExtractions ? auditRows.length : data.length;

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
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>Auditoria Diária</h3>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-m)' }}>
          {displayCount} dias · {extractionDates.length} extração{extractionDates.length !== 1 ? 'ões' : ''}
        </p>
      </div>

      {!hasMultipleExtractions && (
        <div className="flex items-center gap-2 rounded-[var(--rs)] mb-4" style={{ background: 'var(--amber-l)', padding: '10px 14px' }}>
          <AlertTriangle size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <p className="text-[12px]" style={{ color: 'var(--text-s)' }}>
            Apenas 1 data de extração disponível. São necessárias múltiplas extrações para analisar flutuações entre coletas.
          </p>
        </div>
      )}

      <div
        className="overflow-y-auto"
        style={{ maxHeight: '460px', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
            <tr>
              {(hasMultipleExtractions
                ? ['Data', 'Rec. Total', 'Δ Rec', 'Occ%', 'Δ OCC', 'RevPAR', 'Δ RevPAR', 'ADR', 'Ocup.', 'PAX']
                : ['Data', 'Rec. Total', 'Rec. Diárias', 'Rec. A&B', 'Occ%', 'Ocup.', 'Cort.', 'RevPAR', 'ADR', 'PAX']
              ).map(h => (
                <th
                  key={h}
                  className="text-left font-semibold uppercase"
                  style={{
                    padding: '7px 8px',
                    fontSize: '10px',
                    color: h.startsWith('Δ') ? 'var(--accent)' : 'var(--text-m)',
                    letterSpacing: '0.4px',
                    borderBottom: '2px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasMultipleExtractions ? (
              auditRows.map(row => (
                <tr key={row.date} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={cellStyle({ fontWeight: 500 })}>{formatDate(row.date)}</td>
                  <td style={cellStyle()}>{formatR$(row.latest.recTotal)}</td>
                  <td style={cellStyle({ fontSize: '11px', color: deltaColor(row.deltaRec) })}>{formatDelta(row.deltaRec)}</td>
                  <td style={cellStyle({ fontWeight: 600, color: occColor(row.latest.occPct) })}>{row.latest.occPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td>
                  <td style={cellStyle({ fontSize: '11px', color: deltaColor(row.deltaOcc) })}>{formatDelta(row.deltaOcc, 'pp')}</td>
                  <td style={cellStyle({ fontWeight: 600, color: 'var(--accent-d)' })}>{formatR$(row.latest.revpar)}</td>
                  <td style={cellStyle({ fontSize: '11px', color: deltaColor(row.deltaRevpar) })}>{formatDelta(row.deltaRevpar)}</td>
                  <td style={cellStyle()}>{row.latest.adr != null ? formatR$(row.latest.adr) : '—'}</td>
                  <td style={cellStyle({ textAlign: 'center' })}>{row.latest.ocupados}</td>
                  <td style={cellStyle({ color: 'var(--text-m)', textAlign: 'center' })}>{row.latest.pax ?? '—'}</td>
                </tr>
              ))
            ) : (
              data.map(k => (
                <tr key={k.id} style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={cellStyle({ fontWeight: 500 })}>{formatDate(k.date)}</td>
                  <td style={cellStyle()}>{formatR$(k.recTotal)}</td>
                  <td style={cellStyle()}>{formatR$(k.recDiarias)}</td>
                  <td style={cellStyle({ color: 'var(--text-m)' })}>{formatR$(k.recAb)}</td>
                  <td style={cellStyle({ fontWeight: 600, color: occColor(k.occPct) })}>{k.occPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</td>
                  <td style={cellStyle({ textAlign: 'center' })}>{k.ocupados}</td>
                  <td style={cellStyle({ textAlign: 'center', color: k.cortesia > 0 ? 'var(--amber)' : 'var(--text-m)' })}>{k.cortesia}</td>
                  <td style={cellStyle({ fontWeight: 600, color: 'var(--accent-d)' })}>{formatR$(k.revpar)}</td>
                  <td style={cellStyle()}>{k.adr != null ? formatR$(k.adr) : '—'}</td>
                  <td style={cellStyle({ color: 'var(--text-m)', textAlign: 'center' })}>{k.pax ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {consolidated && (
        <div className="grid grid-cols-4 gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
          {[
            { label: 'Δ Receita Média', value: formatDelta(consolidated.avgDeltaRec), color: deltaColor(consolidated.avgDeltaRec) },
            { label: 'Δ Receita Total', value: formatDelta(consolidated.totalDeltaRec), color: deltaColor(consolidated.totalDeltaRec) },
            { label: 'Δ OCC Média', value: formatDelta(consolidated.avgDeltaOcc, 'pp'), color: deltaColor(consolidated.avgDeltaOcc) },
            { label: 'Δ RevPAR Médio', value: formatDelta(consolidated.avgDeltaRevpar), color: deltaColor(consolidated.avgDeltaRevpar) },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-m)', letterSpacing: '0.3px' }}>{item.label}</p>
              <p className="text-sm font-bold mt-1" style={{ color: item.color, fontFamily: 'var(--mono)' }}>{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
