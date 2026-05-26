import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Hotel,
  Loader2,
  Percent,
  Search,
  Target,
} from 'lucide-react';
import { useMetasPage, saveHotelMeta } from '@/hooks/useSupabase';
import type { HotelMeta } from '@/data/types';

type GoalField = 'receita' | 'ocupacao' | 'diaria';

function buildMonths(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = -3; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

const MONTHS = buildMonths();
const MES_PT: Record<string, string> = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
};

function fmtMes(ym: string) {
  const [year, month] = ym.split('-');
  return `${MES_PT[month] ?? month} ${year}`;
}

function metaToInput(value: number | null | undefined) {
  return value != null ? String(value) : '';
}

function parseMeta(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

type GoalHotel = {
  id: number;
  name: string;
  city: string;
  state: string;
  uhs: number;
};

interface GoalInputCardProps {
  field: GoalField;
  title: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}

function GoalInputCard({ field, title, icon, value, onChange, prefix, suffix }: GoalInputCardProps) {
  const tone = field === 'receita'
    ? { bg: 'var(--accent-l)', color: 'var(--accent)', border: 'color-mix(in srgb, var(--accent) 18%, transparent)' }
    : field === 'ocupacao'
      ? { bg: 'var(--green-l)', color: 'var(--green)', border: '#A7F3D0' }
      : { bg: 'var(--gold-l)', color: 'var(--gold)', border: '#FDE68A' };

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${tone.border}`,
      borderRadius: 'var(--rx)',
      padding: 14,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'var(--rx)',
          background: tone.bg,
          color: tone.color,
          flexShrink: 0,
        }}>
          {icon}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 850,
          color: 'var(--text)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {title}
        </span>
      </div>

      <div style={{
        height: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        border: '1px solid var(--border)',
        borderRadius: 'var(--rx)',
        background: 'var(--bg)',
        padding: '0 10px',
      }}>
        {prefix && <span style={{ fontSize: 12, fontWeight: 800, color: tone.color, flexShrink: 0 }}>{prefix}</span>}
        <input
          aria-label={`Meta de ${title}`}
          type="number"
          min={0}
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          style={{
            width: '100%',
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--text)',
            fontSize: 17,
            fontWeight: 850,
            fontFamily: 'var(--mono)',
          }}
        />
        {suffix && <span style={{ fontSize: 12, fontWeight: 800, color: tone.color, flexShrink: 0 }}>{suffix}</span>}
      </div>
    </div>
  );
}

interface HotelGoalRowProps {
  hotel: GoalHotel;
  meta?: HotelMeta;
  onSave: (hotelId: number, receita: number | null, occ: number | null, dm: number | null, revpar: number | null) => Promise<void>;
}

function HotelGoalRow({ hotel, meta, onSave }: HotelGoalRowProps) {
  const [receita, setReceita] = useState(metaToInput(meta?.receitaMeta));
  const [occ, setOcc] = useState(metaToInput(meta?.occMeta));
  const [dm, setDm] = useState(metaToInput(meta?.dmMeta));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initRec = metaToInput(meta?.receitaMeta);
  const initOcc = metaToInput(meta?.occMeta);
  const initDm = metaToInput(meta?.dmMeta);
  const dirty = receita !== initRec || occ !== initOcc || dm !== initDm;

  useEffect(() => setReceita(initRec), [initRec]);
  useEffect(() => setOcc(initOcc), [initOcc]);
  useEffect(() => setDm(initDm), [initDm]);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    await onSave(
      hotel.id,
      parseMeta(receita),
      parseMeta(occ),
      parseMeta(dm),
      meta?.revparMeta ?? null
    );
    setSaving(false);
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div className="metas-goal-row" style={{
      display: 'grid',
      gap: 14,
      alignItems: 'center',
      padding: '16px 18px',
      borderBottom: '1px solid var(--border-l)',
      background: 'var(--surface)',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
          <span style={{
            width: 30,
            height: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'var(--rx)',
            background: 'var(--accent-l)',
            color: 'var(--accent)',
            flexShrink: 0,
          }}>
            <Hotel size={15} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{
              display: 'block',
              fontSize: 13.5,
              fontWeight: 850,
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: 1.25,
            }}>
              {hotel.name}
            </span>
            <span style={{
              display: 'block',
              marginTop: 2,
              fontSize: 11,
              fontWeight: 650,
              color: 'var(--text-m)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {hotel.city}, {hotel.state} · {hotel.uhs} UHs
            </span>
          </span>
        </div>
      </div>

      <div className="metas-goal-cards" style={{
        display: 'grid',
        gap: 10,
        minWidth: 0,
      }}>
        <GoalInputCard
          field="receita"
          title="Receita"
          icon={<BarChart3 size={15} />}
          value={receita}
          onChange={setReceita}
          prefix="R$"
        />
        <GoalInputCard
          field="ocupacao"
          title="Ocupação"
          icon={<Percent size={15} />}
          value={occ}
          onChange={setOcc}
          suffix="%"
        />
        <GoalInputCard
          field="diaria"
          title="Diária Média"
          icon={<DollarSign size={15} />}
          value={dm}
          onChange={setDm}
          prefix="R$"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving || (!dirty && !saved)}
        style={{
          minWidth: 124,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          borderRadius: 'var(--rx)',
          border: dirty ? '1px solid var(--accent)' : '1px solid var(--border)',
          background: saved ? 'var(--green)' : dirty ? 'var(--accent)' : 'var(--surface-h)',
          color: saved || dirty ? '#fff' : 'var(--text-m)',
          fontSize: 12,
          fontWeight: 800,
          cursor: saving || (!dirty && !saved) ? 'default' : 'pointer',
          opacity: saving ? 0.72 : 1,
          flexShrink: 0,
        }}
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Target size={14} />}
        {saving ? 'Salvando' : saved ? 'Salvo' : dirty ? 'Salvar' : 'Sem alterações'}
      </button>
    </div>
  );
}

export default function Metas() {
  const currentMes = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [mesAno, setMesAno] = useState(currentMes);
  const [query, setQuery] = useState('');

  const { rows, loading, error: metasError, reload } = useMetasPage(mesAno);
  const monthIdx = MONTHS.indexOf(mesAno);

  const hotels = useMemo<GoalHotel[]>(() => (
    rows.map(row => ({
      id: row.hotelId,
      name: row.hotelNome,
      city: row.cidade ?? '--',
      state: row.estado ?? '--',
      uhs: row.totalUhs,
    }))
  ), [rows]);

  const metas = useMemo<HotelMeta[]>(() => (
    rows
      .filter(row => row.metaId != null || row.receitaMeta != null || row.occMeta != null || row.dmMeta != null || row.revparMeta != null)
      .map(row => ({
        id: row.metaId ?? undefined,
        hotelId: row.hotelId,
        mesAno: row.mesAno || mesAno,
        receitaMeta: row.receitaMeta,
        occMeta: row.occMeta,
        dmMeta: row.dmMeta,
        revparMeta: row.revparMeta,
      }))
  ), [rows, mesAno]);

  const metaMap = useMemo(() => {
    const map = new Map<number, HotelMeta>();
    metas.forEach(meta => map.set(meta.hotelId, meta));
    return map;
  }, [metas]);

  const filteredHotels = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return hotels;
    return hotels.filter(hotel =>
      hotel.name.toLowerCase().includes(term) ||
      hotel.city.toLowerCase().includes(term) ||
      hotel.state.toLowerCase().includes(term)
    );
  }, [hotels, query]);

  async function handleSave(
    hotelId: number,
    receita: number | null,
    occ: number | null,
    dm: number | null,
    revpar: number | null
  ) {
    await saveHotelMeta({
      hotelId,
      mesAno,
      receitaMeta: receita,
      occMeta: occ,
      dmMeta: dm,
      revparMeta: revpar,
    });
    reload();
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <style>{`
        .metas-list-header,
        .metas-goal-row {
          grid-template-columns: minmax(210px, 0.7fr) minmax(0, 2fr) auto;
        }

        .metas-goal-cards {
          grid-template-columns: repeat(3, minmax(150px, 1fr));
        }

        @media (max-width: 900px) {
          .metas-list-header {
            display: none !important;
          }

          .metas-goal-row {
            grid-template-columns: 1fr;
            align-items: stretch !important;
          }

          .metas-goal-cards {
            grid-template-columns: 1fr;
          }

          .metas-goal-row > button {
            width: 100%;
          }
        }

        @media (min-width: 901px) and (max-width: 1180px) {
          .metas-goal-row {
            grid-template-columns: minmax(190px, 0.8fr) minmax(0, 2fr);
          }

          .metas-goal-row > button {
            grid-column: 2;
            justify-self: end;
          }

          .metas-goal-cards {
            grid-template-columns: repeat(3, minmax(120px, 1fr));
          }
        }
      `}</style>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 14,
        flexWrap: 'wrap',
        padding: '18px 20px',
        background: 'linear-gradient(135deg, var(--accent-d), var(--accent))',
        borderRadius: 'var(--r)',
        color: '#fff',
        boxShadow: 'var(--sh-m)',
      }}>
        <div style={{ minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--rx)',
              background: 'rgba(255,170,1,0.16)',
              color: 'var(--gold)',
            }}>
              <Target size={17} />
            </span>
            <h2 style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px' }}>Gestão de Metas</h2>
          </div>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.68)', fontWeight: 550 }}>
            {metas.length} de {hotels.length} hotéis com metas em {fmtMes(mesAno)}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 'var(--rx)',
            overflow: 'hidden',
            background: 'rgba(255,255,255,0.08)',
          }}>
            <button
              aria-label="Mês anterior"
              disabled={monthIdx <= 0}
              onClick={() => setMesAno(MONTHS[monthIdx - 1])}
              style={{
                width: 38,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                opacity: monthIdx <= 0 ? 0.35 : 1,
                cursor: monthIdx <= 0 ? 'default' : 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{
              minWidth: 112,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
              borderLeft: '1px solid rgba(255,255,255,0.16)',
              borderRight: '1px solid rgba(255,255,255,0.16)',
              fontSize: 13,
              fontWeight: 850,
              color: '#fff',
            }}>
              {fmtMes(mesAno)}
            </span>
            <button
              aria-label="Próximo mês"
              disabled={monthIdx >= MONTHS.length - 1}
              onClick={() => setMesAno(MONTHS[monthIdx + 1])}
              style={{
                width: 38,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                opacity: monthIdx >= MONTHS.length - 1 ? 0.35 : 1,
                cursor: monthIdx >= MONTHS.length - 1 ? 'default' : 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{
            width: 280,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px',
            borderRadius: 'var(--rx)',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.1)',
          }}>
            <Search size={14} style={{ color: 'rgba(255,255,255,0.68)', flexShrink: 0 }} />
            <input
              aria-label="Pesquisar hotel"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Pesquisar hotel"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 650,
                fontFamily: 'var(--font)',
              }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="ml-2" style={{ fontSize: 13, color: 'var(--text-m)' }}>Carregando...</span>
        </div>
      ) : metasError ? (
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--red)', fontWeight: 800 }}>
          {metasError}
        </div>
      ) : (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--r)',
          overflow: 'hidden',
          boxShadow: 'var(--sh)',
        }}>
          <div className="metas-list-header" style={{
            display: 'grid',
            gap: 14,
            alignItems: 'center',
            padding: '10px 18px',
            background: 'var(--bg)',
            borderBottom: '1px solid var(--border)',
            color: 'var(--text-m)',
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            <span>Hotel</span>
            <span>Metas</span>
            <span style={{ width: 124, textAlign: 'center' }}>Status</span>
          </div>

          {filteredHotels.length === 0 ? (
            <div style={{ padding: 42, textAlign: 'center', color: 'var(--text-m)', fontSize: 13, fontWeight: 700 }}>
              Nenhum hotel encontrado
            </div>
          ) : (
            filteredHotels.map(hotel => (
              <HotelGoalRow
                key={hotel.id}
                hotel={hotel}
                meta={metaMap.get(hotel.id)}
                onSave={handleSave}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
