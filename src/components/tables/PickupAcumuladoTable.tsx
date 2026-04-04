import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { usePickupAcumuladoMensal } from '@/hooks/useSupabase';

// ─── Helpers ─────────────────────────────────────────────────────────

const MES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DIA_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtShort(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
function fmtDate(iso: string) {
  const dt = new Date(iso + 'T00:00:00');
  return { dd: String(dt.getDate()).padStart(2,'0'), mes: MES_PT[dt.getMonth()], dia: DIA_PT[dt.getDay()], dow: dt.getDay() };
}
function fmtBRL(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$${(v / 1_000_000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}M`;
  if (abs >= 1_000)     return `R$${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  return `R$${Math.round(v).toLocaleString('pt-BR')}`;
}
function deltaColor(v: number) {
  return v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--text-m)';
}

function Delta({ v, fmt }: { v: number; fmt: (n: number) => string }) {
  if (v === 0) return <span style={{ color: 'var(--text-m)' }}>—</span>;
  return (
    <span style={{ display:'flex', alignItems:'center', gap:3, color: deltaColor(v), justifyContent:'flex-end' }}>
      {v > 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
      {v > 0 ? '+' : ''}{fmt(v)}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────

interface Props { hotelId: number; }

export default function PickupAcumuladoTable({ hotelId }: Props) {
  const mesAtual = new Date().toISOString().slice(0, 7);
  const [extracaoMes, setExtracaoMes] = useState(mesAtual);

  const { rows, extracaoRange, loading } = usePickupAcumuladoMensal(hotelId, extracaoMes);

  const [y, m] = extracaoMes.split('-').map(Number);

  const prev = () => { const pm=m===1?12:m-1; const py=m===1?y-1:y; setExtracaoMes(`${py}-${String(pm).padStart(2,'0')}`); };
  const next = () => { const nm=m===12?1:m+1;  const ny=m===12?y+1:y; setExtracaoMes(`${ny}-${String(nm).padStart(2,'0')}`); };

  const totals = useMemo(() => ({
    deltaUhs:     rows.reduce((s, r) => s + r.deltaUhs, 0),
    deltaReceita: rows.reduce((s, r) => s + r.deltaReceita, 0),
  }), [rows]);

  const today = new Date().toISOString().slice(0, 10);

  const th: React.CSSProperties = {
    padding: '8px 12px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
    textTransform: 'uppercase', color: 'var(--text-m)', background: 'var(--surface-2)',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1, borderBottom: '1px solid var(--border-l)',
  };

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r)', overflow:'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Pickup Acumulado</span>
          <span style={{ fontSize: 11, color: 'var(--text-m)', marginLeft: 8 }}>
            {extracaoRange
              ? `extrações ${fmtShort(extracaoRange.first)} → ${fmtShort(extracaoRange.last)} · ${rows.length} noites`
              : 'variação dentro do mês de extração'}
          </span>
        </div>

        {/* Month navigation (extraction month) */}
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <button onClick={prev} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)', borderRadius:'var(--rx)', background:'transparent', cursor:'pointer' }}>
            <ChevronLeft size={14} style={{ color:'var(--text-m)' }} />
          </button>
          <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', minWidth:100, textAlign:'center' }}>
            {MES_PT[m-1]} {y}
          </span>
          <button onClick={next} style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)', borderRadius:'var(--rx)', background:'transparent', cursor:'pointer' }}>
            <ChevronRight size={14} style={{ color:'var(--text-m)' }} />
          </button>
        </div>
      </div>

      {/* ── Summary strip ── */}
      {rows.length > 0 && (
        <div style={{
          padding: '8px 16px', background: 'var(--bg)', borderBottom: '1px solid var(--border-l)',
          display: 'flex', gap: 20, alignItems: 'center',
        }}>
          <span style={{ fontSize:10, fontWeight:700, color:'var(--text-m)', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            Total acumulado no mês:
          </span>
          <span style={{ fontSize:12, fontWeight:700, color: deltaColor(totals.deltaUhs) }}>
            {totals.deltaUhs > 0 ? '+' : ''}{totals.deltaUhs} UHs
          </span>
          <span style={{ fontSize:12, fontWeight:700, color: deltaColor(totals.deltaReceita) }}>
            {totals.deltaReceita >= 0 ? '+' : ''}{fmtBRL(totals.deltaReceita)}
          </span>
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <div style={{ padding:32, textAlign:'center', color:'var(--text-m)', fontSize:12 }}>
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div style={{ padding:32, textAlign:'center', color:'var(--text-m)', fontSize:12 }}>
          Nenhuma extração encontrada para {MES_PT[m-1]} {y}
        </div>
      ) : (
        <div style={{ overflowX:'auto', overflowY:'auto', maxHeight:460 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign:'left',   paddingLeft:16  }}>Data Ref.</th>
                <th style={{ ...th, textAlign:'center'                   }}>Dia</th>
                <th style={{ ...th, textAlign:'center'                   }}>
                  Início
                  {extracaoRange && <span style={{ fontWeight:400, opacity:.65, marginLeft:3 }}>({fmtShort(extracaoRange.first)})</span>}
                </th>
                <th style={{ ...th, textAlign:'center'                   }}>
                  Fim
                  {extracaoRange && <span style={{ fontWeight:400, opacity:.65, marginLeft:3 }}>({fmtShort(extracaoRange.last)})</span>}
                </th>
                <th style={{ ...th, textAlign:'right'                    }}>Δ UHs</th>
                <th style={{ ...th, textAlign:'right'                    }}>Δ Receita</th>
                <th style={{ ...th, textAlign:'right'                    }}>Δ Occ%</th>
                <th style={{ ...th, textAlign:'center', paddingRight:16  }}>Fotos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const { dd, mes, dia, dow } = fmtDate(r.dataReferencia);
                const isWeekend = dow === 0 || dow === 6;
                const isFuture  = r.dataReferencia > today;

                return (
                  <tr key={r.dataReferencia}
                    style={{ borderBottom:'1px solid var(--border-l)', opacity: isFuture ? 0.7 : 1 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Data Ref */}
                    <td style={{ padding:'8px 12px 8px 16px', whiteSpace:'nowrap' }}>
                      <span style={{ fontWeight:700, fontSize:12, color: isFuture ? 'var(--accent)' : 'var(--text)' }}>
                        {dd}/{mes}
                      </span>
                      {isFuture && (
                        <span style={{ marginLeft:5, fontSize:8, background:'rgba(var(--accent-rgb),0.1)', color:'var(--accent)', borderRadius:3, padding:'1px 4px', fontWeight:700 }}>
                          PREV.
                        </span>
                      )}
                    </td>

                    {/* Dia semana */}
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>
                      <span style={{ fontSize:11, fontWeight: isWeekend ? 700 : 400, color: isWeekend ? 'var(--amber)' : 'var(--text-m)' }}>
                        {dia}
                      </span>
                    </td>

                    {/* Início snapshot */}
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>
                        {r.uhsFirst} <span style={{ fontSize:10, color:'var(--text-m)' }}>UHs</span>
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-m)' }}>{r.occFirst.toFixed(1)}%</div>
                    </td>

                    {/* Fim snapshot */}
                    <td style={{ padding:'8px 12px', textAlign:'center' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>
                        {r.uhsLast} <span style={{ fontSize:10, color:'var(--text-m)' }}>UHs</span>
                      </div>
                      <div style={{ fontSize:10, color:'var(--text-m)' }}>{r.occLast.toFixed(1)}%</div>
                    </td>

                    {/* Deltas */}
                    <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      <Delta v={r.deltaUhs} fmt={n => String(Math.abs(n))} />
                    </td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      <Delta v={r.deltaReceita} fmt={n => fmtBRL(Math.abs(n))} />
                    </td>
                    <td style={{ padding:'8px 12px', textAlign:'right', fontVariantNumeric:'tabular-nums' }}>
                      <Delta v={r.deltaOcc} fmt={n => `${Math.abs(n).toFixed(1)}pp`} />
                    </td>

                    {/* Snapshots count */}
                    <td style={{ padding:'8px 16px 8px 12px', textAlign:'center' }}>
                      <span style={{ fontSize:10, borderRadius:4, padding:'1px 5px', background:'var(--surface-2)', color:'var(--text-m)', fontVariantNumeric:'tabular-nums' }}>
                        {r.totalSnapshots}
                      </span>
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
