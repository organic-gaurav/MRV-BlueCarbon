"use client";

import React, { useMemo, useState } from "react";
import {
  ANDAMAN,
  COAST_MAIN,
  SRI_LANKA,
  boundsOf,
  gridStep,
  makeProjector,
  padBounds,
  pathOf,
} from "@/lib/geo";
import { ECOSYSTEM_COLOR } from "@/lib/carbon";
import type { Plot, Site } from "@/lib/types";

export interface MapSite extends Site {
  projectName: string;
  projectCode: string;
  /** 0–1 condition, drives fill opacity */
  condition?: number;
  /** Mg C ha⁻¹ — drives the label */
  cMgHa?: number;
}

export function MapView({
  sites,
  plots = [],
  height = 420,
  selectedSiteId,
  onSelect,
  showPlots = true,
  showLabels = true,
  focus,
}: {
  sites: MapSite[];
  plots?: Plot[];
  height?: number;
  selectedSiteId?: string | null;
  onSelect?: (siteId: string) => void;
  showPlots?: boolean;
  showLabels?: boolean;
  focus?: { lon: number; lat: number }[];
}) {
  const [hover, setHover] = useState<string | null>(null);

  const W = 900;
  const H = height;

  const bounds = useMemo(() => {
    const pts: { lon: number; lat: number }[] = [];
    for (const s of sites) {
      pts.push(...s.polygon, s.centroid);
    }
    if (focus?.length) pts.push(...focus);
    if (pts.length === 0) pts.push(...COAST_MAIN.map(([lon, lat]) => ({ lon, lat })));
    return padBounds(boundsOf(pts), 0.25);
  }, [sites, focus]);

  const p = useMemo(() => makeProjector(bounds, W, H), [bounds, W, H]);
  const step = gridStep(bounds);

  const lonLines: number[] = [];
  for (
    let x = Math.ceil(bounds.minLon / step) * step;
    x <= bounds.maxLon;
    x += step
  )
    lonLines.push(x);
  const latLines: number[] = [];
  for (
    let y = Math.ceil(bounds.minLat / step) * step;
    y <= bounds.maxLat;
    y += step
  )
    latLines.push(y);

  const active = sites.find((s) => s.id === (hover ?? selectedSiteId));

  // scale bar: pick a round distance that is ≈ 120 px
  const targetKm = p.kmPerUnit * 120;
  const niceKm = [1, 2, 5, 10, 20, 50, 100, 200, 500].reduce((a, b) =>
    Math.abs(b - targetKm) < Math.abs(a - targetKm) ? b : a,
  );
  const barPx = niceKm / p.kmPerUnit;

  const sitePlots = useMemo(() => {
    if (!showPlots) return [];
    const ids = new Set(sites.map((s) => s.id));
    return plots.filter((pl) => ids.has(pl.siteId));
  }, [plots, sites, showPlots]);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl"
        style={{ height, background: "rgba(255,255,255,0.03)" }}
      >
        <defs>
          <pattern id="grid-dots" width="18" height="18" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="rgba(255,255,255,0.12)" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid-dots)" />

        {/* graticule */}
        <g>
          {lonLines.map((x) => (
            <g key={`lon${x}`}>
              <line
                x1={p.x(x)}
                x2={p.x(x)}
                y1={0}
                y2={H}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text x={p.x(x) + 3} y={H - 6} fontSize={9} fill="#5f5f5f">
                {x.toFixed(step < 1 ? 1 : 0)}°E
              </text>
            </g>
          ))}
          {latLines.map((y) => (
            <g key={`lat${y}`}>
              <line
                x1={0}
                x2={W}
                y1={p.y(y)}
                y2={p.y(y)}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text x={4} y={p.y(y) - 4} fontSize={9} fill="#5f5f5f">
                {y.toFixed(step < 1 ? 1 : 0)}°N
              </text>
            </g>
          ))}
        </g>

        {/* schematic landmasses */}
        <g>
          <path
            d={pathOf(COAST_MAIN, p)}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />
          <path
            d={pathOf(COAST_MAIN, p)}
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={pathOf(SRI_LANKA, p, true)}
            fill="rgba(255,255,255,0.05)"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth={1.6}
          />
          {ANDAMAN.map((a, i) => (
            <path
              key={i}
              d={pathOf(a, p, true)}
              fill="rgba(255,255,255,0.05)"
              stroke="rgba(255,255,255,0.11)"
              strokeWidth={1.4}
            />
          ))}
        </g>

        {/* project sites */}
        <g>
          {sites.map((s) => {
            const selected = selectedSiteId === s.id;
            const hovered = hover === s.id;
            const colour = ECOSYSTEM_COLOR[s.ecosystem];
            const op = 0.2 + (s.condition ?? 0.7) * 0.4 + (hovered || selected ? 0.2 : 0);
            return (
              <g
                key={s.id}
                onMouseEnter={() => setHover(s.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(s.id)}
                className="cursor-pointer"
              >
                <path
                  d={pathOf(
                    s.polygon.map((q) => [q.lon, q.lat] as [number, number]),
                    p,
                    true,
                  )}
                  fill={colour}
                  fillOpacity={op}
                  stroke={colour}
                  strokeWidth={hovered || selected ? 2.2 : 1.2}
                  strokeOpacity={hovered || selected ? 1 : 0.7}
                />
                {showLabels && (
                  <text
                    x={p.x(s.centroid.lon)}
                    y={p.y(s.centroid.lat) + 3}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={600}
                    fill="#ffffff"
                    style={{ pointerEvents: "none", paintOrder: "stroke" }}
                    stroke="#030303"
                    strokeWidth={2.6}
                  >
                    {s.code}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* plots */}
        <g>
          {sitePlots.map((pl) => (
            <circle
              key={pl.id}
              cx={p.x(pl.lon)}
              cy={p.y(pl.lat)}
              r={2.1}
              fill="#ffffff"
              fillOpacity={0.75}
              stroke="#030303"
              strokeWidth={0.8}
            />
          ))}
        </g>

        {/* scale bar */}
        <g transform={`translate(${W - barPx - 22}, ${H - 22})`}>
          <line x1={0} x2={barPx} y1={0} y2={0} stroke="#a3a3a3" strokeWidth={1.6} />
          <line x1={0} x2={0} y1={-4} y2={4} stroke="#a3a3a3" strokeWidth={1.6} />
          <line x1={barPx} x2={barPx} y1={-4} y2={4} stroke="#a3a3a3" strokeWidth={1.6} />
          <text x={barPx / 2} y={-7} textAnchor="middle" fontSize={9} fill="#a3a3a3">
            {niceKm} km
          </text>
        </g>

        {/* north arrow */}
        <g transform={`translate(24, ${H - 34})`}>
          <path d="M 0 18 L 5 0 L 10 18 L 5 13 Z" fill="#a3a3a3" />
          <text x={5} y={-3} textAnchor="middle" fontSize={9} fill="#a3a3a3">
            N
          </text>
        </g>
      </svg>

      {active && (
        <div className="pointer-events-none absolute top-3 left-3 max-w-[260px] rounded-lg border border-line bg-black/70 p-3 shadow-xl backdrop-blur">
          <p className="text-[12.5px] font-semibold text-ink">{active.name}</p>
          <p className="text-[10.5px] text-muted">
            {active.projectCode} · {active.stratum}
          </p>
          <dl className="mt-2 space-y-0.5 text-[11px]">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Ecosystem</dt>
              <dd className="capitalize text-ink">{active.ecosystem}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Area</dt>
              <dd className="tnum text-ink">{active.areaHa} ha</dd>
            </div>
            {active.cMgHa != null && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Carbon</dt>
                <dd className="tnum text-ink">{Math.round(active.cMgHa)} Mg C ha⁻¹</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Centroid</dt>
              <dd className="tnum font-mono text-ink">
                {active.centroid.lat.toFixed(3)}, {active.centroid.lon.toFixed(3)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <p className="mt-2 text-[10.5px] text-faint">
        Schematic basemap — low-detail coastline drawn offline, no tile server. Site
        polygons are synthetic.
      </p>
    </div>
  );
}
