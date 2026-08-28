"use client";

import { useSearchParams } from "next/navigation";
import React, { Suspense, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CO2_PER_C, ECOSYSTEM_LABEL, computeCredits } from "@/lib/carbon";
import { campaignShape, creditsForCampaign } from "@/lib/derive";
import {
  Badge,
  Button,
  Card,
  Field,
  KV,
  SectionTitle,
  Select,
  Table,
} from "@/components/ui";
import { dateShort, num, titleCase } from "@/lib/format";
import { projectSeries, projectStock } from "@/lib/carbon";
import { BRAND } from "@/lib/branding";

function ReportsInner() {
  const params = useSearchParams();
  const { data, ready } = useStore();
  const [projectId, setProjectId] = useState(params?.get("project") ?? "");
  const [campaignId, setCampaignId] = useState("");

  const project = useMemo(() => {
    if (!data) return null;
    return (
      data.projects.find((p) => p.id === projectId) ?? data.projects[0] ?? null
    );
  }, [data, projectId]);

  const campaigns = useMemo(
    () =>
      data && project
        ? data.campaigns
            .filter((c) => c.projectId === project.id)
            .sort((a, b) => a.periodEnd.localeCompare(b.periodEnd))
        : [],
    [data, project],
  );

  const campaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) ?? campaigns[campaigns.length - 1] ?? null,
    [campaigns, campaignId],
  );

  const report = useMemo(() => {
    if (!data || !project || !campaign) return null;
    const sites = data.sites.filter((s) => s.projectId === project.id);
    const siteIds = new Set(sites.map((s) => s.id));
    const plots = data.plots.filter((p) => siteIds.has(p.siteId));
    const plotIds = new Set(plots.map((p) => p.id));
    const observations = data.observations.filter(
      (o) => plotIds.has(o.plotId) && o.ts <= campaign.periodEnd,
    );
    const stock = projectStock(project, data.sites, data.plots, observations);
    const series = projectSeries(
      project,
      data.sites,
      data.plots,
      observations,
      campaignShape(data, project.id).filter((c) => c.periodEnd <= campaign.periodEnd),
    );
    const pt = series.find((s) => s.campaignId === campaign.id) ?? series[series.length - 1];
    const prev = series[Math.max(0, series.findIndex((s) => s.campaignId === campaign.id) - 1)];
    const areaHa = stock.areaHa;
    const batch = creditsForCampaign(data, campaign);
    const verification = data.verifications.find((v) => v.campaignId === campaign.id);
    const rs = data.remoteSensing
      .filter((r) => r.campaignId === campaign.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const issuances = data.issuances.filter((i) => i.projectId === project.id);
    return {
      sites,
      plots,
      observations,
      stock,
      series,
      pt,
      prev,
      areaHa,
      batch,
      verification,
      rs,
      issuances,
    };
  }, [data, project, campaign]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading report builder…</div>;
  }
  if (!project || !campaign || !report) {
    return <div className="p-8 text-sm text-muted">No project data available.</div>;
  }

  const exportJson = () => {
    const payload = {
      generatedOn: new Date().toISOString(),
      project,
      campaign,
      sites: report.sites,
      plots: report.plots,
      observationCount: report.observations.length,
      stock: {
        areaHa: report.stock.areaHa,
        biomassCMg: report.stock.biomassCMg,
        soilCMg: report.stock.soilCMg,
        totalCo2eMg: report.stock.totalCo2eMg,
      },
      series: report.series,
      creditCalculation: report.batch,
      verification: report.verification,
      remoteSensing: report.rs,
      issuances: report.issuances,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.code}-monitoring-report-${campaign.vintage}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Monitoring report</h1>
          <p className="mt-1 text-[13px] text-muted">
            Regenerated from the current dataset — print to PDF or export as JSON
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-64">
            <Field label="Project">
              <Select
                value={project.id}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setCampaignId("");
                }}
              >
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-52">
            <Field label="Monitoring period">
              <Select value={campaign.id} onChange={(e) => setCampaignId(e.target.value)}>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.vintage} · {c.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={() => window.print()}>Print / Save PDF</Button>
          <Button variant="primary" onClick={exportJson}>
            Export JSON
          </Button>
        </div>
      </div>

      <article className="print-sheet card p-8">
        <header className="border-b border-line pb-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.18em] text-accent">
                Monitoring report · {project.registry}
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                {project.name}
              </h2>
              <p className="mt-1 text-[13px] text-muted">
                {project.code} · {project.region}, {project.country}
              </p>
            </div>
            <div className="text-right text-[11.5px]">
              <p className="text-muted">Reporting period</p>
              <p className="font-medium">
                {dateShort(campaign.periodStart)} – {dateShort(campaign.periodEnd)}
              </p>
              <p className="mt-2 text-muted">Vintage</p>
              <p className="tnum font-medium">{campaign.vintage}</p>
              <p className="mt-2 text-muted">Status</p>
              <p className="font-medium">{titleCase(campaign.status)}</p>
            </div>
          </div>
        </header>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            1 · Project description
          </h3>
          <p className="text-[12.5px] leading-relaxed text-ink/90">{project.summary}</p>
          <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <KV k="Proponent" v={project.proponent} />
            <KV k="Implementing partner" v={project.partner} />
            <KV k="Ecosystem" v={ECOSYSTEM_LABEL[project.ecosystem]} />
            <KV k="Activity type" v={titleCase(project.activity)} />
            <KV k="Methodology" v={project.methodology} />
            <KV k="Registry" v={project.registry} />
            <KV k="Total area" v={`${num(report.areaHa)} ha`} mono />
            <KV k="Crediting period" v={`${project.creditingStart.slice(0, 4)}–${project.creditingEnd.slice(0, 4)}`} />
            <KV k="Sites / plots" v={`${report.sites.length} sites · ${report.plots.length} plots`} mono />
            <KV k="Co-benefits" v={project.sdgs.join(", ")} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            2 · Baseline scenario
          </h3>
          <p className="text-[12.5px] leading-relaxed text-ink/90">
            {project.baseline.description}
          </p>
          <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <KV k="Baseline biomass loss" v={`${project.baseline.biomassLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹`} mono />
            <KV k="Baseline soil carbon loss" v={`${project.baseline.soilLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹`} mono />
            <KV k="One-off stock loss" v={`${project.baseline.oneOffStockLossMgCHa} Mg C ha⁻¹`} mono />
            <KV k="Baseline source" v={project.baseline.source} />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            3 · Monitoring approach
          </h3>
          <p className="text-[12.5px] leading-relaxed text-ink/90">
            Permanent sample plots were established within each stratum and
            re-measured during the reporting period. Woody stems are measured for
            diameter at breast height and height; meadows and swards are sampled by
            quadrat for cover, shoot density and harvested above-ground dry biomass.
            Soil cores are analysed for bulk density and organic carbon content, and
            surface accretion is used to derive the soil carbon burial rate. Field
            results are cross-checked against satellite-derived extent and condition.
          </p>
          <div className="mt-3">
            <Table
              head={["Site", "Stratum", "Area (ha)", "Plots", "Established", "Prior land use"]}
              rows={report.sites.map((s) => [
                <span key="n">
                  {s.name}
                  <span className="block text-[10px] text-faint">{s.code}</span>
                </span>,
                s.stratum,
                <span key="a" className="tnum">
                  {num(s.areaHa)}
                </span>,
                <span key="p" className="tnum">
                  {report.plots.filter((p) => p.siteId === s.id).length}
                </span>,
                s.establishedYear,
                s.priorLandUse,
              ])}
            />
          </div>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            4 · Monitoring results — carbon pools
          </h3>
          <Table
            head={[
              "Site",
              "Area (ha)",
              "Biomass C (Mg ha⁻¹)",
              "Soil C (Mg ha⁻¹)",
              "Total C (Mg ha⁻¹)",
              "Stock (tCO₂e)",
              "Burial (Mg C yr⁻¹)",
            ]}
            rows={report.stock.sites.map((s) => [
              <span key="n">
                {s.name}
                <span className="block text-[10px] text-faint">{s.code}</span>
              </span>,
              <span key="a" className="tnum">
                {num(s.stock.areaHa)}
              </span>,
              <span key="b" className="tnum">
                {num(s.stock.biomassCMgHa, 1)}
              </span>,
              <span key="s" className="tnum">
                {num(s.stock.soilCMgHa, 0)}
              </span>,
              <span key="t" className="tnum">
                {num(s.stock.cMgHa, 1)}
              </span>,
              <span key="c" className="tnum">
                {num(s.stock.totalCo2eMg)}
              </span>,
              <span key="u" className="tnum">
                {num(s.stock.soilBurialMgCHaYr * s.stock.areaHa, 0)}
              </span>,
            ])}
          />
          <div className="mt-3 grid gap-x-8 gap-y-1 sm:grid-cols-3">
            <KV
              k="Project biomass carbon"
              v={`${num(report.stock.biomassCMg)} Mg C`}
              mono
            />
            <KV k="Project soil carbon" v={`${num(report.stock.soilCMg)} Mg C`} mono />
            <KV
              k="Project stock"
              v={`${num(report.stock.totalCo2eMg)} tCO₂e`}
              mono
            />
          </div>
          {report.pt && (
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink/90">
              Between {report.prev?.vintage ?? "the project start"} and{" "}
              {report.pt.vintage} the project stock changed by{" "}
              <span className="tnum font-semibold text-white">
                {num(report.pt.deltaCo2eMg)} tCO₂e
              </span>
              , of which {num(report.pt.soilAccrualCo2eMg)} tCO₂e is soil carbon
              burial accrued over {num(report.pt.years, 2)} years.
            </p>
          )}
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            5 · Remote-sensing cross-check
          </h3>
          {report.rs.length === 0 ? (
            <p className="text-[12px] text-faint">
              No satellite pass linked to this monitoring period.
            </p>
          ) : (
            <Table
              head={["Date", "Sensor", "Resolution", "Cloud", "NDVI", "Extent (ha)", "Flags"]}
              rows={report.rs.map((r) => [
                dateShort(r.date),
                r.sensor,
                `${r.resolutionM} m`,
                `${r.cloudCoverPct}%`,
                <span key="n" className="tnum">
                  {r.ndvi.toFixed(3)}
                </span>,
                <span key="e" className="tnum">
                  {num(r.extentHa)}
                </span>,
                r.flags.length ? (
                  <Badge key="f" tone="amber">
                    {r.flags.join("; ")}
                  </Badge>
                ) : (
                  <span key="f" className="text-faint">
                    none
                  </span>
                ),
              ])}
            />
          )}
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            6 · Quantification of net GHG removals
          </h3>
          {report.batch ? (
            <Table
              head={["Line item", "Basis", "tCO₂e"]}
              rows={report.batch.lines.map((l) => [
                <span
                  key="l"
                  className={l.key === "net" ? "font-semibold text-white" : ""}
                >
                  {l.label}
                </span>,
                <span key="n" className="text-[11px] text-muted">
                  {l.note}
                </span>,
                <span
                  key="v"
                  className={`tnum ${l.sign < 0 ? "text-neutral-400" : ""}`}
                >
                  {l.sign < 0 ? "−" : ""}
                  {num(Math.abs(l.value))}
                </span>,
              ])}
            />
          ) : (
            <p className="text-[12px] text-faint">
              Quantification unavailable for this period.
            </p>
          )}
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            Conversions use the molecular ratio 44/12 = {CO2_PER_C.toFixed(3)}.
            Uncertainty is propagated across pools in quadrature and capped at{" "}
            {(project.params.maxUncertaintyDeduction * 100).toFixed(0)} % of net
            mitigation; a further {project.bufferPct} % is contributed to the buffer
            pool to cover non-permanence risk.
          </p>
        </section>

        <section className="mt-6">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            7 · Verification
          </h3>
          {report.verification ? (
            <>
              <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
                <KV k="Verification body" v={report.verification.body} />
                <KV k="Lead auditor" v={report.verification.leadAuditor} />
                <KV k="Opened" v={dateShort(report.verification.startedOn)} />
                <KV
                  k="Completed"
                  v={
                    report.verification.completedOn
                      ? dateShort(report.verification.completedOn)
                      : "In progress"
                  }
                />
                <KV
                  k="Findings raised"
                  v={`${report.verification.findings.length} (${report.verification.findings.filter((f) => f.status === "open").length} open)`}
                />
                <KV
                  k="Opinion"
                  v={
                    report.verification.opinion
                      ? titleCase(report.verification.opinion)
                      : "Pending"
                  }
                />
              </div>
              {report.verification.statement && (
                <blockquote className="mt-3 border-l-2 border-accent/50 pl-3 text-[12.5px] italic leading-relaxed text-ink/90">
                  “{report.verification.statement}”
                </blockquote>
              )}
              <div className="mt-3">
                <Table
                  head={["Requirement", "Reference", "Result"]}
                  rows={report.verification.checklist.map((c) => [
                    c.requirement,
                    c.ref,
                    <Badge
                      key="s"
                      tone={
                        c.state === "pass"
                          ? "emerald"
                          : c.state === "fail"
                            ? "rose"
                            : "amber"
                      }
                    >
                      {c.state}
                    </Badge>,
                  ])}
                />
              </div>
            </>
          ) : (
            <p className="text-[12px] text-faint">
              No verification has been opened for this monitoring period yet.
            </p>
          )}
        </section>

        <section className="mt-6 border-t border-line pt-4">
          <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-accent">
            8 · Conclusion
          </h3>
          <p className="text-[12.5px] leading-relaxed text-ink/90">
            For the period {dateShort(campaign.periodStart)} to{" "}
            {dateShort(campaign.periodEnd)}, {project.name} reports{" "}
            <span className="tnum font-semibold">
              {num(report.batch?.net ?? 0)} tCO₂e
            </span>{" "}
            of net anthropogenic greenhouse-gas removals after leakage, uncertainty
            and buffer-pool deductions, across {num(report.areaHa)} hectares. The
            reported values are derived from{" "}
            {num(report.observations.length)} plot-level measurements held in the MRV
            platform and are traceable to the individual survey records.
          </p>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            {[
              ["Project developer", project.proponent],
              ["Verifier", report.verification?.body ?? "Pending"],
            ].map(([role, name]) => (
              <div key={role}>
                <div className="h-10 border-b border-line" />
                <p className="mt-1 text-[11px] text-muted">{role}</p>
                <p className="text-[12px]">{name}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-6 border-t border-line pt-3 text-[10.5px] text-faint">
          {BRAND.reportFooter} · generated on{" "}
          {dateShort(new Date().toISOString())} · document {project.code}-MR-
          {campaign.vintage}-v1 · all figures recomputed from the stored dataset at
          generation time.
        </footer>
      </article>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <ReportsInner />
    </Suspense>
  );
}
