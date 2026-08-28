/**
 * MRV-BlueCarbon — domain model
 *
 * A single flexible model covers all coastal blue-carbon ecosystems; the
 * `ecosystem` field switches the survey protocol, allometric equations and
 * default accounting parameters ("generic blue carbon" mode).
 */

export type Ecosystem = "mangrove" | "seagrass" | "saltmarsh";

export type ActivityType =
  | "restoration"
  | "conservation"
  | "avoided-conversion";

export type ProjectStatus =
  | "validation"
  | "registered"
  | "monitoring"
  | "under-verification"
  | "verified"
  | "suspended";

export type CampaignStatus =
  | "planned"
  | "in-progress"
  | "submitted"
  | "under-review"
  | "verified"
  | "rejected";

export type VerificationOpinion =
  | "positive"
  | "qualified-positive"
  | "adverse";

export type CreditStatus = "issued" | "retired" | "buffer";

export type UserRole =
  | "project-developer"
  | "field-coordinator"
  | "verifier"
  | "registry-admin"
  | "auditor";

export interface LatLon {
  lon: number;
  lat: number;
}

/* ------------------------------------------------------------------ */
/* Field measurements                                                  */
/* ------------------------------------------------------------------ */

/** One measured stem (mangrove / woody saltmarsh species). */
export interface Stem {
  id: string;
  species: string;
  dbhCm: number;
  heightM: number;
  /** live | dead | snag — dead stems are excluded from live biomass. */
  vigour: "live" | "dead";
}

/** One quadrat (seagrass meadow or saltmarsh sward). */
export interface Quadrat {
  id: string;
  /** quadrat area in m² (e.g. 0.25 m² for seagrass, 1 m² for saltmarsh) */
  areaM2: number;
  species: string;
  /** seagrass: shoots per m² */
  shootDensityPerM2?: number;
  /** seagrass: dry mass of a single shoot, g DW */
  shootMassG?: number;
  /** seagrass & saltmarsh: percentage canopy / sward cover */
  coverPct: number;
  /** harvested above-ground dry biomass, g DW per m² */
  agbGPerM2?: number;
  /** harvested below-ground dry biomass, g DW per m² (optional core) */
  bgbGPerM2?: number;
  canopyHeightCm?: number;
}

/** Soil core — the dominant pool in most blue-carbon ecosystems. */
export interface SoilCore {
  id: string;
  depthCm: number;
  bulkDensityGPerCm3: number;
  organicCarbonPct: number;
  /** measured surface accretion, mm/yr (from marker horizons or 210Pb) */
  accretionMmPerYr: number;
}

/** A single visit to one permanent sample plot. */
export interface Observation {
  id: string;
  plotId: string;
  ts: string;
  observer: string;
  device: string;
  gpsAccuracyM: number;
  photoCount: number;
  stems: Stem[];
  quadrats: Quadrat[];
  soilCores: SoilCore[];
  /** water quality / context — supports the verification narrative */
  salinityPpt?: number;
  waterTempC?: number;
  tidalInundationClass?: string;
  notes?: string;
}

/* ------------------------------------------------------------------ */
/* Spatial hierarchy                                                   */
/* ------------------------------------------------------------------ */

export interface Plot {
  id: string;
  siteId: string;
  code: string;
  lon: number;
  lat: number;
  /** plot area in m² — 100 m² (10×10) for mangrove, 0.25 m² for seagrass */
  areaM2: number;
  stratum: string;
  installedOn: string;
  /** permanent sample plot marker physically installed? */
  monumented: boolean;
}

export interface Site {
  id: string;
  projectId: string;
  name: string;
  code: string;
  ecosystem: Ecosystem;
  areaHa: number;
  /** GeoJSON-ish ring of lon/lat pairs */
  polygon: LatLon[];
  centroid: LatLon;
  stratum: string;
  /** year of planting (restoration) or of protection start (conservation) */
  establishedYear: number;
  /** land use before the project started */
  priorLandUse: string;
  protectedArea: boolean;
  tidalRangeM: number;
}

export interface Baseline {
  description: string;
  /** baseline above+below-ground biomass carbon loss, Mg C ha⁻¹ yr⁻¹ */
  biomassLossRateMgCHaYr: number;
  /** baseline soil carbon loss, Mg C ha⁻¹ yr⁻¹ */
  soilLossRateMgCHaYr: number;
  /** one-off baseline stock lost at project start, Mg C ha⁻¹ */
  oneOffStockLossMgCHa: number;
  source: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  proponent: string;
  /** local implementing partner / community organisation */
  partner: string;
  country: string;
  region: string;
  ecosystem: Ecosystem;
  activity: ActivityType;
  methodology: string;
  status: ProjectStatus;
  registeredOn: string;
  creditingStart: string;
  creditingEnd: string;
  targetAreaHa: number;
  summary: string;
  /** voluntary registry the project is listed on */
  registry: string;
  /** sustainable development co-benefits */
  sdgs: string[];
  baseline: Baseline;
  leakagePct: number;
  bufferPct: number;
  params: CarbonParams;
}

/** Editable accounting parameters (per project, defaults by ecosystem). */
export interface CarbonParams {
  /** fraction of dry biomass that is carbon */
  carbonFraction: number;
  /** below-ground : above-ground biomass ratio */
  rootShootRatio: number;
  /** measured soil organic carbon stock at t₀, Mg C ha⁻¹ */
  soilCarbonStockMgCHa: number;
  /** relative 1σ uncertainty per pool (0–1) */
  uncertainty: {
    agb: number;
    bgb: number;
    soil: number;
    baseline: number;
  };
  /** cap on the uncertainty deduction, fraction of net mitigation */
  maxUncertaintyDeduction: number;
}

/* ------------------------------------------------------------------ */
/* Campaigns, verification, credits                                    */
/* ------------------------------------------------------------------ */

export type ChecklistState = "pass" | "fail" | "open";

export interface ChecklistItem {
  id: string;
  ref: string;
  requirement: string;
  state: ChecklistState;
  note?: string;
}

export interface Finding {
  id: string;
  severity: "minor" | "major" | "observation";
  clause: string;
  title: string;
  detail: string;
  raisedOn: string;
  raisedBy: string;
  status: "open" | "resolved";
  response?: string;
}

export interface Verification {
  id: string;
  campaignId: string;
  body: string;
  leadAuditor: string;
  startedOn: string;
  completedOn?: string;
  /** desk review / site visit / remote sensing cross-check */
  activities: string[];
  checklist: ChecklistItem[];
  findings: Finding[];
  opinion?: VerificationOpinion;
  statement?: string;
}

export interface RemoteSensingPass {
  id: string;
  campaignId?: string;
  siteId: string;
  date: string;
  sensor: "Sentinel-2" | "Landsat 9" | "Planet Dove" | "UAV RGB" | "UAV LiDAR" | "ICESat-2";
  cloudCoverPct: number;
  resolutionM: number;
  ndvi: number;
  /** mapped ecosystem extent, ha */
  extentHa: number;
  /** canopy / meadow condition index 0–1 */
  conditionIndex: number;
  /** anomaly flags detected by the change-detection pipeline */
  flags: string[];
}

/** A monitoring campaign (one field season across all plots of a project). */
export interface Campaign {
  id: string;
  projectId: string;
  code: string;
  /** monitoring period covered, e.g. "2024" */
  vintage: string;
  periodStart: string;
  periodEnd: string;
  status: CampaignStatus;
  leadTeam: string;
  plotsSurveyed: number;
  plotsPlanned: number;
  submittedOn?: string;
  /** % of required data fields captured — data-quality gate */
  completenessPct: number;
  observations?: Observation[];
}

export interface Issuance {
  id: string;
  projectId: string;
  campaignId: string;
  vintage: string;
  issuedOn: string;
  serialFrom: string;
  serialTo: string;
  grossT: number;
  baselineT: number;
  leakageT: number;
  uncertaintyT: number;
  bufferT: number;
  netT: number;
  status: CreditStatus;
  retiredBy?: string;
  retiredOn?: string;
}

export type AuditAction =
  | "create"
  | "submit"
  | "review-start"
  | "finding-raised"
  | "finding-resolved"
  | "approve"
  | "reject"
  | "issue"
  | "retire"
  | "survey-upload"
  | "parameter-change"
  | "sync";

export interface AuditEvent {
  id: string;
  ts: string;
  actor: string;
  role: UserRole;
  action: AuditAction;
  entity: string;
  entityId: string;
  note: string;
  /** sha-256-ish integrity hash of the previous event (tamper-evident chain) */
  hash: string;
  prevHash: string;
}

export interface Dataset {
  version: number;
  generatedOn: string;
  projects: Project[];
  sites: Site[];
  plots: Plot[];
  campaigns: Campaign[];
  observations: Observation[];
  verifications: Verification[];
  remoteSensing: RemoteSensingPass[];
  issuances: Issuance[];
  audit: AuditEvent[];
}
