import { useState, useEffect, useRef } from 'react';

export function useAnimatedNumber(value: number, duration = 900) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    const end = value;
    const startTime = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - startTime) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3); // cubic ease-out
      setDisplay(end * e);
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value, duration]);

  return display;
}
