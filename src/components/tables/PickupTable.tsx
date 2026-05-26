import { useMemo, useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter, Hash } from 'lucide-react';
import type { BookingRate, PickupRow } from '@/data/types';

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
  if (months.length === 0) return 'sem datas na referência';

  const sorted = [...months].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const [firstYear, firstMonth] = first.split('-');
  const [lastYear, lastMonth] = last.split('-');
  const lastDay = String(new Date(Number(lastYear), Number(lastMonth), 0).getDate()).padStart(2, '0');

  return `01/${firstMonth}/${firstYear} a ${lastDay}/${lastMonth}/${lastYear}`;
}

function fmtReferencePeriod(months: string[]) {
  if (months.length === 0) return 'sem referência';
  if (months.length <= 3) return months.map(fmtYearMonth).join(', ');
  return `${fmtYearMonth(months[0])} a ${fmtYearMonth(months[months.length - 1])} (${months.length} meses)`;
}

function isPickupExtractionAllowed(r: PickupRow) {
  return r.data_extracao.slice(0, 7) <= r.data_referencia.slice(0, 7);
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

const DIAS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MES_PT  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_PT_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Extraction date calendar ─────────────────────────────────────────

interface ExtracaoCalendarProps {
  available: string[];     // YYYY-MM-DD dates that have extractions
  changed:   string[];     // YYYY-MM-DD dates that have pickup changes
  selected:  string | null;
  onSelect:  (d: string) => void;
}

function ExtracaoCalendar({ available, changed, selected, onSelect }: ExtracaoCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const changedSet = useMemo(() => new Set(changed), [changed]);
  const basePalette = {
    soft: 'var(--accent-l)',
    border: 'color-mix(in srgb,var(--accent) 30%,transparent)',
    text: 'var(--accent-d)',
    selected: 'var(--accent)',
  };
  const changedPalette = {
    soft: '#F0EDE8',
    border: '#D6C8BA',
    text: '#6F5D4B',
    selected: '#9A7657',
  };

  // Default calendar month: month of the selected or most recent available
  const initialYM = useMemo(() => {
    const base = selected ?? available[available.length - 1];
    return base ? base.slice(0, 7) : new Date().toISOString().slice(0, 7);
  }, [selected, available]);

  const [calYM, setCalYM] = useState(initialYM);

  useEffect(() => { setCalYM(initialYM); }, [initialYM]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const availSet = useMemo(() => new Set(available), [available]);
  const availableMonths = useMemo(
    () => [...new Set(available.map(d => d.slice(0, 7)))].sort(),
    [available]
  );

  // Calendar grid for calYM
  const [cy, cm] = calYM.split('-').map(Number);
  const firstDay = new Date(cy, cm - 1, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const fmt = (d: string) => {
    const [, mo, day] = d.split('-');
    return `${day}/${mo}`;
  };

  const labelSelected = selected ? fmt(selected) : 'Selecionar extração';
  const prevAvailableYM = useMemo(
    () => [...availableMonths].reverse().find(ym => ym < calYM) ?? null,
    [availableMonths, calYM]
  );
  const nextAvailableYM = useMemo(
    () => availableMonths.find(ym => ym > calYM) ?? null,
    [availableMonths, calYM]
  );
  const prevYM = () => {
    if (prevAvailableYM) setCalYM(prevAvailableYM);
  };
  const nextYM = () => {
    if (nextAvailableYM) setCalYM(nextAvailableYM);
  };

  return (
    <div ref={ref} style={{ position:'relative', display:'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 transition-all"
        style={{
          padding:'6px 12px', borderRadius:'var(--rx)',
          background: open ? 'var(--accent-l)' : 'var(--bg)',
          border:`1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: open ? 'var(--accent-d)' : 'var(--text)',
          fontSize:12, fontWeight:600,
        }}
      >
        <CalendarDays size={13} style={{ color: open ? 'var(--accent)' : 'var(--text-m)' }}/>
        Extração: {labelSelected}
        <ChevronRight size={12} style={{ color:'var(--text-m)', transform: open ? 'rotate(90deg)' : 'none', transition:'transform .15s' }}/>
      </button>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:'var(--r)', boxShadow:'var(--sh-m)', padding:'14px', width:240,
        }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevYM}
              disabled={!prevAvailableYM}
              style={{
                padding:'3px 8px',
                borderRadius:'var(--rx)',
                color:'var(--text-m)',
                opacity: prevAvailableYM ? 1 : 0.35,
                cursor: prevAvailableYM ? 'pointer' : 'default',
              }}
              className="hover:bg-[var(--surface-h)]"
            >
              <ChevronLeft size={14}/>
            </button>
            <span style={{ fontSize:13, fontWeight:800 }}>{MES_PT[cm-1]} {cy}</span>
            <button
              onClick={nextYM}
              disabled={!nextAvailableYM}
              style={{
                padding:'3px 8px',
                borderRadius:'var(--rx)',
                color:'var(--text-m)',
                opacity: nextAvailableYM ? 1 : 0.35,
                cursor: nextAvailableYM ? 'pointer' : 'default',
              }}
              className="hover:bg-[var(--surface-h)]"
            >
              <ChevronRight size={14}/>
            </button>
          </div>

          {/* Weekday headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:1, marginBottom:4 }}>
            {DIAS_PT.map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:9, fontWeight:700, color:'var(--text-m)', padding:'2px 0' }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const dateStr = `${cy}-${String(cm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const hasData  = availSet.has(dateStr);
              const isSel    = dateStr === selected;
              const hasChange = changedSet.has(dateStr);
              const palette = hasChange ? changedPalette : basePalette;
              return (
                <button
                  key={dateStr}
                  disabled={!hasData}
                  onClick={() => { onSelect(dateStr); setOpen(false); }}
                  title={hasData ? `Extração de ${fmt(dateStr)}` : undefined}
                  style={{
                    padding:'5px 2px', borderRadius:6, textAlign:'center',
                    fontSize:11.5, fontWeight: hasData ? (isSel ? 800 : 700) : 400,
                    background: isSel ? palette.selected : hasData ? palette.soft : 'transparent',
                    color: isSel ? '#fff' : hasData ? palette.text : 'var(--text-m)',
                    border:`1.5px solid ${isSel ? palette.selected : hasData ? palette.border : 'transparent'}`,
                    opacity: !hasData ? 0.3 : 1,
                    cursor: !hasData ? 'default' : 'pointer',
                    transition:'all .1s',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Available dates list */}
          {available.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border-l)' }}>
              <p style={{ fontSize:9.5, fontWeight:700, color:'var(--text-m)', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>
                Extrações disponíveis
              </p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {[...available].reverse().map(d => (
                  (() => {
                    const hasChange = changedSet.has(d);
                    const palette = hasChange ? changedPalette : basePalette;
                    return (
                      <button key={d} onClick={() => { onSelect(d); setCalYM(d.slice(0,7)); setOpen(false); }}
                        style={{
                          fontSize:10.5, fontWeight:700, borderRadius:99, padding:'2px 8px', cursor:'pointer',
                          background: d === selected ? palette.selected : hasChange ? palette.soft : 'var(--bg)',
                          color: d === selected ? '#fff' : palette.text,
                          border: `1px solid ${d === selected ? palette.selected : palette.border}`,
                        }}>
                        {fmt(d)}
                      </button>
                    );
                  })()
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────

interface PickupTableProps {
  data: PickupRow[];
  selectedMonths: string[];
  availableMonths: string[];
  onReferenceChange: (months: string[]) => void;
  shopperRates: BookingRate[];
}

const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '6px 7px', borderBottom: '1px solid var(--border-l)',
  fontFamily: 'var(--mono)', whiteSpace: 'nowrap', ...extra,
});
const thPu: React.CSSProperties = {
  padding:'6px 7px', fontSize:'9px', fontWeight:600, color:'var(--accent)',
  letterSpacing:'0.3px', borderBottom:'2px solid var(--border)', whiteSpace:'nowrap', textAlign:'left',
};
const thSnap: React.CSSProperties = { ...thPu, color:'var(--text-m)' };
const thShopper: React.CSSProperties = {
  ...thPu,
  color: 'var(--accent-d)',
  background: 'var(--accent-l)',
  textAlign: 'right',
  borderBottom: '2px solid var(--accent)',
};

type ShopperPaxPrices = Record<1 | 2 | 3 | 4, number | null>;

const emptyShopperPrices = (): ShopperPaxPrices => ({ 1: null, 2: null, 3: null, 4: null });

export default function PickupTable({
  data,
  selectedMonths,
  availableMonths,
  onReferenceChange,
  shopperRates,
}: PickupTableProps) {
  const validData = useMemo(
    () => data.filter(isPickupExtractionAllowed),
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
  const referenceKey = referenceMonths.join('|');

  useEffect(() => {
    setSelectedExtracao(null);
  }, [referenceKey]);

  // Filter: only rows with changes
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [wholeValues, setWholeValues] = useState(false);
  const calendarExtracoes = allExtracoes;
  const defaultExtracao = calendarExtracoes.length > 0 ? calendarExtracoes[calendarExtracoes.length - 1] : null;
  const activeExtracao = selectedExtracao && calendarExtracoes.includes(selectedExtracao)
    ? selectedExtracao
    : defaultExtracao;

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

  const fmtRef = fmtFullDate;
  const selectReference = (month: string | null) => {
    if (!month) return;
    onReferenceChange([month]);
    setSelectedExtracao(null);
  };

  return (
    <div className="card-in" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'20px', animationDelay:'0.2s' }}>
      {/* Header */}
      <div className="flex items-start justify-between" style={{ gap:12, flexWrap:'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 180 }}>
          <h3 className="text-sm font-semibold" style={{ letterSpacing:'-0.2px' }}>Pick-Up Diário</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color:'var(--text-m)' }}>
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
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 18,
        padding: '14px 0 16px',
        marginBottom: 14,
        borderTop: '1px solid var(--border-l)',
        borderBottom: '1px solid var(--border-l)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 0.6, color: 'var(--accent)', marginBottom: 6 }}>
            MÊS DE REFERÊNCIA
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'34px minmax(0,1fr) 34px', alignItems:'center', gap:10 }}>
            <button
              onClick={() => selectReference(prevReference)}
              disabled={!prevReference}
              title="Referência anterior"
              aria-label="Referência anterior"
              style={{
                width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:'var(--rx)', border:'1px solid var(--border)',
                background:'var(--surface)', color:'var(--text-m)',
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
                color: 'var(--text)',
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
              title="Próxima referência"
              aria-label="Próxima referência"
              style={{
                width:34, height:34, display:'flex', alignItems:'center', justifyContent:'center',
                borderRadius:'var(--rx)', border:'1px solid var(--border)',
                background:'var(--surface)', color:'var(--text-m)',
                opacity: nextReference ? 1 : 0.35,
                cursor: nextReference ? 'pointer' : 'default',
              }}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div style={{ minWidth: 0, alignSelf:'center' }}>
          <div style={{ fontSize: 10, fontWeight: 850, letterSpacing: 0.5, color: 'var(--text-m)', marginBottom: 8 }}>
            EXTRAÇÃO DA REFERÊNCIA
          </div>
          {calendarExtracoes.length > 0 ? (
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <button
                onClick={() => prevExtracao && setSelectedExtracao(prevExtracao)}
                disabled={!prevExtracao}
                title="Extração anterior"
                aria-label="Extração anterior"
                style={{
                  width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'var(--rx)', border:'1px solid var(--border)',
                  background:'var(--bg)', color:'var(--text-m)',
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
                onSelect={setSelectedExtracao}
              />

              <button
                onClick={() => nextExtracao && setSelectedExtracao(nextExtracao)}
                disabled={!nextExtracao}
                title="Próxima extração"
                aria-label="Próxima extração"
                style={{
                  width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
                  borderRadius:'var(--rx)', border:'1px solid var(--border)',
                  background:'var(--bg)', color:'var(--text-m)',
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
                  color: 'var(--text)',
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
            {hasPickup ? 'Dia da extração usado para calcular o pick-up desta referência.' : 'Sem extração anterior para comparar nesta referência.'}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight:'460px', scrollbarWidth:'thin', scrollbarColor:'var(--border) transparent' }}>
        <table className="w-full" style={{ borderCollapse:'collapse', fontSize:'11px' }}>
          <thead className="sticky top-0" style={{ background:'var(--surface)' }}>
            <tr>
              <th style={thSnap}>DATA REFERÊNCIA</th>
              <th style={thPu}>TT UH</th>
              <th style={thPu}>REC HOSP</th>
              <th style={thPu}>DM TT</th>
              <th style={thPu}>OCC%</th>
              <th style={thPu}>REVPAR</th>
              <th style={thSnap}>TT UHS OCUP</th>
              <th style={thSnap}>REC HOSP</th>
              <th style={thSnap}>DM C/C TT</th>
              <th style={thSnap}>OCC% TT</th>
              <th style={thSnap}>REVP TT</th>
              <th style={thSnap}>TT HOSP</th>
              <th style={thSnap}>CHDS</th>
              <th style={thSnap}>UHS DISP</th>
              <th style={thShopper}>SHOPPER PAX 1</th>
              <th style={thShopper}>SHOPPER PAX 2</th>
              <th style={thShopper}>SHOPPER PAX 3</th>
              <th style={thShopper}>SHOPPER PAX 4</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
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

              return (
                <tr key={`${r.data_referencia}-${r.data_extracao}`}
                  style={{ transition:'background 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <td style={cell({ fontWeight:600 })}>{fmtRef(r.data_referencia)}</td>
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
