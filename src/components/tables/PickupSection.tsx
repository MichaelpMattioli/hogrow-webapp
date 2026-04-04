import React, { useState } from 'react';
import { List, TrendingUp } from 'lucide-react';
import type { PickupRow } from '@/data/types';
import PickupTable from './PickupTable';
import PickupAcumuladoTable from './PickupAcumuladoTable';

type PickupView = 'diario' | 'acumulado';

interface Props {
  hotelId:       number;
  pickupRows:    PickupRow[];
  selectedMeses: string[];
}

export default function PickupSection({ hotelId, pickupRows, selectedMeses }: Props) {
  const [view, setView] = useState<PickupView>('diario');

  const toggleBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '5px 12px', borderRadius: 7,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.15s',
    border: active ? '1.5px solid var(--accent)' : '1px solid var(--border)',
    background: active ? 'rgba(var(--accent-rgb),0.08)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-m)',
  });

  return (
    <div>
      {/* ── Toggle header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Pick-up</span>
          <span style={{ fontSize: 11, color: 'var(--text-m)', marginLeft: 8 }}>
            {view === 'diario'
              ? 'variação entre extrações'
              : 'evolução acumulada por dia do mês'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button style={toggleBtn(view === 'diario')} onClick={() => setView('diario')}>
            <List size={13} />
            Diário
          </button>
          <button style={toggleBtn(view === 'acumulado')} onClick={() => setView('acumulado')}>
            <TrendingUp size={13} />
            Acumulado
          </button>
        </div>
      </div>

      {/* ── Active view ── */}
      {view === 'diario' ? (
        <PickupTable data={pickupRows} selectedMonths={selectedMeses} />
      ) : (
        <PickupAcumuladoTable hotelId={hotelId} />
      )}
    </div>
  );
}
