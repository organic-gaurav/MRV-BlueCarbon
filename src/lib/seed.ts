/**
 * MRV-BlueCarbon — synthetic dataset generator
 *
 * Everything is derived from a fixed seed, so the prototype boots with the
 * exact same (realistic) portfolio every time: no API keys, no network, but
 * the numbers are internally consistent and physically plausible.
 */

import {
  CO2_PER_C,
  DEFAULT_OPTIONS,
  computePools,
  computeCredits,
  defaultParams,
  projectSeries,
} from "./carbon";
import type {
  ActivityType,
  AuditAction,
  AuditEvent,
  Campaign,
  CampaignStatus,
  ChecklistItem,
  Dataset,
  Ecosystem,
  Finding,
  Issuance,
  Observation,
  Plot,
  Project,
  ProjectStatus,
  Quadrat,
  RemoteSensingPass,
  Site,
  SoilCore,
  Stem,
  UserRole,
  Verification,
  LatLon,
} from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic PRNG                                                  */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;

const pick = <T,>(rng: Rng, xs: readonly T[]): T =>
  xs[Math.floor(rng() * xs.length)];

const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);

const round = (v: number, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
};

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

interface SiteTemplate {
  name: string;
  code: string;
  ecosystem: Ecosystem;
  areaHa: number;
  centre: LatLon;
  stratum: string;
  establishedYear: number;
  priorLandUse: string;
  protectedArea: boolean;
  plots: number;
}

interface ProjectTemplate {
  code: string;
  name: string;
  proponent: string;
  partner: string;
  region: string;
  activity: ActivityType;
  methodology: string;
  registry: string;
  status: ProjectStatus;
  registeredOn: string;
  targetAreaHa: number;
  summary: string;
  sdgs: string[];
  leakagePct: number;
  bufferPct: number;
  baseline: {
    description: string;
    b: number;
    s: number;
    oneOff: number;
    source: string;
  };
  sites: SiteTemplate[];
}

const SPECIES_BY_ECOSYSTEM: Record<Ecosystem, string[]> = {
  mangrove: [
    "Rhizophora mucronata",
    "Rhizophora apiculata",
    "Avicennia marina",
    "Sonneratia alba",
    "Bruguiera cylindrica",
    "Ceriops tagal",
    "Excoecaria agallocha",
    "Aegiceras corniculatum",
  ],
  seagrass: [
    "Cymodocea serrulata",
    "Halodule uninervis",
    "Halophila ovalis",
    "Thalassia hemprichii",
    "Enhalus acoroides",
    "Syringodium isoetifolium",
  ],
  saltmarsh: [
    "Spartina alterniflora",
    "Sarcocornia quinqueflora",
    "Suaeda maritima",
    "Aeluropus lagopoides",
    "Sesuvium portulacastrum",
  ],
};

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    code: "MRV-BC-001",
    name: "Sundarbans Tidal Mangrove Restoration",
    proponent: "Bengal Coastal Restoration Trust",
    partner: "Sundarbans Fisherfolk Cooperative",
    region: "West Bengal, India",
    activity: "restoration",
    methodology: "VM0033 Tidal Wetland Restoration v2.1",
    registry: "Verra VCS",
    status: "monitoring",
    registeredOn: "2021-04-12",
    targetAreaHa: 1420,
    summary:
      "Community-led replanting of degraded tidal mudflats in the Indian Sundarbans across 14 village forest protection committees, combining Rhizophora-dominant plantation with natural regeneration of Avicennia and Sonneratia.",
    sdgs: ["SDG 13", "SDG 14", "SDG 1", "SDG 15"],
    leakagePct: 2,
    bufferPct: 12,
    baseline: {
      description:
        "Abandoned shrimp ponds and degraded mudflat with no significant woody regeneration; continued pond conversion was the most likely alternative land use.",
      b: 0.35,
      s: 0.9,
      oneOff: 8,
      source:
        "VM0033 §6.2 baseline land-use survey + 2019 village-level land-use history",
    },
    sites: [
      {
        name: "Jharkhali East Mudflat",
        code: "SUN-01",
        ecosystem: "mangrove",
        areaHa: 486,
        centre: { lon: 88.68, lat: 21.95 },
        stratum: "Riverine fringe",
        establishedYear: 2021,
        priorLandUse: "Abandoned shrimp pond",
        protectedArea: false,
        plots: 6,
      },
      {
        name: "Bagmara Natural Regeneration Block",
        code: "SUN-02",
        ecosystem: "mangrove",
        areaHa: 612,
        centre: { lon: 88.82, lat: 21.79 },
        stratum: "Basin / back-mangrove",
        establishedYear: 2020,
        priorLandUse: "Degraded mangrove (pole cutting)",
        protectedArea: true,
        plots: 5,
      },
      {
        name: "Gosaba Channel Banks",
        code: "SUN-03",
        ecosystem: "mangrove",
        areaHa: 322,
        centre: { lon: 88.58, lat: 22.11 },
        stratum: "Fringe / levee",
        establishedYear: 2022,
        priorLandUse: "Eroded embankment",
        protectedArea: false,
        plots: 4,
      },
    ],
  },
  {
    code: "MRV-BC-002",
    name: "Gulf of Kutch Saltmarsh & Mangrove Mosaic",
    proponent: "Kutch Coastal Carbon Foundation",
    partner: "Gujarat Ecology Commission",
    region: "Gujarat, India",
    activity: "avoided-conversion",
    methodology: "VM0007 REDD+ v1.7 (wetland adaptation)",
    registry: "Verra VCS",
    status: "under-verification",
    registeredOn: "2020-11-03",
    targetAreaHa: 960,
    summary:
      "Avoided conversion of 960 ha of intertidal saltmarsh and sparse Avicennia scrub adjoining the Kutch Marine National Park, protecting sediment carbon stocks threatened by salt-pan and port expansion.",
    sdgs: ["SDG 13", "SDG 14", "SDG 15"],
    leakagePct: 3,
    bufferPct: 15,
    baseline: {
      description:
        "Planned conversion to industrial salt pans; historic loss rates from the 2015–2020 cadastral and satellite analysis.",
      b: 0.55,
      s: 1.6,
      oneOff: 22,
      source: "VM0007 §5.3 + 2015–2020 Landsat conversion-rate analysis",
    },
    sites: [
      {
        name: "Adani Creek Saltmarsh",
        code: "KUT-01",
        ecosystem: "saltmarsh",
        areaHa: 430,
        centre: { lon: 69.94, lat: 22.53 },
        stratum: "Low marsh",
        establishedYear: 2020,
        priorLandUse: "Salt pan lease area",
        protectedArea: false,
        plots: 5,
      },
      {
        name: "Narara Scrub Mangrove",
        code: "KUT-02",
        ecosystem: "saltmarsh",
        areaHa: 298,
        centre: { lon: 69.72, lat: 22.44 },
        stratum: "High marsh / Avicennia scrub",
        establishedYear: 2020,
        priorLandUse: "Grazing and fuelwood",
        protectedArea: true,
        plots: 4,
      },
      {
        name: "Kalubhar Estuary Flats",
        code: "KUT-03",
        ecosystem: "mangrove",
        areaHa: 232,
        centre: { lon: 70.16, lat: 22.61 },
        stratum: "Estuarine fringe",
        establishedYear: 2021,
        priorLandUse: "Mudflat under port expansion plan",
        protectedArea: false,
        plots: 4,
      },
    ],
  },
  {
    code: "MRV-BC-003",
    name: "Pichavaram Mangrove Conservation",
    proponent: "Cauvery Delta Blue Carbon Society",
    partner: "Tamil Nadu Forest Department",
    region: "Tamil Nadu, India",
    activity: "conservation",
    methodology: "VM0007 REDD+ v1.7",
    registry: "Gold Standard",
    status: "monitoring",
    registeredOn: "2019-08-21",
    targetAreaHa: 1180,
    summary:
      "Improved protection of 1,180 ha of Rhizophora-rich island mangrove in the Pichavaram–Muzhukkuthurai complex, addressing illegal pole cutting and hydrological disruption in the Vellar–Coleroon estuary.",
    sdgs: ["SDG 13", "SDG 14", "SDG 6"],
    leakagePct: 2.5,
    bufferPct: 10,
    baseline: {
      description:
        "Continued degradation under open-access pole cutting and reduced tidal flushing; measured from the 2012–2018 canopy-loss trajectory.",
      b: 1.15,
      s: 0.6,
      oneOff: 0,
      source: "VM0007 §5.3 + 2012–2018 Landsat canopy-loss trend extrapolation",
    },
    sites: [
      {
        name: "Pichavaram Island Core",
        code: "PIC-01",
        ecosystem: "mangrove",
        areaHa: 540,
        centre: { lon: 79.782, lat: 11.432 },
        stratum: "Island / basin",
        establishedYear: 2019,
        priorLandUse: "Degraded reserve forest",
        protectedArea: true,
        plots: 6,
      },
      {
        name: "Killai Backwater",
        code: "PIC-02",
        ecosystem: "mangrove",
        areaHa: 398,
        centre: { lon: 79.845, lat: 11.478 },
        stratum: "Backwater fringe",
        establishedYear: 2019,
        priorLandUse: "Degraded reserve forest",
        protectedArea: true,
        plots: 4,
      },
      {
        name: "Muzhukkuthurai Regeneration",
        code: "PIC-03",
        ecosystem: "mangrove",
        areaHa: 242,
        centre: { lon: 79.918, lat: 11.401 },
        stratum: "Riverine",
        establishedYear: 2020,
        priorLandUse: "Degraded mangrove",
        protectedArea: false,
        plots: 4,
      },
    ],
  },
  {
    code: "MRV-BC-004",
    name: "Gulf of Mannar Seagrass Recovery",
    proponent: "Mannar Marine Meadows Trust",
    partner: "Gulf of Mannar Biosphere Reserve Trust",
    region: "Tamil Nadu, India",
    activity: "restoration",
    methodology: "VM0033 Seagrass Restoration v2.1",
    registry: "Verra VCS",
    status: "monitoring",
    registeredOn: "2022-02-18",
    targetAreaHa: 640,
    summary:
      "Passive and assisted recovery of Cymodocea–Thalassia meadows between Rameswaram and Kilakarai, removing abandoned gill-net ghost gear, controlling boat anchoring and transplanting donor sods on denuded patches.",
    sdgs: ["SDG 14", "SDG 13", "SDG 2"],
    leakagePct: 1.5,
    bufferPct: 20,
    baseline: {
      description:
        "Denuded seabed maintained by repeated trampling and net dragging; negligible meadow recovery in the absence of intervention.",
      b: 0.08,
      s: 0.35,
      oneOff: 3,
      source: "VM0033 §6.2 + 2020–2021 benthic habitat mapping",
    },
    sites: [
      {
        name: "Rameswaram Shallow Meadow",
        code: "GOM-01",
        ecosystem: "seagrass",
        areaHa: 268,
        centre: { lon: 79.28, lat: 9.24 },
        stratum: "Shallow subtidal 1–3 m",
        establishedYear: 2022,
        priorLandUse: "Denuded seabed",
        protectedArea: true,
        plots: 6,
      },
      {
        name: "Kilakarai Transplant Beds",
        code: "GOM-02",
        ecosystem: "seagrass",
        areaHa: 212,
        centre: { lon: 78.94, lat: 9.02 },
        stratum: "Intertidal / shallow subtidal",
        establishedYear: 2022,
        priorLandUse: "Denuded seabed",
        protectedArea: false,
        plots: 5,
      },
      {
        name: "Valinokkam Lagoon",
        code: "GOM-03",
        ecosystem: "seagrass",
        areaHa: 160,
        centre: { lon: 79.86, lat: 9.31 },
        stratum: "Lagoonal 1–4 m",
        establishedYear: 2023,
        priorLandUse: "Ghost-net impacted meadow",
        protectedArea: false,
        plots: 4,
      },
    ],
  },
  {
    code: "MRV-BC-005",
    name: "Andaman Archipelago Blue Carbon",
    proponent: "Island Resilience Collective",
    partner: "AN Forest & Marine Department",
    region: "Andaman & Nicobar Islands, India",
    activity: "restoration",
    methodology: "VM0033 Tidal Wetland Restoration v2.1",
    registry: "Gold Standard",
    status: "registered",
    registeredOn: "2023-06-09",
    targetAreaHa: 780,
    summary:
      "Post-disturbance restoration of mangrove and seagrass habitat across three islands, prioritising nursery-raised seedlings and hydrological repair of blocked tidal channels after the 2022 storm surge.",
    sdgs: ["SDG 13", "SDG 14", "SDG 11", "SDG 15"],
    leakagePct: 2,
    bufferPct: 18,
    baseline: {
      description:
        "Storm-damaged mangrove with high mortality and impeded tidal exchange; slow natural recovery constrained by sediment smothering.",
      b: 0.6,
      s: 0.8,
      oneOff: 12,
      source: "Post-storm damage assessment 2022 + VM0033 §6.2",
    },
    sites: [
      {
        name: "Baratang Tidal Creek",
        code: "AND-01",
        ecosystem: "mangrove",
        areaHa: 342,
        centre: { lon: 92.79, lat: 12.09 },
        stratum: "Tidal creek / riverine",
        establishedYear: 2023,
        priorLandUse: "Storm-damaged mangrove",
        protectedArea: true,
        plots: 5,
      },
      {
        name: "Havelock Reef Flat Meadow",
        code: "AND-02",
        ecosystem: "seagrass",
        areaHa: 224,
        centre: { lon: 93.0, lat: 11.96 },
        stratum: "Reef flat 2–5 m",
        establishedYear: 2023,
        priorLandUse: "Sediment-smothered meadow",
        protectedArea: true,
        plots: 4,
      },
      {
        name: "Rangat Sheltered Bay",
        code: "AND-03",
        ecosystem: "mangrove",
        areaHa: 214,
        centre: { lon: 92.88, lat: 12.48 },
        stratum: "Sheltered bay / fringe",
        establishedYear: 2024,
        priorLandUse: "Storm-damaged mangrove",
        protectedArea: false,
        plots: 4,
      },
    ],
  },
  {
    code: "MRV-BC-006",
    name: "Konkan Estuarine Saltmarsh Initiative",
    proponent: "Sindhudurg Estuary Trust",
    partner: "Konkan Coastal Panchayat Federation",
    region: "Maharashtra, India",
    activity: "restoration",
    methodology: "VM0033 Tidal Wetland Restoration v2.1",
    registry: "Verra VCS",
    status: "validation",
    registeredOn: "2024-01-30",
    targetAreaHa: 520,
    summary:
      "Restoration of estuarine saltmarsh and mangrove fringe along the Karli and Achra estuaries, replacing encroached bunds with managed tidal exchange and re-establishing native Suaeda–Spartina swards.",
    sdgs: ["SDG 13", "SDG 14", "SDG 15", "SDG 5"],
    leakagePct: 2,
    bufferPct: 14,
    baseline: {
      description:
        "Bunded, drained estuarine flats converted to paddy and prawn culture with recurrent tidal flooding failure.",
      b: 0.25,
      s: 1.1,
      oneOff: 10,
      source: "VM0033 §6.2 + 2018–2023 revenue land-use records",
    },
    sites: [
      {
        name: "Karli Estuary Flats",
        code: "KON-01",
        ecosystem: "saltmarsh",
        areaHa: 286,
        centre: { lon: 73.53, lat: 16.62 },
        stratum: "Mid marsh",
        establishedYear: 2024,
        priorLandUse: "Bunded paddy / prawn culture",
        protectedArea: false,
        plots: 5,
      },
      {
        name: "Achra Mangrove Fringe",
        code: "KON-02",
        ecosystem: "mangrove",
        areaHa: 234,
        centre: { lon: 73.44, lat: 16.79 },
        stratum: "Estuarine fringe",
        establishedYear: 2024,
        priorLandUse: "Drained embankment",
        protectedArea: false,
        plots: 4,
      },
    ],
  },
];

const OBSERVERS = [
  "A. Mondal",
  "R. Iyer",
  "P. Solanki",
  "M. Fernando",
  "S. Kulkarni",
  "J. Rathod",
  "N. Biswas",
  "K. Rajan",
];

const DEVICES = [
  "Field App / Android 14",
  "Field App / Android 13",
  "Field App / iOS 17",
  "KoboToolbox / Android 12",
];

const VERIFIERS = [
  "TerraVerify Pvt Ltd",
  "Coastal Assurance Bureau",
  "Meridian Climate Auditors",
];

const AUDITORS = ["Dr. L. Menon", "S. Chatterjee", "V. Nair", "A. Qureshi"];

const STRATA_TIDAL = ["Irregularly flooded", "Regularly flooded", "Subtidal"];

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function blob(rng: Rng, centre: LatLon, radiusDeg: number, n = 14): LatLon[] {
  const pts: LatLon[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radiusDeg * between(rng, 0.62, 1.25);
    pts.push({
      lon: round(centre.lon + r * Math.cos(a) * 1.15, 5),
      lat: round(centre.lat + r * Math.sin(a) * 0.85, 5),
    });
  }
  return pts;
}

function pointsInside(rng: Rng, centre: LatLon, radiusDeg: number, n: number): LatLon[] {
  const pts: LatLon[] = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const r = radiusDeg * Math.sqrt(rng()) * 0.72;
    pts.push({
      lon: round(centre.lon + r * Math.cos(a) * 1.15, 5),
      lat: round(centre.lat + r * Math.sin(a) * 0.85, 5),
    });
  }
  return pts;
}

/* ------------------------------------------------------------------ */
/* Hash chain for the audit log                                        */
/* ------------------------------------------------------------------ */

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function hashEvent(prev: string, e: Omit<AuditEvent, "hash">): string {
  return fnv1a(
    `${prev}|${e.ts}|${e.actor}|${e.action}|${e.entity}|${e.entityId}|${e.note}`,
  );
}

/* ------------------------------------------------------------------ */
/* Measurement generation                                              */
/* ------------------------------------------------------------------ */

interface QuadState {
  species: string;
  areaM2: number;
  coverPct: number;
  agbGPerM2: number;
  bgbGPerM2: number;
  shootsPerM2: number;
  canopyCm: number;
}

/**
 * Persistent state of one permanent sample plot. Re-measuring the *same*
 * cohort year after year is what makes the stock-change series behave like a
 * real monitoring dataset instead of independent random draws.
 */
interface PlotState {
  areaM2: number;
  stems: Stem[];
  quads: QuadState[];
  core: {
    depthCm: number;
    bulkDensityGPerCm3: number;
    organicCarbonPct: number;
    accretionMmPerYr: number;
  };
  /** below-ground biomass was directly harvested at this plot */
  hasBgbHarvest: boolean;
}

/** Plot-level growth ceilings by ecosystem. */
/**
 * Per-ecosystem growth ceilings. `baMax` is the stand basal-area carrying
 * capacity: stand-level growth is throttled as basal area approaches it, which
 * is what keeps a mature conservation forest accruing slowly while a young
 * plantation accumulates quickly (self-thinning).
 */
const CEILING: Record<
  Ecosystem,
  {
    dbhMax: number;
    heightMax: number;
    baMax: number;
    coverMax: number;
    agbMax: number;
    shootMax: number;
    canopyMax: number;
  }
> = {
  mangrove: {
    dbhMax: 34,
    heightMax: 22,
    baMax: 25,
    coverMax: 95,
    agbMax: 0,
    shootMax: 0,
    canopyMax: 2200,
  },
  seagrass: {
    dbhMax: 0,
    heightMax: 0,
    baMax: 0,
    coverMax: 92,
    agbMax: 340,
    shootMax: 900,
    canopyMax: 55,
  },
  saltmarsh: {
    dbhMax: 0,
    heightMax: 0,
    baMax: 0,
    coverMax: 96,
    agbMax: 1350,
    shootMax: 420,
    canopyMax: 110,
  },
};

const SOIL_OC_BASE: Record<Ecosystem, number> = {
  mangrove: 5.2,
  seagrass: 3.2,
  saltmarsh: 4.1,
};

function gauss(rng: Rng): number {
  return (rng() + rng() + rng() - 1.5) / 1.5;
}

function initPlotState(
  rng: Rng,
  eco: Ecosystem,
  areaM2: number,
  age: number,
  /** fraction of carrying capacity already present when monitoring starts */
  maturity: number,
): PlotState {
  const pool = SPECIES_BY_ECOSYSTEM[eco];
  const c = CEILING[eco];
  const core = {
    depthCm: eco === "seagrass" ? 50 : 100,
    bulkDensityGPerCm3: round(between(rng, 0.4, 1.0), 3),
    organicCarbonPct: round(
      between(rng, SOIL_OC_BASE[eco] * 0.6, SOIL_OC_BASE[eco] * 1.6),
      2,
    ),
    accretionMmPerYr: round(between(rng, 1.8, 7.6), 2),
  };
  const state: PlotState = {
    areaM2,
    stems: [],
    quads: [],
    core,
    hasBgbHarvest: rng() < 0.3,
  };

  if (eco === "mangrove") {
    const density = between(rng, 0.09, 0.17); // stems per m²
    const n = Math.max(4, Math.round(areaM2 * density));
    const nPerHa = n / (areaM2 / 10_000);
    // Basal area the stand has reached at the start of monitoring.
    const baTarget = Math.min(
      0.92 * c.baMax,
      (maturity + age * 0.04) * c.baMax,
    );
    const dbhMean =
      100 * Math.sqrt((4 * baTarget) / (Math.PI * Math.max(nPerHa, 1)));
    const dominants = [pick(rng, pool), pick(rng, pool), pick(rng, pool)];
    for (let i = 0; i < n; i++) {
      const dbh = Math.max(
        1,
        dbhMean * between(rng, 0.45, 1.85) * (1 + 0.1 * gauss(rng)),
      );
      state.stems.push({
        id: `st-${i}`,
        species: pick(rng, dominants),
        dbhCm: round(dbh, 2),
        heightM: round(1.2 + dbh * between(rng, 0.55, 0.95), 2),
        vigour: rng() < (age === 0 ? 0.18 : 0.05) ? "dead" : "live",
      });
    }
    // Normalise the size distribution so the realised stand basal area matches
    // the target (the random size spread otherwise inflates basal area).
    const baNow =
      state.stems.reduce((a, s) => a + Math.PI * Math.pow(s.dbhCm / 200, 2), 0) /
      (areaM2 / 10_000);
    const k = Math.sqrt(baTarget / Math.max(baNow, 1e-9));
    for (const s of state.stems) {
      s.dbhCm = round(Math.max(1, s.dbhCm * k), 2);
      s.heightM = round(1.2 + s.dbhCm * between(rng, 0.55, 0.95), 2);
    }
    return state;
  }

  const nq = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < nq; i++) {
    const cover = Math.min(
      c.coverMax,
      Math.max(2, 8 + age * 11 * between(rng, 0.55, 1.55)),
    );
    const agb = Math.max(
      3,
      c.agbMax * (cover / 100) * between(rng, 0.45, 0.95),
    );
    state.quads.push({
      species: pick(rng, pool),
      areaM2: eco === "seagrass" ? 0.25 : 1,
      coverPct: round(cover, 1),
      agbGPerM2: round(agb, 1),
      bgbGPerM2: round(agb * between(rng, 0.9, 2.1), 1),
      shootsPerM2:
        eco === "seagrass"
          ? Math.round(c.shootMax * (cover / 100) * between(rng, 0.5, 1.1))
          : Math.round(c.shootMax * (cover / 100) * between(rng, 0.4, 1.0)),
      canopyCm: round(Math.min(c.canopyMax, 6 + age * 5 * between(rng, 0.6, 1.4)), 1),
    });
  }
  return state;
}

/** Grow the stand by `dt` monitoring years (mortality, growth, recruitment). */
function advancePlotState(
  rng: Rng,
  state: PlotState,
  eco: Ecosystem,
  dt: number,
): void {
  const c = CEILING[eco];
  const ha = Math.max(state.areaM2, 1e-6) / 10_000;
  for (let y = 0; y < dt; y++) {
    // --- woody stems, with stand-level competition
    const ba =
      state.stems
        .filter((s) => s.vigour === "live")
        .reduce((a, s) => a + Math.PI * Math.pow(s.dbhCm / 200, 2), 0) / ha;
    const room = Math.max(0.04, Math.min(1, 1 - ba / Math.max(c.baMax, 1)));
    for (const s of state.stems) {
      if (s.vigour === "dead") continue;
      // density-dependent mortality: crowded stands self-thin
      if (rng() < 0.022 + (room < 0.15 ? 0.035 : 0)) {
        s.vigour = "dead";
        continue;
      }
      const vigourFactor = between(rng, 0.75, 1.4);
      const g =
        1.7 *
        vigourFactor *
        room *
        Math.max(0.12, 1 - s.dbhCm / Math.max(c.dbhMax, 1));
      s.dbhCm = round(Math.min(c.dbhMax, s.dbhCm + g), 2);
      s.heightM = round(
        Math.min(c.heightMax, s.heightM + g * 0.6 * between(rng, 0.6, 1.25)),
        2,
      );
    }
    // natural recruitment into the plot
    if (eco === "mangrove") {
      const recruits = rng() < 0.75 ? 1 + Math.floor(rng() * 2) : 0;
      for (let i = 0; i < recruits; i++) {
        state.stems.push({
          id: `st-r${y}-${i}-${state.stems.length}`,
          species: pick(rng, SPECIES_BY_ECOSYSTEM.mangrove),
          dbhCm: round(between(rng, 1, 2.4), 1),
          heightM: round(between(rng, 0.9, 2.2), 2),
          vigour: "live",
        });
      }
    }

    // --- meadow / sward
    for (const q of state.quads) {
      q.coverPct = round(
        Math.min(
          c.coverMax,
          q.coverPct + (c.coverMax - q.coverPct) * 0.2 * between(rng, 0.6, 1.35),
        ),
        1,
      );
      q.agbGPerM2 = round(
        Math.min(
          c.agbMax,
          q.agbGPerM2 * (1 + 0.16 * between(rng, 0.55, 1.4)) + between(rng, 0, 6),
        ),
        1,
      );
      q.bgbGPerM2 = round(q.agbGPerM2 * between(rng, 0.9, 2.1), 1);
      q.shootsPerM2 = Math.round(
        Math.min(c.shootMax, q.shootsPerM2 * (1 + 0.13 * between(rng, 0.5, 1.4)) + 4),
      );
      q.canopyCm = round(
        Math.min(c.canopyMax, q.canopyCm + 4 * between(rng, 0.5, 1.5)),
        1,
      );
    }
  }
}

/** Turn the current plot state into a survey record, with measurement noise. */
function observationFromState(
  rng: Rng,
  state: PlotState,
  eco: Ecosystem,
  year: number,
): Omit<Observation, "id" | "plotId"> {
  const stems: Stem[] = state.stems.map((s) => ({
    ...s,
    // caliper / tape measurement error ≈ ±3.5 %
    dbhCm: round(Math.max(0.5, s.dbhCm * (1 + 0.035 * gauss(rng))), 1),
    heightM: round(Math.max(0.4, s.heightM * (1 + 0.05 * gauss(rng))), 2),
  }));

  const quadrats: Quadrat[] = state.quads.map((q) => ({
    id: q.species.slice(0, 2) + "-" + Math.round(q.coverPct),
    areaM2: q.areaM2,
    species: q.species,
    shootDensityPerM2:
      eco === "seagrass"
        ? Math.max(0, Math.round(q.shootsPerM2 * (1 + 0.09 * gauss(rng))))
        : undefined,
    shootMassG:
      eco === "seagrass" && q.shootsPerM2 > 0
        ? round((q.agbGPerM2 / q.shootsPerM2) * (1 + 0.06 * gauss(rng)), 3)
        : undefined,
    coverPct: round(Math.max(1, Math.min(100, q.coverPct + 3.5 * gauss(rng))), 1),
    agbGPerM2: round(Math.max(0, q.agbGPerM2 * (1 + 0.11 * gauss(rng))), 1),
    bgbGPerM2: state.hasBgbHarvest
      ? round(Math.max(0, q.bgbGPerM2 * (1 + 0.16 * gauss(rng))), 1)
      : undefined,
    canopyHeightCm: round(Math.max(1, q.canopyCm * (1 + 0.07 * gauss(rng))), 1),
  }));

  const nCores = 1 + (rng() < 0.35 ? 1 : 0);
  const soilCores: SoilCore[] = Array.from({ length: nCores }, (_, i) => ({
    id: `sc-${i}`,
    depthCm: state.core.depthCm,
    bulkDensityGPerCm3: round(
      state.core.bulkDensityGPerCm3 * (1 + 0.015 * gauss(rng)),
      3,
    ),
    organicCarbonPct: round(
      state.core.organicCarbonPct * (1 + 0.02 * gauss(rng)),
      2,
    ),
    accretionMmPerYr: round(
      state.core.accretionMmPerYr * (1 + 0.08 * gauss(rng)),
      2,
    ),
  }));

  return {
    ts: `${year}-${String(2 + Math.floor(rng() * 10)).padStart(2, "0")}-${String(1 + Math.floor(rng() * 27)).padStart(2, "0")}`,
    observer: pick(rng, OBSERVERS),
    device: pick(rng, DEVICES),
    gpsAccuracyM: round(between(rng, 2.1, 9.4), 1),
    photoCount: 3 + Math.floor(rng() * 8),
    stems,
    quadrats,
    soilCores,
    salinityPpt: round(between(rng, 8, 34), 1),
    waterTempC: round(between(rng, 24, 32), 1),
    tidalInundationClass: pick(rng, STRATA_TIDAL),
    notes:
      rng() < 0.14
        ? pick(rng, [
            "Minor cattle grazing observed on the landward edge.",
            "Fresh sediment deposition from spring tide, plot partially buried.",
            "Ghost net removed from adjacent channel during survey.",
            "Natural regeneration recorded outside the plot boundary.",
            "Plot marker post replaced.",
          ])
        : undefined,
  };
}
/* ------------------------------------------------------------------ */
/* Dataset builder                                                     */
/* ------------------------------------------------------------------ */

const CAMPAIGN_YEARS = [2021, 2022, 2023, 2024, 2025];

export function buildDataset(seed = 20260828): Dataset {
  const rng = mulberry32(seed);

  const projects: Project[] = [];
  const sites: Site[] = [];
  const plots: Plot[] = [];
  const campaigns: Campaign[] = [];
  const observations: Observation[] = [];
  const verifications: Verification[] = [];
  const remoteSensing: RemoteSensingPass[] = [];
  const issuances: Issuance[] = [];
  const audit: AuditEvent[] = [];

  let plotSeq = 0;
  let obsSeq = 0;
  let rsSeq = 0;
  let verSeq = 0;
  let issSeq = 0;
  let serial = 100_000;

  const pushAudit = (
    ts: string,
    actor: string,
    role: UserRole,
    action: AuditAction,
    entity: string,
    entityId: string,
    note: string,
  ) => {
    const prev = audit.length ? audit[audit.length - 1].hash : "genesis";
    const base = {
      id: `ev-${audit.length + 1}`,
      ts,
      actor,
      role,
      action,
      entity,
      entityId,
      note,
      prevHash: prev,
    };
    audit.push({ ...base, hash: hashEvent(prev, base) });
  };

  for (const tpl of PROJECT_TEMPLATES) {
    const projectId = `prj-${tpl.code.toLowerCase()}`;
    const eco: Ecosystem = tpl.sites[0].ecosystem;

    const project: Project = {
      id: projectId,
      code: tpl.code,
      name: tpl.name,
      proponent: tpl.proponent,
      partner: tpl.partner,
      country: "India",
      region: tpl.region,
      ecosystem: eco,
      activity: tpl.activity,
      methodology: tpl.methodology,
      status: tpl.status,
      registeredOn: tpl.registeredOn,
      creditingStart: `${Number(tpl.registeredOn.slice(0, 4)) + 0}-01-01`,
      creditingEnd: `${Number(tpl.registeredOn.slice(0, 4)) + 30}-12-31`,
      targetAreaHa: tpl.targetAreaHa,
      summary: tpl.summary,
      registry: tpl.registry,
      sdgs: tpl.sdgs,
      baseline: {
        description: tpl.baseline.description,
        biomassLossRateMgCHaYr: tpl.baseline.b,
        soilLossRateMgCHaYr: tpl.baseline.s,
        oneOffStockLossMgCHa: tpl.baseline.oneOff,
        source: tpl.baseline.source,
      },
      leakagePct: tpl.leakagePct,
      bufferPct: tpl.bufferPct,
      params: defaultParams(eco),
    };
    // project-specific calibration of the default parameters
    project.params.soilCarbonStockMgCHa = round(
      defaultParams(eco).soilCarbonStockMgCHa * between(rng, 0.75, 1.3),
      0,
    );
    projects.push(project);

    pushAudit(
      tpl.registeredOn,
      "Registry intake",
      "registry-admin",
      "create",
      "project",
      projectId,
      `Project ${tpl.code} created and listed on ${tpl.registry}`,
    );

    // ---- sites
    const projectSites: Site[] = tpl.sites.map((st, si) => {
      const siteId = `sit-${projectId}-${st.code}`;
      const polygon = blob(rng, st.centre, 0.022 + si * 0.004);
      const site: Site = {
        id: siteId,
        projectId,
        name: st.name,
        code: st.code,
        ecosystem: st.ecosystem,
        areaHa: st.areaHa,
        polygon,
        centroid: st.centre,
        stratum: st.stratum,
        establishedYear: st.establishedYear,
        priorLandUse: st.priorLandUse,
        protectedArea: st.protectedArea,
        tidalRangeM: round(between(rng, 1.1, 4.6), 2),
      };
      sites.push(site);

      // ---- plots
      const coords = pointsInside(rng, st.centre, 0.022 + si * 0.004, st.plots);
      coords.forEach((c, pi) => {
        plots.push({
          id: `plt-${siteId}-${pi + 1}`,
          siteId,
          code: `${st.code}-P${String(pi + 1).padStart(2, "0")}`,
          lon: c.lon,
          lat: c.lat,
          areaM2: st.ecosystem === "seagrass" ? 0.25 : st.ecosystem === "saltmarsh" ? 1 : 100,
          stratum: st.stratum,
          installedOn: `${st.establishedYear}-0${(pi % 3) + 1}-15`,
          monumented: rng() > 0.15,
        });
        plotSeq += 1;
      });
      return site;
    });

    // ---- campaigns (one per monitoring year, from registration onward)
    const startYear = Number(tpl.registeredOn.slice(0, 4));
    const years = CAMPAIGN_YEARS.filter((y) => y >= startYear && y <= 2025);
    const sitePlots = plots.filter((p) =>
      projectSites.some((s) => s.id === p.siteId),
    );

    // Persistent plot state: the same trees / quadrats are re-measured every
    // year, so the stock-change series behaves like a real monitoring dataset.
    const pstate = new Map<string, PlotState>();
    for (const plot of sitePlots) {
      const site = projectSites.find((s) => s.id === plot.siteId)!;
      pstate.set(
        plot.id,
        initPlotState(
          rng,
          site.ecosystem,
          plot.areaM2,
          Math.max(0, years[0] - site.establishedYear),
          tpl.activity === "restoration"
            ? 0.05
            : tpl.activity === "avoided-conversion"
              ? 0.35
              : 0.55,
        ),
      );
    }

    let lastYear: number | null = null;

    years.forEach((year, yi) => {
      const isLast = yi === years.length - 1;
      const status: CampaignStatus = isLast
        ? tpl.status === "under-verification"
          ? "under-review"
          : "submitted"
        : years.length - yi === 2 && rng() < 0.35
          ? "under-review"
          : "verified";

      // Advance the stand by the elapsed monitoring interval.
      const dt = lastYear == null ? 0 : year - lastYear;
      if (dt > 0) {
        for (const plot of sitePlots) {
          const site = projectSites.find((s) => s.id === plot.siteId)!;
          advancePlotState(rng, pstate.get(plot.id)!, site.ecosystem, dt);
        }
      }
      lastYear = year;

      const campaignId = `cmp-${projectId}-${year}`;
      const periodStart = `${year}-01-01`;
      const periodEnd = `${year}-12-31`;
      const plotsSurveyed = isLast
        ? sitePlots.length - (rng() < 0.35 ? 1 + Math.floor(rng() * 2) : 0)
        : sitePlots.length;

      const campaign: Campaign = {
        id: campaignId,
        projectId,
        code: `${tpl.code.replace("MRV-BC-", "")}-M${yi + 1}`,
        vintage: String(year),
        periodStart,
        periodEnd,
        status,
        leadTeam: `${pick(rng, OBSERVERS)} (lead), ${pick(rng, OBSERVERS)}`,
        plotsSurveyed: Math.max(1, plotsSurveyed),
        plotsPlanned: sitePlots.length,
        submittedOn: `${year + 1}-02-${String(10 + Math.floor(rng() * 18)).padStart(2, "0")}`,
        completenessPct: round(between(rng, 88, 99.5), 1),
      };
      campaigns.push(campaign);

      // ---- plot re-measurement
      sitePlots.forEach((plot, idx) => {
        if (idx >= campaign.plotsSurveyed) return;
        const site = projectSites.find((s) => s.id === plot.siteId)!;
        observations.push({
          id: `obs-${campaignId}-${plot.id}`,
          plotId: plot.id,
          ...observationFromState(rng, pstate.get(plot.id)!, site.ecosystem, year),
        });
        obsSeq += 1;
      });

      // ---- remote sensing
      for (const site of projectSites) {
        const n = 1 + (rng() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const sensor = pick(rng, [
            "Sentinel-2",
            "Landsat 9",
            "Planet Dove",
            "UAV RGB",
            "UAV LiDAR",
            "ICESat-2",
          ] as const);
          const extentDelta = between(rng, -0.06, 0.05);
          const flags: string[] = [];
          if (extentDelta < -0.03) flags.push("Extent contraction > 3%");
          if (rng() < 0.12) flags.push("Cloud-free composite gap-filled");
          if (rng() < 0.08) flags.push("Possible encroachment signature");
          remoteSensing.push({
            id: `rs-${campaignId}-${site.id}-${i}`,
            campaignId,
            siteId: site.id,
            date: `${year}-${String(3 + Math.floor(rng() * 9)).padStart(2, "0")}-${String(1 + Math.floor(rng() * 27)).padStart(2, "0")}`,
            sensor,
            cloudCoverPct: round(between(rng, 0, 34), 1),
            resolutionM:
              sensor === "Sentinel-2"
                ? 10
                : sensor === "Landsat 9"
                  ? 30
                  : sensor === "Planet Dove"
                    ? 3.7
                    : sensor === "UAV RGB"
                      ? 0.05
                      : sensor === "UAV LiDAR"
                        ? 0.25
                        : 15,
            ndvi: round(between(rng, 0.42, 0.88), 3),
            extentHa: round(site.areaHa * (1 + extentDelta), 1),
            conditionIndex: round(between(rng, 0.48, 0.95), 3),
            flags,
          });
          rsSeq += 1;
        }
      }

      // ---- verification
      if (status === "verified" || status === "under-review") {
        const verId = `ver-${campaignId}`;
        const body = pick(rng, VERIFIERS);
        const started = `${year + 1}-03-${String(1 + Math.floor(rng() * 20)).padStart(2, "0")}`;
        const checklist: ChecklistItem[] = [
          {
            id: `cl-${verId}-1`,
            ref: "MRV §4.1",
            requirement: "Plot relocation within 5 m of permanent marker",
            state: rng() < 0.9 ? "pass" : "fail",
            note: rng() < 0.9 ? "GPS offsets 1.4–4.2 m" : "Two plots > 6 m offset",
          },
          {
            id: `cl-${verId}-2`,
            ref: "MRV §4.3",
            requirement: "Soil cores analysed at accredited laboratory",
            state: "pass",
            note: "Chain-of-custody forms attached",
          },
          {
            id: `cl-${verId}-3`,
            ref: "MRV §4.6",
            requirement: "Remote-sensing extent cross-check within 5%",
            state: rng() < 0.85 ? "pass" : "fail",
          },
          {
            id: `cl-${verId}-4`,
            ref: "MRV §5.2",
            requirement: "Allometric parameters documented and justified",
            state: "pass",
          },
          {
            id: `cl-${verId}-5`,
            ref: "MRV §5.5",
            requirement: "Uncertainty assessment complete for all pools",
            state: status === "under-review" ? "open" : "pass",
          },
          {
            id: `cl-${verId}-6`,
            ref: "MRV §6.1",
            requirement: "Stakeholder consultation evidence on file",
            state: status === "under-review" ? "open" : "pass",
            note: "Village committee minutes attached",
          },
        ];

        const findings: Finding[] = [];
        const nFindings = rng() < 0.55 ? 1 : rng() < 0.8 ? 2 : 0;
        for (let i = 0; i < nFindings; i++) {
          const severity = pick(rng, ["minor", "major", "observation"] as const);
          const resolved = status === "verified" ? true : rng() < 0.4;
          findings.push({
            id: `fn-${verId}-${i + 1}`,
            severity,
            clause: pick(rng, [
              "MRV §4.1",
              "MRV §4.3",
              "MRV §5.2",
              "VM0033 §8.1",
              "ISO 14064-3 §5.4",
            ]),
            title: pick(rng, [
              "Plot coordinates inconsistent with marker description",
              "Soil bulk density outlier not re-sampled",
              "Missing photograph for one quadrat",
              "Allometric equation source not cited for one species",
              "Leakage assessment lacks displaced-effort survey",
              "Baseline land-use evidence needs independent confirmation",
            ]),
            detail:
              "Evidence observed during desk review does not fully reconcile with the monitoring report narrative; additional documentation requested.",
            raisedOn: `${year + 1}-03-${String(10 + Math.floor(rng() * 15)).padStart(2, "0")}`,
            raisedBy: pick(rng, AUDITORS),
            status: resolved ? "resolved" : "open",
            response: resolved
              ? "Revised dataset and supporting evidence submitted; verifier accepted the correction."
              : undefined,
          });
        }

        verifications.push({
          id: verId,
          campaignId,
          body,
          leadAuditor: pick(rng, AUDITORS),
          startedOn: started,
          completedOn:
            status === "verified"
              ? `${year + 1}-04-${String(5 + Math.floor(rng() * 20)).padStart(2, "0")}`
              : undefined,
          activities: [
            "Desk review of monitoring report",
            rng() < 0.8
              ? "Site visit and plot re-measurement (10% sample)"
              : "Remote review only",
            "Independent remote-sensing extent assessment",
            "Stakeholder interviews",
          ],
          checklist,
          findings,
          opinion:
            status === "verified"
              ? findings.some((f) => f.severity === "major")
                ? "qualified-positive"
                : "positive"
              : undefined,
          statement:
            status === "verified"
              ? "The monitoring report is materially correct and conforms to the applied methodology; the reported removals are fairly stated."
              : undefined,
        });
        verSeq += 1;

        pushAudit(
          started,
          verifications[verifications.length - 1].leadAuditor,
          "verifier",
          "review-start",
          "campaign",
          campaignId,
          `${body} opened verification of ${campaign.code} (vintage ${year})`,
        );

        if (status === "verified") {
          for (const f of findings) {
            pushAudit(
              f.raisedOn,
              f.raisedBy,
              "verifier",
              "finding-raised",
              "finding",
              f.id,
              `${f.severity.toUpperCase()} — ${f.title}`,
            );
          }
          pushAudit(
            verifications[verifications.length - 1].completedOn!,
            verifications[verifications.length - 1].leadAuditor,
            "verifier",
            "approve",
            "campaign",
            campaignId,
            `Positive verification opinion issued for vintage ${year}`,
          );
        }
      }
    });

    // ---- issuances (needs the full stock-change series, including a t₀ anchor)
    {
      const pc = campaigns.filter((c) => c.projectId === projectId);
      const shape = pc.map((c) => ({
        id: c.id,
        vintage: c.vintage,
        periodEnd: c.periodEnd,
        status: c.status,
      }));
      const probe = projectSeries(project, sites, plots, observations, shape);
      const b0 = probe.length ? probe[0].biomassCMg : 0;
      // Restoration starts from an almost bare site; conservation/avoided
      // conversion starts with most of the standing stock already in place.
      const t0 = {
        date: `${years[0]}-01-01`,
        biomassCMg: tpl.activity === "restoration" ? b0 * 0.04 : b0 * 0.78,
      };
      const series = projectSeries(
        project,
        sites,
        plots,
        observations,
        shape,
        DEFAULT_OPTIONS,
        t0,
      );

      series.forEach((pt, i) => {
        const campaign = pc.find((c) => c.id === pt.campaignId);
        if (!campaign || campaign.status !== "verified") return;
        const areaHa = projectSites.reduce((a, s) => a + s.areaHa, 0);
        const batch = computeCredits({
          project,
          areaHa,
          years: pt.years,
          biomassDeltaMgC: pt.biomassDeltaMgC,
          soilAccrualMgC: pt.soilAccrualCo2eMg / CO2_PER_C,
          firstPeriod: i === 0,
        });
        const qty = Math.max(0, Math.round(batch.net));
        const isRetired = rng() < 0.12;
        const retiredBy = isRetired
          ? pick(rng, [
              "IndusPort Logistics",
              "Meridian Freight",
              "Axis Manufacturing",
            ])
          : undefined;
        const retiredOn = isRetired
          ? `${Number(campaign.vintage) + 1}-09-${String(1 + Math.floor(rng() * 27)).padStart(2, "0")}`
          : undefined;
        const from = serial + 1;
        serial += qty;
        const issuance: Issuance = {
          id: `iss-${campaign.id}`,
          projectId,
          campaignId: campaign.id,
          vintage: campaign.vintage,
          issuedOn: `${Number(campaign.vintage) + 1}-05-${String(3 + Math.floor(rng() * 24)).padStart(2, "0")}`,
          serialFrom: `IN-${tpl.code.slice(-3)}-${campaign.vintage}-${String(from).padStart(6, "0")}`,
          serialTo: `IN-${tpl.code.slice(-3)}-${campaign.vintage}-${String(serial).padStart(6, "0")}`,
          grossT: round(batch.gross),
          baselineT: round(batch.baseline),
          leakageT: round(batch.leakage),
          uncertaintyT: round(batch.uncertainty),
          bufferT: round(batch.buffer),
          netT: qty,
          status: isRetired ? "retired" : "issued",
          retiredBy,
          retiredOn,
        };
        issuances.push(issuance);
        issSeq += 1;
        pushAudit(
          issuance.issuedOn,
          "Registry operations",
          "registry-admin",
          "issue",
          "issuance",
          issuance.id,
          `${qty.toLocaleString()} tCO₂e issued for vintage ${campaign.vintage}`,
        );
        if (isRetired) {
          pushAudit(
            retiredOn!,
            retiredBy!,
            "registry-admin",
            "retire",
            "issuance",
            issuance.id,
            `${qty.toLocaleString()} tCO₂e retired against a corporate claim`,
          );
        }
      });
    }
  }

  audit.sort((a, b) => a.ts.localeCompare(b.ts));
  // Rebuild the hash chain in chronological order.
  const sorted: AuditEvent[] = [];
  for (const e of audit) {
    const prev = sorted.length ? sorted[sorted.length - 1].hash : "genesis";
    const { hash: _drop, ...base } = e;
    sorted.push({
      ...base,
      prevHash: prev,
      hash: hashEvent(prev, { ...base, prevHash: prev }),
    });
  }

  return {
    version: 1,
    generatedOn: "2026-08-28",
    projects,
    sites,
    plots,
    campaigns,
    observations,
    verifications,
    remoteSensing,
    issuances,
    audit: sorted,
  };
}

/** A freshly opened verification — used when a verifier starts a review. */
export function newVerification(campaignId: string, ts: string): Verification {
  const checklist: ChecklistItem[] = [
    {
      id: `cl-${campaignId}-1`,
      ref: "MRV §4.1",
      requirement: "Plot relocation within 5 m of permanent marker",
      state: "open",
    },
    {
      id: `cl-${campaignId}-2`,
      ref: "MRV §4.3",
      requirement: "Soil cores analysed at accredited laboratory",
      state: "open",
    },
    {
      id: `cl-${campaignId}-3`,
      ref: "MRV §4.6",
      requirement: "Remote-sensing extent cross-check within 5%",
      state: "open",
    },
    {
      id: `cl-${campaignId}-4`,
      ref: "MRV §5.2",
      requirement: "Allometric parameters documented and justified",
      state: "open",
    },
    {
      id: `cl-${campaignId}-5`,
      ref: "MRV §5.5",
      requirement: "Uncertainty assessment complete for all pools",
      state: "open",
    },
    {
      id: `cl-${campaignId}-6`,
      ref: "MRV §6.1",
      requirement: "Stakeholder consultation evidence on file",
      state: "open",
    },
  ];
  return {
    id: `ver-${campaignId}`,
    campaignId,
    body: "Coastal Assurance Bureau",
    leadAuditor: "You (verifier)",
    startedOn: ts,
    activities: [
      "Desk review of monitoring report",
      "Site visit and plot re-measurement (10% sample)",
      "Independent remote-sensing extent assessment",
      "Stakeholder interviews",
    ],
    checklist,
    findings: [],
  };
}

/* ------------------------------------------------------------------ */
/* Convenience: export the dataset as flat CSV                         */
/* ------------------------------------------------------------------ */

export function plotsToCsv(data: Dataset): string {
  const header = [
    "project",
    "site",
    "ecosystem",
    "plot",
    "lat",
    "lon",
    "plot_area_m2",
    "campaign",
    "date",
    "observer",
    "live_stems",
    "mean_dbh_cm",
    "mean_height_m",
    "quadrats",
    "mean_cover_pct",
    "soil_cores",
    "soil_stock_MgC_ha",
    "agb_Mg_ha",
    "bgb_Mg_ha",
    "biomass_C_Mg_ha",
    "soil_C_Mg_ha",
    "total_C_Mg_ha",
    "co2e_Mg_ha",
  ];
  const rows: string[] = [header.join(",")];
  for (const obs of data.observations) {
    const plot = data.plots.find((p) => p.id === obs.plotId);
    if (!plot) continue;
    const site = data.sites.find((s) => s.id === plot.siteId);
    if (!site) continue;
    const project = data.projects.find((p) => p.id === site.projectId);
    if (!project) continue;
    const campaign = data.campaigns.find((c) => obs.id.includes(c.id));
    const pools = computePools(obs, site.ecosystem, plot.areaM2, project.params);
    rows.push(
      [
        project.code,
        site.code,
        site.ecosystem,
        plot.code,
        plot.lat,
        plot.lon,
        plot.areaM2,
        campaign?.code ?? "",
        obs.ts,
        obs.observer,
        obs.stems.filter((s) => s.vigour === "live").length,
        pools.meanDbhCm.toFixed(2),
        pools.meanHeightM.toFixed(2),
        obs.quadrats.length,
        pools.meanCoverPct.toFixed(1),
        obs.soilCores.length,
        pools.soilCMgHa.toFixed(1),
        pools.agbMgHa.toFixed(2),
        pools.bgbMgHa.toFixed(2),
        pools.biomassCMgHa.toFixed(2),
        pools.soilCMgHa.toFixed(1),
        pools.totalCMgHa.toFixed(2),
        pools.co2eMgHa.toFixed(2),
      ]
        .map((v) => (typeof v === "string" && v.includes(",") ? `"${v}"` : v))
        .join(","),
    );
  }
  return rows.join("\n");
}
