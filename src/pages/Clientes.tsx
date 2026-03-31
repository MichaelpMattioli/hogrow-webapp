import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotels } from '@/hooks/useSupabase';
import ClientListCard from '@/components/cards/ClientListCard';
import { Loader2, ChevronDown } from 'lucide-react';
import type { HotelSummary } from '@/data/types';

type SortKey = 'dm' | 'occ' | 'revp' | 'mdUhDia' | 'hospTt';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'dm', label: 'DM C/C TT' },
  { key: 'occ', label: 'OCC TT' },
  { key: 'revp', label: 'REVP' },
  { key: 'mdUhDia', label: 'MD UH/DIA' },
  { key: 'hospTt', label: 'HOSP TT' },
];

function getSortValue(h: HotelSummary, key: SortKey): number {
  const dm = h.ocupadosMesAtual > 0 ? h.receitaMesAtual / h.ocupadosMesAtual : 0;
  switch (key) {
    case 'dm': return dm;
    case 'occ': return h.occMesAtual;
    case 'revp': return dm * h.occMesAtual / 100;
    case 'mdUhDia': return h.diasMesAtual > 0 ? h.ocupadosMesAtual / h.diasMesAtual : 0;
    case 'hospTt': return h.hospedesMesAtual;
  }
}

export default function Clientes() {
  const [sort, setSort] = useState<SortKey>('dm');
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { hotels, loading, error } = useHotels();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="ml-2 text-[var(--text-m)]">Carregando...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-[var(--red)] font-semibold">{error}</p>
      </div>
    );
  }

  const sorted = [...hotels].sort((a, b) => getSortValue(b, sort) - getSortValue(a, sort));
  const activeLabel = SORT_OPTIONS.find(o => o.key === sort)!.label;

  return (
    <div className="fade-in">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ letterSpacing: '-0.4px' }}>Clientes</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-m)' }}>
            {hotels.length} {hotels.length === 1 ? 'hotel' : 'hotéis'} — clique para análise completa
          </p>
        </div>

        {/* Dropdown Sort */}
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button
            className="flex items-center gap-0 text-xs rounded-[var(--rx)] transition-colors"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
            onClick={() => setOpen(o => !o)}
          >
            <span
              className="font-medium"
              style={{
                padding: '7px 10px 7px 14px',
                color: 'var(--text-m)',
                borderRight: '1px solid var(--border)',
              }}
            >
              Ordenar
            </span>
            <span
              className="flex items-center gap-1.5 font-bold"
              style={{
                padding: '7px 12px',
                color: 'var(--accent-d)',
              }}
            >
              {activeLabel}
              <ChevronDown size={13} style={{ color: 'var(--text-m)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
            </span>
          </button>

          {open && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
                boxShadow: 'var(--sh-m)',
                zIndex: 50,
                minWidth: 150,
                padding: '4px 0',
              }}
            >
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.key}
                  className={`w-full text-left text-xs font-medium transition-colors ${sort !== o.key ? 'hover:bg-[var(--surface-h)]' : ''}`}
                  style={{
                    padding: '8px 16px',
                    color: sort === o.key ? 'var(--accent)' : 'var(--text)',
                    background: sort === o.key ? 'var(--accent-l)' : 'transparent',
                  }}
                  onClick={() => { setSort(o.key); setOpen(false); }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{
            padding: '64px 24px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r)',
            textAlign: 'center',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full mb-4"
            style={{ width: 48, height: 48, background: 'var(--surface-h)' }}
          >
            <span style={{ fontSize: 22 }}>🏨</span>
          </div>
          <p className="font-semibold" style={{ fontSize: 14, color: 'var(--text)' }}>Nenhum hotel cadastrado</p>
          <p className="mt-1" style={{ fontSize: 12.5, color: 'var(--text-m)' }}>Adicione um hotel para começar a análise.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sorted.map((h, i) => (
            <ClientListCard
              key={h.id}
              hotel={h}
              onClick={() => navigate(`/clientes/${h.id}`)}
              delay={i * 50}
            />
          ))}
        </div>
      )}
    </div>
  );
}
