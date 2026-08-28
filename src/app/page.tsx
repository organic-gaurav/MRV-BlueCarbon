"use client";

import Link from "next/link";
import React, { useMemo } from "react";
import { useStore } from "@/lib/store";
import { portfolio } from "@/lib/derive";
import { ECOSYSTEM_COLOR, ECOSYSTEM_LABEL } from "@/lib/carbon";
import { BarChart, Donut, Gauge, LineChart, Sparkline } from "@/components/charts";
import { Badge, Button, Card, KV, Progress, SectionTitle, Stat, Table } from "@/components/ui";
import { dateShort, num, tCO2e, titleCase } from "@/lib/format";

const STATUS_TONE: Record<string, "emerald" | "cyan" | "amber" | "rose" | "blue" | "slate"> = {
  monitoring: "cyan",
  "under-verification": "amber",
  registered: "blue",
  verified: "emerald",
  validation: "slate",
  suspended: "rose",
};

export default function OverviewPage() {
  const { data, ready } = useStore();

  const pf = useMemo(() => (data ? portfolio(data) : null), [data]);

  if (!data || !pf || !ready) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted">
        Generating synthetic portfolio…
      </div>
    );
  }

  const recentAudit = [...data.audit]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 7);

  const cumulative = pf.vintageTotals.map((v) => v.net);
  const cumSeries: number[] = [];
  pf.vintageTotals.forEach((v) =>
    cumSeries.push((cumSeries[cumSeries.length - 1] ?? 0) + v.net),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Portfolio overview</h1>
          <p className="mt-1 text-[13px] text-muted">
            {data.projects.length} blue-carbon projects · {pf.sites} sites ·{" "}
            {pf.plots} permanent plots · {num(pf.obs)} plot surveys on record
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/collect">
            <Button variant="primary">+ Record field survey</Button>
          </Link>
          <Link href="/reports">
            <Button>Generate report</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Area under MRV"
          value={num(pf.areaHa)}
          unit="ha"
          tone="cyan"
          hint={`${pf.sites} sites across 6 coastal regions`}
        />
        <Stat
          label="Carbon stock"
          value={tCO2e(pf.stockCo2e)}
          unit="CO₂e"
          tone="emerald"
          hint="Above + below ground biomass and soil"
        />
        <Stat
          label="Annual removals"
          value={num(pf.annualRemovals)}
          unit="tCO₂e/yr"
          tone="lime"
          hint="Latest monitored increment + soil burial"
        />
        <Stat
          label="Credits issued"
          value={num(pf.issued)}
          unit="tCO₂e"
          tone="violet"
          hint={`${num(pf.retired)} retired · ${num(pf.bufferPool)} in buffer`}
        />
        <Stat
          label="Data quality"
          value={`${pf.quality}`}
          unit="/ 100"
          tone={pf.quality > 80 ? "emerald" : "amber"}
          hint="Plot coverage, GPS, cores, photos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Carbon stock over time"
            sub="Recomputed from raw plot measurements at every monitoring campaign"
          />
          <LineChart
            height={230}
            labels={pf.rows[0]?.series.map((s) => s.vintage) ?? []}
            series={pf.rows.slice(0, 4).map((r, i) => ({
              name: r.project.code,
              color: ["#2dd4bf", "#60a5fa", "#a3e635", "#f472b6"][i],
              values: r.series.map((s) => s.totalCMg),
            }))}
            formatValue={(v) => `${Math.round(v / 1000)}k`}
          />
          <p className="mt-2 text-[11px] text-faint">
            Mg C — biomass accrual plus soil carbon burial, aggregated from{" "}
            {num(pf.obs)} individual plot surveys.
          </p>
        </Card>

        <Card>
          <SectionTitle title="Ecosystem split" sub="By mapped project area" />
          <Donut
            size={140}
            segments={pf.byEcosystem.map((e) => ({
              label: ECOSYSTEM_LABEL[e.ecosystem],
              value: e.areaHa,
              color: ECOSYSTEM_COLOR[e.ecosystem],
            }))}
            centre={{
              value: num(pf.areaHa),
              label: "hectares",
            }}
          />
          <div className="mt-4 space-y-2">
            {pf.byEcosystem.map((e) => (
              <div key={e.ecosystem}>
                <div className="flex items-baseline justify-between text-[11.5px]">
                  <span className="text-muted">{ECOSYSTEM_LABEL[e.ecosystem]}</span>
                  <span className="tnum text-ink">
                    {num(e.areaHa)} ha · {tCO2e(e.stockCo2e)}
                  </span>
                </div>
                <Progress
                  value={(e.areaHa / pf.areaHa) * 100}
                  tone={
                    e.ecosystem === "mangrove"
                      ? "emerald"
                      : e.ecosystem === "seagrass"
                        ? "cyan"
                        : "lime"
                  }
                  className="mt-1"
                />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle title="Issuance by vintage" sub="Gross vs net tCO₂e" />
          <BarChart
            height={190}
            labels={pf.vintageTotals.map((v) => v.vintage)}
            values={[]}
            stacked={[
              {
                name: "Net issued",
                color: "#2dd4bf",
                values: pf.vintageTotals.map((v) => v.net),
              },
              {
                name: "Deductions",
                color: "#3f5478",
                values: pf.vintageTotals.map((v) => Math.max(0, v.gross - v.net)),
              },
            ]}
            formatValue={(v) => `${Math.round(v / 1000)}k`}
          />
        </Card>

        <Card>
          <SectionTitle title="Cumulative credits" sub="Net issuance, all projects" />
          <LineChart
            height={190}
            labels={pf.vintageTotals.map((v) => v.vintage)}
            series={[{ name: "Cumulative", color: "#a78bfa", values: cumSeries }]}
            formatValue={(v) => `${Math.round(v / 1000)}k`}
          />
        </Card>

        <Card>
          <SectionTitle title="MRV pipeline" sub="Status of every monitoring campaign" />
          <div className="space-y-3">
            {(
              [
                ["verified", "Verified", "emerald"],
                ["under-review", "Under review", "amber"],
                ["submitted", "Submitted", "blue"],
                ["in-progress", "In progress", "cyan"],
              ] as const
            ).map(([key, label, tone]) => {
              const count = data.campaigns.filter((c) => c.status === key).length;
              const total = data.campaigns.length || 1;
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between text-[11.5px]">
                    <span className="text-muted">{label}</span>
                    <span className="tnum text-ink">
                      {count} / {total}
                    </span>
                  </div>
                  <Progress value={(count / total) * 100} tone={tone} className="mt-1" />
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 border-t border-line pt-4">
            <Gauge value={pf.quality} label="data quality" size={92} />
            <div className="flex-1 space-y-1 text-[11px]">
              <KV k="Open findings" v={data.verifications.flatMap((v) => v.findings).filter((f) => f.status === "open").length} />
              <KV k="Awaiting verification" v={pf.pending} />
              <KV k="Remote-sensing passes" v={data.remoteSensing.length} />
            </div>
          </div>
        </Card>
      </div>

      <Card hover={false}>
        <SectionTitle
          title="Projects"
          sub="Every number below is derived from the stored plot measurements — nothing is hard-coded"
          right={
            <Link href="/projects" className="text-[11.5px] text-accent hover:underline">
              View all →
            </Link>
          }
        />
        <Table
          head={[
            "Project",
            "Ecosystem",
            "Area",
            "Carbon",
            "Latest increment",
            "Issued",
            "Quality",
            "Status",
          ]}
          rows={pf.rows.map((r) => [
            <Link
              key={r.project.id}
              href={`/projects/${r.project.id}`}
              className="block min-w-[190px]"
            >
              <span className="block text-[12.5px] font-medium text-ink hover:text-accent">
                {r.project.name}
              </span>
              <span className="block text-[10.5px] text-faint">
                {r.project.code} · {r.project.region}
              </span>
            </Link>,
            <Badge
              key="e"
              tone={
                r.project.ecosystem === "mangrove"
                  ? "emerald"
                  : r.project.ecosystem === "seagrass"
                    ? "cyan"
                    : "lime"
              }
            >
              {ECOSYSTEM_LABEL[r.project.ecosystem]}
            </Badge>,
            <span key="a" className="tnum">
              {num(r.areaHa)}
            </span>,
            <span key="c" className="tnum">
              {num(r.cMgHa, 0)} <span className="text-faint">Mg C ha⁻¹</span>
            </span>,
            <span key="i" className="flex items-center gap-2">
              <span className="tnum">
                {num(r.lastSeries?.deltaCo2eMg ?? 0)}
              </span>
              <Sparkline
                values={r.series.map((s) => s.deltaCo2eMg)}
                color="#2dd4bf"
                width={52}
                height={18}
              />
            </span>,
            <span key="is" className="tnum">
              {num(r.issued)}
            </span>,
            <span key="q" className="flex items-center gap-1.5">
              <Progress
                value={r.quality}
                tone={r.quality > 80 ? "emerald" : "amber"}
                className="w-12"
              />
              <span className="tnum text-[11px] text-muted">{r.quality}</span>
            </span>,
            <Badge key="s" tone={STATUS_TONE[r.project.status] ?? "slate"}>
              {titleCase(r.project.status)}
            </Badge>,
          ])}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle
            title="Recent activity"
            sub="Append-only audit log"
            right={
              <Link href="/audit" className="text-[11.5px] text-accent hover:underline">
                Full trail →
              </Link>
            }
          />
          <div className="space-y-2.5">
            {recentAudit.map((e) => (
              <div key={e.id} className="flex gap-3">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
                <div className="min-w-0">
                  <p className="text-[12px] text-ink/90">{e.note}</p>
                  <p className="text-[10.5px] text-faint">
                    {dateShort(e.ts)} · {e.actor} · {titleCase(e.role)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="How this prototype fits the MRV cycle"
            sub="Six screens, one consistent data model"
          />
          <ol className="space-y-2.5 text-[12px] text-muted">
            {[
              ["Measure", "/collect", "Geotagged plot surveys — stems, quadrats, soil cores — with a live biomass read-out."],
              ["Model", "/engine", "Allometric equations and soil accretion turned into auditable carbon pools."],
              ["Verify", "/verification", "Verifier checklist, findings and opinion, with the full evidence trail."],
              ["Issue", "/registry", "Deductions, buffer pool, serial numbers and retirement."],
              ["Report", "/reports", "A printable monitoring report regenerated from the current dataset."],
              ["Assure", "/audit", "Hash-chained audit log of every action taken in the system."],
            ].map(([label, href, body], i) => (
              <li key={href} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 text-[10px] font-semibold text-accent">
                  {i + 1}
                </span>
                <span>
                  <Link href={href} className="font-medium text-ink hover:text-accent">
                    {label}
                  </Link>{" "}
                  — {body}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
