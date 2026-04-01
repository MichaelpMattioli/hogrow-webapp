import { X } from 'lucide-react';
import type { BookingRate } from '@/data/types';

interface Props {
  date: string;
  rates: BookingRate[];
  onClose: () => void;
}

const PERSON_GROUPS = [1, 2, 3, 4] as const;

export default function RateDayModal({ date, rates, onClose }: Props) {
  // Unique hotels sorted: client first, then competitors alphabetically
  const hotels = [...new Set(rates.map(r => r.slug))].sort((a, b) => {
    const ta = rates.find(r => r.slug === a)!.type;
    const tb = rates.find(r => r.slug === b)!.type;
    if (ta === 'cliente' && tb !== 'cliente') return -1;
    if (tb === 'cliente' && ta !== 'cliente') return 1;
    const la = rates.find(r => r.slug === a)!.label;
    const lb = rates.find(r => r.slug === b)!.label;
    return la.localeCompare(lb);
  });

  const getLabelForSlug = (slug: string) => rates.find(r => r.slug === slug)?.label ?? slug;
  const getTypeForSlug = (slug: string) => rates.find(r => r.slug === slug)?.type ?? 'concorrente';

  const getRooms = (slug: string, persons: number): BookingRate[] => {
    if (persons === 4) return rates.filter(r => r.slug === slug && r.maxPersons >= 4);
    return rates.filter(r => r.slug === slug && r.maxPersons === persons);
  };

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  // Check which person groups actually have any data
  const activeCols = PERSON_GROUPS.filter(p =>
    hotels.some(slug => getRooms(slug, p).length > 0)
  );

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 1000, background: 'rgba(22,25,69,0.45)', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r)',
          boxShadow: '0 20px 60px rgba(22,25,69,0.2)',
          width: '92vw',
          maxWidth: activeCols.length > 2 ? 760 : 560,
          maxHeight: '85vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
        >
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' }}>
              Comparativo de Tarifas
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-m)', marginTop: 2, textTransform: 'capitalize' }}>
              {dateLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-[var(--rx)] transition-colors hover:bg-[var(--surface-h)]"
            style={{ width: 30, height: 30 }}
          >
            <X size={15} style={{ color: 'var(--text-m)' }} />
          </button>
        </div>

        {/* Table */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th
                  style={{
                    padding: '10px 16px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: 'var(--text-s)',
                    borderBottom: '1px solid var(--border)',
                    position: 'sticky', top: 0, background: 'var(--bg)',
                    minWidth: 160,
                  }}
                >
                  Hotel
                </th>
                {activeCols.map(p => (
                  <th
                    key={p}
                    style={{
                      padding: '10px 12px', textAlign: 'center',
                      fontSize: 11, fontWeight: 600, color: 'var(--text-s)',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, background: 'var(--bg)',
                      minWidth: 140,
                    }}
                  >
                    {p === 4 ? '4+ pessoas' : `${p} pessoa${p > 1 ? 's' : ''}`}
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
                        ? 'var(--accent-l)'
                        : idx % 2 === 0 ? 'var(--surface)' : 'var(--bg)',
                      borderBottom: '1px solid var(--border-l)',
                    }}
                  >
                    <td
                      style={{
                        padding: '10px 16px',
                        fontSize: 12,
                        fontWeight: isCliente ? 700 : 500,
                        color: isCliente ? 'var(--accent)' : 'var(--text)',
                      }}
                    >
                      {getLabelForSlug(slug)}
                      {isCliente && (
                        <span
                          style={{
                            fontSize: 9, fontWeight: 700,
                            background: 'var(--accent)', color: '#fff',
                            borderRadius: 4, padding: '1px 5px',
                            marginLeft: 7, verticalAlign: 'middle',
                            textTransform: 'uppercase', letterSpacing: '0.3px',
                          }}
                        >
                          cliente
                        </span>
                      )}
                    </td>
                    {activeCols.map(p => {
                      const rooms = getRooms(slug, p).sort((a, b) => a.priceBrl - b.priceBrl);
                      return (
                        <td key={p} style={{ padding: '8px 12px', verticalAlign: 'top' }}>
                          {rooms.length === 0 ? (
                            <span style={{ fontSize: 11, color: 'var(--border)' }}>—</span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {rooms.map(r => (
                                <div key={r.id}>
                                  <div
                                    style={{
                                      fontSize: 12, fontWeight: 700,
                                      color: isCliente ? 'var(--accent)' : 'var(--text)',
                                      fontFamily: 'var(--mono)',
                                    }}
                                  >
                                    {r.priceBrl.toLocaleString('pt-BR', {
                                      style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
                                    })}
                                  </div>
                                  <div style={{ color: 'var(--text-m)', fontSize: 10, marginTop: 1 }}>
                                    {r.roomName}
                                  </div>
                                </div>
                              ))}
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

        {/* Footer note */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border-l)',
            fontSize: 10,
            color: 'var(--text-m)',
          }}
        >
          Tarifas menores por pessoa agrupadas em ordem crescente. Preços em BRL.
        </div>
      </div>
    </div>
  );
}
