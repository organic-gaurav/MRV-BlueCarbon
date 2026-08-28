export const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
export const nf2 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function num(v: number, d = 0): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

/** Compact display for large tonnage: 1.24 Mt, 82.4 kt, 912 t */
export function tCO2e(v: number): string {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${num(v / 1_000_000, 2)} Mt`;
  if (a >= 10_000) return `${num(v / 1000, 1)} kt`;
  return `${num(v, 0)} t`;
}

export function ha(v: number): string {
  return `${num(v, 0)} ha`;
}

export function pct(v: number, d = 0): string {
  return `${num(v, d)}%`;
}

export function dateShort(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function monthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export function titleCase(s: string): string {
  return s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function initials(s: string): string {
  return s
    .split(/[\s-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
