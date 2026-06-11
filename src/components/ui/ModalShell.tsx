import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Casca de modal reutilizável — mesmo padrão do RateDayModal (shopper):
// portal para o body (camada isolada, escapa de qualquer ancestral com
// transform/filter/overflow que viraria containing-block ou cortaria o fixed),
// backdrop com blur, trava de scroll do fundo (compensando a scrollbar),
// focus-trap, Escape e devolução de foco ao fechar. Responsivo: card no desktop,
// bottom-sheet no mobile.
//
// `inert` desliga Escape + focus-trap deste modal enquanto um modal-filho está
// por cima (ex.: a confirmação de exclusão sobre o formulário) — assim o Escape
// fecha só o de cima e os dois focus-traps não brigam.

interface Props {
  onClose: () => void;
  /** id de um heading dentro do modal (aria-labelledby). */
  labelledBy?: string;
  /** rótulo acessível quando não há heading com id. */
  ariaLabel?: string;
  /** largura máxima do card no desktop (px). */
  width?: number;
  /** z-index do backdrop (default 999). Use mais alto para modais empilhados. */
  zIndex?: number;
  /** quando true, ignora Escape e focus-trap (há um modal por cima). */
  inert?: boolean;
  /** seletor do elemento que recebe foco ao abrir. */
  initialFocus?: string;
  children: React.ReactNode;
}

/** Reactive media-query (estilos inline não suportam @media). */
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export default function ModalShell({
  onClose, labelledBy, ariaLabel, width = 600, zIndex = 999, inert = false,
  initialFocus = '[data-autofocus]', children,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const inertRef = useRef(inert);
  inertRef.current = inert;
  const mobile = useMediaQuery('(max-width: 640px)');

  // Foco inicial, scroll-lock, focus-trap, Escape e devolução de foco.
  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>(initialFocus)?.focus();
    }, 0);

    // trava o scroll do fundo + compensa a largura da scrollbar (evita "pulo")
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;

    const onKey = (e: KeyboardEvent) => {
      if (inertRef.current) return;
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const nodes = cardRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const list = Array.from(nodes).filter(el => el.offsetParent !== null || el === document.activeElement);
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const active = document.activeElement as HTMLElement;
      if (e.shiftKey) {
        if (active === first || !cardRef.current.contains(active)) { e.preventDefault(); last.focus(); }
      } else if (active === last) {
        e.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      prevFocus.current?.focus?.();
    };
  }, [onClose, initialFocus]);

  return createPortal(
    <div
      className="hg-modal-backdrop"
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex,
        background: 'rgba(10,12,40,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center',
        alignItems: mobile ? 'flex-end' : 'center',
        padding: mobile ? 0 : 24, overflowY: 'auto',
      }}
    >
      <div
        ref={cardRef}
        className={mobile ? 'hg-modal-sheet' : 'hg-modal-card'}
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={ariaLabel}
        style={{
          position: 'relative',
          width: mobile ? '100%' : `min(94vw, ${width}px)`,
          maxHeight: mobile ? '92vh' : '88vh',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: mobile ? '18px 18px 0 0' : 'var(--r)',
          boxShadow: '0 32px 80px rgba(10,12,40,0.28), 0 2px 8px rgba(10,12,40,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
