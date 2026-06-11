import { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle, ChevronLeft, ChevronRight, Hotel, Loader2, MapPin, Pencil, Plus, Search, Swords } from 'lucide-react';
import ClienteFormModal from '@/components/forms/ClienteFormModal';
import { useClientesAdmin, setClienteAtivo, type ClienteAdminRow } from '@/hooks/useClientes';

function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} aria-label={label}
      onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ width: 38, height: 22, flexShrink: 0, borderRadius: 999, padding: 2, cursor: 'pointer', border: 'none', background: on ? 'var(--green)' : 'var(--border)', transition: 'background .15s' }}
    >
      <span style={{ display: 'block', width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.2)', transform: on ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
    </button>
  );
}

function ClienteRow({ c, onEdit, onToggle }: { c: ClienteAdminRow; onEdit: () => void; onToggle: () => void }) {
  const local = [c.cidade, c.uf].filter(Boolean).join(' · ');
  return (
    <div
      className="row-hover" onClick={onEdit}
      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: '1px solid var(--border-l)', cursor: 'pointer', opacity: c.ativo ? 1 : 0.62 }}
    >
      <span style={{ width: 38, height: 38, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-l)', color: 'var(--accent)' }}>
        <Hotel size={17} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 750, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nomeFantasia}</span>
          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, flexShrink: 0, background: c.ativo ? 'var(--green-l)' : 'var(--surface-h)', color: c.ativo ? 'var(--green)' : 'var(--text-m)' }}>
            {c.ativo ? 'ATIVO' : 'INATIVO'}
          </span>
        </div>
        <div className="flex items-center gap-3" style={{ marginTop: 3 }}>
          {local && (
            <span className="flex items-center gap-1" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-m)' }}>
              <MapPin size={11} /> {local}
            </span>
          )}
          <span className="flex items-center gap-1" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-m)' }}>
            <Swords size={11} /> {c.concorrentes} concorrente{c.concorrentes === 1 ? '' : 's'}
            {c.concorrentes > 0 && c.concorrentesAtivos !== c.concorrentes && ` (${c.concorrentesAtivos} ativos)`}
          </span>
        </div>
      </div>
      <Switch on={c.ativo} onClick={onToggle} label={`Ativar ${c.nomeFantasia}`} />
      <button
        type="button" aria-label="Editar" title="Editar" onClick={e => { e.stopPropagation(); onEdit(); }}
        style={{ width: 32, height: 32, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-m)', cursor: 'pointer' }}
      >
        <Pencil size={14} />
      </button>
    </div>
  );
}

const PER_PAGE = 10;

// Lista de páginas a exibir, com reticências quando há muitas (1 … 4 5 6 … 12).
function pageItems(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push('gap');
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push('gap');
  out.push(total);
  return out;
}

function Pagination({ page, totalPages, total, perPage, onChange }: {
  page: number; totalPages: number; total: number; perPage: number; onChange: (p: number) => void;
}) {
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const numStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 32, height: 32, padding: '0 9px', borderRadius: 'var(--rx)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--text-s)', fontSize: 12.5, fontWeight: 700,
    cursor: active ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  });
  const navStyle = (disabled: boolean): React.CSSProperties => ({
    width: 32, height: 32, borderRadius: 'var(--rx)', border: '1px solid var(--border)',
    background: 'var(--surface)', color: 'var(--text-m)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
  });

  return (
    <div className="flex items-center justify-between" style={{ marginTop: 12, flexWrap: 'wrap', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-m)' }}>
        {from}–{to} de {total}
      </span>
      <nav aria-label="Paginação" className="flex items-center gap-1.5">
        <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)} style={navStyle(page <= 1)}>
          <ChevronLeft size={16} />
        </button>
        {pageItems(page, totalPages).map((it, i) =>
          it === 'gap' ? (
            <span key={`gap-${i}`} style={{ width: 22, textAlign: 'center', color: 'var(--text-m)', fontSize: 13 }}>…</span>
          ) : (
            <button
              key={it} type="button"
              aria-label={`Página ${it}`} aria-current={it === page ? 'page' : undefined}
              onClick={() => onChange(it)} style={numStyle(it === page)}
            >
              {it}
            </button>
          ),
        )}
        <button type="button" aria-label="Próxima página" disabled={page >= totalPages} onClick={() => onChange(page + 1)} style={navStyle(page >= totalPages)}>
          <ChevronRight size={16} />
        </button>
      </nav>
    </div>
  );
}

export default function Cadastro() {
  const { data: clientes, isLoading, error } = useClientesAdmin();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; cliente?: ClienteAdminRow } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 4000);
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = clientes ?? [];
    if (!term) return list;
    return list.filter(c =>
      c.nomeFantasia.toLowerCase().includes(term) ||
      c.razaoSocial.toLowerCase().includes(term) ||
      (c.cidade ?? '').toLowerCase().includes(term),
    );
  }, [clientes, q]);

  const ativos = (clientes ?? []).filter(c => c.ativo).length;

  // Paginação client-side (10 por página).
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE),
    [filtered, safePage],
  );
  // Volta à 1ª página ao buscar; mantém a página dentro do intervalo após exclusões.
  useEffect(() => { setPage(1); }, [q]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  async function quickToggle(c: ClienteAdminRow) {
    const res = await setClienteAtivo(c.id, !c.ativo);
    showToast(res.success ? `${c.nomeFantasia} ${!c.ativo ? 'ativado' : 'desativado'}.` : res.error);
  }

  return (
    <div className="card-in" style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
        <div className="flex items-center gap-3">
          <span style={{ width: 40, height: 40, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-l)', color: 'var(--accent)' }}>
            <Building2 size={20} />
          </span>
          <div>
            <h1 style={{ fontSize: 19, fontWeight: 850, letterSpacing: '-0.4px' }}>Cadastro de Clientes</h1>
            <p style={{ fontSize: 12.5, color: 'var(--text-m)', marginTop: 1 }}>
              {clientes ? `${clientes.length} cliente${clientes.length === 1 ? '' : 's'} · ${ativos} ativo${ativos === 1 ? '' : 's'}` : 'Hotéis, status e concorrentes'}
            </p>
          </div>
        </div>
        <button
          type="button" onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2"
          style={{ height: 38, padding: '0 16px', borderRadius: 'var(--rx)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={16} /> Novo cliente
        </button>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-2" style={{ marginBottom: 14, padding: '0 12px', height: 40, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--rx)' }}>
        <Search size={15} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
        <input
          value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, razão social ou cidade…"
          aria-label="Buscar cliente"
          style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text)', fontFamily: 'var(--font)' }}
        />
      </div>

      {/* Lista (10 por página, com scroll curto para alcançar o fim da seleção) */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', boxShadow: 'var(--sh)' }}>
        <div style={{ maxHeight: 'min(540px, 68vh)', overflowY: 'auto' }}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2" style={{ padding: '40px 0', color: 'var(--text-m)' }}>
              <Loader2 size={16} className="animate-spin" /> Carregando…
            </div>
          ) : error ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>Erro ao carregar os clientes.</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-m)', fontSize: 13 }}>
              {q ? 'Nenhum cliente encontrado para a busca.' : 'Nenhum cliente cadastrado ainda.'}
            </div>
          ) : (
            paged.map(c => (
              <ClienteRow key={c.id} c={c} onEdit={() => setModal({ mode: 'edit', cliente: c })} onToggle={() => quickToggle(c)} />
            ))
          )}
        </div>
      </div>

      {/* Paginação (client-side) */}
      {!isLoading && !error && filtered.length > PER_PAGE && (
        <Pagination page={safePage} totalPages={totalPages} total={filtered.length} perPage={PER_PAGE} onChange={setPage} />
      )}

      {/* Modal */}
      {modal && (
        <ClienteFormModal
          mode={modal.mode}
          cliente={modal.cliente}
          onClose={() => setModal(null)}
          onSaved={msg => { setModal(null); if (msg) showToast(msg); }}
          onDeleted={msg => { setModal(null); showToast(msg); }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status" aria-live="polite"
          className="flex items-center gap-2"
          style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 90, padding: '11px 18px', borderRadius: 'var(--rs)', background: 'var(--text)', color: 'var(--surface)', fontSize: 13, fontWeight: 600, boxShadow: 'var(--sh-m)' }}
        >
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
