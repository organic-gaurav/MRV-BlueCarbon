"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  ECOSYSTEM_COLOR,
  ECOSYSTEM_LABEL,
  CO2_PER_C,
  computePools,
  projectSeries,
  projectStock,
  woodDensity,
} from "@/lib/carbon";
import { MapView, type MapSite } from "@/components/MapView";
import { BarChart, Donut, LineChart } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  KV,
  Progress,
  SectionTitle,
  Stat,
  Table,
  Tabs,
} from "@/components/ui";
import { creditsForCampaign } from "@/lib/derive";
import { dateShort, num, tCO2e, titleCase } from "@/lib/format";
import type { Observation } from "@/lib/types";

type Tab = "overview" | "sites" | "campaigns" | "accounting";

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { data, dispatch, ready } = useStore();
  const [tab, setTab] = useState<Tab>("overview");

  const project = useMemo(
    () => data?.projects.find((p) => p.id === id) ?? null,
    [data, id],
  );

  const view = useMemo(() => {
    if (!data || !project) return null;
    const sites = data.sites.filter((s) => s.projectId === project.id);
    const siteIds = new Set(sites.map((s) => s.id));
    const plots = data.plots.filter((p) => siteIds.has(p.siteId));
    const plotIds = new Set(plots.map((p) => p.id));
    const observations = data.observations.filter((o) => plotIds.has(o.plotId));
    const campaigns = data.campaigns
      .filter((c) => c.projectId === project.id)
      .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));
    const stock = projectStock(project, data.sites, data.plots, data.observations);
    const series = projectSeries(
      project,
      data.sites,
      data.plots,
      data.observations,
      campaigns.map((c) => ({
        id: c.id,
        vintage: c.vintage,
        periodEnd: c.periodEnd,
        status: c.status,
      })),
    );
    const issuances = data.issuances
      .filter((i) => i.projectId === project.id)
      .sort((a, b) => a.vintage.localeCompare(b.vintage));
    const verifications = data.verifications.filter((v) =>
      campaigns.some((c) => c.id === v.campaignId),
    );
    return {
      sites,
      plots,
      observations,
      campaigns,
      stock,
      series,
      issuances,
      verifications,
    };
  }, [data, project]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading project…</div>;
  }
  if (!project || !view) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted">
          Project not found.{" "}
          <Link href="/projects" className="text-accent hover:underline">
            Back to projects
          </Link>
        </p>
      </div>
    );
  }

  const latestCampaign = view.campaigns[view.campaigns.length - 1];
  const latestBatch = latestCampaign
    ? creditsForCampaign(data, latestCampaign)
    : null;
  const issued = view.issuances.reduce((a, i) => a + i.netT, 0);
  const openFindings = view.verifications
    .flatMap((v) => v.findings)
    .filter((f) => f.status === "open");

  const mapSites: MapSite[] = view.stock.sites.map((s) => ({
    ...s,
    projectName: project.name,
    projectCode: project.code,
    cMgHa: s.stock.cMgHa,
    condition: Math.min(1, s.stock.cMgHa / 600),
  }));

  const exportCsv = () => {
    const header =
      "site,plot,lat,lon,date,observer,live_stems,mean_dbh_cm,quadrats,mean_cover_pct,biomass_MgC_ha,soil_MgC_ha,total_MgC_ha,co2e_Mg_ha\n";
    const rows = view.observations
      .map((o: Observation) => {
        const plot = view.plots.find((p) => p.id === o.plotId);
        if (!plot) return "";
        const site = view.sites.find((s) => s.id === plot.siteId);
        if (!site) return "";
        const pools = computePools(o, site.ecosystem, plot.areaM2, project.params);
        return [
          site.code,
          plot.code,
          plot.lat,
          plot.lon,
          o.ts,
          o.observer,
          o.stems.filter((s) => s.vigour === "live").length,
          pools.meanDbhCm.toFixed(2),
          o.quadrats.length,
          pools.meanCoverPct.toFixed(1),
          pools.biomassCMgHa.toFixed(2),
          pools.soilCMgHa.toFixed(1),
          pools.totalCMgHa.toFixed(2),
          pools.co2eMgHa.toFixed(2),
        ].join(",");
      })
      .filter(Boolean)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.code}-plot-data.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href="/projects" className="text-[11.5px] text-muted hover:text-accent">
          ← Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{project.name}</h1>
              <Badge tone="slate">{project.code}</Badge>
              <Badge
                tone={
                  project.ecosystem === "mangrove"
                    ? "emerald"
                    : project.ecosystem === "seagrass"
                      ? "cyan"
                      : "lime"
                }
              >
                {ECOSYSTEM_LABEL[project.ecosystem]}
              </Badge>
            </div>
            <p className="mt-1 max-w-3xl text-[12.5px] text-muted">
              {project.summary}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportCsv}>Export plot data (CSV)</Button>
            <Link href={`/reports?project=${project.id}`}>
              <Button variant="primary">Monitoring report</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="Area"
          value={num(view.stock.areaHa)}
          unit="ha"
          tone="cyan"
          hint={`${view.sites.length} sites · ${view.plots.length} plots`}
        />
        <Stat
          label="Carbon stock"
          value={tCO2e(view.stock.totalCo2eMg)}
          unit="CO₂e"
          tone="emerald"
          hint={`${num(view.stock.cMgHa, 0)} Mg C ha⁻¹`}
        />
        <Stat
          label="Soil burial"
          value={num(view.stock.burialMgCYr * CO2_PER_C)}
          unit="tCO₂e/yr"
          tone="lime"
          hint="Accretion × bulk density × OC"
        />
        <Stat
          label="Credits issued"
          value={num(issued)}
          unit="tCO₂e"
          tone="violet"
          hint={`${view.issuances.length} vintages`}
        />
        <Stat
          label="Open findings"
          value={String(openFindings.length)}
          tone={openFindings.length ? "amber" : "emerald"}
          hint={latestCampaign ? `Latest: ${latestCampaign.code} · ${titleCase(latestCampaign.status)}` : ""}
        />
      </div>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "sites", label: "Sites & plots", count: view.sites.length },
          { id: "campaigns", label: "Campaigns", count: view.campaigns.length },
          { id: "accounting", label: "Accounting" },
        ]}
      />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle
              title="Carbon stock over time"
              sub="Biomass and soil pools, recomputed from raw plot data at each campaign"
            />
            <BarChart
              height={230}
              labels={view.series.map((s) => s.vintage)}
              values={[]}
              stacked={[
                {
                  name: "Biomass C",
                  color: "#ffffff",
                  values: view.series.map((s) => s.biomassCMg),
                },
                {
                  name: "Soil C",
                  color: "#a3a3a3",
                  values: view.series.map((s) => s.soilCMg),
                },
              ]}
              formatValue={(v) => `${Math.round(v / 1000)}k`}
            />
          </Card>

          <Card>
            <SectionTitle title="Pool distribution" sub="Current stock" />
            <Donut
              size={140}
              segments={[
                {
                  label: "Above-ground biomass",
                  value: view.stock.sites.reduce(
                    (a, s) => a + s.stock.biomassCMg * 0.62,
                    0,
                  ),
                  color: "#ffffff",
                },
                {
                  label: "Below-ground biomass",
                  value: view.stock.sites.reduce(
                    (a, s) => a + s.stock.biomassCMg * 0.38,
                    0,
                  ),
                  color: "#565656",
                },
                { label: "Soil organic carbon", value: view.stock.soilCMg, color: "#a3a3a3" },
              ]}
              centre={{ value: num(view.stock.cMgHa, 0), label: "Mg C ha⁻¹" }}
            />
            <div className="mt-4 space-y-1">
              <KV k="Methodology" v={project.methodology} />
              <KV k="Registry" v={project.registry} />
              <KV k="Activity" v={titleCase(project.activity)} />
              <KV k="Registered" v={dateShort(project.registeredOn)} />
              <KV
                k="Crediting period"
                v={`${project.creditingStart.slice(0, 4)}–${project.creditingEnd.slice(0, 4)}`}
              />
              <KV k="Partner" v={project.partner} />
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <SectionTitle
              title="Net mitigation per vintage"
              sub="Stock change plus baseline avoided, before deductions"
            />
            <LineChart
              height={200}
              labels={view.series.map((s) => s.vintage)}
              series={[
                {
                  name: "Gross increment (tCO₂e)",
                  color: "#ffffff",
                  values: view.series.map((s) => s.deltaCo2eMg),
                },
              ]}
              formatValue={(v) => `${Math.round(v / 1000)}k`}
            />
            {latestBatch && (
              <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-4">
                {[
                  ["Gross", latestBatch.gross],
                  ["Deductions", -(latestBatch.leakage + latestBatch.uncertainty + latestBatch.buffer)],
                  ["Net (this vintage)", latestBatch.net],
                  ["Per ha / yr", latestBatch.netPerHaYr],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-[10.5px] uppercase tracking-wider text-muted">
                      {l as string}
                    </p>
                    <p className="tnum text-[15px] font-semibold text-ink">
                      {num(v as number, (l as string).includes("Per") ? 2 : 0)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle title="Site boundaries" sub="Click a polygon for detail" />
            <MapView
              sites={mapSites}
              plots={view.plots}
              height={260}
              showLabels
            />
          </Card>

          <Card className="lg:col-span-3">
            <SectionTitle title="Verified vintages" sub="Issuance record" />
            <Table
              head={[
                "Vintage",
                "Issued on",
                "Serial range",
                "Gross",
                "Leakage",
                "Uncertainty",
                "Buffer",
                "Net",
                "Status",
              ]}
              rows={view.issuances.map((i) => [
                <span key="v" className="tnum font-medium">
                  {i.vintage}
                </span>,
                dateShort(i.issuedOn),
                <span key="s" className="tnum font-mono text-[11px]">
                  {i.serialFrom} – {i.serialTo}
                </span>,
                <span key="g" className="tnum">
                  {num(i.grossT)}
                </span>,
                <span key="l" className="tnum text-neutral-400">
                  −{num(i.leakageT)}
                </span>,
                <span key="u" className="tnum text-neutral-400">
                  −{num(i.uncertaintyT)}
                </span>,
                <span key="b" className="tnum text-neutral-400">
                  −{num(i.bufferT)}
                </span>,
                <span key="n" className="tnum font-semibold text-white">
                  {num(i.netT)}
                </span>,
                <Badge key="st" tone={i.status === "retired" ? "slate" : "violet"}>
                  {i.status}
                </Badge>,
              ])}
            />
          </Card>
        </div>
      )}

      {tab === "sites" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <SectionTitle
              title="Sites"
              sub="Each site is stratified and sampled by permanent plots"
            />
            <Table
              head={[
                "Site",
                "Ecosystem",
                "Stratum",
                "Area (ha)",
                "Plots",
                "Mg C ha⁻¹",
                "Stock (tCO₂e)",
                "Est.",
                "Protected",
              ]}
              rows={view.stock.sites.map((s) => [
                <div key="n">
                  <p className="text-[12.5px] font-medium">{s.name}</p>
                  <p className="text-[10.5px] text-faint">
                    {s.code} · prior use: {s.priorLandUse}
                  </p>
                </div>,
                <Badge
                  key="e"
                  tone={
                    s.ecosystem === "mangrove"
                      ? "emerald"
                      : s.ecosystem === "seagrass"
                        ? "cyan"
                        : "lime"
                  }
                >
                  {s.ecosystem}
                </Badge>,
                <span key="st" className="text-[11.5px]">
                  {s.stratum}
                </span>,
                <span key="a" className="tnum">
                  {num(s.areaHa)}
                </span>,
                <span key="p" className="tnum">
                  {s.stock.plots.length}
                </span>,
                <span key="c" className="tnum">
                  {num(s.stock.cMgHa, 0)}
                </span>,
                <span key="t" className="tnum">
                  {num(s.stock.totalCo2eMg)}
                </span>,
                s.establishedYear,
                s.protectedArea ? (
                  <Badge key="pa" tone="emerald">
                    Yes
                  </Badge>
                ) : (
                  <span key="pa" className="text-faint">
                    —
                  </span>
                ),
              ])}
            />
          </Card>

          <Card>
            <SectionTitle title="Site map" />
            <MapView sites={mapSites} plots={view.plots} height={330} />
          </Card>

          <Card className="lg:col-span-3">
            <SectionTitle
              title="Permanent sample plots"
              sub="Plot areas follow the protocol: 100 m² mangrove, 1 m² saltmarsh, 0.25 m² seagrass"
            />
            <Table
              head={[
                "Plot",
                "Site",
                "Stratum",
                "Coordinates",
                "Area (m²)",
                "Installed",
                "Marker",
                "Latest Mg C ha⁻¹",
              ]}
              rows={view.plots.map((p) => {
                const site = view.sites.find((s) => s.id === p.siteId)!;
                const detail = view.stock.sites
                  .flatMap((s) => s.stock.plots)
                  .find((d) => d.plotId === p.id);
                return [
                  <span key="c" className="tnum font-medium">
                    {p.code}
                  </span>,
                  site.code,
                  p.stratum,
                  <span key="x" className="tnum font-mono text-[11px] text-muted">
                    {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                  </span>,
                  <span key="a" className="tnum">
                    {p.areaM2}
                  </span>,
                  dateShort(p.installedOn),
                  p.monumented ? (
                    <Badge key="m" tone="emerald">
                      Yes
                    </Badge>
                  ) : (
                    <Badge key="m" tone="amber">
                      Missing
                    </Badge>
                  ),
                  <span key="v" className="tnum">
                    {detail ? num(detail.cMgHa, 1) : "—"}
                  </span>,
                ];
              })}
            />
          </Card>
        </div>
      )}

      {tab === "campaigns" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle
              title="Monitoring campaigns"
              sub="Each campaign re-measures every permanent plot and is independently verified"
            />
            <Table
              head={[
                "Campaign",
                "Vintage",
                "Period",
                "Plots surveyed",
                "Completeness",
                "Submitted",
                "Verifier",
                "Status",
                "",
              ]}
              rows={view.campaigns.map((c) => {
                const v = view.verifications.find((x) => x.campaignId === c.id);
                const coverage = (c.plotsSurveyed / Math.max(c.plotsPlanned, 1)) * 100;
                return [
                  <span key="c" className="font-medium">
                    {c.code}
                  </span>,
                  <span key="v" className="tnum">
                    {c.vintage}
                  </span>,
                  <span key="p" className="text-[11px] text-muted">
                    {dateShort(c.periodStart)} → {dateShort(c.periodEnd)}
                  </span>,
                  <span key="ps" className="flex items-center gap-2">
                    <Progress
                      value={coverage}
                      tone={coverage >= 100 ? "emerald" : "amber"}
                      className="w-14"
                    />
                    <span className="tnum text-[11px]">
                      {c.plotsSurveyed}/{c.plotsPlanned}
                    </span>
                  </span>,
                  <span key="cp" className="tnum">
                    {c.completenessPct}%
                  </span>,
                  c.submittedOn ? dateShort(c.submittedOn) : "—",
                  v ? v.body : "—",
                  <Badge
                    key="s"
                    tone={
                      c.status === "verified"
                        ? "emerald"
                        : c.status === "under-review"
                          ? "amber"
                          : c.status === "submitted"
                            ? "blue"
                            : "slate"
                    }
                  >
                    {titleCase(c.status)}
                  </Badge>,
                  <Link
                    key="l"
                    href={`/verification?campaign=${c.id}`}
                    className="text-[11.5px] text-accent hover:underline"
                  >
                    Review →
                  </Link>,
                ];
              })}
            />
          </Card>

          <Card>
            <SectionTitle
              title="Remote-sensing evidence"
              sub="Independent extent and condition check against the mapped site boundary"
            />
            <Table
              head={[
                "Date",
                "Site",
                "Sensor",
                "Resolution",
                "Cloud",
                "NDVI",
                "Extent (ha)",
                "Condition",
                "Flags",
              ]}
              rows={data.remoteSensing
                .filter((r) => view.sites.some((s) => s.id === r.siteId))
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 18)
                .map((r) => {
                  const site = view.sites.find((s) => s.id === r.siteId)!;
                  const drift = ((r.extentHa - site.areaHa) / site.areaHa) * 100;
                  return [
                    dateShort(r.date),
                    site.code,
                    r.sensor,
                    <span key="r" className="tnum">
                      {r.resolutionM} m
                    </span>,
                    <span key="cl" className="tnum">
                      {r.cloudCoverPct}%
                    </span>,
                    <span key="n" className="tnum">
                      {r.ndvi.toFixed(3)}
                    </span>,
                    <span key="e" className="tnum">
                      {num(r.extentHa)}{" "}
                      <span
                        className={
                          drift < -2 ? "text-neutral-400" : drift > 2 ? "text-white" : "text-faint"
                        }
                      >
                        ({drift >= 0 ? "+" : ""}
                        {drift.toFixed(1)}%)
                      </span>
                    </span>,
                    <span key="ci" className="flex items-center gap-2">
                      <Progress
                        value={r.conditionIndex * 100}
                        tone={
                          r.conditionIndex > 0.7
                            ? "emerald"
                            : r.conditionIndex > 0.5
                              ? "amber"
                              : "rose"
                        }
                        className="w-12"
                      />
                      <span className="tnum text-[11px]">
                        {(r.conditionIndex * 100).toFixed(0)}
                      </span>
                    </span>,
                    r.flags.length ? (
                      <Badge key="f" tone="amber">
                        {r.flags.length} flag{r.flags.length > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <span key="f" className="text-faint">
                        clean
                      </span>
                    ),
                  ];
                })}
            />
          </Card>
        </div>
      )}

      {tab === "accounting" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <SectionTitle
              title="Accounting parameters"
              sub="Editable — every result in the app recomputes from these"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Carbon fraction of dry biomass">
                <Input
                  type="number"
                  step="0.01"
                  value={project.params.carbonFraction}
                  onChange={(e) =>
                    dispatch({
                      type: "update-params",
                      projectId: project.id,
                      params: {
                        ...project.params,
                        carbonFraction: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Root : shoot ratio (BGB/AGB)">
                <Input
                  type="number"
                  step="0.05"
                  value={project.params.rootShootRatio}
                  onChange={(e) =>
                    dispatch({
                      type: "update-params",
                      projectId: project.id,
                      params: {
                        ...project.params,
                        rootShootRatio: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Soil carbon stock at t₀ (Mg C ha⁻¹)">
                <Input
                  type="number"
                  value={project.params.soilCarbonStockMgCHa}
                  onChange={(e) =>
                    dispatch({
                      type: "update-params",
                      projectId: project.id,
                      params: {
                        ...project.params,
                        soilCarbonStockMgCHa: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Max uncertainty deduction (fraction)">
                <Input
                  type="number"
                  step="0.01"
                  value={project.params.maxUncertaintyDeduction}
                  onChange={(e) =>
                    dispatch({
                      type: "update-params",
                      projectId: project.id,
                      params: {
                        ...project.params,
                        maxUncertaintyDeduction: Number(e.target.value),
                      },
                    })
                  }
                />
              </Field>
              {(["agb", "bgb", "soil", "baseline"] as const).map((k) => (
                <Field key={k} label={`1σ uncertainty — ${k.toUpperCase()}`}>
                  <Input
                    type="number"
                    step="0.01"
                    value={project.params.uncertainty[k]}
                    onChange={(e) =>
                      dispatch({
                        type: "update-params",
                        projectId: project.id,
                        params: {
                          ...project.params,
                          uncertainty: {
                            ...project.params.uncertainty,
                            [k]: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <SectionTitle title="Baseline scenario" sub="What would have happened anyway" />
              <p className="text-[12px] leading-relaxed text-muted">
                {project.baseline.description}
              </p>
              <div className="mt-3 space-y-1">
                <KV k="Baseline biomass loss" v={`${project.baseline.biomassLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹`} mono />
                <KV k="Baseline soil loss" v={`${project.baseline.soilLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹`} mono />
                <KV k="One-off stock loss" v={`${project.baseline.oneOffStockLossMgCHa} Mg C ha⁻¹`} mono />
                <KV k="Leakage deduction" v={`${project.leakagePct}%`} mono />
                <KV k="Buffer pool" v={`${project.bufferPct}%`} mono />
              </div>
              <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
                Source: {project.baseline.source}
              </p>
            </Card>

            <Card>
              <SectionTitle title="Wood densities in use" sub="g cm⁻³, applied per species" />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {[
                  ...new Set(
                    view.observations.flatMap((o) => o.stems.map((s) => s.species)),
                  ),
                ]
                  .sort()
                  .map((sp) => (
                    <KV key={sp} k={sp} v={woodDensity(sp).toFixed(2)} mono />
                  ))}
              </div>
            </Card>
          </div>

          {latestBatch && (
            <Card className="lg:col-span-2">
              <SectionTitle
                title={`Credit calculation — latest vintage (${latestCampaign?.vintage})`}
                sub="Full audit trail from pool to issued credit"
              />
              <Table
                head={["Line item", "Basis", "tCO₂e"]}
                rows={latestBatch.lines.map((l) => [
                  <span
                    key="l"
                    className={
                      l.key === "net" ? "font-semibold text-white" : "text-ink"
                    }
                  >
                    {l.label}
                  </span>,
                  <span key="n" className="text-[11px] text-muted">
                    {l.note}
                  </span>,
                  <span
                    key="v"
                    className={`tnum ${l.sign < 0 ? "text-neutral-400" : "text-ink"}`}
                  >
                    {l.sign < 0 ? "−" : ""}
                    {num(Math.abs(l.value))}
                  </span>,
                ])}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
