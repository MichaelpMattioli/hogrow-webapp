import { clsx, type ClassValue } from 'clsx';
import type { StatusConfig } from '@/data/types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function formatCurrencyCompact(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1).replace('.', ',')}M`;
  }
  if (value >= 1000) {
    return `${Math.round(value / 1000)}k`;
  }
  return formatCurrency(value);
}

export function formatPercent(value: number): string {
  return value.toFixed(1).replace('.', ',') + '%';
}

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  excellent: { label: 'Excelente', color: '#10B981', bg: '#ECFDF5' },
  healthy: { label: 'Saudável', color: '#3B82F6', bg: '#EBF2FF' },
  warning: { label: 'Atenção', color: '#F59E0B', bg: '#FFFBEB' },
  critical: { label: 'Crítico', color: '#EF4444', bg: '#FEF2F2' },
};
