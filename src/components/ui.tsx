"use client";

import React from "react";

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div className={`card p-4 ${hover ? "card-hover" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const TONES = {
  emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  cyan: "bg-cyan-500/12 text-cyan-300 border-cyan-500/25",
  lime: "bg-lime-500/12 text-lime-300 border-lime-500/25",
  amber: "bg-amber-500/12 text-amber-300 border-amber-500/25",
  rose: "bg-rose-500/12 text-rose-300 border-rose-500/25",
  blue: "bg-blue-500/12 text-blue-300 border-blue-500/25",
  slate: "bg-slate-500/12 text-slate-300 border-slate-500/25",
  violet: "bg-violet-500/12 text-violet-300 border-violet-500/25",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px] font-medium tracking-wide uppercase ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "slate" }: { tone?: Tone }) {
  const map: Record<Tone, string> = {
    emerald: "bg-emerald-400",
    cyan: "bg-cyan-400",
    lime: "bg-lime-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    blue: "bg-blue-400",
    slate: "bg-slate-400",
    violet: "bg-violet-400",
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${map[tone]}`} />;
}

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent/40";
  const sizes = {
    sm: "px-2.5 py-1 text-[11.5px]",
    md: "px-3.5 py-2 text-[13px]",
  }[size];
  const variants = {
    default: "bg-panel-2 border border-line text-ink hover:bg-[#1a2842]",
    primary:
      "bg-accent text-[#04211d] hover:bg-[#5eead4] border border-transparent font-semibold",
    ghost: "text-muted hover:text-ink hover:bg-white/5 border border-transparent",
    danger: "bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25",
    outline: "border border-line text-ink hover:bg-white/5 bg-transparent",
  }[variant];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${sizes} ${variants} ${className}`}
    >
      {children}
    </button>
  );
}

export function Stat({
  label,
  value,
  unit,
  hint,
  tone = "emerald",
  spark,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone?: Tone;
  spark?: React.ReactNode;
}) {
  const accent: Record<Tone, string> = {
    emerald: "text-emerald-300",
    cyan: "text-cyan-300",
    lime: "text-lime-300",
    amber: "text-amber-300",
    rose: "text-rose-300",
    blue: "text-blue-300",
    slate: "text-slate-200",
    violet: "text-violet-300",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">
          {label}
        </p>
        {spark}
      </div>
      <p className={`tnum mt-2 text-2xl font-semibold ${accent[tone]}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

export function Table({
  head,
  rows,
  className = "",
}: {
  head: React.ReactNode[];
  rows: React.ReactNode[][];
  className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-line">
            {head.map((h, i) => (
              <th
                key={i}
                className="whitespace-nowrap px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-b border-line-soft/70 transition-colors hover:bg-white/[0.03]"
            >
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-middle text-ink/90">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="px-3 py-6 text-center text-xs text-faint">No records</p>
      )}
    </div>
  );
}

export function Progress({
  value,
  tone = "emerald",
  className = "",
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const bg: Record<Tone, string> = {
    emerald: "bg-emerald-400",
    cyan: "bg-cyan-400",
    lime: "bg-lime-400",
    amber: "bg-amber-400",
    rose: "bg-rose-400",
    blue: "bg-blue-400",
    slate: "bg-slate-400",
    violet: "bg-violet-400",
  };
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/8 ${className}`}>
      <div
        className={`h-full rounded-full ${bg[tone]} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-line bg-canvas/60 px-3 py-2 text-[13px] text-ink placeholder:text-faint outline-none transition-colors focus:border-accent/60 focus:ring-1 focus:ring-accent/30";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputCls} ${props.className ?? ""}`}>
      {props.children}
    </select>
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors ${
            active === t.id
              ? "bg-accent/15 text-accent"
              : "text-muted hover:bg-white/5 hover:text-ink"
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 text-[10px] text-faint">{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center gap-2 p-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-md text-xs text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function KV({
  k,
  v,
  mono = false,
}: {
  k: string;
  v: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft/60 py-1.5 last:border-0">
      <span className="text-[11.5px] text-muted">{k}</span>
      <span className={`text-[12.5px] text-ink ${mono ? "tnum font-mono" : ""}`}>{v}</span>
    </div>
  );
}

export function Error_(props: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props} />;
}
