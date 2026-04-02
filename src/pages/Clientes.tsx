import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHotels, useHotelMetas } from '@/hooks/useSupabase';
import ClientListCard from '@/components/cards/ClientListCard';
import { Loader2, ChevronDown } from 'lucide-react';
import type { HotelSummary } from '@/data/types';

// ─── Sort options aligned with the 6 KPI tiles ────────────────────────

type SortKey = 'receita' | 'occ' | 'dm' | 'revpar' | 'roomNights' | 'recDiarias' | 'nome';

interface SortOption {
  key: SortKey;
  label: string;
  description: string;
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'receita',    label: 'Receita Total',    description: 'Maior receita no mês' },
  { key: 'occ',        label: 'Ocupação',          description: 'Maior % de ocupação' },
  { key: 'dm',         label: 'Diária Média',      description: 'Maior diária média' },
  { key: 'revpar',     label: 'RevPAR',            description: 'Maior RevPAR' },
  { key: 'roomNights', label: 'Room Nights',       description: 'Mais quartos ocupados' },
  { key: 'recDiarias', label: 'Rec. de Diárias',   description: 'Maior receita de diárias' },
  { key: 'nome',       label: 'Nome A → Z',         description: 'Ordem alfabética' },
];

function getSortValue(h: HotelSummary, key: SortKey): number | string {
  const dm = h.ocupadosMesAtual > 0 ? h.receitaMesAtual / h.ocupadosMesAtual : 0;
  switch (key) {
    case 'receita':    return h.receitaMesAtual;
    case 'occ':        return h.occMesAtual;
    case 'dm':         return dm;
    case 'revpar':     return dm * h.occMesAtual / 100;
    case 'roomNights': return h.ocupadosMesAtual;
    case 'recDiarias': return h.recDiariasMesAtual;
    case 'nome':       return h.name.toLowerCase();
  }
}

function sortHotels(hotels: HotelSummary[], key: SortKey): HotelSummary[] {
  return [...hotels].sort((a, b) => {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);
    if (typeof av === 'string') return av.localeCompare(bv as string);
    return (bv as number) - (av as number);
  });
}

// ─── Current month ────────────────────────────────────────────────────

function currentMesAno() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Page ─────────────────────────────────────────────────────────────

export default function Clientes() {
  const [sort, setSort] = useState<SortKey>('receita');
  const [open, setOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const q = (searchParams.get('q') ?? '').toLowerCase().trim();

  const { hotels, loading, error } = useHotels();
  const { metas } = useHotelMetas(currentMesAno());

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

  const filtered = q
    ? hotels.filter(h =>
        h.name.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.state.toLowerCase().includes(q)
      )
    : hotels;

  const sorted = sortHotels(filtered, sort);
  const activeOption = SORT_OPTIONS.find(o => o.key === sort)!;

  return (
    <div className="fade-in">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-bold" style={{ letterSpacing: '-0.4px' }}>Clientes</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-m)' }}>
            {q
              ? `${sorted.length} resultado${sorted.length !== 1 ? 's' : ''} para "${q}"`
              : `${hotels.length} ${hotels.length === 1 ? 'hotel' : 'hotéis'} · ordenado por ${activeOption.description}`
            }
          </p>
        </div>

        {/* Sort dropdown */}
        <div ref={dropRef} style={{ position: 'relative' }}>
          <button
            className="flex items-center gap-0 text-xs rounded-[var(--rx)] transition-colors"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}
            onClick={() => setOpen(o => !o)}
          >
            <span
              className="font-medium"
              style={{ padding: '7px 10px 7px 14px', color: 'var(--text-m)', borderRight: '1px solid var(--border)' }}
            >
              Ordenar por
            </span>
            <span
              className="flex items-center gap-1.5 font-bold"
              style={{ padding: '7px 12px', color: 'var(--accent-d)' }}
            >
              {activeOption.label}
              <ChevronDown
                size={13}
                style={{ color: 'var(--text-m)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
              />
            </span>
          </button>

          {open && (
            <div
              style={{
                position: 'absolute', right: 0, top: 'calc(100% + 4px)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--r)', boxShadow: 'var(--sh-m)', zIndex: 50,
                minWidth: 200, padding: '4px 0',
              }}
            >
              {SORT_OPTIONS.map(o => (
                <button
                  key={o.key}
                  className="w-full text-left transition-colors"
                  style={{
                    padding: '9px 16px',
                    background: sort === o.key ? 'var(--accent-l)' : 'transparent',
                  }}
                  onClick={() => { setSort(o.key); setOpen(false); }}
                >
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: sort === o.key ? 'var(--accent)' : 'var(--text)' }}>
                    {o.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 1 }}>
                    {o.description}
                  </div>
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
            padding: '64px 24px', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: 'var(--r)', textAlign: 'center',
          }}
        >
          <span style={{ fontSize: 36, marginBottom: 12 }}>🏨</span>
          <p className="font-semibold" style={{ fontSize: 14, color: 'var(--text)' }}>
            {q ? `Nenhum hotel encontrado para "${q}"` : 'Nenhum hotel cadastrado'}
          </p>
          <p className="mt-1" style={{ fontSize: 12.5, color: 'var(--text-m)' }}>
            {q ? 'Tente outro nome ou cidade.' : 'Adicione um hotel para começar.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sorted.map((h, i) => (
            <ClientListCard
              key={h.id}
              hotel={h}
              meta={metas.find(m => m.hotelId === h.id)}
              onClick={() => navigate(`/clientes/${h.id}`)}
              delay={i * 40}
            />
          ))}
        </div>
      )}
    </div>
  );
}
