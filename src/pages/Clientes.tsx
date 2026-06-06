import { useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useClientesCalendar, useClientesTable, type ClientesPageRow, type MonthlyKpi } from '@/hooks/useSupabase';
import { ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus, ChevronsUpDown, Hash } from 'lucide-react';
import type { HotelSummary, HotelMeta } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';
import { deriveStatus } from '@/data/transforms';
import HeaderMonthReference from '@/components/ui/HeaderMonthReference';

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

function monthElapsedRatio(referenceMonth = currentMesAno()): number {
  const currentMonth = currentMesAno();
  if (referenceMonth < currentMonth) return 1;
  if (referenceMonth > currentMonth) return 0;

  const now = new Date();
  return now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function currentMesAno() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function monthLabel(ym: string) {
  const [year, month] = ym.split('-');
  return `${MES_LABELS[Number(month) - 1] ?? month}/${year}`;
}

function shiftMonth(ym: string, offset: number) {
  const [year, month] = ym.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildMonthlyHotelSummary(
  hotel: HotelSummary,
  referenceMonth: string,
  rowsByKey: Map<string, MonthlyKpi>,
  rowsByHotel: Map<number, MonthlyKpi[]>,
): HotelSummary {
  const key = (month: string) => `${hotel.id}|${month}`;
  const current = rowsByKey.get(key(referenceMonth));
  const isCurrentCalendarMonth = referenceMonth === currentMesAno();

  const receita = current?.receita ?? (isCurrentCalendarMonth ? hotel.receitaMesAtual : 0);
  const recDiarias = current?.recDiarias ?? (isCurrentCalendarMonth ? hotel.recDiariasMesAtual : 0);
  const ocupados = current?.ocupados ?? (isCurrentCalendarMonth ? hotel.ocupadosMesAtual : 0);
  const cortesia = current?.cortesia ?? (isCurrentCalendarMonth ? hotel.cortesiaMesAtual : 0);
  const hospedes = current?.hospedes ?? (isCurrentCalendarMonth ? hotel.hospedesMesAtual : 0);
  const dias = current?.dias ?? (isCurrentCalendarMonth ? hotel.diasMesAtual : 0);
  const occ = current?.occ ?? (isCurrentCalendarMonth ? hotel.occMesAtual : 0);
  const dm = current?.dm ?? (ocupados > 0 ? receita / ocupados : null);
  const revpar = current?.revpar ?? (dias > 0 && hotel.uhs > 0 ? receita / (hotel.uhs * dias) : 0);

  const previous = rowsByKey.get(key(shiftMonth(referenceMonth, -1)));
  const next = rowsByKey.get(key(shiftMonth(referenceMonth, 1)));
  const [year, month] = referenceMonth.split('-');
  const stly = rowsByKey.get(key(`${Number(year) - 1}-${month}`));

  const historyRows = rowsByHotel.get(hotel.id) ?? [];
  const ytdRows = historyRows.filter(r => r.mesAno.startsWith(`${year}-`) && r.mesAno <= referenceMonth);
  const useCurrentFallback = isCurrentCalendarMonth && !current;
  const ytdReceita = useCurrentFallback
    ? hotel.receitaYTD
    : ytdRows.reduce((sum, r) => sum + r.receita, 0);
  const ytdOcupados = useCurrentFallback
    ? hotel.ocupadosYTD
    : ytdRows.reduce((sum, r) => sum + r.ocupados, 0);
  const ytdHospedes = useCurrentFallback
    ? hotel.hospedesYTD
    : ytdRows.reduce((sum, r) => sum + r.hospedes, 0);
  const ytdDias = ytdRows.reduce((sum, r) => sum + r.dias, 0);
  const ytdOccWeighted = ytdRows.reduce((sum, r) => sum + (r.occ * r.dias), 0);

  return {
    ...hotel,
    avgOcc: occ,
    avgRevpar: revpar,
    avgDm: dm,
    totalReceita: ytdReceita,
    totalRecDiarias: recDiarias,
    diasComDados: dias,

    receitaMesAtual: receita,
    recDiariasMesAtual: recDiarias,
    receitaMesAnterior: previous?.receita ?? (isCurrentCalendarMonth ? hotel.receitaMesAnterior : 0),
    recDiariasMesAnterior: previous?.recDiarias ?? (isCurrentCalendarMonth ? hotel.recDiariasMesAnterior : 0),
    receitaMesQueVem: next?.receita ?? 0,

    occMesAtual: occ,
    occMesAnterior: previous?.occ ?? (isCurrentCalendarMonth ? hotel.occMesAnterior : 0),
    occMesQueVem: next?.occ ?? 0,
    ocupadosMesAtual: ocupados,
    ocupadosMesAnterior: previous?.ocupados ?? (isCurrentCalendarMonth ? hotel.ocupadosMesAnterior : 0),
    cortesiaMesAtual: cortesia,
    hospedesMesAtual: hospedes,
    diasMesAtual: dias,

    receitaAnoAnterior: stly?.receita ?? (isCurrentCalendarMonth ? hotel.receitaAnoAnterior : 0),
    recDiariasAnoAnterior: stly?.recDiarias ?? (isCurrentCalendarMonth ? hotel.recDiariasAnoAnterior : 0),
    occAnoAnterior: stly?.occ ?? (isCurrentCalendarMonth ? hotel.occAnoAnterior : 0),
    ocupadosAnoAnterior: stly?.ocupados ?? (isCurrentCalendarMonth ? hotel.ocupadosAnoAnterior : 0),

    receitaYTD: ytdReceita,
    ocupadosYTD: ytdOcupados,
    hospedesYTD: ytdHospedes,
    occAvgYTD: useCurrentFallback ? hotel.occAvgYTD : (ytdDias > 0 ? parseFloat((ytdOccWeighted / ytdDias).toFixed(1)) : 0),
    dmYTD: useCurrentFallback ? hotel.dmYTD : (ytdOcupados > 0 ? ytdReceita / ytdOcupados : null),

    status: deriveStatus(occ),
  };
}

// ─── Delta pill ───────────────────────────────────────────────────────────────

type DeltaContext = 'mom' | 'yoy';

function deltaTooltipText(value: number | null, context: DeltaContext) {
  const comparison = context === 'mom' ? 'mês anterior' : 'mesmo mês do ano anterior';
  if (!ok(value)) return `Sem base para comparar com o ${comparison}.`;
  if (Math.abs(value) < 0.05) return `Receita estável vs ${comparison}.`;

  const direction = value > 0 ? 'maior' : 'menor';
  return `Receita ${Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% ${direction} vs ${comparison}.`;
}

function TooltipBadge({ text, children }: { text: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      aria-label={text}
      style={{
        position: 'relative',
        display: 'inline-flex',
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 'calc(100% + 7px)',
            transform: 'translateX(-50%)',
            zIndex: 30,
            width: 'max-content',
            maxWidth: 190,
            whiteSpace: 'normal',
            textAlign: 'center',
            padding: '6px 8px',
            borderRadius: 6,
            background: 'var(--text)',
            color: 'var(--surface)',
            boxShadow: '0 8px 20px rgba(13, 27, 62, 0.18)',
            fontFamily: 'var(--font, inherit)',
            fontSize: 10.5,
            fontWeight: 700,
            lineHeight: 1.25,
            pointerEvents: 'none',
          }}
        >
          {text}
          <span
            style={{
              position: 'absolute',
              left: '50%',
              top: '100%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid var(--text)',
            }}
          />
        </span>
      )}
    </span>
  );
}

function PctBadge({ value, context, suffix = '%' }: { value: number | null; context: DeltaContext; suffix?: string }) {
  const tooltip = deltaTooltipText(value, context);

  if (!ok(value) || Math.abs(value) < 0.05) {
    return (
      <TooltipBadge text={tooltip}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
          fontWeight: 600, color: 'var(--text-m)', background: 'var(--surface-h)',
          borderRadius: 99, padding: '2px 7px',
        }}>
          <Minus size={8} strokeWidth={2.5} />—
        </span>
      </TooltipBadge>
    );
  }
  const pos   = value > 0;
  const Icon  = pos ? TrendingUp : TrendingDown;
  const color = pos ? 'var(--green)' : 'var(--red)';
  const bg    = pos ? 'var(--green-l)' : 'var(--red-l)';
  return (
    <TooltipBadge text={tooltip}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
        fontWeight: 700, color, background: bg, borderRadius: 99, padding: '2px 8px',
      }}>
        <Icon size={8} strokeWidth={2.5} />
        {value > 0 ? '+' : ''}{value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{suffix}
      </span>
    </TooltipBadge>
  );
}

// MoM / YoY cell: absolute value on top + % badge below, centered
function DeltaCell({
  absValue, pct, full, context,
}: { absValue: number | null; pct: number | null; full: boolean; context: DeltaContext }) {
  const hasAbs = ok(absValue);
  const pos    = hasAbs && absValue! > 0;
  const color  = !hasAbs ? 'var(--text-m)' : pos ? 'var(--green)' : 'var(--red)';
  const valueFontSize = full ? 10 : 12.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{
        fontSize: valueFontSize, fontWeight: 700, color,
        fontFamily: 'var(--mono)', letterSpacing: '-0.3px',
      }}>
        {fmtDelta(absValue, full)}
      </span>
      <PctBadge value={pct} context={context} />
    </div>
  );
}

// ─── Sort header ──────────────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc';
type SortCol = 'nome' | 'meta' | 'receita' | 'metaPct' | 'mom' | 'yoy' | 'metaYtd' | 'ytd' | 'deltaYtd';

interface SortHeaderProps {
  label: string;
  sub?:  string;
  col:   SortCol;
  active: SortCol;
  dir:    SortDir;
  onSort: (col: SortCol) => void;
  align?: 'left' | 'center' | 'right';
}

function SortHeader({ label, sub, col, active, dir, onSort, align = 'center' }: SortHeaderProps) {
  const isActive = active === col;
  const headerAlign = align === 'right' ? 'flex-end' : align === 'left' ? 'flex-start' : 'center';
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
        alignItems: headerAlign, gap: 1,
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
          {align !== 'left' && <SortIcon active={isActive} dir={dir} />}
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

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, rowIdx) => (
        <tr key={rowIdx}>
          {Array.from({ length: 10 }).map((__, colIdx) => (
            <td
              key={colIdx}
              style={{
                padding: '13px 16px',
                borderBottom: '1px solid var(--border-l)',
                textAlign: colIdx <= 1 ? 'left' : 'center',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: colIdx === 1 ? 160 : colIdx === 0 ? 18 : 76,
                  maxWidth: '100%',
                  height: colIdx === 1 ? 13 : 12,
                  borderRadius: 99,
                  background: 'linear-gradient(90deg, var(--surface-h), var(--border-l), var(--surface-h))',
                  opacity: 0.72,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function TableMessage({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'error' }) {
  return (
    <tr>
      <td colSpan={10} style={{ padding: 0 }}>
        <div
          style={{
            minHeight: 170,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '32px 24px',
            color: tone === 'error' ? 'var(--red)' : 'var(--text-m)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {children}
        </div>
      </td>
    </tr>
  );
}

const HotelRow = memo(function HotelRow({
  hotel, meta, annualMeta, onSelect, idx, full, referenceMonth,
}: { hotel: HotelSummary; meta?: HotelMeta; annualMeta?: number; onSelect: (id: number) => void; idx: number; full: boolean; referenceMonth: string }) {
  const cfg      = STATUS_CONFIG[hotel.status] ?? STATUS_CONFIG.critical;
  const metaVal  = meta?.receitaMeta;
  const elapsed  = monthElapsedRatio(referenceMonth) * 100;

  const metaPct  = ok(metaVal) && metaVal > 0 && ok(hotel.receitaMesAtual)
    ? (hotel.receitaMesAtual / metaVal) * 100 : null;
  const annualPct = ok(annualMeta) && annualMeta > 0
    ? (hotel.receitaYTD / annualMeta) * 100
    : null;

  const momAbs   = ok(hotel.receitaMesAtual) && ok(hotel.receitaMesAnterior)
    ? hotel.receitaMesAtual - hotel.receitaMesAnterior : null;
  const yoyAbs   = ok(hotel.receitaMesAtual) && ok(hotel.receitaAnoAnterior)
    ? hotel.receitaMesAtual - hotel.receitaAnoAnterior : null;
  const momRec   = pctDelta(hotel.receitaMesAtual, hotel.receitaMesAnterior);
  const yoyRec   = pctDelta(hotel.receitaMesAtual, hotel.receitaAnoAnterior);
  const annualDelta = ok(annualMeta) ? hotel.receitaYTD - annualMeta : null;
  const annualDeltaColor = !ok(annualDelta) ? 'var(--text-m)' : annualDelta >= 0 ? 'var(--green)' : 'var(--red)';

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

  const annualMetaColor = !ok(annualPct) ? 'var(--text-m)'
    : annualPct >= 100           ? 'var(--green)'
    : annualPct >= elapsed * 0.9 ? 'var(--green)'
    : annualPct >= elapsed * 0.7 ? 'var(--gold)'
    : 'var(--red)';

  const annualMetaBg = !ok(annualPct) ? 'transparent'
    : annualPct >= 100           ? 'var(--green-l)'
    : annualPct >= elapsed * 0.9 ? 'var(--green-l)'
    : annualPct >= elapsed * 0.7 ? 'color-mix(in srgb,var(--gold) 14%,transparent)'
    : 'var(--red-l)';

  const td: React.CSSProperties = {
    padding: '13px 16px',
    borderBottom: '1px solid var(--border-l)',
    verticalAlign: 'middle',
  };
  const tdNum: React.CSSProperties = {
    ...td, textAlign: 'center',
    fontFamily: 'var(--mono)', fontSize: full ? 10.4 : 13, fontWeight: 700, color: 'var(--text)',
  };
  const secondaryNumberFontSize = full ? 10 : 12.5;

  return (
    <tr
      onClick={() => onSelect(hotel.id)}
      style={{ cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-h)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Rank */}
      <td style={{ ...td, width: 36, textAlign: 'center', color: 'var(--text-m)', fontSize: 11, fontWeight: 600 }}>
        {idx + 1}
      </td>

      {/* Propriedade */}
      <td style={{ ...td, minWidth: 220, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
            background: cfg.color,
            boxShadow: `0 0 0 3px color-mix(in srgb,${cfg.color} 18%,transparent)`,
          }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px', lineHeight: 1.2 }}>
              {hotel.name}
            </div>
            <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
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
      <td style={{ ...tdNum, color: 'var(--text-m)', fontWeight: 600, fontSize: secondaryNumberFontSize }}>
        {ok(metaVal) ? fmtRec(metaVal, full) : (
          <span style={{ fontSize: 10.5, color: 'var(--border)', fontStyle: 'italic', fontFamily: 'inherit' }}>—</span>
        )}
      </td>

      {/* Real com mini barra */}
      <td style={{ ...tdNum }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
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
      <td style={{ ...td, textAlign: 'center' }}>
        {ok(metaPct) ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 12, fontWeight: 800, color: metaColor, background: metaBg,
            borderRadius: 99, padding: '4px 10px',
          }}>
            {metaPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--border)' }}>—</span>
        )}
      </td>

      {/* MoM */}
      <td style={{ ...td, textAlign: 'center' }}>
        <DeltaCell absValue={momAbs} pct={momRec} full={full} context="mom" />
      </td>

      {/* YoY */}
      <td style={{ ...td, textAlign: 'center' }}>
        <DeltaCell absValue={yoyAbs} pct={yoyRec} full={full} context="yoy" />
      </td>

      {/* Meta acumulada */}
      <td style={{
        ...tdNum,
        borderLeft: '1px solid var(--border-l)',
        color: 'var(--text-m)',
        fontWeight: 600,
        fontSize: secondaryNumberFontSize,
      }}>
        {ok(annualMeta) ? fmtRec(annualMeta, full) : (
          <span style={{ fontSize: 10.5, color: 'var(--border)', fontStyle: 'italic', fontFamily: 'inherit' }}>—</span>
        )}
      </td>

      {/* Real acumulado */}
      <td style={{
        ...tdNum,
        color: 'var(--accent-d)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
          <span>{fmtRec(hotel.receitaYTD, full)}</span>
          {ok(annualPct) && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, fontWeight: 800, color: annualMetaColor, background: annualMetaBg,
              borderRadius: 99, padding: '4px 10px',
            }}>
              {annualPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
          )}
        </div>
      </td>

      {/* Delta acumulado */}
      <td style={{ ...tdNum, color: annualDeltaColor }}>
        {fmtDelta(annualDelta, full)}
      </td>
    </tr>
  );
});

// ─── Sort value ───────────────────────────────────────────────────────────────

function getSortValue(h: HotelSummary, meta: HotelMeta | undefined, col: SortCol, annualMeta?: number): number | string {
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
    case 'metaYtd': return annualMeta ?? -1;
    case 'ytd':     return h.receitaYTD ?? 0;
    case 'deltaYtd': return ok(annualMeta) ? (h.receitaYTD ?? 0) - annualMeta : -999_999_999;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function clientesRowToHotel(row: ClientesPageRow): HotelSummary {
  return {
    id: row.hotelId,
    name: row.hotelNome,
    razaoSocial: row.hotelNome,
    city: row.cidade ?? '--',
    state: row.estado ?? '--',
    uhs: row.totalUhs,
    leitos: null,
    ativo: true,
    avgOcc: row.occReferencia,
    avgRevpar: row.revparReferencia,
    avgDm: row.dmReferencia,
    totalReceita: row.receitaRealYtd,
    totalRecDiarias: 0,
    totalRecAb: 0,
    diasComDados: 0,
    receitaMesAnterior: row.receitaMesAnterior,
    receitaMesAtual: row.receitaReal,
    receitaMesQueVem: 0,
    occMesAnterior: 0,
    occMesAtual: row.occReferencia,
    occMesQueVem: 0,
    ocupadosMesAtual: 0,
    cortesiaMesAtual: 0,
    recDiariasMesAtual: 0,
    hospedesMesAtual: 0,
    diasMesAtual: 0,
    recDiariasMesAnterior: 0,
    ocupadosMesAnterior: 0,
    receitaAnoAnterior: row.receitaAnoAnterior,
    recDiariasAnoAnterior: 0,
    occAnoAnterior: 0,
    ocupadosAnoAnterior: 0,
    receitaYTD: row.receitaRealYtd,
    ocupadosYTD: 0,
    hospedesYTD: 0,
    occAvgYTD: row.occReferencia,
    dmYTD: row.dmReferencia,
    latestDate: '--',
    latestExtracao: '--',
    latestOcc: row.occReferencia,
    latestRevpar: row.revparReferencia,
    latestDm: row.dmReferencia,
    latestRecTotal: row.receitaReal,
    latestOcupados: 0,
    status: row.status,
  };
}

export default function Clientes() {
  const [sortCol, setSortCol]     = useState<SortCol>('receita');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');
  const [fullNumbers, setFull]    = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => currentMesAno());
  const [selectedPosition, setSelectedPosition] = useState('');
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').toLowerCase().trim();
  const handleSelectHotel = useCallback((id: number) => navigate(`/clientes/${id}`), [navigate]);

  const {
    calendar,
    loading: calendarLoading,
    error: calendarError,
  } = useClientesCalendar(selectedMonth || null, selectedPosition || null);
  const resolvedMonth = calendar?.selectedMesAno ?? '';
  const resolvedPosition = calendar?.selectedDataExtracao ?? '';
  const calendarMatchesSelection = Boolean(
    calendar &&
    calendar.requestedMesAno === (selectedMonth || '') &&
    calendar.requestedDataExtracao === (selectedPosition || '')
  );
  const tableMonth = selectedMonth && selectedPosition
    ? selectedMonth
    : calendarMatchesSelection
      ? resolvedMonth
      : '';
  const tablePosition = selectedMonth && selectedPosition
    ? selectedPosition
    : calendarMatchesSelection
      ? resolvedPosition
      : '';
  const {
    rows,
    loading: tableLoading,
    error: tableError,
  } = useClientesTable(tableMonth || null, tablePosition || null);
  const error = calendarError || tableError;

  const availableMonths = useMemo(() => {
    return [...(calendar?.availableMonths ?? [])].sort();
  }, [calendar]);

  const availablePositionDates = useMemo(() => {
    return [...(calendar?.availableExtractionDates ?? [])].sort();
  }, [calendar]);

  const calendarMonth = selectedMonth || resolvedMonth || availableMonths[availableMonths.length - 1] || '';
  const calendarPosition = selectedPosition || resolvedPosition || '';

  const handleReferenceMonthSelect = (month: string) => {
    setSelectedMonth(month);
  };

  const handlePositionSelect = (date: string) => {
    if (availablePositionDates.length > 0 && !availablePositionDates.includes(date)) return;
    setSelectedPosition(date);
  };

  const handleCurrentMonthSelect = () => {
    setSelectedMonth(currentMesAno());
    setSelectedPosition('');
  };

  useEffect(() => {
    if (calendarLoading || !calendar) return;
    if (calendar.requestedMesAno !== (selectedMonth || '')) return;
    if (calendar.requestedDataExtracao !== (selectedPosition || '')) return;
    if (calendar.selectedMesAno !== selectedMonth) setSelectedMonth(calendar.selectedMesAno);
    if (calendar.selectedDataExtracao !== selectedPosition) setSelectedPosition(calendar.selectedDataExtracao);
  }, [calendar, calendarLoading, selectedMonth, selectedPosition]);

  const referenceHotels = useMemo(
    () => rows.map(clientesRowToHotel),
    [rows]
  );

  const metaMap = useMemo(() => {
    const m = new Map<number, HotelMeta>();
    rows.forEach(row => {
      if (!ok(row.receitaMeta)) return;
      m.set(row.hotelId, {
        hotelId: row.hotelId,
        mesAno: row.selectedMesAno || selectedMonth,
        receitaMeta: row.receitaMeta,
        occMeta: null,
        dmMeta: null,
        revparMeta: null,
      });
    });
    return m;
  }, [rows, selectedMonth]);

  const annualMetaMap = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach(row => {
      if (ok(row.receitaMetaYtd)) m.set(row.hotelId, row.receitaMetaYtd);
    });
    return m;
  }, [rows]);

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  }

  const filtered = useMemo(() => {
    if (!q) return referenceHotels;
    return referenceHotels.filter(h =>
      h.name.toLowerCase().includes(q) ||
      h.city.toLowerCase().includes(q) ||
      h.state.toLowerCase().includes(q)
    );
  }, [referenceHotels, q]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, metaMap.get(a.id), sortCol, annualMetaMap.get(a.id));
      const bv = getSortValue(b, metaMap.get(b.id), sortCol, annualMetaMap.get(b.id));
      if (typeof av === 'string') {
        const c = av.localeCompare(bv as string);
        return sortDir === 'asc' ? c : -c;
      }
      const c = (av as number) - (bv as number);
      return sortDir === 'asc' ? c : -c;
    });
  }, [filtered, sortCol, sortDir, metaMap, annualMetaMap]);

  const shProps = { active: sortCol, dir: sortDir, onSort: handleSort };
  const hasStaleRows = Boolean(
    !tableMonth ||
    !tablePosition ||
    !calendarMatchesSelection ||
    (rows[0]?.selectedMesAno && rows[0].selectedMesAno !== tableMonth) ||
    (rows[0]?.selectedDataExtracao && rows[0].selectedDataExtracao !== tablePosition)
  );
  const isTableLoading = !error && (calendarLoading || tableLoading || hasStaleRows);

  return (
    <div className="fade-in">
      {/* ── Header ── */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.4px' }}>Clientes</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-m)', marginTop: 2 }}>
            {!isTableLoading && q
              ? `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''} para "${q}"`
              : `${referenceHotels.length} ${referenceHotels.length === 1 ? 'hotel' : 'hotéis'} · receita por referência`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {calendarMonth && (
            <HeaderMonthReference
              selectedMonth={calendarMonth}
              availableMonths={availableMonths}
              onSelect={handleReferenceMonthSelect}
              selectedPosition={calendarPosition}
              availablePositionDates={availablePositionDates}
              onPositionSelect={handlePositionSelect}
              onCurrentMonthSelect={handleCurrentMonthSelect}
            />
          )}

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

        </div>
      </div>

      {!isTableLoading && !error && sorted.length === 0 ? (
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
          position: 'relative',
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
                    padding: '6px 16px', textAlign: 'center',
                    borderBottom: '1px solid var(--border-l)',
                    borderLeft: '1px solid var(--border-l)',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    color: 'var(--accent-d)',
                    background: 'var(--accent-l)',
                  }}>
                    Receita — {monthLabel(selectedMonth)}
                  </td>

                  {/* YTD group */}
                  <td colSpan={3} style={{
                    padding: '6px 16px', textAlign: 'center',
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
                  <SortHeader label="Propriedade" col="nome"    {...shProps} />
                  <SortHeader label="Meta"         col="meta"    {...shProps} sub="mês" />
                  <SortHeader label="Real"         col="receita" {...shProps} sub={monthLabel(selectedMonth)} />
                  <SortHeader label="Δ Real vs Meta" col="metaPct" {...shProps} sub="realização" />
                  <SortHeader label="MoM"          col="mom"     {...shProps} sub="vs mês ant." />
                  <SortHeader label="YoY"          col="yoy"     {...shProps} sub="vs ano ant." />
                  <SortHeader label="Meta"         col="metaYtd" {...shProps} sub="acum." />
                  <SortHeader label="Real"         col="ytd"     {...shProps} sub={selectedMonth === currentMesAno() ? 'jan → hoje' : 'jan → ref.'} />
                  <SortHeader label="Delta"        col="deltaYtd" {...shProps} sub="real - meta" />
                </tr>
              </thead>

              <tbody>
                {isTableLoading ? (
                  <LoadingRows />
                ) : error ? (
                  <TableMessage tone="error">{error}</TableMessage>
                ) : sorted.length === 0 ? (
                  <TableMessage>
                    {q ? `Nenhum hotel encontrado para "${q}"` : 'Nenhum hotel cadastrado'}
                  </TableMessage>
                ) : (
                  sorted.map((h, i) => (
                    <HotelRow
                      key={h.id}
                      hotel={h}
                      meta={metaMap.get(h.id)}
                      annualMeta={annualMetaMap.get(h.id)}
                      onSelect={handleSelectHotel}
                      idx={i}
                      full={fullNumbers}
                      referenceMonth={selectedMonth}
                    />
                  ))
                )}
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
