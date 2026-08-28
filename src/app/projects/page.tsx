"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { projectRows } from "@/lib/derive";
import { ECOSYSTEM_COLOR, ECOSYSTEM_LABEL } from "@/lib/carbon";
import { HBar, Sparkline } from "@/components/charts";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Progress,
  SectionTitle,
  Select,
  Stat,
  Table,
} from "@/components/ui";
import { num, tCO2e, titleCase } from "@/lib/format";
import type { Ecosystem } from "@/lib/types";

const STATUS_TONE: Record<string, "emerald" | "cyan" | "amber" | "rose" | "blue" | "slate"> = {
  monitoring: "cyan",
  "under-verification": "amber",
  registered: "blue",
  verified: "emerald",
  validation: "slate",
  suspended: "rose",
};

export default function ProjectsPage() {
  const { data, ready } = useStore();
  const [q, setQ] = useState("");
  const [eco, setEco] = useState<"all" | Ecosystem>("all");
  const [sort, setSort] = useState<"area" | "carbon" | "issued" | "quality">("carbon");

  const rows = useMemo(() => (data ? projectRows(data) : []), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (eco === "all" ? true : r.project.ecosystem === eco))
      .filter((r) =>
        needle === ""
          ? true
          : `${r.project.name} ${r.project.code} ${r.project.region} ${r.project.proponent}`
              .toLowerCase()
              .includes(needle),
      )
      .sort((a, b) =>
        sort === "area"
          ? b.areaHa - a.areaHa
          : sort === "issued"
            ? b.issued - a.issued
            : sort === "quality"
              ? b.quality - a.quality
              : b.stockCo2e - a.stockCo2e,
      );
  }, [rows, q, eco, sort]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading projects…</div>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-[13px] text-muted">
            {rows.length} registered blue-carbon projects · {num(data.plots.length)}{" "}
            permanent sample plots
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search name, region, proponent…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-56"
          />
          <Select value={eco} onChange={(e) => setEco(e.target.value as typeof eco)}>
            <option value="all">All ecosystems</option>
            <option value="mangrove">Mangrove</option>
            <option value="seagrass">Seagrass</option>
            <option value="saltmarsh">Saltmarsh</option>
          </Select>
          <Select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
          >
            <option value="carbon">Sort: carbon stock</option>
            <option value="area">Sort: area</option>
            <option value="issued">Sort: credits issued</option>
            <option value="quality">Sort: data quality</option>
          </Select>
        </div>
      </header>

      {filtered.length === 0 ? (
        <EmptyState title="No projects match those filters" />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-4">
            <Stat
              label="Filtered area"
              value={num(filtered.reduce((a, r) => a + r.areaHa, 0))}
              unit="ha"
              tone="cyan"
            />
            <Stat
              label="Carbon stock"
              value={tCO2e(filtered.reduce((a, r) => a + r.stockCo2e, 0))}
              unit="CO₂e"
              tone="emerald"
            />
            <Stat
              label="Credits issued"
              value={num(filtered.reduce((a, r) => a + r.issued, 0))}
              unit="tCO₂e"
              tone="violet"
            />
            <Stat
              label="Mean data quality"
              value={String(
                Math.round(
                  filtered.reduce((a, r) => a + r.quality, 0) / filtered.length,
                ),
              )}
              unit="/ 100"
              tone="amber"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <SectionTitle
                title="Project register"
                sub="Click a project to open its full MRV record"
              />
              <Table
                head={[
                  "Project",
                  "Activity",
                  "Area (ha)",
                  "Mg C ha⁻¹",
                  "Latest increment (tCO₂e)",
                  "Issued",
                  "Quality",
                ]}
                rows={filtered.map((r) => [
                  <Link
                    key={r.project.id}
                    href={`/projects/${r.project.id}`}
                    className="block min-w-[200px]"
                  >
                    <span className="block text-[12.5px] font-medium text-ink hover:text-accent">
                      {r.project.name}
                    </span>
                    <span className="block text-[10.5px] text-faint">
                      {r.project.code} · {r.project.region} ·{" "}
                      <span
                        className="capitalize"
                        style={{ color: ECOSYSTEM_COLOR[r.project.ecosystem] }}
                      >
                        {r.project.ecosystem}
                      </span>
                    </span>
                  </Link>,
                  <Badge key="a" tone="slate">
                    {titleCase(r.project.activity)}
                  </Badge>,
                  <span key="ha" className="tnum">
                    {num(r.areaHa)}
                  </span>,
                  <span key="c" className="tnum">
                    {num(r.cMgHa, 0)}
                  </span>,
                  <span key="i" className="flex items-center gap-2">
                    <span className="tnum">{num(r.lastSeries?.deltaCo2eMg ?? 0)}</span>
                    <Sparkline
                      values={r.series.map((s) => s.deltaCo2eMg)}
                      color={ECOSYSTEM_COLOR[r.project.ecosystem]}
                      width={54}
                    />
                  </span>,
                  <span key="is" className="tnum">
                    {num(r.issued)}
                  </span>,
                  <span key="q" className="flex items-center gap-1.5">
                    <Progress
                      value={r.quality}
                      tone={r.quality > 80 ? "emerald" : "amber"}
                      className="w-14"
                    />
                    <span className="tnum text-[11px] text-muted">{r.quality}</span>
                  </span>,
                ])}
              />
            </Card>

            <div className="space-y-4">
              <Card>
                <SectionTitle title="Carbon density" sub="Mg C ha⁻¹ by project" />
                <HBar
                  items={filtered
                    .slice()
                    .sort((a, b) => b.cMgHa - a.cMgHa)
                    .map((r) => ({
                      label: `${r.project.code} · ${r.project.name}`,
                      value: r.cMgHa,
                      color: ECOSYSTEM_COLOR[r.project.ecosystem],
                      sub: `${num(r.areaHa)} ha · ${r.sites} sites`,
                    }))}
                  formatValue={(v) => `${num(v, 0)} Mg C ha⁻¹`}
                />
              </Card>

              <Card>
                <SectionTitle title="Credits issued" sub="Cumulative net tCO₂e" />
                <HBar
                  items={filtered
                    .slice()
                    .sort((a, b) => b.issued - a.issued)
                    .map((r) => ({
                      label: `${r.project.code} · ${r.project.registry}`,
                      value: r.issued,
                      color: "#c2c2c2",
                      sub: `${r.campaigns.filter((c) => c.status === "verified").length} verified vintages`,
                    }))}
                  formatValue={(v) => `${num(v)} tCO₂e`}
                />
              </Card>

              <Card>
                <SectionTitle title="Methodologies in use" />
                <div className="space-y-1.5 text-[11.5px]">
                  {[...new Set(filtered.map((r) => r.project.methodology))].map((m) => (
                    <div key={m} className="flex items-baseline justify-between gap-3">
                      <span className="text-muted">{m}</span>
                      <span className="tnum shrink-0 text-ink">
                        {filtered.filter((r) => r.project.methodology === m).length}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <Card>
            <SectionTitle title="Project summaries" sub="What each intervention actually does on the ground" />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((r) => (
                <Link
                  key={r.project.id}
                  href={`/projects/${r.project.id}`}
                  className="card card-hover block p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[13px] font-semibold text-ink">
                        {r.project.name}
                      </p>
                      <p className="text-[10.5px] text-faint">
                        {r.project.region} · {r.project.proponent}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONE[r.project.status] ?? "slate"}>
                      {titleCase(r.project.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-3 text-[11.5px] leading-relaxed text-muted">
                    {r.project.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <Badge tone="slate">{ECOSYSTEM_LABEL[r.project.ecosystem]}</Badge>
                    {r.project.sdgs.slice(0, 3).map((s) => (
                      <Badge key={s} tone="emerald">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
