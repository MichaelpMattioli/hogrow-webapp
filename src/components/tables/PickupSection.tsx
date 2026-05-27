import React, { useState } from 'react';
import { CalendarRange, List } from 'lucide-react';
import type { BookingRate, PickupRow } from '@/data/types';
import PickupTable from './PickupTable';
import PickupMensalTable from './PickupMensalTable';
import { Skeleton } from '@/components/ui/Skeleton';

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

function PickupPanelSkeleton() {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20 }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: 18,
        padding: '14px 0 16px',
        borderBottom: '1px solid var(--border-l)',
        marginBottom: 16,
      }}>
        <div>
          <Skeleton width={110} height={10} style={{ marginBottom: 10 }} />
          <Skeleton width="70%" height={30} style={{ marginBottom: 8 }} />
          <Skeleton width="52%" height={10} />
        </div>
        <div>
          <Skeleton width={132} height={10} style={{ marginBottom: 10 }} />
          <Skeleton width={190} height={30} style={{ marginBottom: 8 }} />
          <Skeleton width="64%" height={10} />
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {Array.from({ length: 9 }, (_, row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(6, 1fr)', gap: 8 }}>
            {Array.from({ length: 7 }, (_, col) => (
              <Skeleton key={col} height={18} radius={4} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
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
        <PickupPanelSkeleton />
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
