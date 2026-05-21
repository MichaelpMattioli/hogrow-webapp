import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotels, useHotelMetas } from '@/hooks/useSupabase';
import { Loader2, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus, ChevronsUpDown, Hash } from 'lucide-react';
import type { HotelSummary, HotelMeta } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ok = (v: unknown): v is number =>
  typeof v === 'number' && isFinite(v) && !isNaN(v);

function fmtRec(v: number | null | undefined, full = false): string {
  if (!ok(v)) return '—';
  if (full) return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (v >= 1_000)     return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function fmtDelta(v: number | null | undefined, full = false): string {
  if (!ok(v)) return '—';
  const sign = v > 0 ? '+' : '';
  if (full) return `${sign}R$ ${Math.round(v).toLocaleString('pt-BR')}`;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${sign}R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000)     return `${sign}R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  return `${sign}R$ ${Math.round(v).toLocaleString('pt-BR')}`;
}

function pctDelta(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (!ok(curr) || !ok(prev) || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

function monthElapsedRatio(): number {
  const now = new Date();
  return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function currentMesAno() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthLabel() {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^\w/, c => c.toUpperCase());
}

// ─── Delta pill ───────────────────────────────────────────────────────────────

function PctBadge({ value, suffix = '%' }: { value: number | null; suffix?: string }) {
  if (!ok(value) || Math.abs(value) < 0.05) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
        fontWeight: 600, color: 'var(--text-m)', background: 'var(--surface-h)',
        borderRadius: 99, padding: '2px 7px',
      }}>
        <Minus size={8} strokeWidth={2.5} />—
      </span>
    );
  }
  const pos   = value > 0;
  const Icon  = pos ? TrendingUp : TrendingDown;
  const color = pos ? 'var(--green)' : 'var(--red)';
  const bg    = pos ? 'var(--green-l)' : 'var(--red-l)';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
      fontWeight: 700, color, background: bg, borderRadius: 99, padding: '2px 8px',
    }}>
      <Icon size={8} strokeWidth={2.5} />
      {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

// MoM / YoY cell: absolute value on top + % badge below, centered
function DeltaCell({
  absValue, pct, full,
}: { absValue: number | null; pct: number | null; full: boolean }) {
  const hasAbs = ok(absValue);
  const pos    = hasAbs && absValue! > 0;
  const color  = !hasAbs ? 'var(--text-m)' : pos ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontSize: 12.5, fontWeight: 700, color,
        fontFamily: 'var(--mono)', letterSpacing: '-0.3px',
      }}>
        {fmtDelta(absValue, full)}
      </span>
      <PctBadge value={pct} />
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';
type SortCol = 'nome' | 'meta' | 'receita' | 'metaPct' | 'mom' | 'yoy' | 'ytd';

interface SortHeaderProps {
  label: string;
  sub?:  string;
  col:   SortCol;
  active: SortCol;
  dir:    SortDir;
  onSort: (col: SortCol) => void;
  align?: 'left' | 'right';
}

function SortHeader({ label, sub, col, active, dir, onSort, align = 'right' }: SortHeaderProps) {
  const isActive = active === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '11px 16px',
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
        background: isActive ? 'var(--accent-l)' : 'var(--surface)',
        transition: 'background .12s',
      }}
    >
      <div style={{
        display: 'inline-flex', flexDirection: 'column',
        alignItems: align === 'right' ? 'flex-end' : 'flex-start', gap: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {align === 'left' && <SortIcon active={isActive} dir={dir} />}
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: isActive ? 'var(--accent)' : 'var(--text-m)',
          }}>
            {label}
          </span>
          {align === 'right' && <SortIcon active={isActive} dir={dir} />}
        </div>
        {sub && <span style={{ fontSize: 9, color: 'var(--text-m)', fontWeight: 500, marginTop: 1 }}>{sub}</span>}
      </div>
    </th>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={10} style={{ color: 'var(--border)', flexShrink: 0 }} />;
  return dir === 'asc'
    ? <ChevronUp   size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
    : <ChevronDown size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />;
}

// ─── Table row ────────────────────────────────────────────────────────────────

function HotelRow({
  hotel, meta, onClick, idx, full,
}: { hotel: HotelSummary; meta?: HotelMeta; onClick: () => void; idx: number; full: boolean }) {
  const cfg      = STATUS_CONFIG[hotel.status];
  const metaVal  = meta?.receitaMeta;
  const elapsed  = monthElapsedRatio() * 100;

  const metaPct  = ok(metaVal) && metaVal > 0 && ok(hotel.receitaMesAtual)
    ? (hotel.receitaMesAtual / metaVal) * 100 : null;

  const momAbs   = ok(hotel.receitaMesAtual) && ok(hotel.receitaMesAnterior)
    ? hotel.receitaMesAtual - hotel.receitaMesAnterior : null;
  const yoyAbs   = ok(hotel.receitaMesAtual) && ok(hotel.receitaAnoAnterior)
    ? hotel.receitaMesAtual - hotel.receitaAnoAnterior : null;
  const momRec   = pctDelta(hotel.receitaMesAtual, hotel.receitaMesAnterior);
  const yoyRec   = pctDelta(hotel.receitaMesAtual, hotel.receitaAnoAnterior);

  // Color for meta achievement
  const metaColor = !ok(metaPct) ? 'var(--text-m)'
    : metaPct >= 100           ? 'var(--green)'
    : metaPct >= elapsed * 0.9 ? 'var(--green)'
    : metaPct >= elapsed * 0.7 ? 'var(--gold)'
    : 'var(--red)';

  const metaBg = !ok(metaPct) ? 'transparent'
    : metaPct >= 100           ? 'var(--green-l)'
    : metaPct >= elapsed * 0.9 ? 'var(--green-l)'
    : metaPct >= elapsed * 0.7 ? 'color-mix(in srgb,var(--gold) 14%,transparent)'
    : 'var(--red-l)';

  const td: React.CSSProperties = {
    padding: '13px 16px',
    borderBottom: '1px solid var(--border-l)',
    verticalAlign: 'middle',
  };
  const tdNum: React.CSSProperties = {
    ...td, textAlign: 'right',
    fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--text)',
  };

  return (
    <tr
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-h)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Rank */}
      <td style={{ ...td, width: 36, textAlign: 'center', color: 'var(--text-m)', fontSize: 11, fontWeight: 600 }}>
        {idx + 1}
      </td>

      {/* Propriedade */}
      <td style={{ ...td, minWidth: 220 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            background: cfg.color,
            boxShadow: `0 0 0 3px color-mix(in srgb,${cfg.color} 18%,transparent)`,
          }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
              {hotel.name}
            </div>
            <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontSize: 9.5, color: 'var(--text-m)', fontWeight: 500,
                background: 'var(--surface-h)', borderRadius: 99,
                padding: '1px 7px', border: '1px solid var(--border-l)',
              }}>
                {hotel.city}, {hotel.state}
              </span>
              <span style={{ fontSize: 9.5, color: 'var(--text-m)', fontWeight: 500 }}>
                {hotel.uhs} UHs
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Meta */}
      <td style={{ ...tdNum, color: 'var(--text-m)', fontWeight: 600, fontSize: 12.5 }}>
        {ok(metaVal) ? fmtRec(metaVal, full) : (
          <span style={{ fontSize: 10.5, color: 'var(--border)', fontStyle: 'italic', fontFamily: 'inherit' }}>—</span>
        )}
      </td>

      {/* Real com mini barra */}
      <td style={{ ...tdNum }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
          <span>{fmtRec(hotel.receitaMesAtual, full)}</span>
          {ok(metaVal) && metaVal > 0 && (
            <div style={{ width: 80, height: 4, background: 'var(--border-l)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                width: `${Math.min((hotel.receitaMesAtual / metaVal) * 100, 100)}%`,
                background: metaColor, transition: 'width .4s ease',
              }} />
            </div>
          )}
        </div>
      </td>

      {/* Δ Meta */}
      <td style={{ ...td, textAlign: 'right' }}>
        {ok(metaPct) ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 12, fontWeight: 800, color: metaColor, background: metaBg,
            borderRadius: 99, padding: '4px 10px',
          }}>
            {metaPct.toFixed(1)}%
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--border)' }}>—</span>
        )}
      </td>

      {/* MoM */}
      <td style={{ ...td, textAlign: 'center' }}>
        <DeltaCell absValue={momAbs} pct={momRec} full={full} />
      </td>

      {/* YoY */}
      <td style={{ ...td, textAlign: 'center' }}>
        <DeltaCell absValue={yoyAbs} pct={yoyRec} full={full} />
      </td>

      {/* YTD */}
      <td style={{
        ...tdNum,
        borderLeft: '1px solid var(--border-l)',
        color: 'var(--accent-d)',
      }}>
        {fmtRec(hotel.receitaYTD, full)}
      </td>
    </tr>
  );
}

// ─── Sort value ───────────────────────────────────────────────────────────────

function getSortValue(h: HotelSummary, meta: HotelMeta | undefined, col: SortCol): number | string {
  const metaVal = meta?.receitaMeta;
  const metaPct = ok(metaVal) && metaVal > 0
    ? (h.receitaMesAtual / metaVal) * 100 : -1;
  const mom = ok(h.receitaMesAnterior) && h.receitaMesAnterior > 0
    ? ((h.receitaMesAtual - h.receitaMesAnterior) / h.receitaMesAnterior) * 100 : -999;
  const yoy = ok(h.receitaAnoAnterior) && h.receitaAnoAnterior > 0
    ? ((h.receitaMesAtual - h.receitaAnoAnterior) / h.receitaAnoAnterior) * 100 : -999;

  switch (col) {
    case 'nome':    return h.name.toLowerCase();
    case 'meta':    return metaVal ?? -1;
    case 'receita': return h.receitaMesAtual ?? 0;
    case 'metaPct': return metaPct;
    case 'mom':     return mom;
    case 'yoy':     return yoy;
    case 'ytd':     return h.receitaYTD ?? 0;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Clientes() {
  const [sortCol, setSortCol]     = useState<SortCol>('receita');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');
  const [fullNumbers, setFull]    = useState(false);
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').toLowerCase().trim();

  const { hotels, loading, error } = useHotels();
  const { metas }                  = useHotelMetas(currentMesAno());

  const metaMap = useMemo(() => {
    const m = new Map<number, HotelMeta>();
    metas.forEach(mt => m.set(mt.hotelId, mt));
    return m;
  }, [metas]);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    if (!q) return hotels;
    return hotels.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q) ||
      h.state.toLowerCase().includes(q)
    );
  }, [hotels, q]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, metaMap.get(a.id), sortCol);
      const bv = getSortValue(b, metaMap.get(b.id), sortCol);
      if (typeof av === 'string') {
        const c = av.localeCompare(bv as string);
        return sortDir === 'asc' ? c : -c;
      }
      const c = (av as number) - (bv as number);
      return sortDir === 'asc' ? c : -c;
    });
  }, [filtered, sortCol, sortDir, metaMap]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={22} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="ml-2" style={{ fontSize: 13, color: 'var(--text-m)' }}>Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p style={{ color: 'var(--red)', fontWeight: 600 }}>{error}</p>
      </div>
    );
  }

  const shProps = { active: sortCol, dir: sortDir, onSort: handleSort };

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px' }}>Clientes</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-m)', marginTop: 2 }}>
            {q
              ? `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''} para "${q}"`
              : `${hotels.length} ${hotels.length === 1 ? 'hotel' : 'hotéis'} · receita`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Full / abbreviated toggle */}
          <button
            onClick={() => setFull(f => !f)}
            title={fullNumbers ? 'Mostrar abreviado (k)' : 'Mostrar valor inteiro'}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 'var(--rx)', cursor: 'pointer',
              fontSize: 11, fontWeight: 700, transition: 'all .15s',
              border: fullNumbers
                ? '1.5px solid var(--accent)'
                : '1px solid var(--border)',
              background: fullNumbers
                ? 'rgba(var(--accent-rgb),.08)'
                : 'var(--surface)',
              color: fullNumbers ? 'var(--accent)' : 'var(--text-m)',
            }}
          >
            <Hash size={11} />
            {fullNumbers ? 'Inteiro' : 'Abreviado'}
          </button>

          <span style={{
            fontSize: 11.5, fontWeight: 700, padding: '5px 14px',
            background: 'var(--accent-l)', color: 'var(--accent-d)',
            borderRadius: 99,
            border: '1px solid color-mix(in srgb,var(--accent) 25%,transparent)',
          }}>
            {currentMonthLabel()}
          </span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          padding: '64px 24px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: 'var(--r)', textAlign: 'center',
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
            {q ? `Nenhum hotel encontrado para "${q}"` : 'Nenhum hotel cadastrado'}
          </p>
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          boxShadow: 'var(--sh)',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                {/* ── Group labels ── */}
                <tr style={{ background: 'var(--bg)' }}>
                  <td colSpan={2} style={{ padding: '6px 14px', borderBottom: '1px solid var(--border-l)' }} />

                  {/* Mês atual group */}
                  <td colSpan={5} style={{
                    padding: '6px 16px', textAlign: 'right',
                    borderBottom: '1px solid var(--border-l)',
                    borderLeft: '1px solid var(--border-l)',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: 'var(--accent-d)',
                    background: 'var(--accent-l)',
                  }}>
                    Receita — Mês Atual
                  </td>

                  {/* YTD group */}
                  <td colSpan={1} style={{
                    padding: '6px 16px', textAlign: 'right',
                    borderBottom: '1px solid var(--border-l)',
                    borderLeft: '1px solid var(--border-l)',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: 'var(--text-m)',
                  }}>
                    Acumulado Ano
                  </td>
                </tr>

                {/* ── Sort row ── */}
                <tr>
                  {/* # */}
                  <th style={{
                    padding: '11px 14px', width: 36,
                    borderBottom: '2px solid var(--border)',
                    background: 'var(--surface)',
                  }} />
                  <SortHeader label="Propriedade" col="nome"    {...shProps} align="left" />
                  <SortHeader label="Meta"         col="meta"    {...shProps} sub="mês" />
                  <SortHeader label="Real"         col="receita" {...shProps} sub="mês atual" />
                  <SortHeader label="Δ Meta"       col="metaPct" {...shProps} sub="realização" />
                  <SortHeader label="MoM"          col="mom"     {...shProps} sub="vs mês ant." />
                  <SortHeader label="YoY"          col="yoy"     {...shProps} sub="vs ano ant." />
                  <SortHeader label="YTD"          col="ytd"     {...shProps} sub="jan → hoje" />
                </tr>
              </thead>

              <tbody>
                {sorted.map((h, i) => (
                  <HotelRow
                    key={h.id}
                    hotel={h}
                    meta={metaMap.get(h.id)}
                    onClick={() => navigate(`/clientes/${h.id}`)}
                    idx={i}
                    full={fullNumbers}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Footer ── */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border-l)',
            background: 'var(--bg)',
            display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 500 }}>{cfg.label}</span>
                </span>
              ))}
            </div>
            <span style={{ fontSize: 10, color: 'var(--border)', marginLeft: 'auto' }}>
              Clique na coluna para ordenar · Clique na linha para abrir o hotel
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
