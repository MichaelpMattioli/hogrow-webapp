import { Zap, AlertTriangle, CheckCircle } from 'lucide-react';
import type { HotelStatus } from '@/data/types';
import { STATUS_CONFIG } from '@/lib/utils';

interface StatusBadgeProps {
  status: HotelStatus;
  size?: 'sm' | 'md';
}

const iconMap = {
  excellent: Zap,
  healthy: CheckCircle,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const Icon = iconMap[status];
  const sizeClasses = size === 'sm'
    ? 'px-2 py-0.5 text-[10.5px]'
    : 'px-3.5 py-1.5 text-xs';

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-semibold"
      style={{ background: cfg.bg, color: cfg.color, padding: size === 'sm' ? '2px 8px' : '5px 14px', fontSize: size === 'sm' ? '10.5px' : '12px' }}
    >
      <Icon size={size === 'sm' ? 11 : 14} />
      {cfg.label}
    </span>
  );
}
