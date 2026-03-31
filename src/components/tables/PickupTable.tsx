import { useMemo } from 'react';
import type { PickupRow } from '@/data/types';

interface PickupTableProps {
  data: PickupRow[];
  selectedMonths: string[];
}

function formatDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${day}/${m}`;
}

function fmtR$(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function deltaColor(v: number): string {
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-m)';
}

function fmtDelta(v: number, prefix = '', suffix = ''): string {
  if (v === 0) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${prefix}${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
}

function fmtDeltaInt(v: number): string {
  if (v === 0) return '—';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v}`;
}

function occColor(occ: number): string {
  if (occ >= 80) return 'var(--green)';
  if (occ >= 50) return 'var(--accent)';
  if (occ >= 25) return 'var(--amber)';
  return 'var(--red)';
}

const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 7px',
  borderBottom: '1px solid var(--border-l)',
  fontFamily: 'var(--mono)',
  whiteSpace: 'nowrap',
  ...extra,
});

const puHeader: React.CSSProperties = {
  padding: '6px 7px',
  fontSize: '9px',
  fontWeight: 600,
  color: 'var(--accent)',
  letterSpacing: '0.3px',
  borderBottom: '2px solid var(--border)',
  whiteSpace: 'nowrap',
  textAlign: 'left',
};

const snapHeader: React.CSSProperties = {
  ...puHeader,
  color: 'var(--text-m)',
};

export default function PickupTable({ data, selectedMonths }: PickupTableProps) {
  const filtered = useMemo(() => {
    if (selectedMonths.length === 0) return data;
    return data.filter(r => selectedMonths.includes(r.data_referencia.slice(0, 7)));
  }, [data, selectedMonths]);

  const hasPickup = useMemo(
    () => filtered.some(r => r.data_extracao_ant !== null),
    [filtered],
  );

  return (
    <div
      className="card-in"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '20px',
        animationDelay: '0.2s',
      }}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>Pick-Up Diário</h3>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-m)' }}>
          {filtered.length} dias
          {hasPickup ? ' · comparação entre extrações' : ' · 1 extração (pick-ups indisponíveis)'}
        </p>
      </div>

      <div
        className="overflow-x-auto overflow-y-auto"
        style={{ maxHeight: '460px', scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
          <thead className="sticky top-0" style={{ background: 'var(--surface)' }}>
            <tr>
              <th style={snapHeader}>EVENTOS</th>
              {/* Pick-up columns */}
              <th style={puHeader}>PU TT UH</th>
              <th style={puHeader}>PU REC HOSP</th>
              <th style={puHeader}>PU DM TT</th>
              <th style={puHeader}>PU OCC%</th>
              <th style={puHeader}>PU REVPAR</th>
              {/* Snapshot columns */}
              <th style={snapHeader}>TT UHS OCUP</th>
              <th style={snapHeader}>REC HOSP</th>
              <th style={snapHeader}>DM C/C TT</th>
              <th style={snapHeader}>OCC% TT</th>
              <th style={snapHeader}>REVP TT</th>
              <th style={snapHeader}>TT HOSP</th>
              <th style={snapHeader}>CHDS</th>
              <th style={snapHeader}>UHS DISP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => {
              const puRecHosp = parseFloat(r.pu_rec_hosp) || 0;
              const puDm = parseFloat(r.pu_dm_tt) || 0;
              const puOcc = parseFloat(r.pu_occ_tt) || 0;
              const puRevpar = parseFloat(r.pu_revpar_tt) || 0;
              const occTt = parseFloat(r.occ_tt) || 0;

              return (
                <tr
                  key={r.data_referencia}
                  style={{ transition: 'background 0.15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={cell({ fontWeight: 500 })}>{formatDate(r.data_referencia)}</td>
                  {/* Pick-ups */}
                  <td style={cell({ color: deltaColor(r.pu_tt_uh), fontSize: '10px' })}>{fmtDeltaInt(r.pu_tt_uh)}</td>
                  <td style={cell({ color: deltaColor(puRecHosp), fontSize: '10px' })}>{fmtDelta(puRecHosp)}</td>
                  <td style={cell({ color: deltaColor(puDm), fontSize: '10px' })}>{fmtDelta(puDm)}</td>
                  <td style={cell({ color: deltaColor(puOcc), fontSize: '10px' })}>{fmtDelta(puOcc, '', 'pp')}</td>
                  <td style={cell({ color: deltaColor(puRevpar), fontSize: '10px' })}>{fmtDelta(puRevpar)}</td>
                  {/* Snapshot */}
                  <td style={cell({ textAlign: 'center' })}>{r.tt_uhs_ocup}</td>
                  <td style={cell()}>{fmtR$(parseFloat(r.rec_hosp) || 0)}</td>
                  <td style={cell()}>{fmtR$(parseFloat(r.dm_cc_tt) || 0)}</td>
                  <td style={cell({ fontWeight: 600, color: occColor(occTt) })}>{fmtPct(occTt)}%</td>
                  <td style={cell({ fontWeight: 600, color: 'var(--accent-d)' })}>{fmtR$(parseFloat(r.revp_tt) || 0)}</td>
                  <td style={cell({ textAlign: 'center', color: 'var(--text-m)' })}>{r.tt_hosp ?? '—'}</td>
                  <td style={cell({ textAlign: 'center', color: 'var(--text-m)' })}>{r.chds ?? '—'}</td>
                  <td style={cell({ textAlign: 'center' })}>{r.uhs_disp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
