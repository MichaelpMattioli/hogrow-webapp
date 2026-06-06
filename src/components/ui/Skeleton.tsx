import type { CSSProperties } from 'react';

interface SkeletonProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  radius?: CSSProperties['borderRadius'];
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width = '100%',
  height = 12,
  radius = 6,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={['skeleton-shimmer', className].filter(Boolean).join(' ')}
      style={{
        display: 'block',
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  style?: CSSProperties;
}

export function SkeletonText({ lines = 2, style }: SkeletonTextProps) {
  return (
    <div style={{ display: 'grid', gap: 7, ...style }}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? '72%' : '100%'}
          height={10}
        />
      ))}
    </div>
  );
}
