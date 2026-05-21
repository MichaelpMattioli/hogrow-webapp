import React, { useState } from 'react';
import { CalendarRange, List, TrendingUp } from 'lucide-react';
import type { BookingRate, PickupRow } from '@/data/types';
import PickupTable from './PickupTable';
import PickupAcumuladoTable from './PickupAcumuladoTable';
import PickupMensalTable from './PickupMensalTable';

type PickupView = 'diario' | 'acumulado' | 'mensal';

interface Props {
  hotelId: number;
  pickupRows: PickupRow[];
  selectedMeses: string[];
  availableMeses: string[];
  onReferenceChange: (months: string[]) => void;
  shopperRates: BookingRate[];
}

export default function PickupSection({
  hotelId,
  pickupRows,
  selectedMeses,
  availableMeses,
  onReferenceChange,
  shopperRates,
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

  const description =
    view === 'diario'
      ? 'referência mensal e extração'
      : view === 'acumulado'
        ? 'evolução acumulada por dia do mês'
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
          <button style={toggleBtn(view === 'acumulado')} onClick={() => setView('acumulado')}>
            <TrendingUp size={13} />
            Acumulado
          </button>
        </div>
      </div>

      {view === 'diario' ? (
        <PickupTable
          data={pickupRows}
          selectedMonths={selectedMeses}
          availableMonths={availableMeses}
          onReferenceChange={onReferenceChange}
          shopperRates={shopperRates}
        />
      ) : view === 'acumulado' ? (
        <PickupAcumuladoTable hotelId={hotelId} />
      ) : (
        <PickupMensalTable hotelId={hotelId} />
      )}
    </div>
  );
}
