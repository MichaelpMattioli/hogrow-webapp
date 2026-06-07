import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
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
import { useMetasPage, useMetasAnual, saveHotelMeta, type MetaAnualRow } from '@/hooks/useSupabase';
import type { HotelMeta } from '@/data/types';

type GoalField = 'receita' | 'ocupacao' | 'diaria';

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
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};
const MES_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function fmtMes(ym: string) {
  const [year, month] = ym.split('-');
  return `${MES_PT[month] ?? month} ${year}`;
}

function metaToInput(value: number | null | undefined) {
  return value != null ? String(value) : '';
}

function parseMeta(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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
  { key: 'receitaMeta', label: 'Receita',      icon: BarChart3,  color: 'var(--accent)', bg: 'var(--accent-l)', prefix: 'R$', fmt: fmtInt,            agg: 'sum' },
  { key: 'occMeta',     label: 'Ocupação',     icon: Percent,    color: 'var(--green)',  bg: 'var(--green-l)',  suffix: '%',  fmt: fmtInt,            agg: 'avg' },
  { key: 'dmMeta',      label: 'Diária Média', icon: DollarSign, color: 'var(--gold)',   bg: 'var(--gold-l)',   prefix: 'R$', fmt: fmtInt,            agg: 'avg' },
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
//  EDITOR (mensal) — preservado para lançar/editar metas
// ════════════════════════════════════════════════════════════════════════

type GoalHotel = { id: number; name: string; city: string; state: string; uhs: number };

interface GoalInputCardProps {
  field: GoalField;
  title: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}

function GoalInputCard({ field, title, icon, value, onChange, prefix, suffix }: GoalInputCardProps) {
  const tone = field === 'receita'
    ? { bg: 'var(--accent-l)', color: 'var(--accent)', border: 'color-mix(in srgb, var(--accent) 18%, transparent)' }
    : field === 'ocupacao'
      ? { bg: 'var(--green-l)', color: 'var(--green)', border: '#A7F3D0' }
      : { bg: 'var(--gold-l)', color: 'var(--gold)', border: '#FDE68A' };

  return (
    <div style={{ background: 'var(--surface)', border: `1px solid ${tone.border}`, borderRadius: 'var(--rx)', padding: 14, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--rx)', background: tone.bg, color: tone.color, flexShrink: 0 }}>
          {icon}
        </span>
        <span style={{ fontSize: 11, fontWeight: 850, color: 'var(--text)', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </span>
      </div>
      <div style={{ height: 38, display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--border)', borderRadius: 'var(--rx)', background: 'var(--bg)', padding: '0 10px' }}>
        {prefix && <span style={{ fontSize: 12, fontWeight: 800, color: tone.color, flexShrink: 0 }}>{prefix}</span>}
        <input
          aria-label={`Meta de ${title}`}
          type="number" min={0} inputMode="decimal" value={value}
          onChange={e => onChange(e.target.value)} placeholder="0"
          style={{ width: '100%', minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--text)', fontSize: 17, fontWeight: 850, fontFamily: 'var(--mono)' }}
        />
        {suffix && <span style={{ fontSize: 12, fontWeight: 800, color: tone.color, flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  );
}

interface HotelGoalRowProps {
  hotel: GoalHotel;
  meta?: HotelMeta;
  onSave: (hotelId: number, receita: number | null, occ: number | null, dm: number | null, revpar: number | null) => Promise<void>;
}

function HotelGoalRow({ hotel, meta, onSave }: HotelGoalRowProps) {
  const [receita, setReceita] = useState(metaToInput(meta?.receitaMeta));
  const [occ, setOcc] = useState(metaToInput(meta?.occMeta));
  const [dm, setDm] = useState(metaToInput(meta?.dmMeta));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initRec = metaToInput(meta?.receitaMeta);
  const initOcc = metaToInput(meta?.occMeta);
  const initDm = metaToInput(meta?.dmMeta);
  const dirty = receita !== initRec || occ !== initOcc || dm !== initDm;

  useEffect(() => setReceita(initRec), [initRec]);
  useEffect(() => setOcc(initOcc), [initOcc]);
  useEffect(() => setDm(initDm), [initDm]);
  useEffect(() => () => { if (savedTimer.current) clearTimeout(savedTimer.current); }, []);

  async function handleSave() {
    setSaving(true);
    await onSave(hotel.id, parseMeta(receita), parseMeta(occ), parseMeta(dm), meta?.revparMeta ?? null);
    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="metas-goal-row" style={{ display: 'grid', gap: 14, alignItems: 'center', padding: '16px 18px', borderBottom: '1px solid var(--border-l)', background: 'var(--surface)' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--rx)', background: 'var(--accent-l)', color: 'var(--accent)', flexShrink: 0 }}>
            <Hotel size={15} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13.5, fontWeight: 850, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>{hotel.name}</span>
            <span style={{ display: 'block', marginTop: 2, fontSize: 11, fontWeight: 650, color: 'var(--text-m)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hotel.city}, {hotel.state} · {hotel.uhs} UHs</span>
          </span>
        </div>
      </div>
      <div className="metas-goal-cards" style={{ display: 'grid', gap: 10, minWidth: 0 }}>
        <GoalInputCard field="receita" title="Receita" icon={<BarChart3 size={15} />} value={receita} onChange={setReceita} prefix="R$" />
        <GoalInputCard field="ocupacao" title="Ocupação" icon={<Percent size={15} />} value={occ} onChange={setOcc} suffix="%" />
        <GoalInputCard field="diaria" title="Diária Média" icon={<DollarSign size={15} />} value={dm} onChange={setDm} prefix="R$" />
      </div>
      <button onClick={handleSave} disabled={saving || (!dirty && !saved)}
        style={{ minWidth: 124, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 'var(--rx)', border: dirty ? '1px solid var(--accent)' : '1px solid var(--border)', background: saved ? 'var(--green)' : dirty ? 'var(--accent)' : 'var(--surface-h)', color: saved || dirty ? '#fff' : 'var(--text-m)', fontSize: 12, fontWeight: 800, cursor: saving || (!dirty && !saved) ? 'default' : 'pointer', opacity: saving ? 0.72 : 1, flexShrink: 0 }}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Target size={14} />}
        {saving ? 'Salvando' : saved ? 'Salvo' : dirty ? 'Salvar' : 'Sem alterações'}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  PÁGINA
// ════════════════════════════════════════════════════════════════════════

type View = 'anual' | 'lancar';

export default function Metas() {
  const now = useMemo(() => new Date(), []);
  const currentMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [view, setView] = useState<View>('anual');
  const [ano, setAno] = useState(now.getFullYear());
  const [mesAno, setMesAno] = useState(currentMes);
  const [query, setQuery] = useState('');

  const { rows: anualRows, loading: anualLoading, error: anualError } = useMetasAnual(ano);
  const { rows, loading, error: metasError, reload } = useMetasPage(mesAno);
  const monthIdx = MONTHS.indexOf(mesAno);

  const anualClientes = useMemo(() => new Set(anualRows.map(r => r.hotelId)).size, [anualRows]);
  const anualComMeta = useMemo(
    () => new Set(anualRows.filter(r => r.receitaMeta != null || r.occMeta != null || r.dmMeta != null).map(r => r.hotelId)).size,
    [anualRows]
  );

  const hotels = useMemo<GoalHotel[]>(() => (
    rows.map(row => ({ id: row.hotelId, name: row.hotelNome, city: row.cidade ?? '--', state: row.estado ?? '--', uhs: row.totalUhs }))
  ), [rows]);

  const metas = useMemo<HotelMeta[]>(() => (
    rows.filter(row => row.metaId != null || row.receitaMeta != null || row.occMeta != null || row.dmMeta != null || row.revparMeta != null)
      .map(row => ({ id: row.metaId ?? undefined, hotelId: row.hotelId, mesAno: row.mesAno || mesAno, receitaMeta: row.receitaMeta, occMeta: row.occMeta, dmMeta: row.dmMeta, revparMeta: row.revparMeta }))
  ), [rows, mesAno]);

  const metaMap = useMemo(() => {
    const map = new Map<number, HotelMeta>();
    metas.forEach(meta => map.set(meta.hotelId, meta));
    return map;
  }, [metas]);

  const filteredHotels = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return hotels;
    return hotels.filter(h => h.name.toLowerCase().includes(term) || h.city.toLowerCase().includes(term) || h.state.toLowerCase().includes(term));
  }, [hotels, query]);

  async function handleSave(hotelId: number, receita: number | null, occ: number | null, dm: number | null, revpar: number | null) {
    await saveHotelMeta({ hotelId, mesAno, receitaMeta: receita, occMeta: occ, dmMeta: dm, revparMeta: revpar });
    reload();
  }

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
        .metas-list-header, .metas-goal-row { grid-template-columns: minmax(210px,0.7fr) minmax(0,2fr) auto; }
        .metas-goal-cards { grid-template-columns: repeat(3, minmax(150px,1fr)); }
        .metas-row:hover td { background: var(--surface-h) !important; }
        @media (max-width: 900px) {
          .metas-list-header { display: none !important; }
          .metas-goal-row { grid-template-columns: 1fr; align-items: stretch !important; }
          .metas-goal-cards { grid-template-columns: 1fr; }
          .metas-goal-row > button { width: 100%; }
        }
        @media (min-width: 901px) and (max-width: 1180px) {
          .metas-goal-row { grid-template-columns: minmax(190px,0.8fr) minmax(0,2fr); }
          .metas-goal-row > button { grid-column: 2; justify-self: end; }
          .metas-goal-cards { grid-template-columns: repeat(3, minmax(120px,1fr)); }
        }
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
              : `${metas.length} de ${hotels.length} hotéis com metas em ${fmtMes(mesAno)}`}
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

          {/* Seletor de período: ANO (grande) na visão anual, mês no editor */}
          {view === 'anual' ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 'var(--rx)', overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }}>
              <button aria-label="Mês anterior" disabled={monthIdx <= 0} onClick={() => setMesAno(MONTHS[monthIdx - 1])}
                style={{ width: 38, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: monthIdx <= 0 ? 0.35 : 1, cursor: monthIdx <= 0 ? 'default' : 'pointer' }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ minWidth: 112, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px', borderLeft: '1px solid rgba(255,255,255,0.16)', borderRight: '1px solid rgba(255,255,255,0.16)', fontSize: 13, fontWeight: 850, color: '#fff' }}>
                {fmtMes(mesAno)}
              </span>
              <button aria-label="Próximo mês" disabled={monthIdx >= MONTHS.length - 1} onClick={() => setMesAno(MONTHS[monthIdx + 1])}
                style={{ width: 38, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: monthIdx >= MONTHS.length - 1 ? 0.35 : 1, cursor: monthIdx >= MONTHS.length - 1 ? 'default' : 'pointer' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Busca */}
          <div style={{ width: 260, height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRadius: 'var(--rx)', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.1)' }}>
            <Search size={14} style={{ color: 'rgba(255,255,255,0.68)', flexShrink: 0 }} />
            <input aria-label="Pesquisar hotel" value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar hotel"
              style={{ width: '100%', height: '100%', border: 'none', outline: 'none', background: 'transparent', color: '#fff', fontSize: 12.5, fontWeight: 650, fontFamily: 'var(--font)' }} />
          </div>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {view === 'anual' ? (
        <AnnualMetasTable rows={anualRows} ano={ano} query={query} loading={anualLoading} error={anualError} />
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="ml-2" style={{ fontSize: 13, color: 'var(--text-m)' }}>Carregando...</span>
        </div>
      ) : metasError ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--red)', fontWeight: 800 }}>{metasError}</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
          <div className="metas-list-header" style={{ display: 'grid', gap: 14, alignItems: 'center', padding: '10px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: 'var(--text-m)', fontSize: 10, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            <span>Hotel</span>
            <span>Metas</span>
            <span style={{ width: 124, textAlign: 'center' }}>Status</span>
          </div>
          {filteredHotels.length === 0 ? (
            <div style={{ padding: 42, textAlign: 'center', color: 'var(--text-m)', fontSize: 13, fontWeight: 700 }}>Nenhum hotel encontrado</div>
          ) : (
            filteredHotels.map(hotel => (
              <HotelGoalRow key={hotel.id} hotel={hotel} meta={metaMap.get(hotel.id)} onSave={handleSave} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
