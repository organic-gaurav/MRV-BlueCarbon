"use client";

import React from "react";

/* ------------------------------------------------------------------ */
/* Line / area chart                                                   */
/* ------------------------------------------------------------------ */

export interface Series {
  name: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  area?: boolean;
}

export function LineChart({
  labels,
  series,
  height = 200,
  formatValue = (v: number) => v.toFixed(0),
  yZero = true,
}: {
  labels: string[];
  series: Series[];
  height?: number;
  formatValue?: (v: number) => string;
  yZero?: boolean;
}) {
  const W = 720;
  const H = height;
  const padL = 52;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const iw = W - padL - padR;
  const ih = H - padT - padB;

  const all = series.flatMap((s) => s.values.filter((v) => v != null) as number[]);
  if (all.length === 0) {
    return <div style={{ height }} className="text-xs text-faint">No data</div>;
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (yZero) min = Math.min(0, min);
  if (max === min) max = min + 1;
  const pad = (max - min) * 0.08;
  min -= pad;
  max += pad;

  const x = (i: number) =>
    padL + (labels.length <= 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => padT + ih - ((v - min) / (max - min)) * ih;

  const ticks = 4;
  const tickVals = Array.from(
    { length: ticks + 1 },
    (_, i) => min + ((max - min) * i) / ticks,
  );

  const paths = series.map((s) => {
    const pts = s.values
      .map((v, i) => (v == null ? null : { i, v }))
      .filter((p): p is { i: number; v: number } => p != null);
    if (pts.length === 0) return null;
    const d = pts.map((p, k) => `${k === 0 ? "M" : "L"} ${x(p.i)} ${y(p.v)}`).join(" ");
    const areaD =
      s.area === false
        ? null
        : `${d} L ${x(pts[pts.length - 1].i)} ${padT + ih} L ${x(pts[0].i)} ${padT + ih} Z`;
    return { s, d, areaD, pts };
  });

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
        {/* gridlines */}
        {tickVals.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(t)}
              y2={y(t)}
              stroke="#1f2d47"
              strokeWidth={1}
              strokeDasharray={i === 0 ? "" : "3 4"}
            />
            <text
              x={padL - 8}
              y={y(t) + 3.5}
              textAnchor="end"
              fontSize={9.5}
              fill="#5d7ba6"
            >
              {formatValue(t)}
            </text>
          </g>
        ))}
        {/* zero line */}
        {min < 0 && max > 0 && (
          <line
            x1={padL}
            x2={W - padR}
            y1={y(0)}
            y2={y(0)}
            stroke="#3b4c6b"
            strokeWidth={1}
          />
        )}
        {/* series */}
        {paths.map(
          (p) =>
            p && (
              <g key={p.s.name}>
                {p.areaD && (
                  <path d={p.areaD} fill={p.s.color} opacity={0.12} />
                )}
                <path
                  d={p.d}
                  fill="none"
                  stroke={p.s.color}
                  strokeWidth={2}
                  strokeDasharray={p.s.dashed ? "4 4" : undefined}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {p.pts.map((pt) => (
                  <circle
                    key={pt.i}
                    cx={x(pt.i)}
                    cy={y(pt.v)}
                    r={2.8}
                    fill="#0e1729"
                    stroke={p.s.color}
                    strokeWidth={1.8}
                  />
                ))}
              </g>
            ),
        )}
        {/* x labels */}
        {labels.map((l, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={9.5}
            fill="#5d7ba6"
          >
            {l}
          </text>
        ))}
      </svg>
      {series.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-3 px-1">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vertical bars                                                       */
/* ------------------------------------------------------------------ */

export function BarChart({
  labels,
  values,
  colors,
  height = 180,
  formatValue = (v: number) => v.toFixed(0),
  stacked,
}: {
  labels: string[];
  values: number[];
  colors?: string[];
  height?: number;
  formatValue?: (v: number) => string;
  stacked?: { name: string; color: string; values: number[] }[];
}) {
  const W = 720;
  const H = height;
  const padL = 52;
  const padR = 12;
  const padT = 10;
  const padB = 42;
  const iw = W - padL - padR;
  const ih = H - padT - padB;

  const totals = stacked
    ? labels.map((_, i) => stacked.reduce((a, s) => a + (s.values[i] ?? 0), 0))
    : values;
  const max = Math.max(1, ...totals) * 1.1;
  const min = Math.min(0, ...totals);
  const y = (v: number) => padT + ih - (v / max) * ih;
  const bw = (iw / labels.length) * 0.62;
  const cx = (i: number) => padL + (i + 0.5) * (iw / labels.length);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(max * f)}
            y2={y(max * f)}
            stroke="#1f2d47"
            strokeDasharray={f === 0 ? "" : "3 4"}
          />
          <text x={padL - 8} y={y(max * f) + 3.5} textAnchor="end" fontSize={9.5} fill="#5d7ba6">
            {formatValue(max * f)}
          </text>
        </g>
      ))}
      {labels.map((l, i) => {
        if (stacked) {
          let acc = 0;
          return (
            <g key={i}>
              {stacked.map((s) => {
                const v = s.values[i] ?? 0;
                const yTop = y(acc + v);
                const h = Math.max(0, y(acc) - yTop);
                acc += v;
                return (
                  <rect
                    key={s.name}
                    x={cx(i) - bw / 2}
                    y={yTop}
                    width={bw}
                    height={h}
                    fill={s.color}
                    opacity={0.85}
                  />
                );
              })}
              <text
                x={cx(i)}
                y={H - 26}
                textAnchor="middle"
                fontSize={9.5}
                fill="#8ba0c0"
              >
                {l}
              </text>
            </g>
          );
        }
        return (
          <g key={i}>
            <rect
              x={cx(i) - bw / 2}
              y={y(values[i])}
              width={bw}
              height={Math.max(0, y(min) - y(values[i]))}
              rx={3}
              fill={colors?.[i] ?? "#2dd4bf"}
              opacity={0.85}
            />
            <text x={cx(i)} y={H - 26} textAnchor="middle" fontSize={9.5} fill="#8ba0c0">
              {l}
            </text>
          </g>
        );
      })}
      {stacked && (
        <g>
          {stacked.map((s, i) => (
            <g key={s.name} transform={`translate(${padL + i * 100}, ${H - 12})`}>
              <rect width={9} height={9} rx={2} fill={s.color} />
              <text x={13} y={8} fontSize={9.5} fill="#8ba0c0">
                {s.name}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Horizontal bars                                                     */
/* ------------------------------------------------------------------ */

export function HBar({
  items,
  formatValue = (v: number) => v.toFixed(1),
}: {
  items: { label: string; value: number; color?: string; sub?: string }[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <div key={i.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="truncate text-[12px] text-ink/90">{i.label}</span>
            <span className="tnum shrink-0 text-[12px] font-medium text-ink">
              {formatValue(i.value)}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/6">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(Math.abs(i.value) / max) * 100}%`,
                background: i.color ?? "#2dd4bf",
              }}
            />
          </div>
          {i.sub && <p className="mt-0.5 text-[10.5px] text-faint">{i.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut                                                               */
/* ------------------------------------------------------------------ */

export function Donut({
  segments,
  size = 150,
  centre,
  thickness = 16,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  centre?: { value: string; label: string };
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  let acc = 0;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="shrink-0">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#1a2537" strokeWidth={thickness} />
        {segments.map((s) => {
          const frac = s.value / total;
          const dash = frac * circ;
          const gap = circ - dash;
          const el = (
            <circle
              key={s.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-acc * circ}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
          acc += frac;
          return el;
        })}
        {centre && (
          <>
            <text
              x={c}
              y={c - 2}
              textAnchor="middle"
              fontSize={17}
              fontWeight={600}
              fill="#e8eefb"
            >
              {centre.value}
            </text>
            <text x={c} y={c + 14} textAnchor="middle" fontSize={9.5} fill="#8ba0c0">
              {centre.label}
            </text>
          </>
        )}
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="text-muted">{s.label}</span>
            <span className="tnum ml-auto pl-3 text-ink">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

export function Sparkline({
  values,
  color = "#2dd4bf",
  width = 72,
  height = 22,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((v - min) / span) * (height - 4);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Gauge (0–100)                                                       */
/* ------------------------------------------------------------------ */

export function Gauge({
  value,
  label,
  size = 96,
  color = "#2dd4bf",
}: {
  value: number;
  label?: string;
  size?: number;
  color?: string;
}) {
  const r = size / 2 - 8;
  const c = size / 2;
  const circ = Math.PI * r; // half circle
  const frac = Math.max(0, Math.min(1, value / 100));
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 8}>
        <path
          d={`M 8 ${c} A ${r} ${r} 0 0 1 ${size - 8} ${c}`}
          fill="none"
          stroke="#1a2537"
          strokeWidth={9}
          strokeLinecap="round"
        />
        <path
          d={`M 8 ${c} A ${r} ${r} 0 0 1 ${size - 8} ${c}`}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={`${frac * circ} ${circ}`}
        />
        <text
          x={c}
          y={c - 6}
          textAnchor="middle"
          fontSize={19}
          fontWeight={600}
          fill="#e8eefb"
        >
          {Math.round(value)}
        </text>
        {label && (
          <text x={c} y={c + 10} textAnchor="middle" fontSize={9.5} fill="#8ba0c0">
            {label}
          </text>
        )}
      </svg>
    </div>
  );
}
