import React, { useState } from 'react';
import { CalendarRange, List } from 'lucide-react';
import type { BookingRate, PickupRow } from '@/data/types';
import PickupTable from './PickupTable';
import PickupMensalTable from './PickupMensalTable';

type PickupView = 'diario' | 'mensal';

interface Props {
  hotelId: number;
  pickupRows: PickupRow[];
  selectedMeses: string[];
  availableMeses: string[];
  onReferenceChange: (months: string[]) => void;
  shopperRates: BookingRate[];
  loading?: boolean;
  error?: string | null;
}

export default function PickupSection({
  hotelId,
  pickupRows,
  selectedMeses,
  availableMeses,
  onReferenceChange,
  shopperRates,
  loading = false,
  error = null,
}: Props) {
  const [view, setView] = useState<PickupView>('diario');

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 12px',
    borderRadius: 7,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'var(--accent-l)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-m)',
  });

  const description = view === 'diario'
    ? 'referência mensal e extração'
    : 'KPIs mensais do ano';

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Pick-up</span>
          <span style={{ fontSize: 11, color: 'var(--text-m)', marginLeft: 8 }}>
            {description}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={toggleBtn(view === 'diario')} onClick={() => setView('diario')}>
            <List size={13} />
            Diário
          </button>
          <button style={toggleBtn(view === 'mensal')} onClick={() => setView('mensal')}>
            <CalendarRange size={13} />
            Mensal
          </button>
        </div>
      </div>

      {view === 'diario' && loading ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center', color: 'var(--text-m)', fontSize: 12 }}>
          Carregando pick-up...
        </div>
      ) : view === 'diario' && error ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 32, textAlign: 'center', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
          {error}
        </div>
      ) : view === 'diario' ? (
        <PickupTable
          data={pickupRows}
          selectedMonths={selectedMeses}
          availableMonths={availableMeses}
          onReferenceChange={onReferenceChange}
          shopperRates={shopperRates}
        />
      ) : (
        <PickupMensalTable hotelId={hotelId} pickupRows={pickupRows} />
      )}
    </div>
  );
}
