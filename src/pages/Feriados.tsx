import { useMemo, useState } from 'react';
import {
  Building2, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Flag,
  Hotel, MapPin, Pencil, Plus, Repeat, Trash2,
} from 'lucide-react';
import MetasModal from '@/components/metas/MetasModal';
import {
  buildMockFeriados, chipData, DOW_SHORT, HOTEIS, isRecorrente, MES_FULL, OCORRENCIAS, recorrenciaLabel,
  type Abrangencia, type Feriado, type RecTipo, type Recorrencia,
} from '@/data/feriadosMock';

const ABRANG: Record<Abrangencia, { label: string; color: string; bg: string }> = {
  nacional:  { label: 'Nacional',  color: 'var(--accent)', bg: 'var(--accent-l)' },
  estadual:  { label: 'Estadual',  color: 'var(--gold)',   bg: 'var(--gold-l)' },
  municipal: { label: 'Municipal', color: 'var(--green)',  bg: 'var(--green-l)' },
  hotel:     { label: 'Hotel',     color: 'var(--amber)',  bg: 'var(--amber-l)' },
};

type Scope = { abrangencia: Abrangencia; uf?: string; cidade?: string; hotelId?: number; contexto: string; hoteis: number };

// ─── peças ───────────────────────────────────────────────────────
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{ width: 38, height: 22, flexShrink: 0, borderRadius: 999, padding: 2, cursor: 'pointer', border: 'none', background: on ? 'var(--green)' : 'var(--border)', transition: 'background .15s' }}>
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

function RecChip({ rec, ativo }: { rec: Recorrencia; ativo: boolean }) {
  const c = chipData(rec);
  const bg = ativo ? 'var(--accent-l)' : 'var(--surface-h)';
  const fg = ativo ? 'var(--accent)' : 'var(--text-m)';
  return (
    <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, border: `1px solid ${ativo ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--border)'}`, opacity: ativo ? 1 : 0.6 }}>
      {c ? (
        <>
          <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color: fg, fontFamily: 'var(--mono)' }}>{c.dia}</span>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text-m)', textTransform: 'uppercase', marginTop: 2 }}>{c.mes}</span>
        </>
      ) : <Repeat size={18} style={{ color: fg }} />}
    </span>
  );
}

function FeriadoRow({ f, onToggle, onEdit, onDelete }: { f: Feriado; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const ab = ABRANG[f.abrangencia];
  const act = (Icon: typeof Pencil, label: string, onClick: () => void, danger?: boolean) => (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--surface)', color: danger ? 'var(--red)' : 'var(--text-m)', cursor: 'pointer' }}>
      <Icon size={14} />
    </button>
  );
  return (
    <div className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border-l)' }}>
      <RecChip rec={f.rec} ativo={f.ativo} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 750, color: f.ativo ? 'var(--text)' : 'var(--text-m)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
          <span style={{ padding: '2px 8px', borderRadius: 999, background: ab.bg, color: ab.color, fontSize: 10, fontWeight: 800 }}>{ab.label}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-m)' }}>
            {isRecorrente(f.rec) && <Repeat size={11} />} {recorrenciaLabel(f.rec)}
          </span>
        </div>
      </div>
      <Switch on={f.ativo} onClick={onToggle} label={`Ativar ${f.nome}`} />
      {act(Pencil, 'Editar', onEdit)}
      {act(Trash2, 'Excluir', onDelete, true)}
    </div>
  );
}

function Expander({ open, onToggle, icon, title, sub, badges, onAdd, children }: {
  open: boolean; onToggle: () => void; icon: React.ReactNode; title: string; sub: string;
  badges: React.ReactNode; onAdd: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px', cursor: 'pointer' }} onClick={onToggle}>
        <ChevronDown size={18} style={{ color: 'var(--text-m)', flexShrink: 0, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .15s' }} />
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-l)', color: 'var(--accent)' }}>{icon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-m)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
        </div>
        {badges}
        <button type="button" onClick={e => { e.stopPropagation(); onAdd(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 11px', borderRadius: 'var(--rx)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={14} /> Adicionar
        </button>
      </div>
      {open && <div style={{ borderTop: '1px solid var(--border-l)' }}>{children}</div>}
    </div>
  );
}

// ─── modal add/editar com seletor de recorrência (estilo Teams) ───
const TIPOS: { id: RecTipo; label: string }[] = [
  { id: 'unica', label: 'Data única' }, { id: 'anual', label: 'Anual' },
  { id: 'diaSemana', label: 'Dia da semana' },
];

function FeriadoForm({ feriado, scope, ano, onSave, onClose }: {
  feriado: Feriado | null; scope: Scope; ano: number;
  onSave: (d: { id?: string; nome: string; rec: Recorrencia }) => void; onClose: () => void;
}) {
  const [nome, setNome] = useState(feriado?.nome ?? '');
  const [rec, setRec] = useState<Recorrencia>(feriado?.rec ?? { tipo: 'anual', data: `${ano}-01-01` });

  const setTipo = (t: RecTipo) => setRec(
    t === 'unica' ? { tipo: 'unica', data: rec.data ?? `${ano}-01-01` }
      : t === 'anual' ? { tipo: 'anual', data: rec.data ?? `${ano}-01-01` }
        : { tipo: 'diaSemana', dias: rec.dias ?? [6], ocorrencia: rec.ocorrencia ?? 'toda', mes: rec.mes ?? null });

  const valido = nome.trim().length > 0 && (
    (rec.tipo === 'unica' || rec.tipo === 'anual') ? !!rec.data : (rec.dias?.length ?? 0) > 0);

  const fld: React.CSSProperties = { width: '100%', height: 40, padding: '0 12px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)' };
  const lab: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 };
  const subLab: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 750, color: 'var(--text-s)', marginBottom: 8 };
  const chip = (active: boolean): React.CSSProperties => ({ height: 32, padding: '0 12px', borderRadius: 'var(--rx)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-s)', fontSize: 12, fontWeight: 800, cursor: 'pointer' });
  const dayChip = (active: boolean): React.CSSProperties => ({ flex: 1, minWidth: 0, height: 44, borderRadius: 'var(--rx)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'var(--accent)' : 'var(--surface)', color: active ? '#fff' : 'var(--text-s)', fontSize: 12, fontWeight: 800, cursor: 'pointer', transition: 'all .1s' });

  const mesSelect = (
    <select value={rec.mes ?? ''} onChange={e => setRec(r => ({ ...r, mes: e.target.value ? Number(e.target.value) : null }))} style={{ ...fld, height: 36 }}>
      <option value="">Todos os meses</option>
      {MES_FULL.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
  );

  return (
    <MetasModal
      title={feriado ? 'Editar feriado' : 'Adicionar feriado'}
      subtitle={scope.contexto}
      onClose={onClose}
      maxWidth={500}
      footer={<>
        <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
        <button onClick={() => valido && onSave({ id: feriado?.id, nome: nome.trim(), rec })} disabled={!valido}
          style={{ height: 38, padding: '0 18px', borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--accent)', background: valido ? 'var(--accent)' : 'var(--surface-h)', color: valido ? '#fff' : 'var(--text-m)', fontSize: 12.5, fontWeight: 800, cursor: valido ? 'pointer' : 'default' }}>
          <Check size={14} /> Salvar
        </button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><label style={lab} htmlFor="f-nome">Nome do feriado / evento</label><input id="f-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Aniversário da cidade" style={fld} /></div>

        <div>
          <label style={lab}>Repetição</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {TIPOS.map(t => <button key={t.id} type="button" onClick={() => setTipo(t.id)} style={chip(rec.tipo === t.id)}>{t.label}</button>)}
          </div>

          {(rec.tipo === 'unica' || rec.tipo === 'anual') && (
            <div>
              <input type="date" value={rec.data ?? ''} onChange={e => setRec(r => ({ ...r, data: e.target.value }))} style={fld} />
              {rec.tipo === 'anual' && <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 5 }}>Repete todo ano nesta data (dia/mês).</div>}
            </div>
          )}

          {rec.tipo === 'diaSemana' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <span style={subLab}>1. Selecione o(s) dia(s) da semana</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {DOW_SHORT.map((d, i) => {
                    const on = (rec.dias ?? []).includes(i);
                    return <button key={d} type="button" aria-pressed={on} style={dayChip(on)}
                      onClick={() => setRec(r => ({ ...r, dias: on ? (r.dias ?? []).filter(x => x !== i) : [...(r.dias ?? []), i] }))}>{d}</button>;
                  })}
                </div>
              </div>
              <div>
                <span style={subLab}>2. Com que frequência?</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {OCORRENCIAS.map(o => <button key={String(o.v)} type="button" style={chip(rec.ocorrencia === o.v)} onClick={() => setRec(r => ({ ...r, ocorrencia: o.v }))}>{o.curto}</button>)}
                </div>
              </div>
              <div>
                <span style={subLab}>3. Em qual mês? (opcional)</span>
                {mesSelect}
              </div>
            </div>
          )}
        </div>

        {/* Pré-visualização */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 'var(--rx)', background: 'var(--accent-l)', border: '1px solid color-mix(in srgb, var(--accent) 16%, transparent)' }}>
          {isRecorrente(rec) ? <Repeat size={15} style={{ color: 'var(--accent)' }} /> : <CalendarDays size={15} style={{ color: 'var(--accent)' }} />}
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--accent)' }}>{valido ? recorrenciaLabel(rec) : 'Defina a repetição'}</span>
        </div>
      </div>
    </MetasModal>
  );
}

// ════════════════════════════════════════════════════════════════
//  PÁGINA
// ════════════════════════════════════════════════════════════════
type Seg = 'cidades' | 'estados' | 'nacionais' | 'hoteis';
const SEGS: { id: Seg; label: string; Icon: typeof MapPin }[] = [
  { id: 'cidades', label: 'Cidades', Icon: MapPin },
  { id: 'estados', label: 'Estados', Icon: Building2 },
  { id: 'nacionais', label: 'Nacionais', Icon: Flag },
  { id: 'hoteis', label: 'Hotéis', Icon: Hotel },
];

export default function Feriados() {
  const [feriados, setFeriados] = useState<Feriado[]>(() => buildMockFeriados());
  const [ano, setAno] = useState(2026);
  const [seg, setSeg] = useState<Seg>('cidades');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [modal, setModal] = useState<{ feriado: Feriado | null; scope: Scope } | null>(null);

  const cidades = useMemo(() => {
    const m = new Map<string, { cidade: string; uf: string; hoteis: number }>();
    HOTEIS.forEach(h => {
      const k = `${h.cidade}/${h.estado}`;
      const e = m.get(k) ?? { cidade: h.cidade, uf: h.estado, hoteis: 0 };
      e.hoteis++; m.set(k, e);
    });
    return [...m.values()].sort((a, b) => a.cidade.localeCompare(b.cidade));
  }, []);
  const estados = useMemo(() => {
    const m = new Map<string, { uf: string; hoteis: number }>();
    HOTEIS.forEach(h => { const e = m.get(h.estado) ?? { uf: h.estado, hoteis: 0 }; e.hoteis++; m.set(h.estado, e); });
    return [...m.values()].sort((a, b) => a.uf.localeCompare(b.uf));
  }, []);

  const isOpen = (k: string, def = false) => open[k] ?? def;
  const toggleOpen = (k: string, def = false) => setOpen(s => ({ ...s, [k]: !(s[k] ?? def) }));
  const list = (pred: (f: Feriado) => boolean) =>
    feriados.filter(f => pred(f) && (f.rec.tipo !== 'unica' && f.rec.tipo !== 'anual' ? true : (f.rec.data ?? '').startsWith(String(ano))))
      .sort((a, b) => (a.rec.data ?? 'z').localeCompare(b.rec.data ?? 'z'));

  const toggle = (id: string) => setFeriados(fs => fs.map(f => f.id === id ? { ...f, ativo: !f.ativo } : f));
  const remove = (id: string) => setFeriados(fs => fs.filter(f => f.id !== id));
  function save(d: { id?: string; nome: string; rec: Recorrencia }) {
    if (!modal) return;
    setFeriados(fs => d.id
      ? fs.map(f => f.id === d.id ? { ...f, nome: d.nome, rec: d.rec } : f)
      : [...fs, { id: `f-${Date.now()}`, nome: d.nome, rec: d.rec, ativo: true, abrangencia: modal.scope.abrangencia, uf: modal.scope.uf, cidade: modal.scope.cidade, hotelId: modal.scope.hotelId }]);
    setModal(null);
  }

  const badge = (n: number, lbl: string, color: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-h)', fontSize: 11, fontWeight: 800, color, flexShrink: 0 }}>{n} {lbl}</span>
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '16px 20px', background: 'linear-gradient(135deg, var(--accent-d), var(--accent))', borderRadius: 'var(--r)', color: '#fff', boxShadow: 'var(--sh-m)' }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--rx)', background: 'rgba(255,170,1,0.16)', color: 'var(--gold)' }}><CalendarDays size={17} /></span>
            <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>Eventos e Feriados</h2>
          </div>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.68)', fontWeight: 550 }}>Feriados e datas comemorativas por abrangência — país, estado, cidade ou hotel</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 'calc(var(--rx) + 3px)', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
            {SEGS.map(s => (
              <button key={s.id} onClick={() => setSeg(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 13px', borderRadius: 'var(--rx)', border: 'none', fontSize: 12, fontWeight: 800, cursor: 'pointer', background: seg === s.id ? '#fff' : 'transparent', color: seg === s.id ? 'var(--accent-d)' : 'rgba(255,255,255,0.82)', boxShadow: seg === s.id ? '0 1px 3px rgba(13,27,62,0.18)' : 'none' }}>
                <s.Icon size={14} /> {s.label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 'var(--rx)', overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
            <button aria-label="Ano anterior" onClick={() => setAno(a => a - 1)} style={{ width: 34, height: 42, color: '#fff' }}><ChevronLeft size={17} /></button>
            <div style={{ minWidth: 76, height: 42, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.16)', borderRight: '1px solid rgba(255,255,255,0.16)' }}>
              <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--gold)' }}>ANO</span>
              <span style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: 'var(--mono)' }}>{ano}</span>
            </div>
            <button aria-label="Próximo ano" onClick={() => setAno(a => a + 1)} style={{ width: 34, height: 42, color: '#fff' }}><ChevronRight size={17} /></button>
          </div>
        </div>
      </div>

      {/* CIDADES */}
      {seg === 'cidades' && cidades.map((c, i) => {
        const k = `c-${c.cidade}-${c.uf}`;
        const fs = list(f => f.abrangencia === 'municipal' && f.cidade === c.cidade);
        const open_ = isOpen(k, i === 0);
        return (
          <Expander key={k} open={open_} onToggle={() => toggleOpen(k, i === 0)} icon={<MapPin size={17} />}
            title={`${c.cidade} / ${c.uf}`} sub={`Feriados municipais — valem para ${c.hoteis} ${c.hoteis === 1 ? 'hotel' : 'hotéis'} desta cidade`}
            badges={<>{badge(c.hoteis, c.hoteis === 1 ? 'hotel' : 'hotéis', 'var(--accent)')}{badge(fs.length, 'feriados', 'var(--green)')}</>}
            onAdd={() => setModal({ feriado: null, scope: { abrangencia: 'municipal', cidade: c.cidade, uf: c.uf, contexto: `Feriado municipal · ${c.cidade}/${c.uf} — aplica a ${c.hoteis} ${c.hoteis === 1 ? 'hotel' : 'hotéis'}`, hoteis: c.hoteis } })}>
            {fs.length === 0
              ? <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5, color: 'var(--text-m)' }}>Nenhum feriado municipal. Clique em <strong>Adicionar</strong>.</div>
              : fs.map(f => <FeriadoRow key={f.id} f={f} onToggle={() => toggle(f.id)} onEdit={() => setModal({ feriado: f, scope: { abrangencia: 'municipal', cidade: c.cidade, uf: c.uf, contexto: `Feriado municipal · ${c.cidade}/${c.uf}`, hoteis: c.hoteis } })} onDelete={() => remove(f.id)} />)}
          </Expander>
        );
      })}

      {/* ESTADOS */}
      {seg === 'estados' && estados.map((e, i) => {
        const k = `e-${e.uf}`;
        const fs = list(f => f.abrangencia === 'estadual' && f.uf === e.uf);
        const open_ = isOpen(k, i === 0);
        return (
          <Expander key={k} open={open_} onToggle={() => toggleOpen(k, i === 0)} icon={<Building2 size={17} />}
            title={`${e.uf}`} sub={`Feriados estaduais — valem para ${e.hoteis} ${e.hoteis === 1 ? 'hotel' : 'hotéis'} deste estado`}
            badges={<>{badge(e.hoteis, e.hoteis === 1 ? 'hotel' : 'hotéis', 'var(--accent)')}{badge(fs.length, 'feriados', 'var(--green)')}</>}
            onAdd={() => setModal({ feriado: null, scope: { abrangencia: 'estadual', uf: e.uf, contexto: `Feriado estadual · ${e.uf} — aplica a ${e.hoteis} ${e.hoteis === 1 ? 'hotel' : 'hotéis'}`, hoteis: e.hoteis } })}>
            {fs.length === 0
              ? <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5, color: 'var(--text-m)' }}>Nenhum feriado estadual. Clique em <strong>Adicionar</strong>.</div>
              : fs.map(f => <FeriadoRow key={f.id} f={f} onToggle={() => toggle(f.id)} onEdit={() => setModal({ feriado: f, scope: { abrangencia: 'estadual', uf: e.uf, contexto: `Feriado estadual · ${e.uf}`, hoteis: e.hoteis } })} onDelete={() => remove(f.id)} />)}
          </Expander>
        );
      })}

      {/* NACIONAIS */}
      {seg === 'nacionais' && (() => {
        const fs = list(f => f.abrangencia === 'nacional');
        const ativos = fs.filter(f => f.ativo).length;
        return (
          <Expander open onToggle={() => {}} icon={<Flag size={17} />} title="Feriados nacionais"
            sub={`Padrão do Brasil — valem para todos os ${HOTEIS.length} hotéis`}
            badges={badge(ativos, `de ${fs.length} ativos`, 'var(--green)')}
            onAdd={() => setModal({ feriado: null, scope: { abrangencia: 'nacional', contexto: `Feriado nacional — aplica a todos os ${HOTEIS.length} hotéis`, hoteis: HOTEIS.length } })}>
            {fs.map(f => <FeriadoRow key={f.id} f={f} onToggle={() => toggle(f.id)} onEdit={() => setModal({ feriado: f, scope: { abrangencia: 'nacional', contexto: 'Feriado nacional', hoteis: HOTEIS.length } })} onDelete={() => remove(f.id)} />)}
          </Expander>
        );
      })()}

      {/* HOTÉIS — eventos exclusivos de um hotel */}
      {seg === 'hoteis' && HOTEIS.map((h, i) => {
        const k = `h-${h.hotelId}`;
        const fs = list(f => f.abrangencia === 'hotel' && f.hotelId === h.hotelId);
        const open_ = isOpen(k, i === 0);
        return (
          <Expander key={k} open={open_} onToggle={() => toggleOpen(k, i === 0)} icon={<Hotel size={17} />}
            title={h.nome} sub={`Eventos exclusivos — só deste hotel · ${h.cidade}/${h.estado}`}
            badges={badge(fs.length, fs.length === 1 ? 'evento' : 'eventos', 'var(--amber)')}
            onAdd={() => setModal({ feriado: null, scope: { abrangencia: 'hotel', hotelId: h.hotelId, contexto: `Evento exclusivo · ${h.nome}`, hoteis: 1 } })}>
            {fs.length === 0
              ? <div style={{ padding: 26, textAlign: 'center', fontSize: 12.5, color: 'var(--text-m)' }}>Nenhum evento exclusivo. Ex.: aniversário do hotel. Clique em <strong>Adicionar</strong>.</div>
              : fs.map(f => <FeriadoRow key={f.id} f={f} onToggle={() => toggle(f.id)} onEdit={() => setModal({ feriado: f, scope: { abrangencia: 'hotel', hotelId: h.hotelId, contexto: `Evento exclusivo · ${h.nome}`, hoteis: 1 } })} onDelete={() => remove(f.id)} />)}
          </Expander>
        );
      })}

      <p style={{ fontSize: 11, color: 'var(--text-m)', textAlign: 'center', fontWeight: 500 }}>
        Dados de exemplo (mock) — por abrangência (país · estado · cidade · hotel) e recorrência pontual ou repetida.
      </p>

      {modal && <FeriadoForm feriado={modal.feriado} scope={modal.scope} ano={ano} onSave={save} onClose={() => setModal(null)} />}
    </div>
  );
}
