/**
 * MRV-BlueCarbon — carbon accounting engine
 *
 * Everything here is a pure function so results are reproducible, testable and
 * can be shown step-by-step in the UI (the "M" of MRV has to be auditable).
 *
 * Sign convention: positive values are *removals* / *avoided emissions*.
 * All stocks are Mg (tonnes) of carbon per hectare unless stated otherwise.
 */

import type {
  CarbonParams,
  Ecosystem,
  Observation,
  Plot,
  Project,
  Quadrat,
  Site,
  Stem,
  SoilCore,
} from "./types";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** CO₂ : C molecular mass ratio */
export const CO2_PER_C = 44 / 12;

/** g m⁻² → Mg ha⁻¹ */
const G_M2_TO_MG_HA = 0.01;

export const ECOSYSTEM_LABEL: Record<Ecosystem, string> = {
  mangrove: "Mangrove",
  seagrass: "Seagrass",
  saltmarsh: "Saltmarsh",
};

export const ECOSYSTEM_COLOR: Record<Ecosystem, string> = {
  mangrove: "#10b981",
  seagrass: "#22d3ee",
  saltmarsh: "#a3e635",
};

/**
 * Wood density (g cm⁻³, dry mass / green volume).
 * Sources: Komiyama et al. 2005; Chave et al. 2006 mangrove supplements;
 * Zanne et al. 2009 global wood density database.
 */
export const WOOD_DENSITY: Record<string, number> = {
  "Rhizophora mucronata": 0.85,
  "Rhizophora apiculata": 0.8,
  "Rhizophora stylosa": 0.82,
  "Bruguiera cylindrica": 0.75,
  "Bruguiera gymnorrhiza": 0.72,
  "Ceriops tagal": 0.8,
  "Ceriops decandra": 0.78,
  "Kandelia candel": 0.65,
  "Sonneratia alba": 0.55,
  "Sonneratia caseolaris": 0.52,
  "Sonneratia griffithii": 0.58,
  "Avicennia marina": 0.65,
  "Avicennia officinalis": 0.62,
  "Avicennia alba": 0.6,
  "Excoecaria agallocha": 0.52,
  "Aegiceras corniculatum": 0.6,
  "Lumnitzera racemosa": 0.68,
  "Heritiera fomes": 0.6,
  "Xylocarpus granatum": 0.68,
  "Nypa fruticans": 0.5,
  "Acanthus ilicifolius": 0.55,
  "Phoenix paludosa": 0.6,
  "Spartina alterniflora": 0.45,
  "Sarcocornia quinqueflora": 0.4,
};

/** Wood density used when a species is not in the table. */
export const DEFAULT_WOOD_DENSITY = 0.65;

/** Seagrass species commonly surveyed in the Indo-Pacific. */
export const SEAGRASS_SPECIES = [
  "Cymodocea serrulata",
  "Cymodocea rotundata",
  "Halodule uninervis",
  "Halodule pinifolia",
  "Halophila ovalis",
  "Halophila beccarii",
  "Thalassia hemprichii",
  "Enhalus acoroides",
  "Syringodium isoetifolium",
  "Zostera marina",
  "Posidonia oceanica",
];

export const SALTMARSH_SPECIES = [
  "Spartina alterniflora",
  "Sarcocornia quinqueflora",
  "Suaeda maritima",
  "Salicornia europaea",
  "Juncus maritimus",
  "Phragmites australis",
  "Sesuvium portulacastrum",
  "Aeluropus lagopoides",
];

export const MANGROVE_SPECIES = Object.keys(WOOD_DENSITY).filter(
  (s) => !SALTMARSH_SPECIES.includes(s),
);

export function woodDensity(species: string): number {
  return WOOD_DENSITY[species] ?? DEFAULT_WOOD_DENSITY;
}

/* ------------------------------------------------------------------ */
/* Default accounting parameters                                       */
/* ------------------------------------------------------------------ */

export function defaultParams(ecosystem: Ecosystem): CarbonParams {
  switch (ecosystem) {
    case "mangrove":
      return {
        carbonFraction: 0.47,
        rootShootRatio: 0.5,
        soilCarbonStockMgCHa: 250,
        uncertainty: { agb: 0.15, bgb: 0.25, soil: 0.3, baseline: 0.2 },
        maxUncertaintyDeduction: 0.3,
      };
    case "seagrass":
      return {
        carbonFraction: 0.35,
        rootShootRatio: 1.2,
        soilCarbonStockMgCHa: 140,
        uncertainty: { agb: 0.25, bgb: 0.35, soil: 0.35, baseline: 0.25 },
        maxUncertaintyDeduction: 0.35,
      };
    case "saltmarsh":
      return {
        carbonFraction: 0.42,
        rootShootRatio: 1.6,
        soilCarbonStockMgCHa: 200,
        uncertainty: { agb: 0.2, bgb: 0.3, soil: 0.35, baseline: 0.25 },
        maxUncertaintyDeduction: 0.3,
      };
  }
}

/* ------------------------------------------------------------------ */
/* Biomass equations                                                   */
/* ------------------------------------------------------------------ */

/**
 * Above-ground biomass of a single stem, kg dry mass.
 * Komiyama et al. (2005) general mangrove allometry:
 *   AGB = 0.251 · ρ · D^2.46   (D = diameter at breast height, cm)
 */
export function stemAgbKg(stem: Stem): number {
  const rho = woodDensity(stem.species);
  return 0.251 * rho * Math.pow(stem.dbhCm, 2.46);
}

/**
 * Below-ground biomass of a single stem, kg dry mass.
 * `ratio` method applies the ecosystem root:shoot ratio;
 * `allometric` uses Komiyama et al. (2005): BGB = 0.199 · ρ^0.899 · D^2.22
 */
export function stemBgbKg(
  stem: Stem,
  method: "ratio" | "allometric",
  rootShootRatio: number,
): number {
  if (method === "allometric") {
    const rho = woodDensity(stem.species);
    return 0.199 * Math.pow(rho, 0.899) * Math.pow(stem.dbhCm, 2.22);
  }
  return stemAgbKg(stem) * rootShootRatio;
}

/** Basal area of a stem, m². */
export function stemBasalAreaM2(stem: Stem): number {
  const r = stem.dbhCm / 2 / 100;
  return Math.PI * r * r;
}

/** Above-ground biomass of a quadrat, g DW m⁻². */
export function quadratAgbGPerM2(q: Quadrat): number {
  if (q.agbGPerM2 != null) return q.agbGPerM2;
  if (q.shootDensityPerM2 != null && q.shootMassG != null) {
    return q.shootDensityPerM2 * q.shootMassG;
  }
  // Generic cover-based fallback used by rapid-assessment protocols:
  // 100 % cover of a dense sward ≈ 350 g DW m⁻² for seagrass, 900 g for marsh.
  const maxG = q.canopyHeightCm != null && q.canopyHeightCm > 60 ? 900 : 350;
  return (q.coverPct / 100) * maxG;
}

export function quadratBgbGPerM2(q: Quadrat): number {
  if (q.bgbGPerM2 != null) return q.bgbGPerM2;
  return 0;
}

/** Soil organic carbon stock of a core, Mg C ha⁻¹ over the sampled depth. */
export function soilStockMgCHa(core: SoilCore): number {
  return core.depthCm * core.bulkDensityGPerCm3 * core.organicCarbonPct;
}

/**
 * Soil carbon burial rate implied by a core, Mg C ha⁻¹ yr⁻¹.
 * Accretion (mm yr⁻¹) × bulk density × organic-carbon fraction.
 */
export function soilBurialMgCHaYr(core: SoilCore): number {
  return (
    (core.accretionMmPerYr / 10) *
    core.bulkDensityGPerCm3 *
    core.organicCarbonPct
  );
}

/* ------------------------------------------------------------------ */
/* Observation → per-hectare carbon pools                              */
/* ------------------------------------------------------------------ */

export interface Pools {
  agbMgHa: number;
  bgbMgHa: number;
  biomassMgHa: number;
  biomassCMgHa: number;
  soilCMgHa: number;
  soilBurialMgCHaYr: number;
  totalCMgHa: number;
  co2eMgHa: number;
  /** plot-level descriptors used by the UI */
  stemsPerHa: number;
  basalAreaM2Ha: number;
  meanDbhCm: number;
  meanHeightM: number;
  meanCoverPct: number;
  shootDensityPerM2: number;
  speciesRichness: number;
  survivalPct: number;
}

export interface ComputeOptions {
  bgbMethod: "ratio" | "allometric";
}

export const DEFAULT_OPTIONS: ComputeOptions = { bgbMethod: "ratio" };

/**
 * Aggregate one plot visit into carbon pools per hectare.
 * Works for every ecosystem: woody stems (mangrove, woody marsh) and
 * quadrats (seagrass, herbaceous marsh) are both handled and summed.
 */
export function computePools(
  obs: Observation,
  ecosystem: Ecosystem,
  plotAreaM2: number,
  params: CarbonParams,
  opts: ComputeOptions = DEFAULT_OPTIONS,
): Pools {
  const ha = Math.max(plotAreaM2, 1e-6) / 10_000;
  const liveStems = obs.stems.filter((s) => s.vigour === "live");

  // --- woody biomass (kg) → Mg ha⁻¹
  let agbKg = 0;
  let bgbKg = 0;
  for (const s of liveStems) {
    agbKg += stemAgbKg(s);
    bgbKg += stemBgbKg(s, opts.bgbMethod, params.rootShootRatio);
  }

  // --- herbaceous / meadow biomass (g m⁻²) → Mg ha⁻¹
  let herbAgbMgHa = 0;
  let herbBgbMgHa = 0;
  let coverSum = 0;
  let shootSum = 0;
  let quadratCount = 0;
  for (const q of obs.quadrats) {
    herbAgbMgHa += quadratAgbGPerM2(q) * G_M2_TO_MG_HA;
    herbBgbMgHa += quadratBgbGPerM2(q) * G_M2_TO_MG_HA;
    coverSum += q.coverPct;
    shootSum += q.shootDensityPerM2 ?? 0;
    quadratCount += 1;
  }
  if (quadratCount > 0) {
    herbAgbMgHa /= quadratCount;
    herbBgbMgHa /= quadratCount;
  }

  const agbMgHa = agbKg / 1000 / ha + herbAgbMgHa;
  // Herbaceous below-ground biomass: use the harvested value when available,
  // otherwise scale the above-ground harvest by the root:shoot ratio.
  const herbBgb =
    herbBgbMgHa > 0 ? herbBgbMgHa : herbAgbMgHa * params.rootShootRatio;
  const bgbMgHa = bgbKg / 1000 / ha + herbBgb;

  const biomassMgHa = agbMgHa + bgbMgHa;
  const biomassCMgHa = biomassMgHa * params.carbonFraction;

  // --- soil
  let soilCMgHa = params.soilCarbonStockMgCHa;
  let soilBurial = 0;
  if (obs.soilCores.length > 0) {
    soilCMgHa =
      obs.soilCores.reduce((a, c) => a + soilStockMgCHa(c), 0) /
      obs.soilCores.length;
    soilBurial =
      obs.soilCores.reduce((a, c) => a + soilBurialMgCHaYr(c), 0) /
      obs.soilCores.length;
  }

  const totalCMgHa = biomassCMgHa + soilCMgHa;
  const species = new Set<string>();
  for (const s of obs.stems) species.add(s.species);
  for (const q of obs.quadrats) species.add(q.species);

  const dbhs = liveStems.map((s) => s.dbhCm);
  const heights = liveStems.map((s) => s.heightM);

  return {
    agbMgHa,
    bgbMgHa,
    biomassMgHa,
    biomassCMgHa,
    soilCMgHa,
    soilBurialMgCHaYr: soilBurial,
    totalCMgHa,
    co2eMgHa: totalCMgHa * CO2_PER_C,
    stemsPerHa: obs.stems.length / ha,
    basalAreaM2Ha:
      liveStems.reduce((a, s) => a + stemBasalAreaM2(s), 0) / ha,
    meanDbhCm: dbhs.length ? mean(dbhs) : 0,
    meanHeightM: heights.length ? mean(heights) : 0,
    meanCoverPct: quadratCount ? coverSum / quadratCount : 0,
    shootDensityPerM2: quadratCount ? shootSum / quadratCount : 0,
    speciesRichness: species.size,
    survivalPct: obs.stems.length
      ? (liveStems.length / obs.stems.length) * 100
      : obs.quadrats.length
        ? (coverSum / quadratCount)
        : 0,
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/* ------------------------------------------------------------------ */
/* Aggregation: plot → site → project                                  */
/* ------------------------------------------------------------------ */

export interface StockResult {
  /** area-weighted mean carbon, Mg C ha⁻¹ */
  cMgHa: number;
  biomassCMgHa: number;
  soilCMgHa: number;
  soilBurialMgCHaYr: number;
  /** absolute stocks over the whole area, Mg C */
  biomassCMg: number;
  soilCMg: number;
  totalCMg: number;
  totalCo2eMg: number;
  areaHa: number;
  /** per-plot detail for drill-down */
  plots: { plotId: string; code: string; cMgHa: number; pools: Pools }[];
}

/** Weight plots by area to get a site-level stock. */
export function aggregate(
  entries: { areaM2: number; pools: Pools }[],
  areaHa: number,
): { biomassCMgHa: number; soilCMgHa: number; burial: number } {
  if (entries.length === 0) {
    return { biomassCMgHa: 0, soilCMgHa: 0, burial: 0 };
  }
  const totalW = entries.reduce((a, e) => a + e.areaM2, 0) || 1;
  let b = 0;
  let s = 0;
  let bu = 0;
  for (const e of entries) {
    const w = e.areaM2 / totalW;
    b += e.pools.biomassCMgHa * w;
    s += e.pools.soilCMgHa * w;
    bu += e.pools.soilBurialMgCHaYr * w;
  }
  return { biomassCMgHa: b, soilCMgHa: s, burial: bu };
}

/**
 * Carbon stock of a site at the time of the *latest* observation per plot.
 */
export function siteStock(
  site: Site,
  plots: Plot[],
  observations: Observation[],
  params: CarbonParams,
  opts: ComputeOptions = DEFAULT_OPTIONS,
): StockResult {
  const sitePlots = plots.filter((p) => p.siteId === site.id);
  const entries: { areaM2: number; pools: Pools }[] = [];
  const detail: StockResult["plots"] = [];

  for (const plot of sitePlots) {
    const plotObs = observations
      .filter((o) => o.plotId === plot.id)
      .sort((a, b) => b.ts.localeCompare(a.ts));
    if (plotObs.length === 0) continue;
    const pools = computePools(
      plotObs[0],
      site.ecosystem,
      plot.areaM2,
      params,
      opts,
    );
    entries.push({ areaM2: plot.areaM2, pools });
    detail.push({ plotId: plot.id, code: plot.code, cMgHa: pools.totalCMgHa, pools });
  }

  const { biomassCMgHa, soilCMgHa, burial } = aggregate(entries, site.areaHa);
  // Plots sample the site: scale the sampled mean to the whole mapped area.
  const areaHa = site.areaHa;
  const biomassCMg = biomassCMgHa * areaHa;
  const soilCMg = soilCMgHa * areaHa;
  const totalCMg = biomassCMg + soilCMg;

  return {
    cMgHa: biomassCMgHa + soilCMgHa,
    biomassCMgHa,
    soilCMgHa,
    soilBurialMgCHaYr: burial,
    biomassCMg,
    soilCMg,
    totalCMg,
    totalCo2eMg: totalCMg * CO2_PER_C,
    areaHa,
    plots: detail.sort((a, b) => b.cMgHa - a.cMgHa),
  };
}

export interface ProjectStock {
  projectId: string;
  areaHa: number;
  biomassCMg: number;
  soilCMg: number;
  totalCMg: number;
  totalCo2eMg: number;
  cMgHa: number;
  burialMgCYr: number;
  sites: (Site & { stock: StockResult })[];
}

export function projectStock(
  project: Project,
  sites: Site[],
  plots: Plot[],
  observations: Observation[],
  opts: ComputeOptions = DEFAULT_OPTIONS,
): ProjectStock {
  const projectSites = sites.filter((s) => s.projectId === project.id);
  const enriched = projectSites.map((s) => ({
    ...s,
    stock: siteStock(s, plots, observations, project.params, opts),
  }));
  const areaHa = enriched.reduce((a, s) => a + s.stock.areaHa, 0);
  const biomassCMg = enriched.reduce((a, s) => a + s.stock.biomassCMg, 0);
  const soilCMg = enriched.reduce((a, s) => a + s.stock.soilCMg, 0);
  const burialMgCYr = enriched.reduce(
    (a, s) => a + s.stock.soilBurialMgCHaYr * s.stock.areaHa,
    0,
  );
  const totalCMg = biomassCMg + soilCMg;
  return {
    projectId: project.id,
    areaHa,
    biomassCMg,
    soilCMg,
    totalCMg,
    totalCo2eMg: totalCMg * CO2_PER_C,
    cMgHa: areaHa ? totalCMg / areaHa : 0,
    burialMgCYr,
    sites: enriched,
  };
}

/* ------------------------------------------------------------------ */
/* Stock change between monitoring campaigns                           */
/* ------------------------------------------------------------------ */

export interface SeriesPoint {
  t: string;
  vintage: string;
  campaignId: string;
  biomassCMg: number;
  soilCMg: number;
  totalCMg: number;
  totalCo2eMg: number;
  /** biomass stock change vs. the previous monitoring point, Mg C */
  biomassDeltaMgC: number;
  /** stock change vs. previous monitoring point, Mg CO₂e */
  deltaCo2eMg: number;
  /** soil burial accrued since the previous point, Mg CO₂e */
  soilAccrualCo2eMg: number;
  years: number;
  status: string;
}

/** Stock over time: recompute the project at the date of every campaign. */
export function projectSeries(
  project: Project,
  sites: Site[],
  plots: Plot[],
  observations: Observation[],
  campaigns: { id: string; vintage: string; periodEnd: string; status: string }[],
  opts: ComputeOptions = DEFAULT_OPTIONS,
  /** optional project-start ("t₀") reference so the first vintage has a delta */
  t0?: { date: string; biomassCMg: number },
): SeriesPoint[] {
  const sorted = [...campaigns].sort((a, b) =>
    a.periodEnd.localeCompare(b.periodEnd),
  );
  const out: SeriesPoint[] = [];
  let prevBiomass: number | null = t0 ? t0.biomassCMg : null;
  let prevSoil: number | null = null;
  let prevT: string | null = t0 ? t0.date : null;

  for (const c of sorted) {
    const obsUpTo = observations.filter((o) => o.ts <= c.periodEnd);
    if (obsUpTo.length === 0) continue;
    const st = projectStock(project, sites, plots, obsUpTo, opts);
    const years = prevT
      ? Math.max(
          (Date.parse(c.periodEnd) - Date.parse(prevT)) /
            (365.25 * 24 * 3600 * 1000),
          1 / 365.25,
        )
      : 1;
    const soilAccrual = st.burialMgCYr * years;

    const biomassDelta = prevBiomass == null ? 0 : st.biomassCMg - prevBiomass;
    const deltaCo2e =
      prevBiomass == null ? 0 : (biomassDelta + soilAccrual) * CO2_PER_C;

    out.push({
      t: c.periodEnd,
      vintage: c.vintage,
      campaignId: c.id,
      biomassCMg: st.biomassCMg,
      soilCMg: st.soilCMg,
      totalCMg: st.totalCMg,
      totalCo2eMg: st.totalCo2eMg,
      biomassDeltaMgC: biomassDelta,
      deltaCo2eMg: deltaCo2e,
      soilAccrualCo2eMg: soilAccrual * CO2_PER_C,
      years,
      status: c.status,
    });
    prevBiomass = st.biomassCMg;
    prevSoil = st.soilCMg;
    prevT = c.periodEnd;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Credit calculation for one monitoring period                        */
/* ------------------------------------------------------------------ */

export interface CreditLine {
  key: string;
  label: string;
  value: number;
  sign: 1 | -1;
  note: string;
}

export interface CreditBatch {
  areaHa: number;
  years: number;
  lines: CreditLine[];
  gross: number;
  baseline: number;
  leakage: number;
  subtotal: number;
  uncertaintyRel: number;
  uncertainty: number;
  buffer: number;
  net: number;
  netPerHaYr: number;
}

/**
 * Net anthropogenic CO₂e removals for one monitoring period, in tCO₂e.
 *
 *   net = (ΔC_project + ΔC_baseline) · (1 − leakage)
 *         − uncertainty deduction
 *         − buffer-pool contribution
 *
 * Uncertainty is propagated across pools in quadrature and converted to a
 * one-sided 90 % interval (z = 1.645), then capped by the methodology.
 */
export function computeCredits(input: {
  project: Project;
  areaHa: number;
  years: number;
  /** biomass stock change over the period, Mg C (positive = gain) */
  biomassDeltaMgC: number;
  /** soil carbon accrual over the period, Mg C */
  soilAccrualMgC: number;
  /** measured soil burial uncertainty is folded into the soil pool */
  firstPeriod: boolean;
}): CreditBatch {
  const { project, areaHa, years, biomassDeltaMgC, soilAccrualMgC } = input;
  const p = project.params;

  const projectBiomassCo2e = biomassDeltaMgC * CO2_PER_C;
  const projectSoilCo2e = soilAccrualMgC * CO2_PER_C;
  const projectRemovals = projectBiomassCo2e + projectSoilCo2e;

  const baselineBiomass =
    project.baseline.biomassLossRateMgCHaYr * areaHa * years * CO2_PER_C;
  const baselineSoil =
    project.baseline.soilLossRateMgCHaYr * areaHa * years * CO2_PER_C;
  const baselineOneOff = input.firstPeriod
    ? project.baseline.oneOffStockLossMgCHa * areaHa * CO2_PER_C
    : 0;
  const baseline = baselineBiomass + baselineSoil + baselineOneOff;

  const gross = projectRemovals + baseline;
  const leakage = gross * (project.leakagePct / 100);
  const subtotal = gross - leakage;

  // --- uncertainty propagation
  const u = p.uncertainty;
  const terms = [
    { v: projectBiomassCo2e * (u.agb * 0.6 + u.bgb * 0.4), rel: u.agb },
    { v: projectSoilCo2e, rel: u.soil },
    { v: baseline, rel: u.baseline },
  ];
  const sigma = Math.sqrt(terms.reduce((a, t) => a + t.v * t.v * t.rel * t.rel, 0));
  const denom = Math.abs(subtotal) || 1;
  const uncertaintyRel = Math.min((1.645 * sigma) / denom, 1);
  const cappedRel = Math.min(
    uncertaintyRel,
    p.maxUncertaintyDeduction,
  );
  const uncertainty = subtotal * cappedRel;

  const afterUncertainty = subtotal - uncertainty;
  const buffer = afterUncertainty * (project.bufferPct / 100);
  const net = afterUncertainty - buffer;

  const lines: CreditLine[] = [
    {
      key: "biomass",
      label: "Biomass stock change (project scenario)",
      value: projectBiomassCo2e,
      sign: 1,
      note: `Δ above + below-ground biomass × ${CO2_PER_C.toFixed(3)} (44/12)`,
    },
    {
      key: "soil",
      label: "Soil carbon accrual (project scenario)",
      value: projectSoilCo2e,
      sign: 1,
      note: "Accretion rate × bulk density × OC fraction × years",
    },
    {
      key: "baseline-biomass",
      label: "Baseline biomass loss avoided",
      value: baselineBiomass,
      sign: 1,
      note: `${project.baseline.biomassLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹ baseline loss`,
    },
    {
      key: "baseline-soil",
      label: "Baseline soil carbon loss avoided",
      value: baselineSoil,
      sign: 1,
      note: `${project.baseline.soilLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹ baseline loss`,
    },
    ...(baselineOneOff > 0
      ? [
          {
            key: "baseline-oneoff",
            label: "One-off baseline stock loss avoided",
            value: baselineOneOff,
            sign: 1 as const,
            note: "Stock released at the start of the crediting period",
          },
        ]
      : []),
    {
      key: "gross",
      label: "Gross mitigation",
      value: gross,
      sign: 1,
      note: "Project removals + baseline avoided emissions",
    },
    {
      key: "leakage",
      label: "Leakage deduction",
      value: -leakage,
      sign: -1,
      note: `${project.leakagePct}% of gross (displaced activity)`,
    },
    {
      key: "uncertainty",
      label: "Uncertainty deduction",
      value: -uncertainty,
      sign: -1,
      note: `${(cappedRel * 100).toFixed(1)}% — quadrature propagation, 90% CI, capped at ${(p.maxUncertaintyDeduction * 100).toFixed(0)}%`,
    },
    {
      key: "buffer",
      label: "Buffer pool contribution",
      value: -buffer,
      sign: -1,
      note: `${project.bufferPct}% for non-permanence risk`,
    },
    {
      key: "net",
      label: "Net issuable credits",
      value: net,
      sign: 1,
      note: "tCO₂e eligible for issuance this vintage",
    },
  ];

  return {
    areaHa,
    years,
    lines,
    gross,
    baseline,
    leakage,
    subtotal,
    uncertaintyRel: cappedRel,
    uncertainty,
    buffer,
    net,
    netPerHaYr: areaHa && years ? net / areaHa / years : 0,
  };
}

/** MRV completeness / data-quality score for a project (0–100). */
export function dataQualityScore(input: {
  plotsPlanned: number;
  plotsSurveyed: number;
  completenessPct: number;
  gpsAccuracyM: number;
  hasSoilCores: boolean;
  hasPhotos: boolean;
  verified: boolean;
}): number {
  const coverage = input.plotsPlanned
    ? Math.min(input.plotsSurveyed / input.plotsPlanned, 1)
    : 0;
  const gps = input.gpsAccuracyM <= 5 ? 1 : input.gpsAccuracyM <= 10 ? 0.7 : 0.4;
  const score =
    coverage * 35 +
    (input.completenessPct / 100) * 25 +
    gps * 15 +
    (input.hasSoilCores ? 12 : 0) +
    (input.hasPhotos ? 8 : 0) +
    (input.verified ? 5 : 0);
  return Math.round(Math.min(score, 100));
}
