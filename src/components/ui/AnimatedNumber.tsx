import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

export default function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: AnimatedNumberProps) {
  const display = useAnimatedNumber(value);
  const formatted = decimals > 0
    ? display.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : Math.round(display).toLocaleString('pt-BR');

  return (
    <span>
      {prefix}{formatted}{suffix}
    </span>
  );
}
