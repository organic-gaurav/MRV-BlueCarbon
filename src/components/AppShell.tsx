"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "./ui";

const NAV: {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: string;
}[] = [
  {
    href: "/",
    label: "Overview",
    group: "Portfolio",
    icon: (
      <path d="M3 12l9-8 9 8M5 10v10h14V10" />
    ),
  },
  {
    href: "/projects",
    label: "Projects",
    group: "Portfolio",
    icon: <path d="M4 5h16v14H4zM4 10h16M9 10v9" />,
  },
  {
    href: "/map",
    label: "Geospatial",
    group: "Portfolio",
    icon: <path d="M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11zM12 10a2 2 0 100-4 2 2 0 000 4z" />,
  },
  {
    href: "/collect",
    label: "Field collection",
    group: "Measurement",
    icon: <path d="M12 3v18M3 12h18M7 7l10 10M17 7L7 17" />,
  },
  {
    href: "/engine",
    label: "Carbon engine",
    group: "Measurement",
    icon: <path d="M5 19L19 5M14 5h5v5M9 19l-4-4" />,
  },
  {
    href: "/verification",
    label: "Verification",
    group: "Assurance",
    icon: <path d="M9 12l2 2 4-4M6 4h12v16l-6-3-6 3z" />,
  },
  {
    href: "/registry",
    label: "Registry & credits",
    group: "Assurance",
    icon: <path d="M4 7h16v12H4zM9 7V5h6v2M4 12h16" />,
  },
  {
    href: "/reports",
    label: "Monitoring report",
    group: "Reporting",
    icon: <path d="M7 4h7l4 4v12H7zM14 4v4h4M10 13h6M10 17h4" />,
  },
  {
    href: "/audit",
    label: "Audit trail",
    group: "Reporting",
    icon: <path d="M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" />,
  },
];

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[17px] w-[17px] shrink-0"
    >
      {children}
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, reset, ready } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);

  const groups = [...new Set(NAV.map((n) => n.group))];

  return (
    <div className="flex min-h-screen">
      <aside className="no-print sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-line bg-panel/70 backdrop-blur lg:flex">
        <div className="flex items-center gap-2.5 border-b border-line px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 text-[#04211d]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              className="h-[18px] w-[18px]"
            >
              <path d="M12 21c0-6 3-10 8-11-1 6-4 9-8 11z" />
              <path d="M12 21c0-6-3-10-8-11 1 6 4 9 8 11z" />
              <path d="M12 21c0-5 0-9 0-13" />
            </svg>
          </div>
          <div className="leading-tight">
            <p className="text-[13px] font-semibold text-ink">MRV-BlueCarbon</p>
            <p className="text-[10px] text-muted">Prototype v0.1</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g} className="mb-3">
              <p className="px-2 pb-1 text-[9.5px] font-semibold uppercase tracking-widest text-faint">
                {g}
              </p>
              {NAV.filter((n) => n.group === g).map((n) => {
                const active =
                  n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] transition-colors ${
                      active
                        ? "bg-accent/12 font-medium text-accent"
                        : "text-muted hover:bg-white/5 hover:text-ink"
                    }`}
                  >
                    <Icon>{n.icon}</Icon>
                    {n.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-3">
          <p className="mb-2 text-[10px] leading-relaxed text-faint">
            {ready && data
              ? `${data.projects.length} projects · ${data.plots.length} plots · ${data.observations.length} surveys`
              : "Generating dataset…"}
          </p>
          {confirmReset ? (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                }}
              >
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="w-full"
              onClick={() => setConfirmReset(true)}
            >
              Reset demo data
            </Button>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="no-print sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-canvas/85 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-teal-400 to-emerald-500 text-[#04211d]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
              <path d="M12 21c0-6 3-10 8-11-1 6-4 9-8 11zM12 21c0-6-3-10-8-11 1 6 4 9 8 11z" />
            </svg>
          </div>
          <p className="text-[13px] font-semibold">MRV-BlueCarbon</p>
          <div className="ml-auto flex gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] ${
                  pathname === n.href ? "bg-accent/15 text-accent" : "text-muted"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="mx-auto max-w-[1360px] px-5 py-6">{children}</div>
      </main>
    </div>
  );
}
