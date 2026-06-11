import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHomePage, type HomePageRow } from '@/hooks/useSupabase';
import {
  Loader2, ArrowRight, Hotel, BarChart2, TrendingUp, Users,
  ChevronUp, ChevronDown, ChevronsUpDown, Search, X, BellRing,
} from 'lucide-react';
import { localDateKey } from '@/lib/utils';

// ─── Formatters ───────────────────────────────────────────────────────
const fmtRec = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000).toLocaleString('pt-BR')}k`;
  return `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
};
const fmtPct = (v: number) => `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const fmtRevpar = (v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`;
const fmtDate = (d: string) => { const [, m, day] = d.split('-'); return `${day}/${m}`; };
const occColor = (v: number) => v >= 80 ? 'var(--green)' : v >= 50 ? 'var(--accent)' : v >= 25 ? 'var(--amber)' : 'var(--red)';
const metaColor = (v: number | null) => v == null ? 'var(--text-m)' : v >= 100 ? 'var(--green)' : v >= 80 ? 'var(--amber)' : 'var(--red)';

// ─── Sort ─────────────────────────────────────────────────────────────
type SortCol = 'nome' | 'receita' | 'occ' | 'revpar' | 'meta' | 'pickup';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ChevronsUpDown size={12} style={{ color: 'var(--text-m)', opacity: 0.5 }} />;
  return dir === 'asc'
    ? <ChevronUp size={12} style={{ color: 'var(--accent)' }} />
    : <ChevronDown size={12} style={{ color: 'var(--accent)' }} />;
}

interface SortHeaderProps {
  label: string; sub?: string; col: SortCol; active: SortCol; dir: SortDir;
  onSort: (col: SortCol) => void; align?: 'left' | 'right';
}
function SortHeader({ label, sub, col, active, dir, onSort, align = 'right' }: SortHeaderProps) {
  const isActive = active === col;
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        padding: '11px 16px', textAlign: align, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        borderBottom: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
        background: isActive ? 'var(--accent-l)' : 'var(--surface)', transition: 'background .12s',
      }}
    >
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: align === 'left' ? 'flex-start' : 'flex-end', gap: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {align === 'left' && <SortIcon active={isActive} dir={dir} />}
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: isActive ? 'var(--accent)' : 'var(--text-m)' }}>
            {label}
          </span>
          {align !== 'left' && <SortIcon active={isActive} dir={dir} />}
        </div>
        {sub && <span style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-m)', opacity: 0.8 }}>{sub}</span>}
      </div>
    </th>
  );
}

// ─── Indicadores (hero) ───────────────────────────────────────────────
function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '16px 18px', background: 'rgba(255,255,255,0.07)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ opacity: 0.6 }}>{icon}</div>
      <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', fontFamily: 'var(--mono)', lineHeight: 1 }}>{value}</span>
    </div>
  );
}

const td = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: '11px 16px', borderBottom: '1px solid var(--border-l)', whiteSpace: 'nowrap', ...extra,
});

export default function Home() {
  const navigate = useNavigate();
  const currentDate = localDateKey();
  const currentMonth = currentDate.slice(0, 7);
  const { rows, loading, error } = useHomePage(currentMonth, currentDate);

  const [sortCol, setSortCol] = useState<SortCol>('receita');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [query, setQuery] = useState('');

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir(col === 'nome' ? 'asc' : 'desc'); }
  };

  const totals = useMemo(() => {
    const n = rows.length;
    const receita = rows.reduce((s, r) => s + (r.receitaMesAtual || 0), 0);
    const withOcc = rows.filter(r => r.occAtual > 0);
    const avgOcc = withOcc.length ? withOcc.reduce((s, r) => s + r.occAtual, 0) / withOcc.length : 0;
    const withRev = rows.filter(r => r.revparAtual > 0);
    const avgRevpar = withRev.length ? withRev.reduce((s, r) => s + r.revparAtual, 0) / withRev.length : 0;
    const pickupHotels = rows.filter(r => r.pickupAlteracoes > 0).length;
    return { n, receita, avgOcc, avgRevpar, pickupHotels };
  }, [rows]);

  const pickupDate = useMemo(
    () => rows.find(r => r.pickupDataExtracao)?.pickupDataExtracao || rows[0]?.selectedDataExtracao || '',
    [rows]
  );

  const sorted = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    const filtered = q ? rows.filter(r => r.hotelNome.toLocaleLowerCase('pt-BR').includes(q)) : rows;
    const value = (r: HomePageRow): number | string => {
      switch (sortCol) {
        case 'nome': return r.hotelNome;
        case 'occ': return r.occAtual;
        case 'revpar': return r.revparAtual;
        case 'meta': return r.receitaMetaPct ?? -1;
        case 'pickup': return r.pickupAlteracoes;
        default: return r.receitaMesAtual;
      }
    };
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
    return [...filtered].sort((a, b) => {
      const av = value(a), bv = value(b);
      const c = typeof av === 'string' ? collator.compare(av, bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? c : -c;
    });
  }, [rows, query, sortCol, sortDir]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="ml-2 text-[var(--text-m)]">Carregando dados...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--red)] font-semibold mb-2">Erro ao carregar dados</p>
        <p className="text-[13px] text-[var(--text-m)]">{error}</p>
      </div>
    );
  }

  const shProps = { active: sortCol, dir: sortDir, onSort: handleSort };

  return (
    <div className="fade-in flex flex-col gap-5">
      {/* ── Hero + indicadores ── */}
      <div style={{ background: 'linear-gradient(135deg, #1A2744, #1E3E6E, #2D6CB5)', borderRadius: 'var(--r)', padding: '26px 30px', color: '#fff' }}>
        <div className="flex items-start justify-between" style={{ gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div>
            <p className="text-[12px] font-medium mb-1" style={{ opacity: 0.55 }}>Painel de Receita</p>
            <h1 className="text-[24px] font-bold" style={{ letterSpacing: '-0.5px' }}>HoGrow Revenue Intelligence</h1>
          </div>
          <button
            className="flex items-center gap-2 text-[13px] font-semibold transition-all duration-150 hover:gap-3"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 99, padding: '9px 18px', color: '#fff' }}
            onClick={() => navigate('/clientes')}
          >
            Ver todos os clientes
            <ArrowRight size={14} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          <StatTile icon={<Hotel size={16} color="#fff" />} label="Hotéis cliente" value={String(totals.n)} />
          <StatTile icon={<BarChart2 size={16} color="#fff" />} label="Receita do mês" value={fmtRec(totals.receita)} />
          <StatTile icon={<TrendingUp size={16} color="#fff" />} label="OCC médio" value={fmtPct(totals.avgOcc)} />
          <StatTile icon={<Users size={16} color="#fff" />} label="RevPAR médio" value={fmtRevpar(totals.avgRevpar)} />
        </div>
      </div>

      {/* ── Tabela de portfólio ── */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
        {/* Header da tabela */}
        <div className="flex items-center justify-between" style={{ gap: 12, flexWrap: 'wrap', padding: '16px 18px', borderBottom: '1px solid var(--border-l)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>Portfólio</h3>
            <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-m)' }}>
              {totals.n} hotéis · clique numa coluna para ordenar
            </p>
          </div>
          <div style={{ position: 'relative', width: 'min(260px, 60vw)' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-m)', pointerEvents: 'none' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar hotel"
              aria-label="Buscar hotel"
              style={{ width: '100%', height: 34, borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, fontWeight: 600, outline: 'none', padding: query ? '0 32px 0 30px' : '0 12px 0 30px' }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca"
                className="flex items-center justify-center" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 22, height: 22, borderRadius: 'var(--rx)', color: 'var(--text-m)' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 130px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
              <tr>
                <SortHeader label="Hotel" col="nome" align="left" {...shProps} />
                <SortHeader label="Receita" sub="mês atual" col="receita" {...shProps} />
                <SortHeader label="OCC" sub="média mês" col="occ" {...shProps} />
                <SortHeader label="RevPAR" sub="média mês" col="revpar" {...shProps} />
                <SortHeader label="Meta" sub="% realizado" col="meta" {...shProps} />
                <SortHeader label="Pick-up" sub={pickupDate ? `extr. ${fmtDate(pickupDate)}` : 'sem extração'} col="pickup" {...shProps} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-m)', fontSize: 13 }}>
                    {query ? `Nenhum hotel encontrado para "${query}"` : 'Nenhum hotel cliente'}
                  </td>
                </tr>
              ) : sorted.map((r) => {
                const metaPct = r.receitaMetaPct;
                const hasPickup = r.pickupAlteracoes > 0;
                return (
                  <tr key={r.hotelId} className="row-hover" style={{ cursor: 'pointer', transition: 'background .1s' }}
                    onClick={() => navigate(`/clientes/${r.hotelId}`)}>
                    <td style={td({ fontWeight: 600, color: 'var(--text)', whiteSpace: 'normal' })}>{r.hotelNome}</td>
                    <td style={td({ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700 })}>{fmtRec(r.receitaMesAtual)}</td>
                    <td style={td({ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: occColor(r.occAtual) })}>{fmtPct(r.occAtual)}</td>
                    <td style={td({ textAlign: 'right', fontFamily: 'var(--mono)', color: 'var(--text)' })}>{fmtRevpar(r.revparAtual)}</td>
                    <td style={td({ textAlign: 'right', fontFamily: 'var(--mono)', fontWeight: 700, color: metaColor(metaPct) })}>
                      {metaPct == null ? '—' : `${Math.round(metaPct)}%`}
                    </td>
                    <td style={td({ textAlign: 'right' })}>
                      {!hasPickup ? (
                        <span style={{ color: 'var(--text-m)' }}>—</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                          <BellRing size={11} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent-d)' }}>{r.pickupAlteracoes}</span>
                          <span style={{ fontSize: 10.5, fontFamily: 'var(--mono)', fontWeight: 700, color: r.pickupReceita >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {r.pickupReceita >= 0 ? '+' : '−'}{fmtRec(Math.abs(r.pickupReceita)).replace('R$ ', 'R$')}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
