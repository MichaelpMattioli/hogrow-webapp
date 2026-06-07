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
  selectedPosition?: string;
  availablePositionDates?: string[];
  onPositionChange?: (date: string) => void;
  onCurrentMonthSelect?: () => void;
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
  selectedPosition,
  availablePositionDates,
  onPositionChange,
  onCurrentMonthSelect,
  shopperRates,
  loading = false,
  error = null,
}: Props) {
  const [view, setView] = useState<PickupView>('diario');

  // Segmented control (Diário | Mensal) — renderizado DENTRO do card de cada visão
  // (antes flutuava solto acima do card).
  const segBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 13px', borderRadius: 6, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: 'none', transition: 'all 0.15s',
    background: active ? 'var(--surface)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-m)',
    boxShadow: active ? 'var(--sh)' : 'none',
  });
  const viewToggle = (
    <div role="tablist" aria-label="Visão do pick-up" style={{
      display: 'inline-flex', gap: 3, padding: 3, borderRadius: 8,
      background: 'var(--surface-2)', border: '1px solid var(--border-l)',
    }}>
      <button type="button" role="tab" aria-selected={view === 'diario'} style={segBtn(view === 'diario')} onClick={() => setView('diario')}>
        <List size={13} /> Diário
      </button>
      <button type="button" role="tab" aria-selected={view === 'mensal'} style={segBtn(view === 'mensal')} onClick={() => setView('mensal')}>
        <CalendarRange size={13} /> Mensal
      </button>
    </div>
  );

  if (view === 'mensal') {
    return <PickupMensalTable hotelId={hotelId} pickupRows={pickupRows} viewToggle={viewToggle} />;
  }

  if (error && !loading) {
    return (
      <div className="card-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20 }}>
        <div style={{ marginBottom: 16 }}>{viewToggle}</div>
        <div style={{ padding: 28, textAlign: 'center', color: 'var(--red)', fontSize: 12, fontWeight: 700 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <PickupTable
      data={pickupRows}
      selectedMonths={selectedMeses}
      availableMonths={availableMeses}
      onReferenceChange={onReferenceChange}
      selectedPosition={selectedPosition}
      availablePositionDates={availablePositionDates}
      onPositionChange={onPositionChange}
      onCurrentMonthSelect={onCurrentMonthSelect}
      shopperRates={shopperRates}
      loading={loading}
      viewToggle={viewToggle}
    />
  );
}
