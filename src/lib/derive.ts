import {
  CO2_PER_C,
  DEFAULT_OPTIONS,
  computeCredits,
  dataQualityScore,
  projectSeries,
  projectStock,
} from "./carbon";
import type { Campaign, Dataset, Ecosystem, Project } from "./types";

export interface ProjectRow {
  project: Project;
  areaHa: number;
  cMgHa: number;
  stockCo2e: number;
  burialMgCYr: number;
  issued: number;
  retired: number;
  pending: number;
  campaigns: Campaign[];
  lastSeries: ReturnType<typeof projectSeries>[number] | null;
  series: ReturnType<typeof projectSeries>;
  quality: number;
  sites: number;
  plots: number;
}

export function campaignShape(data: Dataset, projectId: string) {
  return data.campaigns
    .filter((c) => c.projectId === projectId)
    .map((c) => ({
      id: c.id,
      vintage: c.vintage,
      periodEnd: c.periodEnd,
      status: c.status,
    }));
}

export function projectRows(data: Dataset): ProjectRow[] {
  return data.projects.map((project) => {
    const sites = data.sites.filter((s) => s.projectId === project.id);
    const siteIds = sites.map((s) => s.id);
    const plots = data.plots.filter((pl) => siteIds.includes(pl.siteId));
    const campaigns = data.campaigns.filter((c) => c.projectId === project.id);
    const stock = projectStock(project, data.sites, data.plots, data.observations);
    const series = projectSeries(
      project,
      data.sites,
      data.plots,
      data.observations,
      campaignShape(data, project.id),
    );
    const issuances = data.issuances.filter((i) => i.projectId === project.id);
    const last = campaigns
      .slice()
      .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
    const plotIds = new Set(plots.map((p) => p.id));
    const obs = data.observations.filter((o) => plotIds.has(o.plotId));
    const verified = campaigns.some((c) => c.status === "verified");

    return {
      project,
      areaHa: stock.areaHa,
      cMgHa: stock.cMgHa,
      stockCo2e: stock.totalCo2eMg,
      burialMgCYr: stock.burialMgCYr,
      issued: issuances.reduce((a, i) => a + i.netT, 0),
      retired: issuances
        .filter((i) => i.status === "retired")
        .reduce((a, i) => a + i.netT, 0),
      pending: campaigns.filter(
        (c) => c.status === "submitted" || c.status === "under-review",
      ).length,
      campaigns,
      series,
      lastSeries: series[series.length - 1] ?? null,
      quality: dataQualityScore({
        plotsPlanned: last?.plotsPlanned ?? 0,
        plotsSurveyed: last?.plotsSurveyed ?? 0,
        completenessPct: last?.completenessPct ?? 0,
        gpsAccuracyM:
          obs.reduce((a, o) => a + o.gpsAccuracyM, 0) / Math.max(obs.length, 1),
        hasSoilCores: obs.some((o) => o.soilCores.length > 0),
        hasPhotos: obs.some((o) => o.photoCount > 0),
        verified,
      }),
      sites: sites.length,
      plots: plots.length,
    };
  });
}

export interface Portfolio {
  rows: ProjectRow[];
  areaHa: number;
  stockCo2e: number;
  issued: number;
  retired: number;
  bufferPool: number;
  pending: number;
  annualRemovals: number;
  byEcosystem: { ecosystem: Ecosystem; areaHa: number; stockCo2e: number }[];
  vintageTotals: { vintage: string; gross: number; net: number }[];
  quality: number;
  sites: number;
  plots: number;
  obs: number;
}

export function portfolio(data: Dataset): Portfolio {
  const rows = projectRows(data);
  const byEco = new Map<Ecosystem, { areaHa: number; stockCo2e: number }>();
  const vintages = new Map<string, { gross: number; net: number }>();

  for (const r of rows) {
    const cur = byEco.get(r.project.ecosystem) ?? { areaHa: 0, stockCo2e: 0 };
    byEco.set(r.project.ecosystem, {
      areaHa: cur.areaHa + r.areaHa,
      stockCo2e: cur.stockCo2e + r.stockCo2e,
    });
  }
  for (const i of data.issuances) {
    const cur = vintages.get(i.vintage) ?? { gross: 0, net: 0 };
    vintages.set(i.vintage, {
      gross: cur.gross + i.grossT,
      net: cur.net + i.netT,
    });
  }

  const annualRemovals = rows.reduce(
    (a, r) => a + (r.burialMgCYr * CO2_PER_C + (r.lastSeries?.deltaCo2eMg ?? 0)),
    0,
  );

  return {
    rows,
    areaHa: rows.reduce((a, r) => a + r.areaHa, 0),
    stockCo2e: rows.reduce((a, r) => a + r.stockCo2e, 0),
    issued: rows.reduce((a, r) => a + r.issued, 0),
    retired: rows.reduce((a, r) => a + r.retired, 0),
    bufferPool: data.issuances.reduce((a, i) => a + i.bufferT, 0),
    pending: rows.reduce((a, r) => a + r.pending, 0),
    annualRemovals,
    byEcosystem: [...byEco.entries()].map(([ecosystem, v]) => ({ ecosystem, ...v })),
    vintageTotals: [...vintages.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([vintage, v]) => ({ vintage, ...v })),
    quality: Math.round(
      rows.reduce((a, r) => a + r.quality, 0) / Math.max(rows.length, 1),
    ),
    sites: data.sites.length,
    plots: data.plots.length,
    obs: data.observations.length,
  };
}

/** Credit calculation for one campaign, using the same path as the registry. */
export function creditsForCampaign(data: Dataset, campaign: Campaign) {
  const project = data.projects.find((p) => p.id === campaign.projectId);
  if (!project) return null;
  const sites = data.sites.filter((s) => s.projectId === project.id);
  const areaHa = sites.reduce((a, s) => a + s.areaHa, 0);
  const series = projectSeries(
    project,
    data.sites,
    data.plots,
    data.observations,
    campaignShape(data, project.id),
    DEFAULT_OPTIONS,
  );
  const idx = series.findIndex((s) => s.campaignId === campaign.id);
  const pt = series[idx];
  if (!pt) return null;
  return computeCredits({
    project,
    areaHa,
    years: pt.years,
    biomassDeltaMgC: pt.biomassDeltaMgC,
    soilAccrualMgC: pt.soilAccrualCo2eMg / CO2_PER_C,
    firstPeriod: idx === 0,
  });
}
