import { useState, useEffect, useRef, useMemo } from 'react';
import { useHotels, useHotelMetas, useHotelsMonthly, useAllMetas, usePickupSummary, saveHotelMeta } from '@/hooks/useSupabase';
import type { MonthlyKpi, PickupSummary } from '@/hooks/useSupabase';
import { Target, ChevronLeft, ChevronRight, Check, Loader2, DollarSign, TrendingUp, TrendingDown, BedDouble, BarChart3, Percent, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { HotelSummary, HotelMeta } from '@/data/types';

// ─── Helpers ──────────────────────────────────────────────────────────

const ok = (v: unknown): v is number => typeof v === 'number' && isFinite(v) && !isNaN(v);

const fmtR = (v: number | null) => {
  if (!ok(v)) return '—';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000)     return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
};
const fmtRFull = (v: number | null) => {
  if (!ok(v)) return '—';
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
};
const fmtPct = (v: number | null) => ok(v) ? `${v.toFixed(1)}%` : '—';
const fmtN   = (v: number | null) => ok(v) ? v.toLocaleString('pt-BR') : '—';

const ach = (actual: number, meta: number | null): number | null => {
  if (!ok(meta) || meta <= 0 || !ok(actual)) return null;
  return (actual / meta) * 100;
};
const achColor = (pct: number) =>
  pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--gold)' : 'var(--red)';
const achBg = (pct: number) =>
  pct >= 90 ? 'var(--green-l)' : pct >= 70 ? 'color-mix(in srgb,var(--gold) 15%,transparent)' : 'var(--red-l)';

function buildMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = -3; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}
const MONTHS = buildMonths();

const MES_PT: Record<string, string> = {
  '01':'Jan','02':'Fev','03':'Mar','04':'Abr',
  '05':'Mai','06':'Jun','07':'Jul','08':'Ago',
  '09':'Set','10':'Out','11':'Nov','12':'Dez',
};
const fmtMes = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_PT[m]} ${y}`; };
const fmtMesShort = (ym: string) => { const [y, m] = ym.split('-'); return `${MES_PT[m]}/${y.slice(2)}`; };

// ─── Forecast computation ─────────────────────────────────────────────

interface ForecastData {
  recMtd: number;
  ocupMtd: number;
  diasMtd: number;
  occMtd: number;
  dmMtd: number;
  revparMtd: number;
  recForecast: number;
  ocupForecast: number;
  occForecast: number;
  dmForecast: number;
  revparForecast: number;
  recStly: number;
  occStly: number;
  dmStly: number | null;
  revparStly: number | null;
  recYoy: number | null;
  occYoy: number | null;
  dmYoy: number | null;
  revparYoy: number | null;
  diasNoMes: number;
  diasRestantes: number;
}

function computeForecast(
  hotel: HotelSummary,
  monthlyStly: MonthlyKpi | undefined,
  monthlyActual: MonthlyKpi | undefined,
  mesAno: string,
): ForecastData {
  const [y, mo] = mesAno.split('-').map(Number);
  const diasNoMes = new Date(y, mo, 0).getDate();
  const uhs = hotel.uhs;
  const totalRoomNights = uhs * diasNoMes;

  const now = new Date();
  const currYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const isCurrent = mesAno === currYm;
  const isPast = mesAno < currYm;

  // For current month, use summary data; for other months, use monthly view
  let recMtd: number, ocupMtd: number, diasMtd: number;
  if (isCurrent) {
    recMtd = hotel.receitaMesAtual;
    ocupMtd = hotel.ocupadosMesAtual;
    diasMtd = hotel.diasMesAtual;
  } else if (monthlyActual) {
    recMtd = monthlyActual.receita;
    ocupMtd = monthlyActual.ocupados;
    diasMtd = monthlyActual.dias;
  } else {
    recMtd = 0; ocupMtd = 0; diasMtd = 0;
  }

  const occMtd = diasMtd > 0 && uhs > 0 ? (ocupMtd / (uhs * diasMtd)) * 100 : 0;
  const dmMtd  = ocupMtd > 0 ? recMtd / ocupMtd : 0;
  const revparMtd = diasMtd > 0 && uhs > 0 ? recMtd / (uhs * diasMtd) : 0;

  // STLY data
  const recStly = monthlyStly?.receita ?? 0;
  const ocupStly = monthlyStly?.ocupados ?? 0;
  const diasStly = monthlyStly?.dias ?? 0;
  const occStly = monthlyStly?.occ ?? 0;
  const dmStly  = monthlyStly?.dm ?? null;
  const revparStly = monthlyStly?.revpar ?? null;

  // Forecast
  let recForecast: number, ocupForecast: number;
  const diasRestantes = Math.max(0, diasNoMes - diasMtd);

  if (isPast || diasRestantes === 0) {
    // Month closed — forecast = actual
    recForecast  = recMtd;
    ocupForecast = ocupMtd;
  } else if (diasStly > 0 && recStly > 0) {
    // Extrapolate using STLY daily average for remaining days
    const stlyRecPerDay  = recStly / diasStly;
    const stlyOcupPerDay = ocupStly / diasStly;
    recForecast  = recMtd + stlyRecPerDay  * diasRestantes;
    ocupForecast = ocupMtd + stlyOcupPerDay * diasRestantes;
  } else {
    // No STLY — extrapolate from own MTD average
    if (diasMtd > 0) {
      recForecast  = (recMtd / diasMtd) * diasNoMes;
      ocupForecast = (ocupMtd / diasMtd) * diasNoMes;
    } else {
      recForecast = 0; ocupForecast = 0;
    }
  }

  const occForecast = totalRoomNights > 0 ? (ocupForecast / totalRoomNights) * 100 : 0;
  const dmForecast  = ocupForecast > 0 ? recForecast / ocupForecast : 0;
  const revparForecast = totalRoomNights > 0 ? recForecast / totalRoomNights : 0;

  // YoY deltas
  const recYoy     = recStly > 0 ? ((recForecast - recStly) / recStly) * 100 : null;
  const occYoy     = occStly > 0 ? occForecast - occStly : null;
  const dmYoy      = ok(dmStly) && dmStly > 0 ? ((dmForecast - dmStly) / dmStly) * 100 : null;
  const revparYoy  = ok(revparStly) && revparStly > 0 ? ((revparForecast - revparStly) / revparStly) * 100 : null;

  return {
    recMtd, ocupMtd, diasMtd, occMtd, dmMtd, revparMtd,
    recForecast, ocupForecast, occForecast, dmForecast, revparForecast,
    recStly, occStly, dmStly, revparStly,
    recYoy, occYoy, dmYoy, revparYoy,
    diasNoMes, diasRestantes,
  };
}

// ─── Forecast Card (2x2 grid item) ──────────────────────────────────

interface ForecastCardProps {
  label: string;
  icon: React.ReactNode;
  forecastValue: number;
  forecastFormatted: string;
  metaValue: string;
  onMetaChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  achPct: number | null;
  yoyPct: number | null;
  yoyLabel?: string;
  gapFormatted: string | null;
  mtdFormatted: string;
}

function ForecastCard({
  label, icon, forecastValue, forecastFormatted,
  metaValue, onMetaChange, prefix, suffix,
  achPct, yoyPct, yoyLabel, gapFormatted, mtdFormatted,
}: ForecastCardProps) {
  return (
    <div style={{
      padding: '14px', background: 'var(--bg)', borderRadius: 'var(--rx)',
      border: '1px solid var(--border-l)', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--accent)' }}>{icon}</span>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-m)' }}>
            {label}
          </span>
        </div>
        {ok(achPct) && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: achColor(achPct),
            background: achBg(achPct), borderRadius: 99, padding: '1px 7px',
          }}>
            {achPct.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Forecast (big number) */}
      <div style={{
        fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px',
        color: 'var(--text)', fontFamily: 'var(--mono)', lineHeight: 1.1,
      }}>
        {forecastFormatted}
      </div>
      <div style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: -4 }}>
        Forecast
      </div>

      {/* Achievement bar */}
      {ok(achPct) && (
        <div style={{ height: 3, background: 'var(--border-l)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${Math.min(achPct, 100)}%`,
            background: achColor(achPct), borderRadius: 99, transition: 'width .4s ease',
          }} />
        </div>
      )}

      {/* Meta input (compact) */}
      <div className="flex items-center gap-1"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rx)', padding: '0 8px' }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-m)', flexShrink: 0 }}>META</span>
        {prefix && <span style={{ fontSize: 11, color: 'var(--text-m)', fontWeight: 600, flexShrink: 0 }}>{prefix}</span>}
        <input type="number" min={0} value={metaValue} onChange={e => onMetaChange(e.target.value)}
          placeholder="—"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)',
            padding: '6px 0', minWidth: 0,
          }} />
        {suffix && <span style={{ fontSize: 11, color: 'var(--text-m)', fontWeight: 600, flexShrink: 0 }}>{suffix}</span>}
      </div>

      {/* Sub-metrics */}
      <div style={{ display: 'flex', gap: 6, fontSize: 10.5 }}>
        {/* MTD */}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-m)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>MTD</div>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--mono)' }}>{mtdFormatted}</div>
        </div>
        {/* vs LY */}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-m)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>vs LY</div>
          {ok(yoyPct) ? (
            <div className="flex items-center gap-0.5" style={{
              fontWeight: 700, fontFamily: 'var(--mono)',
              color: yoyPct >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {yoyPct >= 0 ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
              {yoyPct >= 0 ? '+' : ''}{yoyLabel ?? `${yoyPct.toFixed(1)}%`}
            </div>
          ) : (
            <div style={{ color: 'var(--text-m)' }}>—</div>
          )}
        </div>
        {/* Gap */}
        <div style={{ flex: 1 }}>
          <div style={{ color: 'var(--text-m)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase' }}>Gap</div>
          <div style={{
            fontWeight: 700, fontFamily: 'var(--mono)',
            color: gapFormatted && gapFormatted.startsWith('-') ? 'var(--red)' : gapFormatted && gapFormatted !== '—' ? 'var(--green)' : 'var(--text-m)',
          }}>
            {gapFormatted ?? '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── OTB / Pickup mini-card ──────────────────────────────────────────

function OtbPickupCard({ pickup }: { pickup: PickupSummary | null }) {
  return (
    <div style={{
      padding: '12px 14px', background: 'var(--bg)', borderRadius: 'var(--rx)',
      border: '1px solid var(--border-l)', marginBottom: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-m)', marginBottom: 8 }}>
        Pickup do Mês
      </div>
      {pickup ? (
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-m)', textTransform: 'uppercase' }}>UHs</div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)',
              color: pickup.pu7dUhs >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pickup.pu7dUhs >= 0 ? '+' : ''}{pickup.pu7dUhs}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-m)', textTransform: 'uppercase' }}>Receita</div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'var(--mono)',
              color: pickup.pu7dReceita >= 0 ? 'var(--green)' : 'var(--red)',
            }}>
              {pickup.pu7dReceita >= 0 ? '+' : ''}{fmtR(Math.abs(pickup.pu7dReceita))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'var(--text-m)' }}>Indisponível (1 extração)</div>
      )}
    </div>
  );
}

// ─── History table with metas ────────────────────────────────────────

interface HistoryTableProps {
  rows: MonthlyKpi[];
  allMetas: HotelMeta[];
  hotelId: number;
  currentMesAno: string;
}

function HistoryTable({ rows, allMetas, hotelId, currentMesAno }: HistoryTableProps) {
  const [sameMonthOnly, setSameMonthOnly] = useState(false);
  const currentMonth = currentMesAno.split('-')[1]; // "04"
  const sorted = useMemo(() => {
    const all = [...rows].sort((a, b) => b.mesAno.localeCompare(a.mesAno)).slice(0, 24);
    if (!sameMonthOnly) return all;
    return all.filter(r => r.mesAno.split('-')[1] === currentMonth);
  }, [rows, sameMonthOnly, currentMonth]);
  const metasByMonth = useMemo(() => {
    const map = new Map<string, HotelMeta>();
    for (const m of allMetas) {
      if (m.hotelId === hotelId) map.set(m.mesAno, m);
    }
    return map;
  }, [allMetas, hotelId]);

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-m)', fontSize: 12 }}>
        Sem dados históricos
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', overflowX: 'auto', height: '100%' }}>
      {/* Filter toggle */}
      <div style={{ padding: '6px 6px 4px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => setSameMonthOnly(v => !v)}
          style={{
            fontSize: 9.5, fontWeight: 700, padding: '3px 9px', borderRadius: 99, border: 'none',
            cursor: 'pointer', transition: 'all .15s',
            background: sameMonthOnly ? 'var(--accent)' : 'var(--surface-h)',
            color: sameMonthOnly ? '#fff' : 'var(--text-m)',
          }}
        >
          {sameMonthOnly ? `Só ${MES_PT[currentMonth]}` : `Filtrar ${MES_PT[currentMonth]}`}
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--surface-h)' }}>
            {['Mês', 'Receita', 'Meta Rec', 'Occ%', 'Meta Occ', 'DM', 'Meta DM', 'RevPAR', 'Meta Rev'].map((label, i) => (
              <th key={label} style={{
                padding: '7px 6px', fontWeight: 700, fontSize: 9, textTransform: 'uppercase',
                letterSpacing: '0.3px',
                color: label.startsWith('Meta') ? 'var(--accent)' : 'var(--text-m)',
                textAlign: i === 0 ? 'left' : 'right',
                borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
              }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const isCurrent = r.mesAno === currentMesAno;
            const meta = metasByMonth.get(r.mesAno);
            const recAch = ach(r.receita, meta?.receitaMeta ?? null);
            return (
              <tr key={r.mesAno}
                style={{
                  background: isCurrent ? 'var(--accent-l)' : i % 2 === 0 ? 'transparent' : 'var(--bg)',
                  borderLeft: isCurrent ? '3px solid var(--accent)' : '3px solid transparent',
                }}>
                <td style={{ padding: '6px 6px', fontWeight: isCurrent ? 800 : 600, color: isCurrent ? 'var(--accent-d)' : 'var(--text)', whiteSpace: 'nowrap' }}>
                  {fmtMesShort(r.mesAno)}
                  {isCurrent && <span style={{ marginLeft: 4, fontSize: 8, fontWeight: 800, background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 4px' }}>atual</span>}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{fmtR(r.receita)}</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: ok(recAch) && recAch >= 100 ? 'var(--green)' : 'var(--text-m)' }}>
                  {meta?.receitaMeta ? fmtR(meta.receitaMeta) : '—'}
                </td>
                <td style={{
                  padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600,
                  color: r.occ >= 70 ? 'var(--green)' : r.occ >= 50 ? 'var(--gold)' : 'var(--red)',
                }}>{fmtPct(r.occ)}</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-m)' }}>
                  {meta?.occMeta ? fmtPct(meta.occMeta) : '—'}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{fmtR(r.dm)}</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-m)' }}>
                  {meta?.dmMeta ? fmtR(meta.dmMeta) : '—'}
                </td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--text)' }}>{fmtR(r.revpar)}</td>
                <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-m)' }}>
                  {meta?.revparMeta ? fmtR(meta.revparMeta) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Hotel row (forecasts + meta inputs + history) ──────────────────

interface HotelRowProps {
  hotel: HotelSummary;
  mesAno: string;
  forecast: ForecastData;
  meta: HotelMeta | undefined;
  allMetas: HotelMeta[];
  historyRows: MonthlyKpi[];
  pickup: PickupSummary | null;
  onSave: (receita: number | null, occ: number | null, dm: number | null, revpar: number | null) => Promise<void>;
}

function HotelMetaRow({ hotel, mesAno, forecast, meta, allMetas, historyRows, pickup, onSave }: HotelRowProps) {
  const [receita, setReceita] = useState(meta?.receitaMeta != null ? String(meta.receitaMeta) : '');
  const [occ,     setOcc]     = useState(meta?.occMeta != null ? String(meta.occMeta) : '');
  const [dm,      setDm]      = useState(meta?.dmMeta != null ? String(meta.dmMeta) : '');
  const [revpar,  setRevpar]  = useState(meta?.revparMeta != null ? String(meta.revparMeta) : '');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const initRec = meta?.receitaMeta != null ? String(meta.receitaMeta) : '';
  const initOcc = meta?.occMeta != null ? String(meta.occMeta) : '';
  const initDm  = meta?.dmMeta != null ? String(meta.dmMeta) : '';
  const initRev = meta?.revparMeta != null ? String(meta.revparMeta) : '';

  useEffect(() => { setReceita(initRec); }, [initRec]);
  useEffect(() => { setOcc(initOcc); },     [initOcc]);
  useEffect(() => { setDm(initDm); },       [initDm]);
  useEffect(() => { setRevpar(initRev); },  [initRev]);

  const dirty = receita !== initRec || occ !== initOcc || dm !== initDm || revpar !== initRev;

  const recMeta    = parseFloat(receita) || null;
  const occMeta    = parseFloat(occ)     || null;
  const dmMeta     = parseFloat(dm)      || null;
  const revparMeta = parseFloat(revpar)  || null;

  // Gap calculations (forecast - meta)
  const recGap = ok(recMeta) ? forecast.recForecast - recMeta : null;
  const occGap = ok(occMeta) ? forecast.occForecast - occMeta : null;
  const dmGap  = ok(dmMeta)  ? forecast.dmForecast - dmMeta : null;
  const revGap = ok(revparMeta) ? forecast.revparForecast - revparMeta : null;

  const fmtGap = (gap: number | null, prefix = 'R$ ') => {
    if (!ok(gap)) return null;
    const sign = gap >= 0 ? '+' : '';
    return `${sign}${prefix}${Math.round(Math.abs(gap)).toLocaleString('pt-BR')}`;
  };
  const fmtGapPct = (gap: number | null) => {
    if (!ok(gap)) return null;
    const sign = gap >= 0 ? '+' : '';
    return `${sign}${gap.toFixed(1)}pp`;
  };

  async function handleSave() {
    setSaving(true);
    await onSave(recMeta, occMeta, dmMeta, revparMeta);
    setSaving(false); setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', overflow: 'hidden',
    }}>
      {/* ── Left: Forecast cards 2x2 ── */}
      <div style={{ borderRight: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Hotel header */}
        <div className="flex items-center justify-between" style={{ marginBottom: 2 }}>
          <div>
            <h3 style={{ fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.2px', color: 'var(--text)' }}>{hotel.name}</h3>
            <p style={{ fontSize: 11, color: 'var(--text-m)' }}>{hotel.city}, {hotel.state} · {hotel.uhs} UHs</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, background: 'var(--accent-l)', color: 'var(--accent-d)', borderRadius: 99, padding: '2px 8px' }}>
              {fmtMes(mesAno)}
            </span>
            <div style={{ fontSize: 9, color: 'var(--text-m)', marginTop: 3 }}>
              {forecast.diasMtd}/{forecast.diasNoMes} dias · {forecast.diasRestantes} restantes
            </div>
          </div>
        </div>

        {/* 2x2 Forecast Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <ForecastCard
            label="Receita" icon={<BarChart3 size={11}/>}
            forecastValue={forecast.recForecast}
            forecastFormatted={fmtR(forecast.recForecast)}
            metaValue={receita} onMetaChange={setReceita} prefix="R$"
            achPct={ach(forecast.recForecast, recMeta)}
            yoyPct={forecast.recYoy}
            gapFormatted={fmtGap(recGap)}
            mtdFormatted={fmtR(forecast.recMtd)}
          />
          <ForecastCard
            label="Ocupação" icon={<Percent size={11}/>}
            forecastValue={forecast.occForecast}
            forecastFormatted={fmtPct(forecast.occForecast)}
            metaValue={occ} onMetaChange={setOcc} suffix="%"
            achPct={ach(forecast.occForecast, occMeta)}
            yoyPct={forecast.occYoy}
            yoyLabel={ok(forecast.occYoy) ? `${forecast.occYoy >= 0 ? '+' : ''}${forecast.occYoy.toFixed(1)}pp` : undefined}
            gapFormatted={fmtGapPct(occGap)}
            mtdFormatted={fmtPct(forecast.occMtd)}
          />
          <ForecastCard
            label="Diária Média" icon={<DollarSign size={11}/>}
            forecastValue={forecast.dmForecast}
            forecastFormatted={fmtRFull(forecast.dmForecast)}
            metaValue={dm} onMetaChange={setDm} prefix="R$"
            achPct={ach(forecast.dmForecast, dmMeta)}
            yoyPct={forecast.dmYoy}
            gapFormatted={fmtGap(dmGap)}
            mtdFormatted={fmtRFull(forecast.dmMtd)}
          />
          <ForecastCard
            label="RevPAR" icon={<TrendingUp size={11}/>}
            forecastValue={forecast.revparForecast}
            forecastFormatted={fmtRFull(forecast.revparForecast)}
            metaValue={revpar} onMetaChange={setRevpar} prefix="R$"
            achPct={ach(forecast.revparForecast, revparMeta)}
            yoyPct={forecast.revparYoy}
            gapFormatted={fmtGap(revGap)}
            mtdFormatted={fmtRFull(forecast.revparMtd)}
          />
        </div>

        {/* Save button */}
        <button onClick={handleSave} disabled={saving || (!dirty && !saved)}
          className="flex items-center justify-center gap-2 w-full transition-all duration-150"
          style={{
            padding: '9px 0', borderRadius: 'var(--rx)', fontSize: 12.5, fontWeight: 700,
            background: saved ? 'var(--green)' : dirty ? 'var(--accent)' : 'var(--surface-h)',
            color: saved || dirty ? '#fff' : 'var(--text-m)', border: 'none',
            cursor: saving || (!dirty && !saved) ? 'default' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? <><Loader2 size={13} className="animate-spin"/> Salvando...</>
            : saved ? <><Check size={13}/> Salvo!</>
            : <><Target size={13}/> {dirty ? 'Salvar metas' : 'Sem alterações'}</>}
        </button>
      </div>

      {/* ── Right: OTB/Pickup + History ── */}
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* OTB + Pickup */}
        <div style={{ padding: '12px 14px 0' }}>
          <OtbPickupCard pickup={pickup} />
        </div>

        {/* Table header */}
        <div style={{ padding: '8px 14px 6px', borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-m)' }}>
            Histórico — últimos 24 meses
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', maxHeight: 320 }}>
          <HistoryTable rows={historyRows} allMetas={allMetas} hotelId={hotel.id} currentMesAno={mesAno} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function Metas() {
  const now = new Date();
  const currentMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [mesAno, setMesAno] = useState(currentMes);

  const { hotels, loading: hotelsLoading }                   = useHotels();
  const { metas, loading: metasLoading, reload }             = useHotelMetas(mesAno);
  const { rows: monthlyRows, loading: monthlyLoading }       = useHotelsMonthly();
  const { metas: allMetas, loading: allMetasLoading }        = useAllMetas();
  const { summaries: pickupSummaries, loading: pickupLoading } = usePickupSummary();

  const loading = hotelsLoading || metasLoading || monthlyLoading || allMetasLoading || pickupLoading;

  const getMetaFor     = (hid: number) => metas.find(m => m.hotelId === hid);
  const getHistoryFor  = (hid: number) => monthlyRows.filter(r => r.hotelId === hid);
  const getPickupFor   = (hid: number) => pickupSummaries.find(s => s.hotelId === hid) ?? null;

  // STLY month key
  const [selY, selM] = mesAno.split('-').map(Number);
  const stlyYm = `${selY - 1}-${String(selM).padStart(2, '0')}`;

  const getStlyFor   = (hid: number) => monthlyRows.find(r => r.hotelId === hid && r.mesAno === stlyYm);
  const getActualFor = (hid: number) => monthlyRows.find(r => r.hotelId === hid && r.mesAno === mesAno);

  async function handleSave(hotelId: number, receita: number | null, occ: number | null, dm: number | null, revpar: number | null) {
    await saveHotelMeta({ hotelId, mesAno, receitaMeta: receita, occMeta: occ, dmMeta: dm, revparMeta: revpar });
    reload();
  }

  const monthIdx = MONTHS.indexOf(mesAno);

  // Portfolio forecast summary
  const portfolioForecast = useMemo(() => {
    if (hotels.length === 0) return null;
    let totalRecForecast = 0, totalRecMeta = 0, hasMeta = 0;
    for (const h of hotels) {
      const fc = computeForecast(h, getStlyFor(h.id), getActualFor(h.id), mesAno);
      totalRecForecast += fc.recForecast;
      const meta = getMetaFor(h.id);
      if (meta?.receitaMeta) { totalRecMeta += meta.receitaMeta; hasMeta++; }
    }
    return { totalRecForecast, totalRecMeta, hasMeta };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotels, monthlyRows, metas, mesAno]);

  return (
    <div className="fade-in flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target size={18} style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px' }}>Gestão de Metas</h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-m)' }}>
            Forecast de fechamento, metas e comparação YoY por hotel
          </p>
        </div>

        {/* Month stepper */}
        <div className="flex items-center gap-0" style={{ border: '1px solid var(--border)', borderRadius: 'var(--rx)', overflow: 'hidden', background: 'var(--surface)' }}>
          <button disabled={monthIdx <= 0} onClick={() => setMesAno(MONTHS[monthIdx - 1])}
            style={{ padding: '8px 14px', borderRight: '1px solid var(--border)', color: monthIdx <= 0 ? 'var(--text-m)' : 'var(--text)', cursor: monthIdx <= 0 ? 'default' : 'pointer' }}>
            <ChevronLeft size={16}/>
          </button>
          <span style={{ padding: '8px 20px', fontSize: 14, fontWeight: 700, minWidth: 120, textAlign: 'center' }}>
            {fmtMes(mesAno)}
          </span>
          <button disabled={monthIdx >= MONTHS.length - 1} onClick={() => setMesAno(MONTHS[monthIdx + 1])}
            style={{ padding: '8px 14px', borderLeft: '1px solid var(--border)', color: monthIdx >= MONTHS.length - 1 ? 'var(--text-m)' : 'var(--text)', cursor: monthIdx >= MONTHS.length - 1 ? 'default' : 'pointer' }}>
            <ChevronRight size={16}/>
          </button>
        </div>
      </div>

      {/* ── Summary bar ── */}
      {!loading && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rx)', flexWrap: 'wrap' }}>
          <Target size={13} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
          <span style={{ fontSize: 12.5, color: 'var(--text-m)' }}>
            <strong style={{ color: 'var(--text)' }}>{metas.length}</strong> de{' '}
            <strong style={{ color: 'var(--text)' }}>{hotels.length}</strong> hotéis com metas em{' '}
            <strong style={{ color: 'var(--accent)' }}>{fmtMes(mesAno)}</strong>
          </span>
          {portfolioForecast && portfolioForecast.hasMeta > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--border)' }}/>
              <span style={{ fontSize: 11.5, color: 'var(--text-m)' }}>
                Forecast portfolio:{' '}
                <strong style={{ color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                  {fmtR(portfolioForecast.totalRecForecast)}
                </strong>
                {' '}/ Meta:{' '}
                <strong style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
                  {fmtR(portfolioForecast.totalRecMeta)}
                </strong>
              </span>
            </>
          )}
          {metas.length > 0 && (
            <>
              <div style={{ flex: 1, height: 4, background: 'var(--border-l)', borderRadius: 99, overflow: 'hidden', minWidth: 60 }}>
                <div style={{ height: '100%', width: `${Math.round((metas.length / hotels.length) * 100)}%`, background: 'var(--accent)', borderRadius: 99 }}/>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)' }}>
                {Math.round((metas.length / hotels.length) * 100)}%
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }}/>
          <span className="ml-2" style={{ fontSize: 13, color: 'var(--text-m)' }}>Carregando...</span>
        </div>
      )}

      {/* ── Hotel rows ── */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {hotels.map(hotel => {
            const meta = getMetaFor(hotel.id);
            const stly = getStlyFor(hotel.id);
            const actual = getActualFor(hotel.id);
            const forecast = computeForecast(hotel, stly, actual, mesAno);
            return (
              <HotelMetaRow
                key={hotel.id}
                hotel={hotel}
                mesAno={mesAno}
                forecast={forecast}
                meta={meta}
                allMetas={allMetas}
                historyRows={getHistoryFor(hotel.id)}
                pickup={getPickupFor(hotel.id)}
                onSave={(r, o, d, rv) => handleSave(hotel.id, r, o, d, rv)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
