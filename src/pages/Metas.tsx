import { useMemo, useState } from 'react';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Hotel,
  LayoutGrid,
  Loader2,
  Pencil,
  Percent,
  Search,
  Target,
} from 'lucide-react';
import { useMetasAnual, useMetasUploadLog, type MetaAnualRow } from '@/hooks/useSupabase';
import MetasExcelCard from '@/components/metas/MetasExcelCard';
import MetasUploadLog from '@/components/metas/MetasUploadLog';

const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── Formatação da tabela anual ─────────────────────────────────────────
// 0 é tratado como "sem meta" (meses inativos) — exibe "—" e fica fora da média do ano.
// Valores sempre INTEIROS, sem abreviação (k/M).
function fmtInt(v: number | null | undefined): string {
  if (v == null || v === 0) return '—';
  return Math.round(v).toLocaleString('pt-BR');
}

interface CatConfig {
  key: 'receitaMeta' | 'occMeta' | 'dmMeta';
  label: string;
  icon: typeof BarChart3;
  color: string;
  bg: string;
  prefix?: string;
  suffix?: string;
  fmt: (v: number | null | undefined) => string;
  agg: 'sum' | 'avg';
}

const CATS: CatConfig[] = [
  { key: 'receitaMeta', label: 'Receita',      icon: BarChart3,  color: 'var(--accent)', bg: 'var(--accent-l)', prefix: 'R$', fmt: fmtInt, agg: 'sum' },
  { key: 'occMeta',     label: 'Ocupação',     icon: Percent,    color: 'var(--green)',  bg: 'var(--green-l)',  suffix: '%',  fmt: fmtInt, agg: 'avg' },
  { key: 'dmMeta',      label: 'Diária Média', icon: DollarSign, color: 'var(--gold)',   bg: 'var(--gold-l)',   prefix: 'R$', fmt: fmtInt, agg: 'avg' },
];

// ════════════════════════════════════════════════════════════════════════
//  TABELA ANUAL (só-leitura)
// ════════════════════════════════════════════════════════════════════════

interface AnnualHotel {
  id: number;
  nome: string;
  cidade: string;
  estado: string;
  uhs: number;
  byMes: Map<number, MetaAnualRow>;
  temMeta: boolean;
}

function AnnualMetasTable({
  rows, ano, query, loading, error,
}: { rows: MetaAnualRow[]; ano: number; query: string; loading: boolean; error: string | null }) {
  const grouped = useMemo<AnnualHotel[]>(() => {
    const m = new Map<number, AnnualHotel>();
    rows.forEach(r => {
      let h = m.get(r.hotelId);
      if (!h) {
        h = { id: r.hotelId, nome: r.hotelNome, cidade: r.cidade ?? '—', estado: r.estado ?? '—', uhs: r.totalUhs, byMes: new Map(), temMeta: false };
        m.set(r.hotelId, h);
      }
      h.byMes.set(r.mes, r);
      if (r.receitaMeta != null || r.occMeta != null || r.dmMeta != null) h.temMeta = true;
    });
    return [...m.values()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? grouped.filter(h => h.nome.toLowerCase().includes(q) || h.cidade.toLowerCase().includes(q) || h.estado.toLowerCase().includes(q))
      : grouped;
    // hotéis com meta primeiro, depois alfabético
    return [...base].sort((a, b) => (Number(b.temMeta) - Number(a.temMeta)) || a.nome.localeCompare(b.nome));
  }, [grouped, query]);

  const currentMes = new Date().getFullYear() === ano ? new Date().getMonth() + 1 : null;

  const aggValue = (h: AnnualHotel, cat: CatConfig): number | null => {
    const vals: number[] = [];
    for (let mes = 1; mes <= 12; mes++) {
      const v = h.byMes.get(mes)?.[cat.key];
      if (v != null && v !== 0) vals.push(v);
    }
    if (vals.length === 0) return null;
    if (cat.agg === 'sum') return vals.reduce((s, v) => s + v, 0);
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const th: React.CSSProperties = {
    position: 'sticky', top: 0, zIndex: 2,
    background: 'var(--surface-h)', color: 'var(--text-m)',
    fontSize: 10, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
    padding: '10px 8px', textAlign: 'center', whiteSpace: 'nowrap',
    borderBottom: '2px solid var(--border)',
  };
  const stickyCliente: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 3, minWidth: 190, width: 190 };
  const stickyCat: React.CSSProperties = { position: 'sticky', left: 190, zIndex: 3, minWidth: 128, width: 128 };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-m)' }}>
        <Loader2 size={22} className="animate-spin" />
        <span className="ml-2" style={{ fontSize: 13 }}>Carregando metas de {ano}…</span>
      </div>
    );
  }
  if (error) {
    return <div style={{ padding: 28, textAlign: 'center', color: 'var(--red)', fontWeight: 800 }}>{error}</div>;
  }
  if (filtered.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-m)', fontSize: 13, fontWeight: 700 }}>
        Nenhum hotel encontrado{query ? ` para "${query}"` : ''}.
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)',
    }}>
      <div style={{ overflowX: 'auto', maxHeight: '72vh' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...th, ...stickyCliente, zIndex: 4, textAlign: 'left', background: 'var(--surface-h)', paddingLeft: 16 }}>
                Cliente
              </th>
              <th style={{ ...th, ...stickyCat, zIndex: 4, textAlign: 'left', background: 'var(--surface-h)' }}>
                Categoria
              </th>
              {MES_ABBR.map((m, i) => {
                const isCur = currentMes === i + 1;
                return (
                  <th key={m} style={{
                    ...th, minWidth: 62,
                    color: isCur ? 'var(--accent-d)' : 'var(--text-m)',
                    background: isCur ? 'var(--accent-l)' : 'var(--surface-h)',
                  }}>
                    {m}
                  </th>
                );
              })}
              <th style={{ ...th, minWidth: 74, borderLeft: '1px solid var(--border)', color: 'var(--text)' }}>
                Ano
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((h, hi) => (
              CATS.map((cat, ci) => {
                const Icon = cat.icon;
                const firstOfHotel = ci === 0;
                const groupBorder = firstOfHotel && hi > 0 ? '2px solid var(--border)' : '1px solid var(--border-l)';
                const rowBg = hi % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
                const agg = aggValue(h, cat);
                return (
                  <tr key={`${h.id}-${cat.key}`} className="metas-row">
                    {firstOfHotel && (
                      <td rowSpan={3} style={{
                        ...stickyCliente, background: rowBg, borderTop: groupBorder,
                        borderRight: '1px solid var(--border)', padding: '8px 12px 8px 16px', verticalAlign: 'middle',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <span style={{
                            width: 28, height: 28, flexShrink: 0, borderRadius: 'var(--rx)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: h.temMeta ? 'var(--accent-l)' : 'var(--surface-h)',
                            color: h.temMeta ? 'var(--accent)' : 'var(--text-m)',
                          }}>
                            <Hotel size={14} />
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                              {h.nome}
                            </span>
                            <span style={{ display: 'block', marginTop: 1, fontSize: 10, fontWeight: 600, color: 'var(--text-m)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {h.cidade}, {h.estado} · {h.uhs} UHs
                            </span>
                          </span>
                        </div>
                      </td>
                    )}
                    <td style={{
                      ...stickyCat, background: rowBg,
                      borderTop: firstOfHotel ? groupBorder : '1px solid var(--border-l)',
                      borderRight: '1px solid var(--border)', padding: '7px 10px',
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cat.bg, color: cat.color }}>
                          <Icon size={11} />
                        </span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)' }}>{cat.label}</span>
                      </span>
                    </td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const mes = i + 1;
                      const v = h.byMes.get(mes)?.[cat.key] ?? null;
                      const isCur = currentMes === mes;
                      const filled = v != null && v !== 0;
                      return (
                        <td key={mes} title={filled && cat.key === 'receitaMeta' ? `R$ ${Math.round(v).toLocaleString('pt-BR')}` : undefined}
                          style={{
                            borderTop: firstOfHotel ? groupBorder : '1px solid var(--border-l)',
                            background: isCur ? 'color-mix(in srgb, var(--accent) 7%, ' + rowBg + ')' : rowBg,
                            padding: '7px 8px', textAlign: 'right', whiteSpace: 'nowrap',
                            fontFamily: 'var(--mono)', fontSize: 11.5,
                            fontWeight: filled ? 700 : 400,
                            color: filled ? 'var(--text)' : 'var(--border)',
                          }}>
                          {filled && cat.prefix ? <span style={{ fontSize: 9, color: cat.color, marginRight: 2, fontWeight: 700 }}>{cat.prefix}</span> : null}
                          {cat.fmt(v)}
                          {filled && cat.suffix ? <span style={{ fontSize: 9.5, color: cat.color, marginLeft: 1 }}>{cat.suffix}</span> : null}
                        </td>
                      );
                    })}
                    <td style={{
                      borderTop: firstOfHotel ? groupBorder : '1px solid var(--border-l)',
                      borderLeft: '1px solid var(--border)',
                      background: cat.bg, padding: '7px 9px', textAlign: 'right', whiteSpace: 'nowrap',
                      fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 800, color: cat.color,
                    }}>
                      {agg != null && cat.prefix ? <span style={{ fontSize: 9, marginRight: 2 }}>{cat.prefix}</span> : null}
                      {cat.fmt(agg)}
                      {agg != null && cat.suffix ? <span style={{ fontSize: 9.5, marginLeft: 1 }}>{cat.suffix}</span> : null}
                    </td>
                  </tr>
                );
              })
            ))}
          </tbody>
        </table>
      </div>
      <div style={{
        padding: '9px 16px', borderTop: '1px solid var(--border-l)', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        {CATS.map(cat => (
          <span key={cat.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: cat.bg, color: cat.color }}>
              <cat.icon size={9} />
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--text-m)', fontWeight: 600 }}>
              {cat.label}{cat.agg === 'sum' ? ' (Ano = soma)' : ' (Ano = média)'}
            </span>
          </span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--border)' }}>
          Coluna destacada = mês atual · Ano grande no topo · só leitura
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  PÁGINA
// ════════════════════════════════════════════════════════════════════════

type View = 'anual' | 'lancar';

export default function Metas() {
  const now = useMemo(() => new Date(), []);

  const [view, setView] = useState<View>('anual');
  const [ano, setAno] = useState(now.getFullYear());
  const [query, setQuery] = useState('');

  const { rows: anualRows, loading: anualLoading, error: anualError, reload: reloadAnual } = useMetasAnual(ano);
  const { rows: logRows, loading: logLoading, error: logError, reload: reloadLog } = useMetasUploadLog();

  const anualClientes = useMemo(() => new Set(anualRows.map(r => r.hotelId)).size, [anualRows]);
  const anualComMeta = useMemo(
    () => new Set(anualRows.filter(r => r.receitaMeta != null || r.occMeta != null || r.dmMeta != null).map(r => r.hotelId)).size,
    [anualRows]
  );

  const segBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px',
    borderRadius: 'var(--rx)', fontSize: 12, fontWeight: 800, cursor: 'pointer',
    border: 'none', transition: 'all .12s',
    background: active ? '#fff' : 'transparent',
    color: active ? 'var(--accent-d)' : 'rgba(255,255,255,0.82)',
    boxShadow: active ? '0 1px 3px rgba(13,27,62,0.18)' : 'none',
  });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        .metas-row:hover td { background: var(--surface-h) !important; }
      `}</style>

      {/* ── Cabeçalho ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        padding: '16px 20px', background: 'linear-gradient(135deg, var(--accent-d), var(--accent))',
        borderRadius: 'var(--r)', color: '#fff', boxShadow: 'var(--sh-m)',
      }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--rx)', background: 'rgba(255,170,1,0.16)', color: 'var(--gold)' }}>
              <Target size={17} />
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>Gestão de Metas</h2>
          </div>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.68)', fontWeight: 550 }}>
            {view === 'anual'
              ? `${anualComMeta} de ${anualClientes} hotéis com metas em ${ano}`
              : `Baixe o template, preencha e suba para atualizar as metas de ${ano}`}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* Toggle de visão */}
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 'calc(var(--rx) + 3px)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
            <button onClick={() => setView('anual')} style={segBtn(view === 'anual')}>
              <LayoutGrid size={14} /> Visão anual
            </button>
            <button onClick={() => setView('lancar')} style={segBtn(view === 'lancar')}>
              <Pencil size={14} /> Lançar metas
            </button>
          </div>

          {/* Seletor de ANO (grande) — vale para as duas visões */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid rgba(255,255,255,0.22)', borderRadius: 'var(--rx)', overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
            <button aria-label="Ano anterior" onClick={() => setAno(a => a - 1)}
              style={{ width: 38, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ChevronLeft size={18} />
            </button>
            <div style={{ minWidth: 96, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.16)', borderRight: '1px solid rgba(255,255,255,0.16)', padding: '0 14px' }}>
              <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--gold)' }}>ANO</span>
              <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: 'var(--mono)' }}>{ano}</span>
            </div>
            <button aria-label="Próximo ano" onClick={() => setAno(a => a + 1)}
              style={{ width: 38, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Busca (só na visão anual; o lançamento por Excel não filtra por hotel) */}
          {view === 'anual' && (
            <div style={{ width: 260, height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 'var(--rx)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)' }}>
              <Search size={14} style={{ color: 'rgba(255,255,255,0.68)', flexShrink: 0 }} />
              <input aria-label="Pesquisar hotel" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar hotel"
                style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', color: '#fff', fontSize: 12.5, fontWeight: 650, fontFamily: 'var(--font)' }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {view === 'anual' ? (
        <AnnualMetasTable rows={anualRows} ano={ano} query={query} loading={anualLoading} error={anualError} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <MetasExcelCard ano={ano} rows={anualRows} onDone={() => { reloadAnual(); reloadLog(); }} />
          <MetasUploadLog rows={logRows} loading={logLoading} error={logError} />
        </div>
      )}
    </div>
  );
}
