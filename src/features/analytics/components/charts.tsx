/**
 * Server-rendered SVG charts following the dataviz mark specs:
 * thin marks, 4px rounded data-ends anchored to the baseline, 2px gaps,
 * recessive hairline grid, text in ink tokens (never series color),
 * native <title> tooltips on every mark.
 */

const ACCENT = "#5B57D4";
const GRID = "#EAEAEC";
const INK_SOFT = "#9A9AA5";

/** Vertical column chart for a single day-series. */
export function ColumnChart({
  data,
  height = 180,
  valueSuffix = "",
}: {
  data: { label: string; value: number }[];
  height?: number;
  valueSuffix?: string;
}) {
  const width = 640;
  const padLeft = 30;
  const padBottom = 22;
  const padTop = 12;
  const plotW = width - padLeft - 6;
  const plotH = height - padBottom - padTop;
  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const barGap = 2;
  const barW = Math.max(3, Math.floor(plotW / data.length) - barGap);
  const ticks = [0, niceMax / 2, niceMax];

  // Label every ~5th column to avoid collisions
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      role="img"
      aria-label="Conversations per day"
    >
      {ticks.map((t) => {
        const y = padTop + plotH - (t / niceMax) * plotH;
        return (
          <g key={t}>
            <line x1={padLeft} x2={width - 6} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={padLeft - 6} y={y + 3.5} textAnchor="end" fontSize="10" fill={INK_SOFT}>
              {t}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (d.value / niceMax) * plotH;
        const x = padLeft + i * (barW + barGap);
        const y = padTop + plotH - h;
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, d.value > 0 ? 3 : 0)}
              rx={Math.min(4, barW / 2)}
              fill={ACCENT}
              className="hover:opacity-75 transition-opacity"
            >
              <title>{`${d.label}: ${d.value}${valueSuffix}`}</title>
            </rect>
            {/* invisible full-height hit target for easier hovering */}
            <rect x={x} y={padTop} width={barW + barGap} height={plotH} fill="transparent">
              <title>{`${d.label}: ${d.value}${valueSuffix}`}</title>
            </rect>
            {i % labelEvery === 0 && (
              <text
                x={x + barW / 2}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill={INK_SOFT}
              >
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bar list — identity via row label, single hue. */
export function BarList({
  data,
  labelMap,
  emptyText = "No data in this period",
}: {
  data: { label: string; value: number }[];
  labelMap?: Record<string, string>;
  emptyText?: string;
}) {
  if (data.length === 0) {
    return <p className="text-[12.5px] text-ink-soft py-6 text-center">{emptyText}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} title={`${labelMap?.[d.label] ?? d.label}: ${d.value}`}>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[12px] font-medium text-ink truncate pr-3">
              {labelMap?.[d.label] ?? d.label}
            </span>
            <span className="font-mono text-[11.5px] text-ink-mid shrink-0">{d.value}</span>
          </div>
          <div className="h-[10px] bg-hover rounded-[4px] overflow-hidden">
            <div
              className="h-full rounded-[4px]"
              style={{ width: `${(d.value / max) * 100}%`, background: ACCENT, minWidth: 4 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
