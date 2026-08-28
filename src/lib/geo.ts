/**
 * Schematic basemap for the prototype.
 *
 * The brief asked for a zero-dependency, no-API-key prototype, so instead of
 * pulling tiles from a map server we draw a low-detail coastline of peninsular
 * India, Sri Lanka and the Andaman & Nicobar ridge directly as SVG paths.
 * It is deliberately coarse — enough to orient a reviewer, not a survey-grade
 * basemap. Swap in MapLibre + a tile provider when real geospatial work starts.
 */

export type Ring = [number, number][];

/** Kutch → Kanyakumari → Bengal (open polyline). */
export const COAST_MAIN: Ring = [
  [68.6, 23.6],
  [68.9, 22.8],
  [69.2, 22.3],
  [70.0, 21.6],
  [70.9, 20.9],
  [71.9, 21.2],
  [72.55, 21.35],
  [72.7, 20.5],
  [72.9, 19.1],
  [73.3, 18.1],
  [73.55, 17.3],
  [73.3, 16.6],
  [73.95, 15.3],
  [74.85, 12.95],
  [75.78, 11.25],
  [76.1, 9.3],
  [77.52, 8.08],
  [78.2, 8.7],
  [79.3, 9.2],
  [79.85, 10.3],
  [80.3, 13.1],
  [80.3, 15.9],
  [81.2, 16.2],
  [82.3, 16.9],
  [83.5, 18.6],
  [84.8, 19.3],
  [85.6, 19.8],
  [86.6, 20.6],
  [87.0, 21.4],
  [88.2, 21.6],
  [88.9, 21.8],
  [89.2, 22.1],
];

export const SRI_LANKA: Ring = [
  [79.7, 9.6],
  [79.85, 8.6],
  [80.2, 7.2],
  [80.6, 6.3],
  [81.2, 6.1],
  [81.75, 6.6],
  [81.9, 7.4],
  [81.7, 8.4],
  [81.2, 8.9],
  [80.6, 9.5],
  [80.1, 9.7],
  [79.7, 9.6],
];

export const ANDAMAN: Ring[] = [
  [
    [92.5, 13.35],
    [92.8, 12.7],
    [93.05, 12.0],
    [93.0, 11.35],
    [92.8, 10.65],
    [92.6, 10.8],
    [92.7, 11.6],
    [92.62, 12.4],
    [92.5, 13.35],
  ],
  [
    [92.72, 12.85],
    [92.97, 12.3],
    [92.92, 11.9],
    [92.76, 12.1],
    [92.72, 12.85],
  ],
  [
    [92.4, 10.9],
    [92.68, 10.55],
    [92.62, 10.3],
    [92.42, 10.5],
    [92.4, 10.9],
  ],
  [
    [93.1, 9.2],
    [93.9, 8.1],
    [93.85, 7.55],
    [93.7, 7.0],
    [93.52, 7.1],
    [93.7, 7.7],
    [93.75, 8.2],
    [93.0, 9.15],
    [93.1, 9.2],
  ],
];

export interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

export function boundsOf(points: { lon: number; lat: number }[]): Bounds {
  if (points.length === 0)
    return { minLon: 68, maxLon: 94, minLat: 6, maxLat: 24 };
  const lons = points.map((p) => p.lon);
  const lats = points.map((p) => p.lat);
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
  };
}

export function padBounds(b: Bounds, frac = 0.18): Bounds {
  const dLon = (b.maxLon - b.minLon) || 0.5;
  const dLat = (b.maxLat - b.minLat) || 0.5;
  return {
    minLon: b.minLon - dLon * frac,
    maxLon: b.maxLon + dLon * frac,
    minLat: b.minLat - dLat * frac,
    maxLat: b.maxLat + dLat * frac,
  };
}

export interface Projector {
  x: (lon: number) => number;
  y: (lat: number) => number;
  /** km per SVG unit, for the scale bar */
  kmPerUnit: number;
  bounds: Bounds;
}

/**
 * Equirectangular projection with a cos(latitude) correction so shapes stay
 * roughly true across the 25° of longitude the portfolio spans.
 */
export function makeProjector(
  bounds: Bounds,
  width: number,
  height: number,
): Projector {
  const midLat = (bounds.minLat + bounds.maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const spanX = (bounds.maxLon - bounds.minLon) * kx || 1e-6;
  const spanY = bounds.maxLat - bounds.minLat || 1e-6;
  const sx = width / spanX;
  const sy = height / spanY;
  const s = Math.min(sx, sy);
  const offX = (width - spanX * s) / 2;
  const offY = (height - spanY * s) / 2;
  return {
    x: (lon) => offX + (lon - bounds.minLon) * kx * s,
    y: (lat) => offY + (bounds.maxLat - lat) * s,
    kmPerUnit: 111.32 / s,
    bounds,
  };
}

export function pathOf(ring: Ring, p: Projector, close = false): string {
  const d = ring
    .map(([lon, lat], i) => `${i === 0 ? "M" : "L"} ${p.x(lon)} ${p.y(lat)}`)
    .join(" ");
  return close ? `${d} Z` : d;
}

/** Nice graticule step for the current zoom. */
export function gridStep(bounds: Bounds): number {
  const span = Math.max(bounds.maxLon - bounds.minLon, bounds.maxLat - bounds.minLat);
  const steps = [0.25, 0.5, 1, 2, 5, 10];
  return steps.find((s) => span / s <= 8) ?? 10;
}
