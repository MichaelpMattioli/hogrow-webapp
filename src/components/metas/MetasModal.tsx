import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { MetaUploadIssue } from '@/hooks/useSupabase';

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

export function IssueList({ issues }: { issues: MetaUploadIssue[] }) {
  if (!issues || issues.length === 0) {
    return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-m)', fontSize: 13, fontWeight: 600 }}>Nenhuma observação registrada.</div>;
  }
  const sorted = [...issues].sort((a, b) => ORDER[a.level] - ORDER[b.level]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {sorted.map((i, ix) => {
        const lv = LV[i.level];
        return (
          <div key={ix} style={{ display: 'flex', gap: 9, padding: '9px 11px', borderRadius: 'var(--rx)', background: lv.bg, border: '1px solid var(--border-l)' }}>
            <lv.Icon size={15} style={{ color: lv.color, flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: lv.color, letterSpacing: '0.04em', fontFamily: 'var(--mono)' }}>{i.code}</span>
              <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.35 }}>{i.msg}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
