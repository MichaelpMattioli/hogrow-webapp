import type { CSSProperties } from 'react';

// Linguagem visual dos "eixos" de data (compartilhada por PickupTable e PeriodSelector):
//  - stayAxis  = eixo dos dados/mês (azul)
//  - extractionAxis = eixo da extração (marrom)
//  - changedAxis = realce de datas com alteração (verde)

export const stayAxis = {
  soft: 'var(--accent-l)',
  surface: '#F7F8FC',
  border: '#CAD2E8',
  text: 'var(--accent-d)',
  strong: 'var(--accent)',
};

export const extractionAxis = {
  soft: '#F0EDE8',
  surface: '#FAF7F3',
  border: '#D6C8BA',
  text: '#6F5D4B',
  strong: '#9A7657',
};

export const changedAxis = {
  soft: 'var(--green-l)',
  border: '#A7F3D0',
  text: 'var(--green)',
  selected: 'var(--green)',
};

export type Axis = typeof stayAxis;

export const axisPanel = (axis: Axis): CSSProperties => ({
  minWidth: 0,
  padding: '13px 14px',
  borderRadius: 'var(--r)',
  border: `1px solid ${axis.border}`,
  borderLeft: `4px solid ${axis.strong}`,
  background: axis.surface,
});

export const axisLabel = (axis: Axis): CSSProperties => ({
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: 0.6,
  color: axis.text,
  marginBottom: 8,
  textTransform: 'uppercase',
});
