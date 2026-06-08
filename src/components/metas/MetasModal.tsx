import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, ChevronRight, Info, X } from 'lucide-react';
import type { MetaUploadIssue, MetaUploadIssueGroup } from '@/hooks/useSupabase';

// Modal em portal no body — ancestrais com transform (.fade-in/.card-in) quebram position:fixed.
export default function MetasModal({
  title, subtitle, onClose, children, footer, maxWidth = 580,
}: {
  title: React.ReactNode; subtitle?: React.ReactNode; onClose: () => void;
  children: React.ReactNode; footer?: React.ReactNode; maxWidth?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(13,27,62,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: 'var(--surface)', borderRadius: 'var(--r)', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', width: `min(94vw, ${maxWidth}px)`, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 850, color: 'var(--text)' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-m)', fontWeight: 600, marginTop: 2, wordBreak: 'break-word' }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Fechar"
            style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 'var(--rx)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-m)', background: 'var(--surface-h)', border: '1px solid var(--border)' }}>
            <X size={16} />
          </button>
        </header>
        <div style={{ padding: 18, overflowY: 'auto', flex: 1, minHeight: 0 }}>{children}</div>
        {footer && (
          <footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--border-l)', background: 'var(--bg)' }}>
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

const LV = {
  erro:   { color: 'var(--red)',    bg: 'var(--red-l)',     Icon: AlertCircle },
  alerta: { color: 'var(--gold)',   bg: 'var(--gold-l)',    Icon: AlertTriangle },
  info:   { color: 'var(--text-m)', bg: 'var(--surface-h)', Icon: Info },
} as const;
const ORDER: Record<MetaUploadIssue['level'], number> = { erro: 0, alerta: 1, info: 2 };

// Rótulo curto e genérico por código (o `msg` é específico de cada ocorrência).
const CODE_LABEL: Record<string, string> = {
  'E-FMT-00': 'Requisição inválida', 'E-FMT-01': 'Arquivo ilegível', 'E-FMT-02': 'Não é um Excel válido',
  'E-FMT-03': 'Arquivo ausente/vazio', 'E-FMT-04': 'Planilha vazia',
  'E-HDR-02': 'Coluna obrigatória faltando', 'E-HDR-03': 'Número de meses errado', 'E-HDR-04': 'Rótulo de mês inválido',
  'E-ROW-01': 'ID inválido', 'E-ROW-02': 'Hotel inexistente', 'E-ROW-03': 'Hotel não-cliente', 'E-ROW-04': 'Categoria desconhecida',
  'E-VAL-01': 'Valor não-numérico', 'E-VAL-02': 'Valor negativo', 'E-VAL-03': 'Ocupação fora de 0–100',
  'E-DB-01': 'Falha ao gravar', 'E-DB-02': 'Falha ao validar hotéis', 'E-DATA-00': 'Nenhuma meta válida',
  'A-BIZ-01': 'Meses vazios mantidos', 'A-BIZ-03': 'Hotéis ausentes', 'A-BIZ-05': 'Metas substituídas',
  'A-BIZ-06': 'Categoria incompleta', 'A-BIZ-07': 'Categoria duplicada', 'A-BIZ-08': 'Ano divergente',
  'A-SYS-01': 'Arquivo não versionado', 'I-99': 'Mais ocorrências', 'I-02': 'Linhas em branco',
};
const CAT_LABEL: Record<string, string> = { receita: 'Receita', occ: 'Ocupação', dm: 'Diária Média' };
const MES_AB = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function monthRange(months: number[]): string {
  const u = [...new Set(months)].filter(m => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (!u.length) return '';
  if (u.length === 1) return MES_AB[u[0] - 1];
  const contiguous = u.every((m, i) => i === 0 || m === u[i - 1] + 1);
  if (contiguous) return `${MES_AB[u[0] - 1]}–${MES_AB[u[u.length - 1] - 1]}`;
  return u.slice(0, 4).map(m => MES_AB[m - 1]).join(', ') + (u.length > 4 ? '…' : '');
}

// Resumo condensado do "onde", sem listar cada repetição. `count` = total real do grupo.
function whereSummary(items: MetaUploadIssue[], count: number): string {
  if (items.some(i => i.mes != null)) {
    const byHC = new Map<string, { nome: string; cat?: string; meses: number[] }>();
    for (const i of items) {
      const nome = i.hotelNome ?? (i.hotelId != null ? `Hotel ${i.hotelId}` : '—');
      const key = `${nome}|${i.cat ?? ''}`;
      if (!byHC.has(key)) byHC.set(key, { nome, cat: i.cat, meses: [] });
      if (i.mes != null) byHC.get(key)!.meses.push(i.mes);
    }
    const parts = [...byHC.values()].slice(0, 3).map(g =>
      `${g.nome}${g.cat ? ` · ${CAT_LABEL[g.cat] ?? g.cat}` : ''}${g.meses.length ? ` · ${monthRange(g.meses)}` : ''}`);
    return parts.join('   ·   ') + (byHC.size > 3 ? `   … +${byHC.size - 3}` : '');
  }
  const ids = [...new Set(items.map(i => i.hotelId).filter((x): x is number => x != null))];
  if (ids.length) {
    const shown = ids.slice(0, 4);
    const rest = count - shown.length; // remainder pelo total real, não pela amostra
    return shown.join(' · ') + (rest > 0 ? ` … +${rest}` : '');
  }
  return items[0]?.msg ?? '';
}

// Lista de observações já AGREGADA por tipo (código), com contagem + expandir.
// Colapsa a repetição (ex.: 100× "Hotel 900XX não existe" → 1 linha "Hotel inexistente · 100").
export function IssueList({ issues }: { issues: MetaUploadIssueGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  if (!issues || issues.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-m)', fontSize: 13, fontWeight: 600 }}>Nenhuma observação registrada.</div>;
  }
  const groups = [...issues].sort((a, b) => ORDER[a.level] - ORDER[b.level] || b.count - a.count);
  const counts = { erro: 0, alerta: 0, info: 0 };
  groups.forEach(g => { counts[g.level] += g.count; });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Resumo por nível (contagem real) */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
        {(['erro', 'alerta', 'info'] as const).filter(l => counts[l] > 0).map(l => {
          const lv = LV[l];
          const label = l === 'erro' ? 'erro' : l === 'alerta' ? 'alerta' : 'info';
          return (
            <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, background: lv.bg, color: lv.color, fontSize: 11.5, fontWeight: 800, border: '1px solid var(--border-l)' }}>
              <lv.Icon size={12} /> {counts[l]} {label}{counts[l] > 1 ? 's' : ''}
            </span>
          );
        })}
      </div>

      {groups.map(g => {
        const lv = LV[g.level];
        const n = g.count;
        // Grupo de 1 ocorrência: mostra a mensagem direta (sem contagem/expandir).
        if (n === 1) {
          return (
            <div key={g.code} style={{ display: 'flex', gap: 9, padding: '9px 11px', borderRadius: 'var(--rx)', background: lv.bg, border: '1px solid var(--border-l)' }}>
              <lv.Icon size={15} style={{ color: lv.color, flexShrink: 0, marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: lv.color, letterSpacing: '0.04em', fontFamily: 'var(--mono)' }}>{g.code}</span>
                <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>{g.items[0]?.msg ?? CODE_LABEL[g.code] ?? g.code}</div>
              </div>
            </div>
          );
        }
        const isOpen = !!open[g.code];
        const shownItems = g.items.length;       // amostra disponível
        const rest = n - shownItems;             // quantos além da amostra
        return (
          <div key={g.code} style={{ borderRadius: 'var(--rx)', background: lv.bg, border: '1px solid var(--border-l)', overflow: 'hidden' }}>
            <button
              onClick={() => setOpen(s => ({ ...s, [g.code]: !s[g.code] }))}
              aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <lv.Icon size={15} style={{ color: lv.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text)' }}>{CODE_LABEL[g.code] ?? g.code}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: lv.color, fontFamily: 'var(--mono)' }}>{g.code}</span>
              <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ minWidth: 22, textAlign: 'center', padding: '1px 7px', borderRadius: 999, background: lv.color, color: '#fff', fontSize: 11, fontWeight: 800 }}>{n}</span>
                <ChevronRight size={15} style={{ color: 'var(--text-m)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }} />
              </span>
            </button>
            {!isOpen ? (
              <div style={{ padding: '0 11px 9px 35px', fontSize: 11.5, color: 'var(--text-m)', fontWeight: 600, lineHeight: 1.4, wordBreak: 'break-word' }}>
                {whereSummary(g.items, n)}
              </div>
            ) : (
              <div style={{ padding: '0 11px 9px 35px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {g.items.map((it, ix) => (
                  <div key={ix} style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 550, lineHeight: 1.4, wordBreak: 'break-word' }}>· {it.msg}</div>
                ))}
                {rest > 0 && <div style={{ fontSize: 11.5, color: 'var(--text-m)', fontWeight: 700 }}>… e mais {rest} (amostra de {shownItems})</div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
