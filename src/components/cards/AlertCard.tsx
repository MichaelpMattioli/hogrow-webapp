import { useMemo, useState } from 'react';
import { Bell, ChevronRight, Loader2, Search, X } from 'lucide-react';
import type { HotelSummary } from '@/data/types';
import type { TodayPickupAlert } from '@/hooks/useSupabase';

interface AlertCardProps {
  alerts: TodayPickupAlert[];
  hotels: HotelSummary[];
  loading?: boolean;
  error?: string | null;
  onSelect: (hotelId: number) => void;
}

type SortKey = 'alteracoes' | 'uhs' | 'receita';
type SortDir = 'desc' | 'asc';

const fmtDate = (date: string) => {
  if (!date) return '--';
  const [, month, day] = date.split('-');
  return `${day}/${month}`;
};

const fmtDateRange = (dates: string[]) => {
  if (dates.length === 0) return '--';
  if (dates.length === 1) return fmtDate(dates[0]);
  return `${fmtDate(dates[0])}-${fmtDate(dates[dates.length - 1])}`;
};

const signed = (value: number) => {
  if (value > 0) return '+';
  if (value < 0) return '-';
  return '';
};

const toneColor = (value: number) => {
  if (value > 0) return 'var(--green)';
  if (value < 0) return 'var(--red)';
  return 'var(--text-m)';
};

const fmtSignedInt = (value: number) =>
  `${signed(value)}${Math.abs(Math.round(value)).toLocaleString('pt-BR')}`;

const fmtSignedBRL = (value: number) =>
  `${signed(value)}R$ ${Math.round(Math.abs(value)).toLocaleString('pt-BR')}`;

const SORT_LABELS: Record<SortKey, string> = {
  alteracoes: 'Alterações',
  uhs: 'UHs',
  receita: 'Receita',
};

export default function AlertCard({ alerts, hotels, loading = false, error = null, onSelect }: AlertCardProps) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('alteracoes');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const hotelById = useMemo(
    () => new Map(hotels.map(hotel => [hotel.id, hotel])),
    [hotels]
  );

  const visibleAlerts = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' });
    const sortValue = (alert: TodayPickupAlert) => {
      if (sortKey === 'uhs') return Math.abs(alert.pickupUhs);
      if (sortKey === 'receita') return Math.abs(alert.pickupReceita);
      return alert.alteracoes;
    };

    return alerts
      .filter((alert) => {
        if (!normalized) return true;
        const hotelName = hotelById.get(alert.hotelId)?.name ?? `Cliente ${alert.hotelId}`;
        return hotelName.toLocaleLowerCase('pt-BR').includes(normalized);
      })
      .sort((a, b) => {
        const diff = sortDir === 'desc'
          ? sortValue(b) - sortValue(a)
          : sortValue(a) - sortValue(b);
        if (diff !== 0) return diff;

        const an = hotelById.get(a.hotelId)?.name ?? `Cliente ${a.hotelId}`;
        const bn = hotelById.get(b.hotelId)?.name ?? `Cliente ${b.hotelId}`;
        return collator.compare(an, bn);
      });
  }, [alerts, hotelById, query, sortDir, sortKey]);

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r)',
        padding: '22px',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ letterSpacing: '-0.2px' }}>
          Alterações de pick-up hoje
        </h3>
        <span
          className="inline-flex items-center gap-1 rounded-full text-[11px] font-bold"
          style={{ padding: '3px 8px', color: 'var(--accent-d)', background: 'var(--accent-l)' }}
        >
          <Bell size={12} />
          {visibleAlerts.length}
        </span>
      </div>

      {!loading && !error && alerts.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-m)',
                pointerEvents: 'none',
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar hotel"
              aria-label="Buscar hotel"
              style={{
                width: '100%',
                height: 32,
                borderRadius: 'var(--rx)',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                padding: query ? '0 34px 0 30px' : '0 12px 0 30px',
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpar busca"
                className="flex items-center justify-center"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 22,
                  height: 22,
                  borderRadius: 'var(--rx)',
                  color: 'var(--text-m)',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
              const active = sortKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (sortKey === key) {
                      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
                    } else {
                      setSortKey(key);
                      setSortDir('desc');
                    }
                  }}
                  className="transition-colors duration-150"
                  style={{
                    height: 28,
                    padding: '0 9px',
                    borderRadius: 'var(--rx)',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    background: active ? 'var(--accent-l)' : 'transparent',
                    color: active ? 'var(--accent-d)' : 'var(--text-m)',
                    fontSize: 11,
                    fontWeight: 800,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {SORT_LABELS[key]}
                  {active && (
                    <span style={{ fontSize: 10, lineHeight: 1 }}>
                      {sortDir === 'desc' ? '↓' : '↑'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-[13px]" style={{ color: 'var(--text-m)' }}>
          <Loader2 size={15} className="animate-spin" />
          Carregando alertas...
        </div>
      ) : error ? (
        <p className="text-[13px]" style={{ color: 'var(--red)' }}>{error}</p>
      ) : alerts.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-m)' }}>
          Nenhuma alteração de pick-up encontrada para hoje.
        </p>
      ) : visibleAlerts.length === 0 ? (
        <p className="text-[13px]" style={{ color: 'var(--text-m)' }}>
          Nenhum hotel encontrado para a busca.
        </p>
      ) : (
        <div
          className="flex flex-col gap-2.5 overflow-y-auto pr-1"
          style={{
            maxHeight: 340,
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--border) transparent',
          }}
        >
          {visibleAlerts.map((alert) => {
            const hotel = hotelById.get(alert.hotelId);
            return (
              <button
                key={alert.hotelId}
                className="flex items-center gap-3 w-full text-left rounded-[var(--rs)] transition-colors duration-150"
                style={{ padding: '10px 12px' }}
                onClick={() => onSelect(alert.hotelId)}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-h)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0 rounded-[var(--rx)]"
                  style={{
                    width: 34,
                    height: 34,
                    background: 'var(--accent-l)',
                    color: 'var(--accent)',
                  }}
                >
                  <Bell size={15} />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[13px] font-semibold block truncate">
                    {hotel?.name ?? `Cliente ${alert.hotelId}`}
                  </span>
                  <span className="text-[11.5px] block" style={{ color: 'var(--text-m)' }}>
                    {alert.alteracoes} alterações · ref. {fmtDateRange(alert.referencias)}
                  </span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <span
                      className="text-[10.5px] font-bold rounded-full"
                      style={{
                        padding: '2px 7px',
                        background: 'var(--surface-h)',
                        color: toneColor(alert.pickupUhs),
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {fmtSignedInt(alert.pickupUhs)} UHs
                    </span>
                    <span
                      className="text-[10.5px] font-bold rounded-full"
                      style={{
                        padding: '2px 7px',
                        background: 'var(--surface-h)',
                        color: toneColor(alert.pickupReceita),
                        fontFamily: 'var(--mono)',
                      }}
                    >
                      {fmtSignedBRL(alert.pickupReceita)}
                    </span>
                  </div>
                </div>

                <ChevronRight size={14} style={{ color: 'var(--text-m)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
