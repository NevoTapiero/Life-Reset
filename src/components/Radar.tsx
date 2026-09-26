"use client";

type Series = {
  values: number[];
  stroke: string;
  fill?: string;
  dashed?: boolean;
  dots?: boolean;
};

export default function Radar({
  labels,
  series,
  size = 280,
  max,
}: {
  labels: string[];
  series: Series[];
  size?: number;
  max?: number;
}) {
  const n = labels.length;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const peak = max ?? Math.max(...series.flatMap((s) => s.values)) * 1.15;

  const point = (i: number, v: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rad = (Math.max(0, v) / peak) * r;
    return [cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)];
  };

  const ringPath = (frac: number) =>
    labels
      .map((_, i) => {
        const [x, y] = point(i, peak * frac);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  const seriesPath = (values: number[]) =>
    values
      .map((v, i) => {
        const [x, y] = point(i, v);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="stat radar">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <path key={f} d={ringPath(f)} fill="none" stroke="var(--line)" strokeWidth={1} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = point(i, peak);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth={1} />;
      })}
      {series.map((s, si) => (
        <g key={si}>
          <path
            d={seriesPath(s.values)}
            fill={s.fill ?? "none"}
            stroke={s.stroke}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            strokeLinejoin="round"
          />
          {s.dots &&
            s.values.map((v, i) => {
              const [x, y] = point(i, v);
              return <circle key={i} cx={x} cy={y} r={3} fill={s.stroke} />;
            })}
        </g>
      ))}
      {labels.map((label, i) => {
        const [x, y] = point(i, peak * 1.22);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--muted)"
            style={{ fontSize: 11, fontFamily: "var(--font-geist-mono)", letterSpacing: "0.08em" }}
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
