import { useEffect, useMemo } from 'react';
import { X, Users, Star, ExternalLink } from 'lucide-react';
import type { BookingRate } from '@/data/types';

interface Props {
  date: string;
  rates: BookingRate[];
  anchorTop?: number;
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

export default function RateDayModal({ date, rates, anchorTop, onClose }: Props) {
  // Close on Escape for keyboard accessibility.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Index once by slug (was repeated rates.find() — O(n²) inside the sort).
  const bySlug = useMemo(() => {
    const m = new Map<string, BookingRate>();
    for (const r of rates) if (!m.has(r.slug)) m.set(r.slug, r);
    return m;
  }, [rates]);

  // Unique hotels: client first, then competitors alphabetically
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

  // Only show pax columns that have at least one rate
  const activeCols = PERSON_GROUPS.filter(p =>
    hotels.some(slug => getRooms(slug, p).length > 0)
  );

  // Compute global min per pax column for "best price" highlight
  const globalMin: Record<number, number> = {};
  for (const p of activeCols) {
    const prices = hotels.flatMap(slug => getRooms(slug, p).map(r => r.priceBrl));
    if (prices.length) globalMin[p] = Math.min(...prices);
  }

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  return (
    <>
      {/* Backdrop — fixed overlay to dim the page */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999,
          background: 'rgba(10,12,40,0.5)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Card — absolute in the document so it aligns with the Rate Shopper section */}
      <div
        style={{
          position: 'absolute',
          top: anchorTop ?? 200,
          left: '5%',
          right: '5%',
          zIndex: 1000,
          background: 'var(--surface)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(10,12,40,0.28), 0 2px 8px rgba(10,12,40,0.12)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rate-day-modal-title"
      >
        {/* ── Header ── */}
        <div style={{
          padding: '18px 22px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          background: 'var(--surface)',
        }}>
          <div>
            <h3 id="rate-day-modal-title" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              Comparativo de Tarifas
            </h3>
            <p style={{
              fontSize: 12, color: 'var(--text-m)', marginTop: 4,
              textTransform: 'capitalize', fontWeight: 400,
            }}>
              {dateLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar comparativo de tarifas"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              border: '1px solid var(--border)', background: 'transparent',
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-h)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} style={{ color: 'var(--text-m)' }} />
          </button>
        </div>

        {/* ── Pax legend strip ── */}
        <div style={{
          display: 'flex', gap: 6, padding: '10px 22px',
          background: 'var(--bg)', borderBottom: '1px solid var(--border-l)',
          flexWrap: 'wrap',
        }}>
          {activeCols.map(p => (
            <div key={p} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 10px', borderRadius: 20,
              background: 'var(--surface)', border: '1px solid var(--border-l)',
            }}>
              <Users size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                {p === 4 ? '4+ pessoas' : `${p} pessoa${p > 1 ? 's' : ''}`}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text-m)' }}>
                · mín. {fmtBRL(globalMin[p])}
              </span>
            </div>
          ))}
        </div>

        {/* ── Table ── */}
        <div style={{ overflowY: 'auto', flex: 1, maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: activeCols.length > 2 ? '28%' : activeCols.length > 1 ? '32%' : '40%' }} />
              {activeCols.map(p => <col key={p} />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" style={{
                  padding: '9px 16px', textAlign: 'left',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                  textTransform: 'uppercase', color: 'var(--text-m)',
                  background: 'var(--surface-2)',
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 1,
                }}>
                  Hotel
                </th>
                {activeCols.map(p => (
                  <th key={p} scope="col" style={{
                    padding: '9px 12px', textAlign: 'center',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', color: 'var(--text-m)',
                    background: 'var(--surface-2)',
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, zIndex: 1,
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
                return (
                  <tr
                    key={slug}
                    style={{
                      background: isCliente
                        ? 'rgba(var(--accent-rgb),0.05)'
                        : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                      borderBottom: '1px solid var(--border-l)',
                    }}
                  >
                    {/* Hotel name cell */}
                    <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isCliente && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 18, height: 18, borderRadius: '50%',
                            background: 'var(--accent)', flexShrink: 0,
                          }}>
                            <Star size={9} fill="#fff" color="#fff" />
                          </span>
                        )}
                        <div>
                          <div style={{
                            fontSize: 12, fontWeight: isCliente ? 700 : 500,
                            color: isCliente ? 'var(--accent)' : 'var(--text)',
                            lineHeight: 1.3,
                          }}>
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
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                marginTop: 4, fontSize: 10, fontWeight: 500,
                                color: 'var(--text-m)', textDecoration: 'none',
                                transition: 'color 0.12s',
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
                                    width: '100%',
                                    padding: '7px 10px',
                                    borderRadius: 8,
                                    border: isGlobalMin
                                      ? `1.5px solid ${isCliente ? 'var(--accent)' : 'var(--green)'}`
                                      : '1px solid var(--border-l)',
                                    background: isGlobalMin
                                      ? isCliente ? 'rgba(var(--accent-rgb),0.07)' : 'var(--green-l)'
                                      : ri === 0 ? 'var(--surface-2)' : 'transparent',
                                    position: 'relative',
                                  }}>
                                    {isGlobalMin && (
                                      <div style={{
                                        position: 'absolute', top: -7, left: '50%',
                                        transform: 'translateX(-50%)',
                                        fontSize: 8, fontWeight: 700,
                                        background: isCliente ? 'var(--accent)' : 'var(--green)',
                                        color: '#fff',
                                        borderRadius: 10, padding: '1px 6px',
                                        letterSpacing: '0.04em', textTransform: 'uppercase',
                                        whiteSpace: 'nowrap',
                                      }}>
                                        menor preço
                                      </div>
                                    )}
                                    <div style={{
                                      fontSize: 13, fontWeight: 700,
                                      fontFamily: 'var(--mono)',
                                      color: isGlobalMin
                                        ? isCliente ? 'var(--accent)' : 'var(--green)'
                                        : 'var(--text)',
                                      lineHeight: 1.2,
                                    }}>
                                      {fmtBRL(r.priceBrl)}
                                    </div>
                                    <div style={{
                                      fontSize: 10, color: 'var(--text-m)', marginTop: 3,
                                      lineHeight: 1.3, wordBreak: 'break-word',
                                    }}>
                                      {r.roomName}
                                    </div>
                                    {r.mealPlan && (
                                      <div style={{
                                        marginTop: 3, fontSize: 9, fontWeight: 600,
                                        color: 'var(--text-m)', textTransform: 'uppercase',
                                        letterSpacing: '0.04em',
                                      }}>
                                        {r.mealPlan}
                                      </div>
                                    )}
                                    {r.url && (
                                      <a
                                        href={r.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 3,
                                          marginTop: 6,
                                          fontSize: 9.5, fontWeight: 600,
                                          color: 'var(--text-m)',
                                          textDecoration: 'none',
                                          borderTop: '1px solid var(--border-l)',
                                          paddingTop: 5,
                                          width: '100%',
                                          transition: 'color 0.12s',
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

        {/* ── Footer ── */}
        <div style={{
          padding: '10px 22px',
          borderTop: '1px solid var(--border-l)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-m)' }}>
            Preços por acomodação em BRL · ordenados do menor ao maior
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-m)', fontWeight: 600 }}>
            {hotels.length} hotéis · {rates.length} tarifas
          </span>
        </div>
      </div>
    </>
  );
}
