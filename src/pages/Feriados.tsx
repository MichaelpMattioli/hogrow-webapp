import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Flag, Hotel,
  MapPin, Pencil, Plus, Search, Trash2,
} from 'lucide-react';
import MetasModal from '@/components/metas/MetasModal';
import { buildMockFeriados, type Feriado, type FeriadoTipo, type HotelFeriados } from '@/data/feriadosMock';

const MES_AB = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TIPO: Record<FeriadoTipo, { label: string; color: string; bg: string }> = {
  nacional:  { label: 'Nacional',  color: 'var(--accent)', bg: 'var(--accent-l)' },
  estadual:  { label: 'Estadual',  color: 'var(--gold)',   bg: 'var(--gold-l)' },
  municipal: { label: 'Municipal', color: 'var(--green)',  bg: 'var(--green-l)' },
};

function fmtDia(data: string) {
  return { dia: data.slice(8, 10), mes: MES_AB[Number(data.slice(5, 7)) - 1] ?? '—' };
}

// ─── peças visuais ───────────────────────────────────────────────
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{ width: 38, height: 22, flexShrink: 0, borderRadius: 999, padding: 2, cursor: 'pointer', border: 'none',
        background: on ? 'var(--green)' : 'var(--border)', transition: 'background .15s' }}>
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

function DateChip({ data, ativo }: { data: string; ativo: boolean }) {
  const { dia, mes } = fmtDia(data);
  return (
    <span style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: ativo ? 'var(--accent-l)' : 'var(--surface-h)', border: `1px solid ${ativo ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--border)'}`, opacity: ativo ? 1 : 0.6 }}>
      <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1, color: ativo ? 'var(--accent)' : 'var(--text-m)', fontFamily: 'var(--mono)' }}>{dia}</span>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.04em', color: 'var(--text-m)', textTransform: 'uppercase', marginTop: 2 }}>{mes}</span>
    </span>
  );
}

function TipoChip({ tipo }: { tipo: FeriadoTipo }) {
  const t = TIPO[tipo];
  return <span style={{ padding: '2px 9px', borderRadius: 999, background: t.bg, color: t.color, fontSize: 10.5, fontWeight: 800 }}>{t.label}</span>;
}

function FeriadoRow({ f, onToggle, onEdit, onDelete }: { f: Feriado; onToggle: () => void; onEdit?: () => void; onDelete?: () => void }) {
  const act = (Icon: typeof Pencil, label: string, onClick: () => void, danger?: boolean): React.ReactNode => (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid var(--border)', background: 'var(--surface)', color: danger ? 'var(--red)' : 'var(--text-m)', cursor: 'pointer' }}>
      <Icon size={14} />
    </button>
  );
  return (
    <div className="row-hover" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--border-l)' }}>
      <DateChip data={f.data} ativo={f.ativo} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 750, color: f.ativo ? 'var(--text)' : 'var(--text-m)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.nome}</div>
        <div style={{ marginTop: 4 }}><TipoChip tipo={f.tipo} /></div>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: f.ativo ? 'var(--green)' : 'var(--text-m)', minWidth: 48, textAlign: 'right' }}>{f.ativo ? 'Ativo' : 'Inativo'}</span>
      <Switch on={f.ativo} onClick={onToggle} label={`Ativar ${f.nome}`} />
      {onEdit && act(Pencil, 'Editar', onEdit)}
      {onDelete && act(Trash2, 'Excluir', onDelete, true)}
    </div>
  );
}

function Section({ icon, title, sub, count, action, children }: {
  icon: React.ReactNode; title: string; sub?: string; count: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', borderBottom: '1px solid var(--border-l)' }}>
        <span style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-l)', color: 'var(--accent)' }}>{icon}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 850, color: 'var(--text)' }}>{title}</div>
          {sub && <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-m)', marginTop: 1 }}>{sub}</div>}
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-m)' }}>{count}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── seletor de hotel (dropdown com busca) ───────────────────────
function HotelPicker({ hoteis, selectedId, onSelect }: { hoteis: HotelFeriados[]; selectedId: number; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const sel = hoteis.find(h => h.hotelId === selectedId);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? hoteis.filter(h => h.nome.toLowerCase().includes(t) || h.cidade.toLowerCase().includes(t)) : hoteis;
  }, [hoteis, q]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-haspopup="listbox" aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 12px', minWidth: 240, borderRadius: 'var(--rx)', border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer' }}>
        <Hotel size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 800, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sel?.nome ?? 'Selecione'}</span>
          <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{sel ? `${sel.cidade}/${sel.estado} · ${sel.uhs} UHs` : ''}</span>
        </span>
        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
      </button>
      {open && (
        <div role="listbox" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 60, width: 300, maxHeight: 360, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rs)', boxShadow: 'var(--sh-m)' }}>
          <div style={{ position: 'sticky', top: 0, background: 'var(--surface)', padding: 8, borderBottom: '1px solid var(--border-l)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 34, padding: '0 10px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <Search size={14} style={{ color: 'var(--text-m)' }} />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar hotel…" style={{ border: 'none', outline: 'none', background: 'transparent', width: '100%', fontSize: 12.5, color: 'var(--text)' }} />
            </div>
          </div>
          {list.map(h => {
            const active = h.hotelId === selectedId;
            return (
              <button key={h.hotelId} type="button" role="option" aria-selected={active}
                onClick={() => { onSelect(h.hotelId); setOpen(false); setQ(''); }}
                className="hg-menu-item"
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border-l)', background: active ? 'var(--accent-l)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <Hotel size={15} style={{ color: active ? 'var(--accent)' : 'var(--text-m)', flexShrink: 0 }} />
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nome}</span>
                  <span style={{ display: 'block', fontSize: 10.5, fontWeight: 600, color: 'var(--text-m)' }}>{h.cidade}/{h.estado}</span>
                </span>
                {active && <Check size={15} style={{ color: 'var(--accent)' }} />}
              </button>
            );
          })}
          {list.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12.5, color: 'var(--text-m)' }}>Nenhum hotel.</div>}
        </div>
      )}
    </div>
  );
}

// ─── modal add/editar feriado local ──────────────────────────────
function FeriadoForm({ inicial, ano, onSave, onClose }: { inicial: Partial<Feriado> | null; ano: number; onSave: (f: { id?: string; data: string; nome: string; tipo: FeriadoTipo }) => void; onClose: () => void }) {
  const [data, setData] = useState(inicial?.data ?? `${ano}-01-01`);
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [tipo, setTipo] = useState<FeriadoTipo>((inicial?.tipo as FeriadoTipo) ?? 'municipal');
  const valido = nome.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(data);
  const fld: React.CSSProperties = { width: '100%', height: 40, padding: '0 12px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)' };
  const lab: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 };
  return (
    <MetasModal
      title={inicial?.id ? 'Editar feriado local' : 'Adicionar feriado local'}
      subtitle="Feriados estaduais e municipais valem só para este hotel."
      onClose={onClose}
      maxWidth={460}
      footer={<>
        <button onClick={onClose} style={{ height: 38, padding: '0 16px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
        <button onClick={() => valido && onSave({ id: inicial?.id, data, nome: nome.trim(), tipo })} disabled={!valido}
          style={{ height: 38, padding: '0 18px', borderRadius: 'var(--rx)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', gap: 7, background: valido ? 'var(--accent)' : 'var(--surface-h)', color: valido ? '#fff' : 'var(--text-m)', fontSize: 12.5, fontWeight: 800, cursor: valido ? 'pointer' : 'default' }}>
          <Check size={14} /> Salvar
        </button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={lab} htmlFor="f-data">Data</label><input id="f-data" type="date" value={data} onChange={e => setData(e.target.value)} style={fld} /></div>
        <div><label style={lab} htmlFor="f-nome">Nome do feriado</label><input id="f-nome" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Aniversário da cidade" style={fld} /></div>
        <div>
          <label style={lab}>Tipo</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['municipal', 'estadual'] as FeriadoTipo[]).map(t => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                style={{ flex: 1, height: 40, borderRadius: 'var(--rx)', border: `1px solid ${tipo === t ? TIPO[t].color : 'var(--border)'}`, background: tipo === t ? TIPO[t].bg : 'var(--surface)', color: tipo === t ? TIPO[t].color : 'var(--text-m)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
                {TIPO[t].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </MetasModal>
  );
}

// ════════════════════════════════════════════════════════════════
//  PÁGINA
// ════════════════════════════════════════════════════════════════
export default function Feriados() {
  const [hoteis, setHoteis] = useState<HotelFeriados[]>(() => buildMockFeriados());
  const [selectedId, setSelectedId] = useState(hoteis[0]?.hotelId ?? 0);
  const [ano, setAno] = useState(2026);
  const [form, setForm] = useState<{ inicial: Partial<Feriado> | null } | null>(null);

  const sel = hoteis.find(h => h.hotelId === selectedId);
  const doAno = (sel?.feriados ?? []).filter(f => f.data.startsWith(String(ano)));
  const nacionais = doAno.filter(f => f.tipo === 'nacional').sort((a, b) => a.data.localeCompare(b.data));
  const locais = doAno.filter(f => f.tipo !== 'nacional').sort((a, b) => a.data.localeCompare(b.data));
  const nacAtivos = nacionais.filter(f => f.ativo).length;
  const locAtivos = locais.filter(f => f.ativo).length;

  function mutate(fn: (fs: Feriado[]) => Feriado[]) {
    setHoteis(hs => hs.map(h => h.hotelId === selectedId ? { ...h, feriados: fn(h.feriados) } : h));
  }
  const toggle = (id: string) => mutate(fs => fs.map(f => f.id === id ? { ...f, ativo: !f.ativo } : f));
  const remove = (id: string) => mutate(fs => fs.filter(f => f.id !== id));
  function save(d: { id?: string; data: string; nome: string; tipo: FeriadoTipo }) {
    mutate(fs => d.id
      ? fs.map(f => f.id === d.id ? { ...f, ...d } : f)
      : [...fs, { id: `l-${selectedId}-${Date.now()}`, data: d.data, nome: d.nome, tipo: d.tipo, ativo: true }]);
    setForm(null);
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', padding: '16px 20px', background: 'linear-gradient(135deg, var(--accent-d), var(--accent))', borderRadius: 'var(--r)', color: '#fff', boxShadow: 'var(--sh-m)' }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--rx)', background: 'rgba(255,170,1,0.16)', color: 'var(--gold)' }}><CalendarDays size={17} /></span>
            <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>Feriados</h2>
          </div>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.68)', fontWeight: 550 }}>Defina os feriados nacionais e locais de cada hotel</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 'var(--rx)', overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
            <button aria-label="Ano anterior" onClick={() => setAno(a => a - 1)} style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><ChevronLeft size={18} /></button>
            <div style={{ minWidth: 84, height: 44, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid rgba(255,255,255,0.16)', borderRight: '1px solid rgba(255,255,255,0.16)', padding: '0 12px' }}>
              <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', color: 'var(--gold)' }}>ANO</span>
              <span style={{ fontSize: 24, fontWeight: 900, lineHeight: 1, color: '#fff', fontFamily: 'var(--mono)' }}>{ano}</span>
            </div>
            <button aria-label="Próximo ano" onClick={() => setAno(a => a + 1)} style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><ChevronRight size={18} /></button>
          </div>
          <HotelPicker hoteis={hoteis} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
      </div>

      {!sel ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-m)' }}>Selecione um hotel.</div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { lbl: 'Nacionais ativos', val: `${nacAtivos}/${nacionais.length}`, color: 'var(--accent)' },
              { lbl: 'Locais ativos', val: `${locAtivos}/${locais.length}`, color: 'var(--green)' },
              { lbl: 'Total no ano', val: nacAtivos + locAtivos, color: 'var(--gold)' },
            ].map(s => (
              <div key={s.lbl} style={{ flex: '1 1 150px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '12px 16px', boxShadow: 'var(--sh)' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: 'var(--mono)', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 5 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* Nacionais */}
          <Section icon={<Flag size={17} />} title="Feriados nacionais" sub="Padrão do Brasil — ative ou desative por hotel (não podem ser excluídos)." count={`${nacAtivos} de ${nacionais.length} ativos`}>
            {nacionais.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-m)' }}>Nenhum feriado nacional para {ano}.</div>
              : nacionais.map(f => <FeriadoRow key={f.id} f={f} onToggle={() => toggle(f.id)} />)}
          </Section>

          {/* Locais */}
          <Section icon={<MapPin size={17} />} title={`Feriados locais · ${sel.cidade}/${sel.estado}`} sub="Estaduais e municipais específicos deste hotel."
            count={`${locais.length} ${locais.length === 1 ? 'feriado' : 'feriados'}`}
            action={<button type="button" onClick={() => setForm({ inicial: null })}
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 'var(--rx)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
              <Plus size={15} /> Adicionar
            </button>}>
            {locais.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--text-m)' }}>Nenhum feriado local cadastrado. Clique em <strong>Adicionar</strong>.</div>
              : locais.map(f => <FeriadoRow key={f.id} f={f} onToggle={() => toggle(f.id)} onEdit={() => setForm({ inicial: f })} onDelete={() => remove(f.id)} />)}
          </Section>

          <p style={{ fontSize: 11, color: 'var(--text-m)', textAlign: 'center', fontWeight: 500 }}>
            Dados de exemplo (mock) — em breve conectado aos feriados reais por hotel.
          </p>
        </>
      )}

      {form && <FeriadoForm inicial={form.inicial} ano={ano} onSave={save} onClose={() => setForm(null)} />}
    </div>
  );
}
