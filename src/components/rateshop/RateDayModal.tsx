import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Star, ExternalLink, Trophy } from 'lucide-react';
import type { BookingRate } from '@/data/types';

interface Props {
  date: string;
  rates: BookingRate[];
  onClose: () => void;
}

const PERSON_GROUPS = [1, 2, 3, 4] as const;

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

/** Constructs a Booking.com search URL from slug + checkin date (1-night stay, 2 adults). */
function buildBookingUrl(slug: string, checkin: string): string {
  const d = new Date(`${checkin}T12:00:00`);
  d.setDate(d.getDate() + 1);
  const checkout = d.toISOString().slice(0, 10);
  return (
    `https://www.booking.com/hotel/br/${slug}.pt-br.html` +
    `?checkin=${checkin}&checkout=${checkout}` +
    `&group_adults=2&group_children=0&no_rooms=1` +
    `&req_adults=2&req_children=0&sb_price_type=total&type=total`
  );
}

/** Reactive media-query (inline styles can't use @media). */
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

export default function RateDayModal({ date, rates, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const mobile = useMediaQuery('(max-width: 640px)');
  const [edge, setEdge] = useState({ top: false, bottom: false });

  // ── Ciclo de abertura: foco inicial, scroll-lock, focus-trap, Escape, devolver foco ──
  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      cardRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }, 0);

    // trava o scroll do fundo + compensa a largura da scrollbar (evita "pulo" de layout)
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const nodes = cardRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
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
  }, [onClose]);

  // ── Sombras nas bordas da área rolável (indica que há mais conteúdo) ──
  const updateEdges = () => {
    const el = scrollRef.current;
    if (!el) return;
    setEdge({
      top: el.scrollTop > 4,
      bottom: el.scrollTop + el.clientHeight < el.scrollHeight - 4,
    });
  };

  // ── Dados ──
  const bySlug = useMemo(() => {
    const m = new Map<string, BookingRate>();
    for (const r of rates) if (!m.has(r.slug)) m.set(r.slug, r);
    return m;
  }, [rates]);

  const hotels = useMemo(() =>
    [...bySlug.keys()].sort((a, b) => {
      const ra = bySlug.get(a)!, rb = bySlug.get(b)!;
      if (ra.type === 'cliente' && rb.type !== 'cliente') return -1;
      if (rb.type === 'cliente' && ra.type !== 'cliente') return 1;
      return ra.label.localeCompare(rb.label);
    }),
    [bySlug]
  );

  const getLabelForSlug     = (slug: string) => bySlug.get(slug)?.label ?? slug;
  const getTypeForSlug      = (slug: string) => bySlug.get(slug)?.type ?? 'concorrente';
  const getSearchUrlForSlug = (slug: string) => bySlug.get(slug)?.searchUrl ?? buildBookingUrl(slug, date);

  const getRooms = (slug: string, persons: number): BookingRate[] => {
    if (persons === 4) return rates.filter(r => r.slug === slug && r.maxPersons >= 4);
    return rates.filter(r => r.slug === slug && r.maxPersons === persons);
  };

  const activeCols = PERSON_GROUPS.filter(p => hotels.some(slug => getRooms(slug, p).length > 0));

  const globalMin: Record<number, number> = {};
  for (const p of activeCols) {
    const prices = hotels.flatMap(slug => getRooms(slug, p).map(r => r.priceBrl));
    if (prices.length) globalMin[p] = Math.min(...prices);
  }

  // Recalcula as sombras quando os dados/breakpoint mudam (após render).
  useEffect(() => { updateEdges(); }, [rates, mobile, activeCols.length]);

  // ── Resumo do cabeçalho: posição do cliente vs mercado, na MESMA capacidade ──
  // Escolhe a coluna de pax onde o cliente tem o menor preço (pra o chip do cliente sempre
  // aparecer quando ele oferece quartos); sem cliente, usa a 1ª coluna ativa.
  const summary = (() => {
    if (activeCols.length === 0) return null;
    const clientSlug = hotels.find(s => getTypeForSlug(s) === 'cliente');
    let col = activeCols[0];
    if (clientSlug) {
      let best = Infinity;
      for (const c of activeCols) {
        const m = Math.min(...getRooms(clientSlug, c).map(r => r.priceBrl), Infinity);
        if (m < best) { best = m; col = c; }
      }
    }
    const ranked = hotels
      .map(s => ({ s, price: Math.min(...getRooms(s, col).map(r => r.priceBrl), Infinity) }))
      .filter(x => Number.isFinite(x.price))
      .sort((a, b) => a.price - b.price);
    if (ranked.length === 0) return null;
    let client: null | { price: number; rank: number; total: number; isMin: boolean } = null;
    if (clientSlug) {
      const idx = ranked.findIndex(x => x.s === clientSlug);
      if (idx >= 0) client = { price: ranked[idx].price, rank: idx + 1, total: ranked.length, isMin: idx === 0 };
    }
    return { marketMin: ranked[0].price, client };
  })();

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // Portal para o body: escapa de qualquer ancestral com transform/filter/animation
  // (que viraria containing block do position:fixed e quebraria a centralização/scroll).
  return createPortal(
    <div
      className="hg-modal-backdrop"
      onClick={onClose}
      aria-hidden={false}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(10,12,40,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', justifyContent: 'center',
        alignItems: mobile ? 'flex-end' : 'center',
        padding: mobile ? 0 : 24, overflowY: 'auto',
      }}
    >
      <div
        ref={cardRef}
        className={mobile ? 'hg-modal-sheet' : 'hg-modal-card'}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-day-modal-title"
        style={{
          width: mobile ? '100%' : 'min(92vw, 880px)',
          maxHeight: mobile ? '92vh' : '88vh',
          background: 'var(--surface)',
          borderRadius: mobile ? '18px 18px 0 0' : 16,
          boxShadow: '0 32px 80px rgba(10,12,40,0.28), 0 2px 8px rgba(10,12,40,0.12)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding: mobile ? '16px 18px 14px' : '18px 22px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 12, background: 'var(--surface)', flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <h3 id="rate-day-modal-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              Comparativo de Tarifas
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-m)', marginTop: 4, textTransform: 'capitalize', fontWeight: 400 }}>
              {dateLabel}
            </p>
            {summary && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {summary.client && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20,
                    fontSize: 11, fontWeight: 600,
                    background: summary.client.isMin ? 'var(--green-l)' : 'var(--accent-l)',
                    color: summary.client.isMin ? 'var(--green)' : 'var(--accent)',
                    border: `1px solid ${summary.client.isMin ? '#A7F3D0' : 'var(--border)'}`,
                  }}>
                    {summary.client.isMin ? <Trophy size={11} /> : <Star size={11} />}
                    Seu hotel: {fmtBRL(summary.client.price)} · {summary.client.isMin ? 'menor preço' : `${summary.client.rank}º de ${summary.client.total}`}
                  </span>
                )}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-s)', border: '1px solid var(--border-l)',
                }}>
                  Menor do dia: {fmtBRL(summary.marketMin)}
                </span>
              </div>
            )}
          </div>
          <button
            data-autofocus
            onClick={onClose}
            aria-label="Fechar comparativo de tarifas"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-h)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} style={{ color: 'var(--text-m)' }} />
          </button>
        </div>

        {/* ── Pax legend strip ── */}
        <div style={{
          display: 'flex', gap: 6, padding: mobile ? '10px 18px' : '10px 22px',
          background: 'var(--bg)', borderBottom: '1px solid var(--border-l)', flexWrap: 'wrap', flexShrink: 0,
        }}>
          {activeCols.map(p => (
            <div key={p} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
              background: 'var(--surface)', border: '1px solid var(--border-l)',
            }}>
              <Users size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                {p === 4 ? '4+ pessoas' : `${p} pessoa${p > 1 ? 's' : ''}`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-m)' }}>· mín. {fmtBRL(globalMin[p])}</span>
            </div>
          ))}
        </div>

        {/* ── Área rolável (com sombras de borda) ── */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 16, pointerEvents: 'none', zIndex: 4,
            opacity: edge.top ? 1 : 0, transition: 'opacity 0.2s',
            background: 'linear-gradient(to bottom, rgba(10,12,40,0.10), transparent)',
          }} />
          <div ref={scrollRef} onScroll={updateEdges} style={{ overflow: 'auto', flex: 1, minHeight: 0 }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              tableLayout: mobile ? 'auto' : 'fixed', minWidth: mobile ? 480 : undefined,
            }}>
              {!mobile && (
                <colgroup>
                  <col style={{ width: activeCols.length > 2 ? '28%' : activeCols.length > 1 ? '32%' : '40%' }} />
                  {activeCols.map(p => <col key={p} />)}
                </colgroup>
              )}
              <thead>
                <tr>
                  <th scope="col" style={{
                    padding: '9px 16px', textAlign: 'left',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-m)',
                    background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, left: mobile ? 0 : undefined, zIndex: 3,
                    minWidth: mobile ? 150 : undefined,
                  }}>
                    Hotel
                  </th>
                  {activeCols.map(p => (
                    <th key={p} scope="col" style={{
                      padding: '9px 12px', textAlign: 'center',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-m)',
                      background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, zIndex: 2, minWidth: mobile ? 78 : undefined,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Users size={10} />
                        {p === 4 ? '4+' : p}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hotels.map((slug, idx) => {
                  const isCliente = getTypeForSlug(slug) === 'cliente';
                  const rowBg = isCliente
                    ? 'rgba(var(--accent-rgb),0.06)'
                    : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)';
                  return (
                    <tr key={slug} style={{ background: rowBg, borderBottom: '1px solid var(--border-l)' }}>
                      {/* Hotel name cell (sticky-left no mobile) */}
                      <td style={{
                        padding: '12px 16px', verticalAlign: 'middle',
                        position: mobile ? 'sticky' : undefined, left: mobile ? 0 : undefined, zIndex: mobile ? 1 : undefined,
                        background: rowBg,
                        boxShadow: isCliente ? 'inset 3px 0 0 var(--accent)' : undefined,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isCliente && (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 18, height: 18, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0,
                            }}>
                              <Star size={9} fill="#fff" color="#fff" />
                            </span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: isCliente ? 700 : 500, color: isCliente ? 'var(--accent)' : 'var(--text)', lineHeight: 1.3 }}>
                              {getLabelForSlug(slug)}
                            </div>
                            {isCliente && (
                              <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 600, marginTop: 1, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                Seu hotel
                              </div>
                            )}
                            {getSearchUrlForSlug(slug) && (
                              <a
                                href={getSearchUrlForSlug(slug)!}
                                target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 5,
                                  fontSize: 10, fontWeight: 600, color: 'var(--text-m)', textDecoration: 'none',
                                  padding: '2px 0', transition: 'color 0.12s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-m)')}
                              >
                                <ExternalLink size={9} />
                                Ver no Booking
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Price cells */}
                      {activeCols.map(p => {
                        const rooms = getRooms(slug, p).sort((a, b) => a.priceBrl - b.priceBrl);
                        return (
                          <td key={p} style={{ padding: '10px 12px', verticalAlign: 'top', textAlign: 'center' }}>
                            {rooms.length === 0 ? (
                              <span style={{ fontSize: 13, color: 'var(--border)', lineHeight: '2.2' }}>—</span>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                                {rooms.map((r, ri) => {
                                  const isGlobalMin = r.priceBrl === globalMin[p];
                                  return (
                                    <div key={r.id} style={{
                                      width: '100%', padding: '7px 10px', borderRadius: 8,
                                      border: isGlobalMin ? `1.5px solid ${isCliente ? 'var(--accent)' : 'var(--green)'}` : '1px solid var(--border-l)',
                                      background: isGlobalMin
                                        ? isCliente ? 'rgba(var(--accent-rgb),0.07)' : 'var(--green-l)'
                                        : ri === 0 ? 'var(--surface-2)' : 'transparent',
                                      position: 'relative',
                                    }}>
                                      {isGlobalMin && (
                                        <div style={{
                                          position: 'absolute', top: -7, left: '50%', transform: 'translateX(-50%)',
                                          fontSize: 8, fontWeight: 700,
                                          background: isCliente ? 'var(--accent)' : 'var(--green)', color: '#fff',
                                          borderRadius: 10, padding: '1px 6px', letterSpacing: '0.04em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                                        }}>
                                          menor preço
                                        </div>
                                      )}
                                      <div style={{
                                        fontSize: 13, fontWeight: 700, fontFamily: 'var(--mono)',
                                        color: isGlobalMin ? isCliente ? 'var(--accent)' : 'var(--green)' : 'var(--text)', lineHeight: 1.2,
                                      }}>
                                        {fmtBRL(r.priceBrl)}
                                      </div>
                                      <div style={{ fontSize: 10, color: 'var(--text-m)', marginTop: 3, lineHeight: 1.3, wordBreak: 'break-word' }}>
                                        {r.roomName}
                                      </div>
                                      {r.mealPlan && (
                                        <div style={{ marginTop: 3, fontSize: 9, fontWeight: 600, color: 'var(--text-m)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                          {r.mealPlan}
                                        </div>
                                      )}
                                      {r.url && (
                                        <a
                                          href={r.url} target="_blank" rel="noopener noreferrer"
                                          onClick={e => e.stopPropagation()}
                                          style={{
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                                            marginTop: 6, fontSize: 9.5, fontWeight: 600, color: 'var(--text-m)', textDecoration: 'none',
                                            borderTop: '1px solid var(--border-l)', paddingTop: 5, width: '100%', transition: 'color 0.12s',
                                          }}
                                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-m)')}
                                        >
                                          <ExternalLink size={9} />
                                          Ver oferta
                                        </a>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, pointerEvents: 'none', zIndex: 4,
            opacity: edge.bottom ? 1 : 0, transition: 'opacity 0.2s',
            background: 'linear-gradient(to top, rgba(10,12,40,0.10), transparent)',
          }} />
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: mobile ? '10px 18px' : '10px 22px', borderTop: '1px solid var(--border-l)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          background: 'var(--bg)', flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-m)' }}>
            Preços por acomodação em BRL · do menor ao maior
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {hotels.length} hotéis · {rates.length} tarifas
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
