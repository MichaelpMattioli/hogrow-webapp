import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, Check, FileText, Loader2, MapPin, Plus, Save, Trash2, X,
} from 'lucide-react';
import { parseBookingUrl, nameFromSlug } from '@/lib/booking';
import ModalShell from '@/components/ui/ModalShell';
import { UFS, ufFromAny, estadoFromUf } from '@/data/uf';
import {
  createCliente, updateCliente, setClienteAtivo, checkDeleteCliente, deleteCliente,
  useClienteCompetitors, useCidadesExistentes, DEPENDENT_LABELS,
  type ClienteAdminRow, type CompetitorPayload, type DeleteDependents,
} from '@/hooks/useClientes';

interface Props {
  mode: 'create' | 'edit';
  cliente?: ClienteAdminRow | null;
  onClose: () => void;
  onSaved: (msg?: string) => void;
  onDeleted: (msg: string) => void;
}

interface CompState {
  key: string;
  infoId?: number;
  url: string;
  name: string;
  nameTouched: boolean;
  ativo: boolean;
}

let KEY_SEQ = 0;
const nextKey = () => `c${++KEY_SEQ}`;

// ─── peças ───────────────────────────────────────────────────────────
function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      style={{ width: 38, height: 22, flexShrink: 0, borderRadius: 999, padding: 2, cursor: 'pointer', border: 'none', background: on ? 'var(--green)' : 'var(--border)', transition: 'background .15s' }}
    >
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border-l)',
  borderRadius: 'var(--rx)', color: 'var(--text)', fontSize: 13, fontWeight: 500, outline: 'none', fontFamily: 'var(--font)',
};

function Field({ label, icon: Icon, required, error, children }: {
  label: string; icon: React.ElementType; required?: boolean; error?: string | null; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-m)', marginBottom: 6 }}>
        <Icon size={12} /> {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
      </label>
      {children}
      {error && (
        <div role="alert" className="flex items-center gap-1.5" style={{ marginTop: 5, fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>
          <AlertTriangle size={11} /> {error}
        </div>
      )}
    </div>
  );
}

// ─── editor de um concorrente ────────────────────────────────────────
function CompetitorItem({ comp, error, onChange, onRemove }: {
  comp: CompState; error: string | null;
  onChange: (patch: Partial<CompState>) => void; onRemove: () => void;
}) {
  const parsed = parseBookingUrl(comp.url);
  const hasUrl = comp.url.trim().length > 0;
  const valid = hasUrl && parsed.ok && !error;

  return (
    <div style={{ border: `1px solid ${error ? 'var(--red)' : 'var(--border-l)'}`, borderRadius: 'var(--rx)', padding: 12, background: 'var(--bg)' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={comp.url}
            onChange={e => onChange({ url: e.target.value })}
            placeholder="Cole o link do hotel no Booking.com"
            aria-invalid={!!error}
            style={{ ...inputStyle, borderColor: error ? 'var(--red)' : valid ? 'var(--green)' : 'var(--border-l)', paddingRight: 30 }}
          />
          {valid && <Check size={15} style={{ position: 'absolute', right: 10, top: 11, color: 'var(--green)' }} />}
        </div>
        <Switch on={comp.ativo} onClick={() => onChange({ ativo: !comp.ativo })} label="Concorrente ativo" />
        <button
          type="button" aria-label="Remover concorrente" title="Remover" onClick={onRemove}
          style={{ width: 34, height: 34, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--red)', cursor: 'pointer' }}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {error ? (
        <div role="alert" className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>
          <AlertTriangle size={11} /> {error}
        </div>
      ) : valid ? (
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap' }}>✓ {parsed.slug}</span>
          <input
            value={comp.name}
            onChange={e => onChange({ name: e.target.value, nameTouched: true })}
            placeholder="Nome do concorrente"
            style={{ ...inputStyle, padding: '6px 10px', fontSize: 12 }}
          />
        </div>
      ) : (
        <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-m)' }}>
          Ex.: https://www.booking.com/hotel/br/seu-concorrente.pt-br.html
        </span>
      )}
    </div>
  );
}

// ─── confirmação de exclusão (com checagem de dependências) ──────────
function DeleteConfirm({ cliente, onCancel, onDeleted }: {
  cliente: ClienteAdminRow; onCancel: () => void; onDeleted: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [deps, setDeps] = useState<DeleteDependents | null>(null);
  const [canDelete, setCanDelete] = useState(false);
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    checkDeleteCliente(cliente.id).then(res => {
      if (!alive) return;
      setLoading(false);
      if (res) { setDeps(res.dependents); setCanDelete(res.canDelete); }
      else setErr('Não foi possível verificar as dependências.');
    });
    return () => { alive = false; };
  }, [cliente.id]);

  const blocking = deps ? Object.entries(deps).filter(([, v]) => v > 0) : [];

  async function confirm() {
    setWorking(true);
    const res = await deleteCliente(cliente.id);
    setWorking(false);
    if (res.success) onDeleted(`"${cliente.nomeFantasia}" foi excluído.`);
    else if ('dependents' in res) { setDeps(res.dependents); setCanDelete(false); }
    else setErr(res.error);
  }

  return (
    <ModalShell onClose={onCancel} ariaLabel="Excluir cliente" width={440} zIndex={1000}>
      <div style={{ padding: 20 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <span style={{ width: 34, height: 34, borderRadius: 'var(--rx)', background: 'var(--red-l)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle size={17} />
          </span>
          <h3 style={{ fontSize: 15, fontWeight: 800 }}>Excluir cliente</h3>
        </div>

        {loading ? (
          <div className="flex items-center gap-2" style={{ color: 'var(--text-m)', fontSize: 13, padding: '12px 0' }}>
            <Loader2 size={14} className="animate-spin" /> Verificando dependências…
          </div>
        ) : err ? (
          <p style={{ fontSize: 13, color: 'var(--red)' }}>{err}</p>
        ) : canDelete ? (
          <p style={{ fontSize: 13, color: 'var(--text-s)', lineHeight: 1.5 }}>
            <b>{cliente.nomeFantasia}</b> não possui dados vinculados e pode ser excluído definitivamente.
            Esta ação não pode ser desfeita.
          </p>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-s)', lineHeight: 1.5, marginBottom: 10 }}>
              Não é possível excluir — existem dados vinculados. Use <b>Desativar</b> para tirar o cliente da operação sem perder o histórico.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {blocking.map(([k, v]) => (
                <span key={k} style={{ fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'var(--surface-h)', color: 'var(--text-m)' }}>
                  {DEPENDENT_LABELS[k as keyof DeleteDependents]}: {v}
                </span>
              ))}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2" style={{ marginTop: 18 }}>
          <button type="button" data-autofocus onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-s)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          {canDelete && !loading && (
            <button type="button" onClick={confirm} disabled={working} style={{ padding: '8px 16px', borderRadius: 'var(--rx)', border: 'none', background: 'var(--red)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: working ? 0.7 : 1 }}>
              {working ? <Loader2 size={13} className="animate-spin" /> : 'Excluir definitivamente'}
            </button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ─── modal principal ─────────────────────────────────────────────────
export default function ClienteFormModal({ mode, cliente, onClose, onSaved, onDeleted }: Props) {
  const editing = mode === 'edit' && !!cliente;
  const { data: existingComps } = useClienteCompetitors(editing ? cliente!.id : null);
  const { data: cidades } = useCidadesExistentes();

  const [nomeFantasia, setNomeFantasia] = useState(cliente?.nomeFantasia ?? '');
  const [razaoSocial, setRazaoSocial] = useState(cliente?.razaoSocial ?? '');
  const [cidade, setCidade] = useState(cliente?.cidade ?? '');
  const [uf, setUf] = useState(ufFromAny(cliente?.uf ?? cliente?.estado) ?? '');
  const [ativo, setAtivo] = useState(cliente?.ativo ?? true);
  const [comps, setComps] = useState<CompState[]>([]);

  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Carrega concorrentes existentes ao abrir em modo edição.
  useEffect(() => {
    if (!editing || !existingComps) return;
    setComps(existingComps.map(c => ({
      key: nextKey(), infoId: c.infoId, url: c.url, name: c.name, nameTouched: true, ativo: c.ativo,
    })));
  }, [editing, existingComps]);

  // Erros por linha de concorrente (formato + duplicidade).
  const { rowErrors, payload } = useMemo(() => {
    const parsedList = comps.map(c => parseBookingUrl(c.url));
    const firstBySlug = new Map<string, number>();
    parsedList.forEach((p, i) => { if (p.ok && !firstBySlug.has(p.slug)) firstBySlug.set(p.slug, i); });

    const rowErrors = comps.map((c, i) => {
      if (!c.url.trim()) return null;          // linha vazia é ignorada
      const p = parsedList[i];
      if (!p.ok) return p.message;
      if (firstBySlug.get(p.slug) !== i) return 'Esse concorrente já está na lista.';
      return null;
    });

    const payload: CompetitorPayload[] = [];
    comps.forEach((c, i) => {
      const p = parsedList[i];
      if (c.url.trim() && p.ok && rowErrors[i] === null) {
        payload.push({
          slug: p.slug, url: p.url, country: p.country, lang: p.lang,
          name: c.name.trim() || nameFromSlug(p.slug), ativo: c.ativo, ordem: payload.length,
        });
      }
    });
    return { rowErrors, payload };
  }, [comps]);

  const nomeErr = submitted && !nomeFantasia.trim() ? 'Informe o nome fantasia.' : null;
  const razaoErr = submitted && !razaoSocial.trim() ? 'Informe a razão social.' : null;
  const hasRowError = rowErrors.some(e => e !== null);

  function addComp() {
    setComps(prev => [...prev, { key: nextKey(), url: '', name: '', nameTouched: false, ativo: true }]);
  }
  function patchComp(key: string, patch: Partial<CompState>) {
    setComps(prev => prev.map(c => {
      if (c.key !== key) return c;
      const next = { ...c, ...patch };
      // auto-preenche o nome a partir do slug, enquanto o usuário não editar o nome
      if (patch.url !== undefined && !next.nameTouched) {
        const p = parseBookingUrl(next.url);
        if (p.ok) next.name = nameFromSlug(p.slug);
      }
      return next;
    }));
  }

  async function handleSave() {
    setSubmitted(true);
    setBanner(null);
    if (!nomeFantasia.trim() || !razaoSocial.trim() || hasRowError) {
      setBanner('Corrija os campos destacados em vermelho.');
      return;
    }
    setSaving(true);
    const fields = {
      nome_fantasia: nomeFantasia.trim(),
      razao_social: razaoSocial.trim(),
      cidade: cidade.trim() || null,
      uf: uf || null,
      estado: uf ? estadoFromUf(uf) : null,
      ativo,
    };
    const res = editing
      ? await updateCliente(cliente!.id, fields, payload)
      : await createCliente(fields, payload);
    setSaving(false);

    if (res.success) {
      const soft = res.softened && res.softened.length
        ? ` ${res.softened.length} concorrente(s) com histórico foram desativados em vez de excluídos.`
        : '';
      onSaved(`${editing ? 'Cliente atualizado.' : 'Cliente cadastrado.'}${soft}`);
    } else {
      setBanner(res.error);
    }
  }

  async function toggleAtivo() {
    if (!editing) { setAtivo(a => !a); return; }
    const next = !ativo;
    setAtivo(next);
    const res = await setClienteAtivo(cliente!.id, next);
    if (!res.success) { setAtivo(!next); setBanner(res.error); }
  }

  return (
    <>
      <ModalShell
        onClose={onClose}
        ariaLabel={editing ? 'Editar cliente' : 'Novo cliente'}
        width={600}
        inert={confirmDelete}
      >
        {/* Header (fixo) */}
        <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-l)', flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 850, letterSpacing: '-0.3px' }}>{editing ? 'Editar cliente' : 'Novo cliente'}</h2>
            {editing && <p style={{ fontSize: 11.5, color: 'var(--text-m)', marginTop: 1 }}>ID {cliente!.id} · {ativo ? 'Ativo' : 'Inativo'}</p>}
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} style={{ width: 32, height: 32, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-m)', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body (rolável; header e footer ficam fixos) */}
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {banner && (
            <div role="alert" className="flex items-center gap-2" style={{ padding: '10px 12px', borderRadius: 'var(--rx)', background: 'var(--red-l)', color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>
              <AlertTriangle size={14} /> {banner}
            </div>
          )}

          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-2">
              <Field label="Nome Fantasia" icon={Building2} required error={nomeErr}>
                <input data-autofocus value={nomeFantasia} onChange={e => setNomeFantasia(e.target.value)} placeholder="Ex.: Hotel Sol Nascente" style={{ ...inputStyle, borderColor: nomeErr ? 'var(--red)' : 'var(--border-l)' }} />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Razão Social" icon={FileText} required error={razaoErr}>
                <input value={razaoSocial} onChange={e => setRazaoSocial(e.target.value)} placeholder="Ex.: Sol Nascente Hotelaria LTDA" style={{ ...inputStyle, borderColor: razaoErr ? 'var(--red)' : 'var(--border-l)' }} />
              </Field>
            </div>
            <Field label="Cidade" icon={MapPin}>
              <input list="cidades-sugeridas" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex.: Santarém" style={inputStyle} />
              <datalist id="cidades-sugeridas">
                {(cidades ?? []).map(c => <option key={c} value={c} />)}
              </datalist>
            </Field>
            <Field label="Estado (UF)" icon={MapPin}>
              <select value={uf} onChange={e => setUf(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">Selecione…</option>
                {UFS.map(u => <option key={u.uf} value={u.uf}>{u.uf} — {u.nome}</option>)}
              </select>
            </Field>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderRadius: 'var(--rx)', background: 'var(--bg)', border: '1px solid var(--border-l)' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Cliente ativo</span>
              <p style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 1 }}>{ativo ? 'Aparece nos dashboards e no rate shopper' : 'Oculto dos dashboards'}</p>
            </div>
            <Switch on={ativo} onClick={toggleAtivo} label="Cliente ativo" />
          </div>

          {/* Concorrentes */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 13.5, fontWeight: 800 }}>Concorrentes (Booking)</h3>
                <p style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 1 }}>Cole o link do hotel no Booking — o resto é automático</p>
              </div>
              <button type="button" onClick={addComp} className="flex items-center gap-1.5" style={{ height: 32, padding: '0 12px', borderRadius: 'var(--rx)', border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {comps.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-m)', padding: '10px 0', textAlign: 'center' }}>Nenhum concorrente cadastrado.</p>
              )}
              {comps.map((c, i) => (
                <CompetitorItem
                  key={c.key} comp={c} error={rowErrors[i]}
                  onChange={patch => patchComp(c.key, patch)}
                  onRemove={() => setComps(prev => prev.filter(x => x.key !== c.key))}
                />
              ))}
            </div>
          </div>

          {/* Zona de perigo (só edição) */}
          {editing && (
            <div style={{ marginTop: 4, paddingTop: 14, borderTop: '1px solid var(--border-l)' }}>
              <button
                type="button" onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5"
                style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 size={13} /> Excluir cliente definitivamente
              </button>
            </div>
          )}
        </div>

        {/* Footer (fixo) */}
        <div className="flex items-center justify-end gap-2" style={{ padding: '14px 20px', borderTop: '1px solid var(--border-l)', flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 'var(--rx)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-s)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="flex items-center gap-2"
            style={{ padding: '9px 22px', borderRadius: 'var(--rx)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar cliente'}
          </button>
        </div>

      </ModalShell>

      {editing && confirmDelete && (
        <DeleteConfirm cliente={cliente!} onCancel={() => setConfirmDelete(false)} onDeleted={onDeleted} />
      )}
    </>
  );
}
