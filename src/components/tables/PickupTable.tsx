import { useMemo, useState, useRef, useEffect } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import type { PickupRow } from '@/data/types';

// ─── Formatting helpers ───────────────────────────────────────────────

function fmtR$(v: number)  { return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtPct(v: number) { return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
function deltaColor(v: number) { return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-m)'; }
function fmtDelta(v: number, prefix = '', suffix = '') {
  if (v === 0) return '—';
  return `${v > 0 ? '+' : ''}${prefix}${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
}
function fmtDeltaInt(v: number) { return v === 0 ? '—' : `${v > 0 ? '+' : ''}${v}`; }
function occColor(occ: number) {
  return occ >= 80 ? 'var(--green)' : occ >= 50 ? 'var(--accent)' : occ >= 25 ? 'var(--amber)' : 'var(--red)';
}

const DIAS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MES_PT  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ─── Extraction date calendar ─────────────────────────────────────────

interface ExtracaoCalendarProps {
  available: string[];     // YYYY-MM-DD dates that have extractions
  selected:  string | null;
  onSelect:  (d: string) => void;
}

function ExtracaoCalendar({ available, selected, onSelect }: ExtracaoCalendarProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
  const prevYM = () => {
    const [y, m] = calYM.split('-').map(Number);
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    setCalYM(`${py}-${String(pm).padStart(2,'0')}`);
  };
  const nextYM = () => {
    const [y, m] = calYM.split('-').map(Number);
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    setCalYM(`${ny}-${String(nm).padStart(2,'0')}`);
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
            <button onClick={prevYM} style={{ padding:'3px 8px', borderRadius:'var(--rx)', color:'var(--text-m)' }} className="hover:bg-[var(--surface-h)]">
              <ChevronLeft size={14}/>
            </button>
            <span style={{ fontSize:13, fontWeight:800 }}>{MES_PT[cm-1]} {cy}</span>
            <button onClick={nextYM} style={{ padding:'3px 8px', borderRadius:'var(--rx)', color:'var(--text-m)' }} className="hover:bg-[var(--surface-h)]">
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
              return (
                <button
                  key={dateStr}
                  disabled={!hasData}
                  onClick={() => { onSelect(dateStr); setOpen(false); }}
                  title={hasData ? `Extração de ${fmt(dateStr)}` : undefined}
                  style={{
                    padding:'5px 2px', borderRadius:6, textAlign:'center',
                    fontSize:11.5, fontWeight: hasData ? (isSel ? 800 : 700) : 400,
                    background: isSel ? 'var(--accent)' : hasData ? 'var(--accent-l)' : 'transparent',
                    color: isSel ? '#fff' : hasData ? 'var(--accent-d)' : 'var(--text-m)',
                    border:`1.5px solid ${isSel ? 'var(--accent)' : hasData ? 'color-mix(in srgb,var(--accent) 30%,transparent)' : 'transparent'}`,
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
                  <button key={d} onClick={() => { onSelect(d); setCalYM(d.slice(0,7)); setOpen(false); }}
                    style={{
                      fontSize:10.5, fontWeight:700, borderRadius:99, padding:'2px 8px', cursor:'pointer',
                      background: d === selected ? 'var(--accent)' : 'var(--bg)',
                      color: d === selected ? '#fff' : 'var(--accent-d)',
                      border: `1px solid ${d === selected ? 'var(--accent)' : 'color-mix(in srgb,var(--accent) 30%,transparent)'}`,
                    }}>
                    {fmt(d)}
                  </button>
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

export default function PickupTable({ data, selectedMonths }: PickupTableProps) {
  // All unique extraction dates sorted ascending
  const allExtracoes = useMemo(
    () => [...new Set(data.map(r => r.data_extracao))].sort(),
    [data]
  );

  // Default to most recent extraction
  const [selectedExtracao, setSelectedExtracao] = useState<string | null>(null);
  const defaultExtracao = allExtracoes.length > 0 ? allExtracoes[allExtracoes.length - 1] : null;
  const activeExtracao = selectedExtracao ?? defaultExtracao;

  // Filter: only rows with changes
  const [onlyChanged, setOnlyChanged] = useState(false);

  // Filter by selected months then by extraction date
  const filtered = useMemo(() => {
    let rows = data;
    if (selectedMonths.length > 0)
      rows = rows.filter(r => selectedMonths.includes(r.data_referencia.slice(0, 7)));
    if (activeExtracao)
      rows = rows.filter(r => r.data_extracao === activeExtracao);
    if (onlyChanged)
      rows = rows.filter(r =>
        r.data_extracao_ant !== null && (
          r.pu_tt_uh !== 0 ||
          parseFloat(r.pu_rec_hosp) !== 0 ||
          parseFloat(r.pu_dm_tt)   !== 0 ||
          parseFloat(r.pu_occ_tt)  !== 0 ||
          parseFloat(r.pu_revpar_tt) !== 0
        )
      );
    return rows.sort((a, b) => a.data_referencia.localeCompare(b.data_referencia));
  }, [data, selectedMonths, activeExtracao, onlyChanged]);

  const hasPickup = filtered.some(r => r.data_extracao_ant !== null);

  const fmtRef = (d: string) => {
    const [, m, day] = d.split('-');
    return `${day}/${m}`;
  };

  return (
    <div className="card-in" style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'20px', animationDelay:'0.2s' }}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4" style={{ gap:12, flexWrap:'wrap' }}>
        <div>
          <h3 className="text-sm font-semibold" style={{ letterSpacing:'-0.2px' }}>Pick-Up Diário</h3>
          <p className="text-[11.5px] mt-0.5" style={{ color:'var(--text-m)' }}>
            {filtered.length} dias
            {activeExtracao && ` · extração ${fmtRef(activeExtracao)}`}
            {hasPickup
              ? ` · comparação com extração anterior`
              : ' · sem extração anterior (sem pick-up)'}
          </p>
        </div>

        {/* Right controls */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
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

          {/* Extraction date picker */}
          {allExtracoes.length > 0 && (
            <ExtracaoCalendar
              available={allExtracoes}
              selected={activeExtracao}
              onSelect={setSelectedExtracao}
            />
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight:'460px', scrollbarWidth:'thin', scrollbarColor:'var(--border) transparent' }}>
        <table className="w-full" style={{ borderCollapse:'collapse', fontSize:'11px' }}>
          <thead className="sticky top-0" style={{ background:'var(--surface)' }}>
            <tr>
              <th style={thSnap}>DATA REF</th>
              <th style={thPu}>PU TT UH</th>
              <th style={thPu}>PU REC HOSP</th>
              <th style={thPu}>PU DM TT</th>
              <th style={thPu}>PU OCC%</th>
              <th style={thPu}>PU REVPAR</th>
              <th style={thSnap}>TT UHS OCUP</th>
              <th style={thSnap}>REC HOSP</th>
              <th style={thSnap}>DM C/C TT</th>
              <th style={thSnap}>OCC% TT</th>
              <th style={thSnap}>REVP TT</th>
              <th style={thSnap}>TT HOSP</th>
              <th style={thSnap}>CHDS</th>
              <th style={thSnap}>UHS DISP</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={14} style={{ padding:'24px', textAlign:'center', color:'var(--text-m)', fontSize:12 }}>
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
                      <td style={cell({ color:deltaColor(puRec),    fontSize:10 })}>{fmtDelta(puRec)}</td>
                      <td style={cell({ color:deltaColor(puDm),     fontSize:10 })}>{fmtDelta(puDm)}</td>
                      <td style={cell({ color:deltaColor(puOcc),    fontSize:10 })}>{fmtDelta(puOcc,'','pp')}</td>
                      <td style={cell({ color:deltaColor(puRevpar), fontSize:10 })}>{fmtDelta(puRevpar)}</td>
                    </>
                  )}
                  {/* Snapshot */}
                  <td style={cell({ textAlign:'center' })}>{r.tt_uhs_ocup}</td>
                  <td style={cell()}>{fmtR$(parseFloat(r.rec_hosp) || 0)}</td>
                  <td style={cell()}>{fmtR$(parseFloat(r.dm_cc_tt) || 0)}</td>
                  <td style={cell({ fontWeight:600, color:occColor(occTt) })}>{fmtPct(occTt)}%</td>
                  <td style={cell({ fontWeight:600, color:'var(--accent-d)' })}>{fmtR$(parseFloat(r.revp_tt) || 0)}</td>
                  <td style={cell({ textAlign:'center', color:'var(--text-m)' })}>{r.tt_hosp ?? '—'}</td>
                  <td style={cell({ textAlign:'center', color:'var(--text-m)' })}>{r.chds ?? '—'}</td>
                  <td style={cell({ textAlign:'center' })}>{r.uhs_disp}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
