import { useMemo, useState, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Hash, Info } from 'lucide-react';
import type { BookingRate, PickupRow } from '@/data/types';
import { eventosNaData, type Feriado } from '@/data/eventos';
import { Skeleton } from '@/components/ui/Skeleton';
import ExtracaoCalendar from '@/components/ui/ExtracaoCalendar';
import { stayAxis, extractionAxis, axisPanel, axisLabel } from '@/components/ui/axisPanel';

// ─── Formatting helpers ───────────────────────────────────────────────

function fmtShopper(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }); }
function deltaColor(v: number) { return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-m)'; }
function fmtDeltaInt(v: number) { return v === 0 ? '—' : `${v > 0 ? '+' : ''}${v}`; }
function fmtWholeAware(v: number, whole: boolean, decimals = 2) {
  return v.toLocaleString('pt-BR', {
    minimumFractionDigits: whole ? 0 : decimals,
    maximumFractionDigits: whole ? 0 : decimals,
  });
}

function fmtDeltaWholeAware(v: number, whole: boolean, suffix = '') {
  if (v === 0) return '\u2014';
  return `${v > 0 ? '+' : ''}${fmtWholeAware(v, whole)}${suffix}`;
}

function occColor(occ: number) {
  return occ >= 80 ? 'var(--green)' : occ >= 50 ? 'var(--accent)' : occ >= 25 ? 'var(--amber)' : 'var(--red)';
}

function fmtFullDate(d: string) {
  const [year, month, day] = d.split('-');
  return `${day}/${month}/${year}`;
}

function fmtYearMonth(ym: string) {
  const [year, month] = ym.split('-');
  return `${MES_PT[Number(month) - 1] ?? month}/${year}`;
}

function fmtYearMonthTitle(ym: string) {
  const [year, month] = ym.split('-');
  return `${MES_PT_FULL[Number(month) - 1] ?? month} ${year}`;
}

function fmtReferenceRange(months: string[]) {
  if (months.length === 0) return 'sem datas de diária';

  const sorted = [...months].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const [firstYear, firstMonth] = first.split('-');
  const [lastYear, lastMonth] = last.split('-');
  const lastDay = String(new Date(Number(lastYear), Number(lastMonth), 0).getDate()).padStart(2, '0');

  return `01/${firstMonth}/${firstYear} a ${lastDay}/${lastMonth}/${lastYear}`;
}

function fmtReferencePeriod(months: string[]) {
  if (months.length === 0) return 'sem diárias';
  if (months.length <= 3) return months.map(fmtYearMonth).join(', ');
  return `${fmtYearMonth(months[0])} a ${fmtYearMonth(months[months.length - 1])} (${months.length} meses)`;
}

function rateScrapeDate(rate: BookingRate) {
  return rate.scrapedAt.slice(0, 10);
}

function hasPickupChange(r: PickupRow) {
  return r.data_extracao_ant !== null && (
    r.pu_tt_uh !== 0 ||
    parseFloat(r.pu_rec_hosp) !== 0 ||
    parseFloat(r.pu_dm_tt) !== 0 ||
    parseFloat(r.pu_occ_tt) !== 0 ||
    parseFloat(r.pu_revpar_tt) !== 0
  );
}

const MES_PT  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Table ────────────────────────────────────────────────────────────

interface PickupTableProps {
  data: PickupRow[];
  selectedMonths: string[];
  availableMonths: string[];
  onReferenceChange: (months: string[]) => void;
  selectedPosition?: string;
  availablePositionDates?: string[];
  onPositionChange?: (date: string) => void;
  onCurrentMonthSelect?: () => void;
  shopperRates: BookingRate[];
  eventos?: Feriado[];
  loading?: boolean;
  viewToggle?: React.ReactNode;
}

const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 7px', borderBottom: '1px solid var(--border-l)',
  fontFamily: 'var(--mono)', whiteSpace: 'nowrap', ...extra,
});
const thPu: React.CSSProperties = {
  padding:'6px 7px', fontSize:'9px', fontWeight:600, color:'var(--green)',
  letterSpacing:'0.3px', borderBottom:'2px solid #A7F3D0', whiteSpace:'nowrap', textAlign:'left',
};
const thSnap: React.CSSProperties = { ...thPu, color: extractionAxis.text, borderBottom: `2px solid ${extractionAxis.border}` };
const thShopper: React.CSSProperties = {
  ...thPu,
  color: 'var(--accent-d)',
  background: 'var(--accent-l)',
  textAlign: 'right',
  borderBottom: '2px solid var(--accent)',
};
const thGroup: React.CSSProperties = {
  padding: '7px',
  fontSize: 9,
  fontWeight: 850,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-l)',
  whiteSpace: 'nowrap',
  textAlign: 'center',
};

type ShopperPaxPrices = Record<1 | 2 | 3 | 4, number | null>;

const emptyShopperPrices = (): ShopperPaxPrices => ({ 1: null, 2: null, 3: null, 4: null });

function PickupTableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 12 }, (_, row) => (
        <tr key={row}>
          {Array.from({ length: 18 }, (_, col) => (
            <td key={col} style={cell()}>
              <Skeleton height={14} radius={4} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default function PickupTable({
  data,
  selectedMonths,
  availableMonths,
  onReferenceChange,
  selectedPosition,
  availablePositionDates,
  onPositionChange,
  onCurrentMonthSelect,
  shopperRates,
  eventos = [],
  loading = false,
  viewToggle,
}: PickupTableProps) {
  const validData = useMemo(
    () => data.filter(r => Boolean(r.data_extracao && r.data_referencia)),
    [data]
  );

  const monthFilteredRows = useMemo(() => {
    if (selectedMonths.length === 0) return validData;
    return validData.filter(r => selectedMonths.includes(r.data_referencia.slice(0, 7)));
  }, [selectedMonths, validData]);

  const referenceMonths = useMemo(() => {
    const months = selectedMonths.length > 0
      ? selectedMonths
      : monthFilteredRows.map(r => r.data_referencia.slice(0, 7));
    return [...new Set(months)].sort();
  }, [monthFilteredRows, selectedMonths]);

  const availableReferenceMonths = useMemo(() => {
    const months = availableMonths.length > 0
      ? availableMonths
      : validData.map(r => r.data_referencia.slice(0, 7));
    return [...new Set(months)].sort();
  }, [availableMonths, validData]);

  const referenceLabel = useMemo(() => fmtReferencePeriod(referenceMonths), [referenceMonths]);
  const referenceRangeLabel = useMemo(() => fmtReferenceRange(referenceMonths), [referenceMonths]);
  const activeReferenceMonth = referenceMonths.length > 0
    ? referenceMonths[referenceMonths.length - 1]
    : availableReferenceMonths[availableReferenceMonths.length - 1] ?? null;
  const referenceTitle = referenceMonths.length === 1 && activeReferenceMonth
    ? fmtYearMonthTitle(activeReferenceMonth)
    : referenceLabel;
  const activeReferenceIndex = activeReferenceMonth ? availableReferenceMonths.indexOf(activeReferenceMonth) : -1;
  const prevReference = activeReferenceIndex > 0 ? availableReferenceMonths[activeReferenceIndex - 1] : null;
  const nextReference = activeReferenceIndex >= 0 && activeReferenceIndex < availableReferenceMonths.length - 1
    ? availableReferenceMonths[activeReferenceIndex + 1]
    : null;

  // Extraction dates sorted ascending for the current period
  const allExtracoes = useMemo(
    () => [...new Set(monthFilteredRows.map(r => r.data_extracao))].sort(),
    [monthFilteredRows]
  );

  const changedExtracoes = useMemo(
    () => [...new Set(monthFilteredRows.filter(hasPickupChange).map(r => r.data_extracao))].sort(),
    [monthFilteredRows]
  );

  // Default to most recent extraction
  const [selectedExtracao, setSelectedExtracao] = useState<string | null>(null);
  const [settledExtracao, setSettledExtracao] = useState<string | null>(null);
  const [isExtracaoLoading, setIsExtracaoLoading] = useState(false);
  const referenceKey = referenceMonths.join('|');

  useEffect(() => {
    setSelectedExtracao(null);
    setSettledExtracao(null);
  }, [referenceKey]);

  // Filter: only rows with changes
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [wholeValues, setWholeValues] = useState(false);
  const calendarExtracoes = useMemo(() => {
    const source = availablePositionDates && availablePositionDates.length > 0
      ? availablePositionDates
      : allExtracoes;
    return [...new Set(source)].sort();
  }, [allExtracoes, availablePositionDates]);
  const defaultExtracao = calendarExtracoes.length > 0 ? calendarExtracoes[calendarExtracoes.length - 1] : null;
  const controlledExtracao = selectedPosition && calendarExtracoes.includes(selectedPosition)
    ? selectedPosition
    : null;
  const activeExtracao = controlledExtracao
    ?? (selectedExtracao && calendarExtracoes.includes(selectedExtracao)
    ? selectedExtracao
    : defaultExtracao);

  useEffect(() => {
    if (activeExtracao === settledExtracao) return;

    setIsExtracaoLoading(true);
    const timer = window.setTimeout(() => {
      setSettledExtracao(activeExtracao);
      setIsExtracaoLoading(false);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [activeExtracao, settledExtracao]);

  const activeExtracaoIndex = activeExtracao ? calendarExtracoes.indexOf(activeExtracao) : -1;
  const prevExtracao = activeExtracaoIndex > 0 ? calendarExtracoes[activeExtracaoIndex - 1] : null;
  const nextExtracao = activeExtracaoIndex >= 0 && activeExtracaoIndex < calendarExtracoes.length - 1
    ? calendarExtracoes[activeExtracaoIndex + 1]
    : null;

  const shopperByDate = useMemo(() => {
    const map = new Map<string, ShopperPaxPrices>();
    if (!activeExtracao) return map;

    for (const rate of shopperRates) {
      if (rate.type !== 'cliente') continue;
      if (rateScrapeDate(rate) !== activeExtracao) continue;

      const prices = map.get(rate.checkinDate) ?? emptyShopperPrices();
      const pax = rate.maxPersons >= 4 ? 4 : rate.maxPersons;
      if (pax < 1 || pax > 4) continue;

      const key = pax as 1 | 2 | 3 | 4;
      const current = prices[key];
      if (current == null || rate.priceBrl < current) prices[key] = rate.priceBrl;
      map.set(rate.checkinDate, prices);
    }

    return map;
  }, [activeExtracao, shopperRates]);

  // Filter by selected months then by extraction date
  const filtered = useMemo(() => {
    let rows = monthFilteredRows;
    if (activeExtracao)
      rows = rows.filter(r => r.data_extracao === activeExtracao);
    if (onlyChanged)
      rows = rows.filter(hasPickupChange);
    return rows.sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
  }, [monthFilteredRows, activeExtracao, onlyChanged]);

  const hasPickup = filtered.some(r => r.data_extracao_ant !== null);
  const isTableLoading = loading || isExtracaoLoading;

  const fmtRef = fmtFullDate;
  const selectReference = (month: string | null) => {
    if (!month) return;
    onReferenceChange([month]);
    if (!onPositionChange) setSelectedExtracao(null);
  };
  const selectExtracao = (date: string) => {
    if (onPositionChange) {
      onPositionChange(date);
      return;
    }
    setSelectedExtracao(date);
  };

  return (
    <div className="card-in" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'20px', animationDelay:'0.2s' }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ gap:12, flexWrap:'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {viewToggle}
          <p className="text-[11.5px]" style={{ color:'var(--text-m)' }}>
            {filtered.length} datas na tabela
            {hasPickup
              ? ` · comparação com extração anterior`
              : ' · sem extração anterior (sem pick-up)'}
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          <button
            onClick={() => setWholeValues(v => !v)}
            title="Arredondar valores da tabela"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              border: wholeValues ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: wholeValues ? 'var(--accent-l)' : 'transparent',
              color: wholeValues ? 'var(--accent)' : 'var(--text-m)',
            }}
          >
            <Hash size={11} />
            Valor inteiro
          </button>

          {/* Only-changed toggle */}
          <button
            onClick={() => setOnlyChanged(v => !v)}
            title="Mostrar apenas linhas com alteração"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s',
              border: onlyChanged ? '1.5px solid var(--accent)' : '1px solid var(--border)',
              background: onlyChanged ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
              color: onlyChanged ? 'var(--accent)' : 'var(--text-m)',
            }}
          >
            <Filter size={11} />
            Com alteração
            {onlyChanged && (
              <span style={{
                fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: '#fff',
                borderRadius: 10, padding: '1px 5px', marginLeft: 2,
              }}>
                {filtered.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        padding: '9px 11px',
        marginBottom: 12,
        borderRadius: 'var(--rx)',
        border: '1px solid var(--border-l)',
        background: 'var(--bg)',
        fontSize: 11.5,
        fontWeight: 650,
        color: 'var(--text-m)',
      }}>
        <span style={{
          color: stayAxis.text,
          background: stayAxis.soft,
          border: `1px solid ${stayAxis.border}`,
          borderRadius: 999,
          padding: '2px 8px',
          fontWeight: 850,
        }}>
          Diárias de {referenceTitle}
        </span>
        <span>vistas na</span>
        <span style={{
          color: extractionAxis.text,
          background: extractionAxis.soft,
          border: `1px solid ${extractionAxis.border}`,
          borderRadius: 999,
          padding: '2px 8px',
          fontWeight: 850,
        }}>
          extração de {activeExtracao ? fmtFullDate(activeExtracao) : '--'}
        </span>
        <span style={{ color: 'var(--text-m)' }}>
          {prevExtracao ? `Pick-up vs ${fmtFullDate(prevExtracao)}` : 'sem extração anterior'}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 14,
        padding: '0 0 16px',
        marginBottom: 14,
        borderBottom: '1px solid var(--border-l)',
      }}>
        <div style={axisPanel(stayAxis)}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}>
            <span style={{ ...axisLabel(stayAxis), marginBottom:0 }}>MÊS DAS DIÁRIAS</span>
            {onCurrentMonthSelect && (
              <button
                type="button"
                onClick={onCurrentMonthSelect}
                title="Voltar ao mês atual e à última extração"
                aria-label="Voltar ao mês atual e à última extração"
                style={{
                  display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:99,
                  border:`1px solid ${stayAxis.border}`, background:'var(--surface)', color: stayAxis.text,
                  fontSize:10, fontWeight:800, cursor:'pointer',
                }}
              >
                <CalendarDays size={11} /> Mês atual
              </button>
            )}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'34px minmax(0,1fr) 34px', alignItems:'center', gap:10 }}>
            <button
              onClick={() => selectReference(prevReference)}
              disabled={!prevReference}
              title="Mês das diárias anterior"
              aria-label="Mês das diárias anterior"
              style={{
                width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:'var(--rx)', border:`1px solid ${stayAxis.border}`,
                background:'var(--surface)', color: stayAxis.text,
                opacity: prevReference ? 1 : 0.35,
                cursor: prevReference ? 'pointer' : 'default',
              }}
            >
              <ChevronLeft size={17} />
            </button>

            <div style={{ minWidth:0 }}>
              <div style={{
                fontSize: 30,
                lineHeight: 1.05,
                fontWeight: 900,
                color: stayAxis.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {referenceTitle}
              </div>
              <div style={{ marginTop: 5, fontSize: 12, fontWeight: 650, color: 'var(--text-m)' }}>
                {referenceRangeLabel}
              </div>
            </div>

            <button
              onClick={() => selectReference(nextReference)}
              disabled={!nextReference}
              title="Próximo mês das diárias"
              aria-label="Próximo mês das diárias"
              style={{
                width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:'var(--rx)', border:`1px solid ${stayAxis.border}`,
                background:'var(--surface)', color: stayAxis.text,
                opacity: nextReference ? 1 : 0.35,
                cursor: nextReference ? 'pointer' : 'default',
              }}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div style={axisPanel(extractionAxis)}>
          <div style={axisLabel(extractionAxis)}>
            EXTRAÇÃO DOS DADOS
          </div>
          {calendarExtracoes.length > 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <button
                onClick={() => prevExtracao && selectExtracao(prevExtracao)}
                disabled={!prevExtracao}
                title="Extração dos dados anterior"
                aria-label="Extração dos dados anterior"
                style={{
                  width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'var(--rx)', border:`1px solid ${extractionAxis.border}`,
                  background:'var(--surface)', color: extractionAxis.text,
                  opacity: prevExtracao ? 1 : 0.35,
                  cursor: prevExtracao ? 'pointer' : 'default',
                }}
              >
                <ChevronLeft size={14} />
              </button>

              <ExtracaoCalendar
                available={calendarExtracoes}
                changed={changedExtracoes}
                selected={activeExtracao}
                onSelect={selectExtracao}
              />

              <button
                onClick={() => nextExtracao && selectExtracao(nextExtracao)}
                disabled={!nextExtracao}
                title="Próxima extração dos dados"
                aria-label="Próxima extração dos dados"
                style={{
                  width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'var(--rx)', border:`1px solid ${extractionAxis.border}`,
                  background:'var(--surface)', color: extractionAxis.text,
                  opacity: nextExtracao ? 1 : 0.35,
                  cursor: nextExtracao ? 'pointer' : 'default',
                }}
              >
                <ChevronRight size={14} />
              </button>
              {activeExtracao && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: extractionAxis.text,
                  marginLeft: 4,
                }}>
                  {fmtFullDate(activeExtracao)}
                </span>
              )}
            </div>
          ) : (
            <button
              disabled
              style={{
                display:'flex', alignItems:'center', gap:6,
                padding:'6px 12px', borderRadius:'var(--rx)',
                background:'var(--bg)', border:'1px solid var(--border)',
                color:'var(--text-m)', fontSize:12, fontWeight:600,
                opacity:0.65, cursor:'default',
              }}
            >
              <CalendarDays size={13} />
              Sem extrações
            </button>
          )}
          <div style={{ marginTop: 7, fontSize: 11.5, color: 'var(--text-m)', fontWeight: 600 }}>
            {hasPickup ? 'Retrato capturado nessa data para calcular o pick-up das diárias.' : 'Sem extração anterior para comparar essas diárias.'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight:'460px', scrollbarWidth:'thin', scrollbarColor:'var(--border) transparent' }}>
        <table className="w-full" style={{ borderCollapse:'collapse', fontSize:'11px' }}>
          <thead className="sticky top-0" style={{ background:'var(--surface)' }}>
            <tr>
              <th scope="colgroup" style={{ ...thGroup, color: stayAxis.text, background: stayAxis.soft }} colSpan={1}>Diária</th>
              <th scope="colgroup" style={{ ...thGroup, color: 'var(--green)', background: 'var(--green-l)' }} colSpan={5}>Pick-up vs extração anterior</th>
              <th scope="colgroup" style={{ ...thGroup, color: extractionAxis.text, background: extractionAxis.soft }} colSpan={8}>Retrato na extração selecionada</th>
              <th scope="colgroup" style={{ ...thGroup, color: 'var(--accent-d)', background: 'var(--accent-l)' }} colSpan={4}>Shopper</th>
            </tr>
            <tr>
              <th scope="col" style={{ ...thSnap, color: stayAxis.text }}>DATA DA DIÁRIA</th>
              <th scope="col" style={thPu}>TT UH</th>
              <th scope="col" style={thPu}>REC HOSP</th>
              <th scope="col" style={thPu}>DM TT</th>
              <th scope="col" style={thPu}>OCC%</th>
              <th scope="col" style={thPu}>REVPAR</th>
              <th scope="col" style={thSnap}>TT UHS OCUP</th>
              <th scope="col" style={thSnap}>REC HOSP</th>
              <th scope="col" style={thSnap}>DM C/C TT</th>
              <th scope="col" style={thSnap}>OCC% TT</th>
              <th scope="col" style={thSnap}>REVP TT</th>
              <th scope="col" style={thSnap}>TT HOSP</th>
              <th scope="col" style={thSnap}>CHDS</th>
              <th scope="col" style={thSnap}>UHS DISP</th>
              <th scope="col" style={thShopper}>SHOPPER PAX 1</th>
              <th scope="col" style={thShopper}>SHOPPER PAX 2</th>
              <th scope="col" style={thShopper}>SHOPPER PAX 3</th>
              <th scope="col" style={thShopper}>SHOPPER PAX 4</th>
            </tr>
          </thead>
          <tbody>
            {isTableLoading ? (
              <PickupTableSkeletonRows />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={18} style={{ padding:'24px', textAlign:'center', color:'var(--text-m)', fontSize:12 }}>
                  Nenhum dado para os filtros selecionados
                </td>
              </tr>
            ) : filtered.map(r => {
              const puRec    = parseFloat(r.pu_rec_hosp) || 0;
              const puDm     = parseFloat(r.pu_dm_tt)   || 0;
              const puOcc    = parseFloat(r.pu_occ_tt)  || 0;
              const puRevpar = parseFloat(r.pu_revpar_tt) || 0;
              const occTt    = parseFloat(r.occ_tt)     || 0;
              const noPickup = r.data_extracao_ant === null;
              const shopperPrices = shopperByDate.get(r.data_referencia) ?? emptyShopperPrices();
              const feriados = eventosNaData(eventos, r.data_referencia);

              return (
                <tr key={`${r.data_referencia}-${r.data_extracao}`}
                  className="row-hover"
                  style={{ transition:'background 0.1s' }}>
                  <td style={cell({ fontWeight:600 })}>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                      {fmtRef(r.data_referencia)}
                      {feriados.length > 0 && (
                        <span
                          title={`${feriados.length === 1 ? 'Feriado' : 'Feriados'}: ${feriados.join(' · ')}`}
                          aria-label={`${feriados.length === 1 ? 'Feriado' : 'Feriados'}: ${feriados.join(', ')}`}
                          style={{
                            display:'inline-flex', alignItems:'center', justifyContent:'center',
                            width:16, height:16, borderRadius:999, flexShrink:0, cursor:'help',
                            background:'var(--gold-l)', color:'var(--gold)',
                            border:'1px solid color-mix(in srgb, var(--gold) 30%, transparent)',
                          }}
                        >
                          <Info size={10} />
                        </span>
                      )}
                    </span>
                  </td>
                  {/* Pick-ups */}
                  {noPickup ? (
                    <td colSpan={5} style={cell({ color:'var(--text-m)', fontSize:10, textAlign:'center', fontStyle:'italic' })}>
                      sem extração anterior
                    </td>
                  ) : (
                    <>
                      <td style={cell({ color:deltaColor(r.pu_tt_uh), fontSize:10 })}>{fmtDeltaInt(r.pu_tt_uh)}</td>
                      <td style={cell({ color:deltaColor(puRec),    fontSize:10 })}>{fmtDeltaWholeAware(puRec, wholeValues)}</td>
                      <td style={cell({ color:deltaColor(puDm),     fontSize:10 })}>{fmtDeltaWholeAware(puDm, wholeValues)}</td>
                      <td style={cell({ color:deltaColor(puOcc),    fontSize:10 })}>{fmtDeltaWholeAware(puOcc, wholeValues, 'pp')}</td>
                      <td style={cell({ color:deltaColor(puRevpar), fontSize:10 })}>{fmtDeltaWholeAware(puRevpar, wholeValues)}</td>
                    </>
                  )}
                  {/* Snapshot */}
                  <td style={cell({ textAlign:'center' })}>{r.tt_uhs_ocup}</td>
                  <td style={cell()}>{fmtWholeAware(parseFloat(r.rec_hosp) || 0, wholeValues)}</td>
                  <td style={cell()}>{fmtWholeAware(parseFloat(r.dm_cc_tt) || 0, wholeValues)}</td>
                  <td style={cell({ fontWeight:600, color:occColor(occTt) })}>{fmtWholeAware(occTt, wholeValues, 1)}%</td>
                  <td style={cell({ fontWeight:600, color:'var(--accent-d)' })}>{fmtWholeAware(parseFloat(r.revp_tt) || 0, wholeValues)}</td>
                  <td style={cell({ textAlign:'center', color:'var(--text-m)' })}>{r.tt_hosp ?? '—'}</td>
                  <td style={cell({ textAlign:'center', color:'var(--text-m)' })}>{r.chds ?? '—'}</td>
                  <td style={cell({ textAlign:'center' })}>{r.uhs_disp}</td>
                  {[1, 2, 3, 4].map(pax => {
                    const price = shopperPrices[pax as 1 | 2 | 3 | 4];
                    return (
                      <td key={pax} style={cell({
                        textAlign: 'right',
                        fontWeight: 700,
                        fontSize: 10,
                        color: price == null ? 'var(--text-m)' : 'var(--accent-d)',
                        background: price == null ? 'transparent' : 'var(--accent-l)',
                      })}>
                        {price == null ? '—' : fmtShopper(price)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
