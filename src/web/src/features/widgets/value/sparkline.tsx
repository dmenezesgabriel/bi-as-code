import type { ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { sparklineBaseline, sparklineDomain } from "./sparkline-points";
import type { SparklinePoint, SparklineType } from "./types";

export interface SparklineDisplayProps {
  /** Projected (x, y) pairs in draw order — see `projectSparklinePoints`. */
  readonly points: readonly SparklinePoint[];
  readonly type?: SparklineType;
  /** CSS color; defaults to the muted neutral the wrapper span sets. */
  readonly color?: string;
  readonly width?: number;
  readonly height?: number;
  /** Accessible name — the svg is `role="img"`; widgets pass `"{y} by {x}"`. */
  readonly label?: string;
  readonly className?: string;
}

/** Two-decimal rounding keeps the emitted path deterministic and short. */
const r = (v: number): number => Math.round(v * 100) / 100;

/**
 * The sparkline mark itself: an inline SVG, `role="img"` with an
 * `aria-label`, drawn in `currentColor` so the wrapper's text color (or the
 * `color` prop) is the whole palette. x positions are evenly spaced by
 * index — a sparkline shows shape, not a scaled axis — which handles int,
 * Date and string x uniformly. No tooltips or interactions in v1.
 *
 * @example
 * <SparklineDisplay points={projectSparklinePoints(rows, "week", "revenue")} />
 * <SparklineDisplay points={pts} type="bar" label="Orders by week" />
 */
export function SparklineDisplay({
  points,
  type = "line",
  color,
  width = 50,
  height = 15,
  label = "sparkline",
  className,
}: SparklineDisplayProps): ReactElement {
  if (points.length === 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center align-baseline text-neutral-400 dark:text-neutral-500",
          className,
        )}
        style={{ width, height }}
      >
        <span className="text-xs">–</span>
      </span>
    );
  }

  const ys = points.map((p) => p.y);
  const [dMin, dMax] = sparklineDomain(ys);
  const baseline = sparklineBaseline(ys);
  const yPx = (v: number): number =>
    height - ((v - dMin) / (dMax - dMin)) * height;

  const [only] = points;
  const coords: readonly (readonly [number, number])[] =
    points.length === 1 && only !== undefined
      ? [
          [0, yPx(only.y)],
          [width, yPx(only.y)],
        ]
      : points.map((p, i) => [(i * width) / (points.length - 1), yPx(p.y)]);

  const segments = coords.map(([cx, cy]) => `${r(cx)} ${r(cy)}`);
  const linePath = `M ${segments.join(" L ")}`;
  const basePx = yPx(baseline);

  return (
    <span
      className={cn(
        "inline-block align-baseline leading-none text-neutral-400 dark:text-neutral-500",
        className,
      )}
      style={color === undefined ? undefined : { color }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        className="block overflow-visible"
      >
        {type === "bar" ? (
          <Bars coords={coords} basePx={basePx} width={width} />
        ) : (
          <>
            {type === "area" && (
              <path
                d={`${linePath} L ${width} ${r(basePx)} L 0 ${r(basePx)} Z`}
                fill="currentColor"
                fillOpacity={0.2}
              />
            )}
            <path
              d={linePath}
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
            />
          </>
        )}
      </svg>
    </span>
  );
}

/** One `<rect>` per point, anchored at the baseline, ~80% of its slot. */
function Bars({
  coords,
  basePx,
  width,
}: {
  readonly coords: readonly (readonly [number, number])[];
  readonly basePx: number;
  readonly width: number;
}): ReactElement {
  const step = width / coords.length;
  const barW = step * 0.8;
  return (
    <>
      {coords.map(([, cy], i) => {
        const top = Math.min(cy, basePx);
        const h = Math.max(Math.abs(cy - basePx), 0.5);
        return (
          <rect
            key={i}
            x={r(i * step + (step - barW) / 2)}
            y={r(top)}
            width={r(barW)}
            height={r(h)}
            fill="currentColor"
          />
        );
      })}
    </>
  );
}
