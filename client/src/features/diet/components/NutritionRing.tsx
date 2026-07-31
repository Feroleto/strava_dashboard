import type { ReactNode } from 'react';

interface NutritionRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  children?: ReactNode;
}

// pure SVG ring — track in --chip, fill in --acc; caller supplies the
// centered content (kcal readout) via children so this stays diet-agnostic
export default function NutritionRing({
  value,
  max,
  size = 176,
  strokeWidth = 14,
  children,
}: NutritionRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - progress);
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--chip)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--acc)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}
