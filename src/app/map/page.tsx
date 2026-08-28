"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { ECOSYSTEM_COLOR, ECOSYSTEM_LABEL, computePools } from "@/lib/carbon";
import { MapView, type MapSite } from "@/components/MapView";
import { Donut } from "@/components/charts";
import {
  Badge,
  Card,
  KV,
  Progress,
  SectionTitle,
  Select,
  Stat,
  Table,
} from "@/components/ui";
import { num, tCO2e } from "@/lib/format";
import type { Ecosystem } from "@/lib/types";

export default function MapPage() {
  const { data, ready } = useStore();
  const [projectId, setProjectId] = useState("all");
  const [eco, setEco] = useState<"all" | Ecosystem>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const enriched = useMemo(() => {
    if (!data) return [];
    const out: MapSite[] = [];
    for (const site of data.sites) {
      const project = data.projects.find((p) => p.id === site.projectId);
      if (!project) continue;
      if (projectId !== "all" && project.id !== projectId) continue;
      if (eco !== "all" && site.ecosystem !== eco) continue;
      const sitePlots = data.plots.filter((p) => p.siteId === site.id);
      const plotIds = new Set(sitePlots.map((p) => p.id));
      const obs = data.observations
        .filter((o) => plotIds.has(o.plotId))
        .sort((a, b) => b.ts.localeCompare(a.ts));
      const latestByPlot = new Map<string, (typeof obs)[number]>();
      for (const o of obs) if (!latestByPlot.has(o.plotId)) latestByPlot.set(o.plotId, o);
      const entries = [...latestByPlot.values()].map((o) => {
        const plot = sitePlots.find((p) => p.id === o.plotId)!;
        return computePools(o, site.ecosystem, plot.areaM2, project.params);
      });
      const cMgHa = entries.length
        ? entries.reduce((a, e) => a + e.totalCMgHa, 0) / entries.length
        : 0;
      out.push({
        ...site,
        projectName: project.name,
        projectCode: project.code,
        cMgHa,
        condition: Math.min(1, cMgHa / 600),
      });
    }
    return out;
  }, [data, projectId, eco]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading geospatial view…</div>;
  }

  const selectedSite = enriched.find((s) => s.id === selected) ?? null;
  const selectedProject = selectedSite
    ? data.projects.find((p) => p.id === selectedSite.projectId)
    : null;
  const plots = selectedSite
    ? data.plots.filter((p) => p.siteId === selectedSite.id)
    : data.plots.filter((p) => enriched.some((s) => s.id === p.siteId));

  const areaByEco = (["mangrove", "seagrass", "saltmarsh"] as Ecosystem[])
    .map((e) => ({
      ecosystem: e,
      areaHa: enriched.filter((s) => s.ecosystem === e).reduce((a, s) => a + s.areaHa, 0),
    }))
    .filter((x) => x.areaHa > 0);

  const latestRs = data.remoteSensing
    .filter((r) => enriched.some((s) => s.id === r.siteId))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Geospatial view</h1>
          <p className="mt-1 text-[13px] text-muted">
            {enriched.length} sites · {enriched.reduce((a, s) => a + s.areaHa, 0).toLocaleString("en-IN")}{" "}
            ha · {plots.length} plots rendered
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All projects</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={eco}
            onChange={(e) => setEco(e.target.value as typeof eco)}
          >
            <option value="all">All ecosystems</option>
            <option value="mangrove">Mangrove</option>
            <option value="seagrass">Seagrass</option>
            <option value="saltmarsh">Saltmarsh</option>
          </Select>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-4">
        <Card className="lg:col-span-3">
          <MapView
            sites={enriched}
            plots={plots}
            height={520}
            selectedSiteId={selected}
            onSelect={(id) => setSelected(id === selected ? null : id)}
          />
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle title="Legend" />
            <div className="space-y-2">
              {(["mangrove", "seagrass", "saltmarsh"] as Ecosystem[]).map((e) => (
                <div key={e} className="flex items-center gap-2 text-[11.5px]">
                  <span
                    className="inline-block h-3 w-3 rounded"
                    style={{ background: ECOSYSTEM_COLOR[e], opacity: 0.55 }}
                  />
                  <span className="text-muted">{ECOSYSTEM_LABEL[e]}</span>
                  <span className="tnum ml-auto text-ink">
                    {num(
                      areaByEco.find((x) => x.ecosystem === e)?.areaHa ?? 0,
                    )}{" "}
                    ha
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2 border-t border-line pt-2 text-[11.5px]">
                <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
                <span className="text-muted">Permanent plot</span>
              </div>
            </div>
            {areaByEco.length > 0 && (
              <div className="mt-4">
                <Donut
                  size={110}
                  thickness={12}
                  segments={areaByEco.map((a) => ({
                    label: ECOSYSTEM_LABEL[a.ecosystem],
                    value: a.areaHa,
                    color: ECOSYSTEM_COLOR[a.ecosystem],
                  }))}
                />
              </div>
            )}
          </Card>

          {selectedSite && selectedProject ? (
            <Card>
              <SectionTitle
                title={selectedSite.name}
                sub={`${selectedSite.projectCode} · ${selectedSite.stratum}`}
                right={
                  <Link
                    href={`/projects/${selectedProject.id}`}
                    className="text-[11px] text-accent hover:underline"
                  >
                    Open project →
                  </Link>
                }
              />
              <div className="space-y-1">
                <KV k="Ecosystem" v={selectedSite.ecosystem} />
                <KV k="Area" v={`${num(selectedSite.areaHa)} ha`} mono />
                <KV
                  k="Carbon density"
                  v={`${num(selectedSite.cMgHa ?? 0, 0)} Mg C ha⁻¹`}
                  mono
                />
                <KV
                  k="Stock"
                  v={tCO2e((selectedSite.cMgHa ?? 0) * selectedSite.areaHa * (44 / 12))}
                  mono
                />
                <KV k="Established" v={String(selectedSite.establishedYear)} />
                <KV k="Prior land use" v={selectedSite.priorLandUse} />
                <KV k="Tidal range" v={`${selectedSite.tidalRangeM} m`} mono />
                <KV
                  k="Protected"
                  v={selectedSite.protectedArea ? "Yes" : "No"}
                />
                <KV
                  k="Centroid"
                  v={`${selectedSite.centroid.lat.toFixed(3)}, ${selectedSite.centroid.lon.toFixed(3)}`}
                  mono
                />
              </div>
              <div className="mt-3 space-y-1.5">
                <p className="text-[10.5px] uppercase tracking-wider text-muted">
                  Latest remote-sensing pass
                </p>
                {latestRs.filter((r) => r.siteId === selectedSite.id).slice(0, 1).map((r) => (
                  <div key={r.id} className="rounded-lg border border-line bg-canvas/40 p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11.5px] font-medium">{r.sensor}</span>
                      <span className="text-[10.5px] text-faint">{r.date}</span>
                    </div>
                    <div className="mt-1.5 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[10px] text-muted">NDVI</span>
                        <Progress value={r.ndvi * 100} tone="emerald" className="flex-1" />
                        <span className="tnum text-[10px]">{r.ndvi.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[10px] text-muted">Condition</span>
                        <Progress
                          value={r.conditionIndex * 100}
                          tone={r.conditionIndex > 0.7 ? "emerald" : "amber"}
                          className="flex-1"
                        />
                        <span className="tnum text-[10px]">
                          {(r.conditionIndex * 100).toFixed(0)}
                        </span>
                      </div>
                    </div>
                    {r.flags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.flags.map((f) => (
                          <Badge key={f} tone="amber">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card>
              <SectionTitle title="Site detail" />
              <p className="text-[12px] text-muted">
                Click any polygon to inspect its carbon density, plots and latest
                satellite pass.
              </p>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <SectionTitle
          title="Sites in view"
          sub="Carbon density is the mean of the most recent measurement in each plot"
        />
        <Table
          head={[
            "Site",
            "Project",
            "Ecosystem",
            "Area (ha)",
            "Plots",
            "Mg C ha⁻¹",
            "Stock (tCO₂e)",
            "Coordinates",
          ]}
          rows={enriched
            .sort((a, b) => (b.cMgHa ?? 0) - (a.cMgHa ?? 0))
            .map((s) => [
              <button
                key="n"
                onClick={() => setSelected(s.id)}
                className="text-left text-[12.5px] font-medium text-ink hover:text-accent"
              >
                {s.name}
                <span className="block text-[10.5px] text-faint">{s.code}</span>
              </button>,
              <span key="p" className="text-[11.5px] text-muted">
                {s.projectCode}
              </span>,
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
              <span key="a" className="tnum">
                {num(s.areaHa)}
              </span>,
              <span key="pl" className="tnum">
                {data.plots.filter((p) => p.siteId === s.id).length}
              </span>,
              <span key="c" className="tnum">
                {num(s.cMgHa ?? 0, 0)}
              </span>,
              <span key="t" className="tnum">
                {tCO2e((s.cMgHa ?? 0) * s.areaHa * (44 / 12))}
              </span>,
              <span key="x" className="tnum font-mono text-[11px] text-muted">
                {s.centroid.lat.toFixed(3)}, {s.centroid.lon.toFixed(3)}
              </span>,
            ])}
        />
      </Card>
    </div>
  );
}
