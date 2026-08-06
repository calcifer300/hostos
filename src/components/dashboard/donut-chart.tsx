"use client";

export interface DonutSegment {
  label: string;
  value: number;
  colorVar: string;
}

/**
 * Small dependency-free SVG donut — no charting library in this project,
 * and one ring with a handful of segments doesn't justify adding one.
 * `colorVar` is a CSS custom property name (e.g. "--success") resolved via
 * var(), so segments follow the active theme automatically.
 */
export function DonutChart({
  segments,
  size = 128,
  strokeWidth = 16,
  centerLabel,
  centerValue,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={strokeWidth}
        />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const fraction = s.value / total;
              const dash = fraction * circumference;
              const circle = (
                <circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={`var(${s.colorVar})`}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += dash;
              return circle;
            })}
      </svg>
      {(centerValue !== undefined || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue !== undefined && (
            <span className="text-[22px] font-bold leading-none tracking-tight text-foreground">{centerValue}</span>
          )}
          {centerLabel && <span className="mt-1 text-[10.5px] text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
