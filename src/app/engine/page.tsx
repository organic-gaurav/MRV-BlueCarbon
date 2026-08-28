"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  CO2_PER_C,
  DEFAULT_OPTIONS,
  DEFAULT_WOOD_DENSITY,
  ECOSYSTEM_LABEL,
  WOOD_DENSITY,
  computeCredits,
  computePools,
  defaultParams,
  soilBurialMgCHaYr,
  soilStockMgCHa,
  stemAgbKg,
  woodDensity,
} from "@/lib/carbon";
import { LineChart } from "@/components/charts";
import {
  Badge,
  Card,
  Field,
  Input,
  KV,
  SectionTitle,
  Select,
  Stat,
} from "@/components/ui";
import { num } from "@/lib/format";
import type { Ecosystem, Observation, Stem } from "@/lib/types";

const SPECIES = Object.keys(WOOD_DENSITY);

export default function EnginePage() {
  const { data, ready } = useStore();

  const [eco, setEco] = useState<Ecosystem>("mangrove");
  const [species, setSpecies] = useState("Rhizophora mucronata");
  const [stemsPerHa, setStemsPerHa] = useState(1200);
  const [dbh, setDbh] = useState(14);
  const [height, setHeight] = useState(9);
  const [plotArea, setPlotArea] = useState(100);
  const [cover, setCover] = useState(70);
  const [agbG, setAgbG] = useState(220);
  const [depth, setDepth] = useState(100);
  const [bd, setBd] = useState(0.65);
  const [oc, setOc] = useState(4.8);
  const [accretion, setAccretion] = useState(4.5);
  const [carbonFraction, setCarbonFraction] = useState(0.47);
  const [rs, setRs] = useState(0.5);
  const [bgbMethod, setBgbMethod] = useState<"ratio" | "allometric">("ratio");

  const [areaHa, setAreaHa] = useState(500);
  const [years, setYears] = useState(1);
  const [baselineLoss, setBaselineLoss] = useState(0.35);
  const [soilBaseline, setSoilBaseline] = useState(0.9);
  const [leakagePct, setLeakagePct] = useState(2);
  const [bufferPct, setBufferPct] = useState(12);
  const [uAgb, setUAgb] = useState(0.15);
  const [uSoil, setUSoil] = useState(0.3);
  const [uBaseline, setUBaseline] = useState(0.2);
  const [sensParam, setSensParam] = useState<"dbh" | "carbonFraction" | "oc" | "rs" | "uAgb">(
    "dbh",
  );

  const params = useMemo(() => {
    const base = defaultParams(eco);
    return {
      ...base,
      carbonFraction,
      rootShootRatio: rs,
      uncertainty: {
        agb: uAgb,
        bgb: uAgb * 1.6,
        soil: uSoil,
        baseline: uBaseline,
      },
    };
  }, [eco, carbonFraction, rs, uAgb, uSoil, uBaseline]);

  /** Build the plot-level observation implied by the summary inputs. */
  const obs = useMemo<Observation>(() => {
    const ha = plotArea / 10_000;
    const nStems = Math.max(1, Math.round(stemsPerHa * ha));
    const stems: Stem[] =
      eco === "mangrove"
        ? Array.from({ length: nStems }, (_, i) => ({
            id: `s${i}`,
            species,
            dbhCm: dbh,
            heightM: height,
            vigour: "live" as const,
          }))
        : [];
    const nQ = 4;
    const quadrats =
      eco === "mangrove"
        ? []
        : Array.from({ length: nQ }, (_, i) => ({
            id: `q${i}`,
            areaM2: eco === "seagrass" ? 0.25 : 1,
            species: eco === "seagrass" ? "Cymodocea serrulata" : "Spartina alterniflora",
            coverPct: cover,
            agbGPerM2: agbG,
            canopyHeightCm: eco === "seagrass" ? 20 : 55,
            shootDensityPerM2: eco === "seagrass" ? 400 : undefined,
            shootMassG: eco === "seagrass" ? agbG / 400 : undefined,
          }));
    return {
      id: "engine",
      plotId: "engine",
      ts: "2026-01-01",
      observer: "engine",
      device: "engine",
      gpsAccuracyM: 3,
      photoCount: 4,
      stems,
      quadrats,
      soilCores: [
        {
          id: "c0",
          depthCm: depth,
          bulkDensityGPerCm3: bd,
          organicCarbonPct: oc,
          accretionMmPerYr: accretion,
        },
      ],
    };
  }, [eco, species, stemsPerHa, dbh, height, plotArea, cover, agbG, depth, bd, oc, accretion]);

  const pools = useMemo(
    () => computePools(obs, eco, plotArea, params, { bgbMethod }),
    [obs, eco, plotArea, params, bgbMethod],
  );

  const syntheticProject = useMemo(
    () => ({
      id: "engine",
      code: "ENGINE",
      name: "Engine sandbox",
      proponent: "—",
      partner: "—",
      country: "—",
      region: "—",
      ecosystem: eco,
      activity: "restoration" as const,
      methodology: "—",
      status: "monitoring" as const,
      registeredOn: "2020-01-01",
      creditingStart: "2020-01-01",
      creditingEnd: "2050-01-01",
      targetAreaHa: areaHa,
      summary: "",
      registry: "—",
      sdgs: [],
      baseline: {
        description: "",
        biomassLossRateMgCHaYr: baselineLoss,
        soilLossRateMgCHaYr: soilBaseline,
        oneOffStockLossMgCHa: 0,
        source: "",
      },
      leakagePct,
      bufferPct,
      params,
    }),
    [eco, areaHa, baselineLoss, soilBaseline, leakagePct, bufferPct, params],
  );

  const batch = useMemo(
    () =>
      computeCredits({
        project: syntheticProject,
        areaHa,
        years,
        // a young stand accumulates roughly a tenth of its standing biomass a year
        biomassDeltaMgC: (pools.biomassCMgHa * 0.1 * areaHa) || 0,
        soilAccrualMgC: pools.soilBurialMgCHaYr * areaHa * years,
        firstPeriod: false,
      }),
    [syntheticProject, areaHa, years, pools],
  );

  const sensitivity = useMemo(() => {
    const points: { x: number; net: number }[] = [];
    const apply = (f: number) => {
      const o: Observation = {
        ...obs,
        stems: obs.stems.map((s) => ({
          ...s,
          dbhCm: sensParam === "dbh" ? Math.max(0.5, dbh * f) : s.dbhCm,
        })),
        quadrats: obs.quadrats,
        soilCores: obs.soilCores.map((c) => ({
          ...c,
          organicCarbonPct: sensParam === "oc" ? oc * f : c.organicCarbonPct,
        })),
      };
      const pr = {
        ...params,
        carbonFraction: sensParam === "carbonFraction" ? carbonFraction * f : carbonFraction,
        rootShootRatio: sensParam === "rs" ? rs * f : rs,
        uncertainty: {
          ...params.uncertainty,
          agb: sensParam === "uAgb" ? uAgb * f : uAgb,
        },
      };
      const pp = computePools(o, eco, plotArea, pr, { bgbMethod });
      const b = computeCredits({
        project: { ...syntheticProject, params: pr },
        areaHa,
        years,
        biomassDeltaMgC: pp.biomassCMgHa * 0.1 * areaHa,
        soilAccrualMgC: pp.soilBurialMgCHaYr * areaHa * years,
        firstPeriod: false,
      });
      return b.net;
    };
    for (let i = 0; i <= 20; i++) {
      const f = 0.5 + (i / 20) * 1.0; // 50 % … 150 %
      points.push({ x: f, net: apply(f) });
    }
    return points;
  }, [
    obs,
    params,
    eco,
    plotArea,
    bgbMethod,
    syntheticProject,
    areaHa,
    years,
    sensParam,
    dbh,
    oc,
    carbonFraction,
    rs,
    uAgb,
  ]);

  const rho = woodDensity(species);
  const agbPerStem = stemAgbKg({
    id: "x",
    species,
    dbhCm: dbh,
    heightM: height,
    vigour: "live",
  });
  const core = obs.soilCores[0];

  if (!data || !ready) return <div className="p-8 text-sm text-muted">Loading engine…</div>;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Carbon calculation engine</h1>
        <p className="mt-1 text-[13px] text-muted">
          Change any input and watch the full chain — allometry → pools → CO₂e →
          deductions → issuable credits. Every formula is shown.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ---------- inputs ---------- */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionTitle title="Stand / meadow" sub="Field measurements" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Ecosystem">
                <Select value={eco} onChange={(e) => setEco(e.target.value as Ecosystem)}>
                  <option value="mangrove">Mangrove</option>
                  <option value="seagrass">Seagrass</option>
                  <option value="saltmarsh">Saltmarsh</option>
                </Select>
              </Field>
              <Field label="Plot area (m²)">
                <Input
                  type="number"
                  value={plotArea}
                  onChange={(e) => setPlotArea(Number(e.target.value))}
                />
              </Field>
              {eco === "mangrove" ? (
                <>
                  <Field label="Dominant species">
                    <Select value={species} onChange={(e) => setSpecies(e.target.value)}>
                      {SPECIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Stems per hectare">
                    <Input
                      type="number"
                      value={stemsPerHa}
                      onChange={(e) => setStemsPerHa(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Mean DBH (cm)">
                    <Input
                      type="number"
                      step="0.1"
                      value={dbh}
                      onChange={(e) => setDbh(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Mean height (m)">
                    <Input
                      type="number"
                      step="0.1"
                      value={height}
                      onChange={(e) => setHeight(Number(e.target.value))}
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Mean cover (%)">
                    <Input
                      type="number"
                      value={cover}
                      onChange={(e) => setCover(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Above-ground biomass (g DW m⁻²)">
                    <Input
                      type="number"
                      value={agbG}
                      onChange={(e) => setAgbG(Number(e.target.value))}
                    />
                  </Field>
                </>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="col-span-2 text-[10.5px] uppercase tracking-wider text-muted">
                Soil core
              </p>
              <Field label="Depth (cm)">
                <Input type="number" value={depth} onChange={(e) => setDepth(Number(e.target.value))} />
              </Field>
              <Field label="Bulk density (g cm⁻³)">
                <Input type="number" step="0.01" value={bd} onChange={(e) => setBd(Number(e.target.value))} />
              </Field>
              <Field label="Organic carbon (%)">
                <Input type="number" step="0.1" value={oc} onChange={(e) => setOc(Number(e.target.value))} />
              </Field>
              <Field label="Accretion (mm yr⁻¹)">
                <Input
                  type="number"
                  step="0.1"
                  value={accretion}
                  onChange={(e) => setAccretion(Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <p className="col-span-2 text-[10.5px] uppercase tracking-wider text-muted">
                Accounting parameters
              </p>
              <Field label="Carbon fraction">
                <Input
                  type="number"
                  step="0.01"
                  value={carbonFraction}
                  onChange={(e) => setCarbonFraction(Number(e.target.value))}
                />
              </Field>
              <Field label="Root : shoot ratio">
                <Input
                  type="number"
                  step="0.05"
                  value={rs}
                  onChange={(e) => setRs(Number(e.target.value))}
                />
              </Field>
              <Field label="Below-ground method">
                <Select
                  value={bgbMethod}
                  onChange={(e) => setBgbMethod(e.target.value as typeof bgbMethod)}
                >
                  <option value="ratio">Root:shoot ratio</option>
                  <option value="allometric">Komiyama allometry</option>
                </Select>
              </Field>
              <Field label="1σ AGB uncertainty">
                <Input
                  type="number"
                  step="0.01"
                  value={uAgb}
                  onChange={(e) => setUAgb(Number(e.target.value))}
                />
              </Field>
              <Field label="1σ soil uncertainty">
                <Input
                  type="number"
                  step="0.01"
                  value={uSoil}
                  onChange={(e) => setUSoil(Number(e.target.value))}
                />
              </Field>
              <Field label="1σ baseline uncertainty">
                <Input
                  type="number"
                  step="0.01"
                  value={uBaseline}
                  onChange={(e) => setUBaseline(Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle title="Project scenario" sub="Scales the plot result to a crediting claim" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Project area (ha)">
                <Input type="number" value={areaHa} onChange={(e) => setAreaHa(Number(e.target.value))} />
              </Field>
              <Field label="Monitoring period (years)">
                <Input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} />
              </Field>
              <Field label="Baseline biomass loss (Mg C ha⁻¹ yr⁻¹)">
                <Input
                  type="number"
                  step="0.05"
                  value={baselineLoss}
                  onChange={(e) => setBaselineLoss(Number(e.target.value))}
                />
              </Field>
              <Field label="Baseline soil loss (Mg C ha⁻¹ yr⁻¹)">
                <Input
                  type="number"
                  step="0.05"
                  value={soilBaseline}
                  onChange={(e) => setSoilBaseline(Number(e.target.value))}
                />
              </Field>
              <Field label="Leakage (%)">
                <Input
                  type="number"
                  step="0.5"
                  value={leakagePct}
                  onChange={(e) => setLeakagePct(Number(e.target.value))}
                />
              </Field>
              <Field label="Buffer pool (%)">
                <Input
                  type="number"
                  step="1"
                  value={bufferPct}
                  onChange={(e) => setBufferPct(Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>
        </div>

        {/* ---------- outputs ---------- */}
        <div className="space-y-4 lg:col-span-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Total carbon" value={num(pools.totalCMgHa, 1)} unit="Mg C ha⁻¹" tone="emerald" />
            <Stat label="CO₂ equivalent" value={num(pools.co2eMgHa, 1)} unit="tCO₂e ha⁻¹" tone="cyan" />
            <Stat label="Soil burial" value={num(pools.soilBurialMgCHaYr, 2)} unit="Mg C ha⁻¹ yr⁻¹" tone="lime" />
            <Stat label="Net credits" value={num(batch.net, 0)} unit="tCO₂e" tone="violet" />
          </div>

          <Card>
            <SectionTitle
              title="Step 1 — Above-ground biomass"
              sub="Komiyama et al. (2005) general mangrove allometry"
            />
            <div className="rounded-lg border border-line bg-canvas/50 p-3 font-mono text-[12px] text-accent">
              AGB = 0.251 × ρ × D^2.46
            </div>
            <div className="mt-3 space-y-1">
              <KV k="Wood density ρ" v={`${rho.toFixed(2)} g cm⁻³`} mono />
              <KV k="DBH D" v={`${dbh} cm`} mono />
              <KV k="AGB per stem" v={`${num(agbPerStem, 2)} kg`} mono />
              <KV k="Stems per hectare" v={num(stemsPerHa)} mono />
              <KV k="AGB" v={`${num(pools.agbMgHa, 2)} Mg ha⁻¹`} mono />
            </div>
            {eco !== "mangrove" && (
              <p className="mt-2 text-[11px] text-muted">
                For {ECOSYSTEM_LABEL[eco].toLowerCase()} the above-ground pool comes from
                quadrat harvests: {num(agbG, 0)} g DW m⁻² × 0.01 ={" "}
                {num(agbG * 0.01, 2)} Mg ha⁻¹.
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle
              title="Step 2 — Below-ground biomass"
              sub={
                bgbMethod === "ratio"
                  ? "Root:shoot ratio (IPCC Wetlands default by ecosystem)"
                  : "Komiyama et al. (2005): BGB = 0.199 × ρ^0.899 × D^2.22"
              }
            />
            <div className="rounded-lg border border-line bg-canvas/50 p-3 font-mono text-[12px] text-accent">
              {bgbMethod === "ratio"
                ? "BGB = AGB × root:shoot ratio"
                : "BGB = 0.199 × ρ^0.899 × D^2.22"}
            </div>
            <div className="mt-3 space-y-1">
              <KV k="Root : shoot ratio" v={rs.toFixed(2)} mono />
              <KV k="BGB" v={`${num(pools.bgbMgHa, 2)} Mg ha⁻¹`} mono />
              <KV k="Total biomass" v={`${num(pools.biomassMgHa, 2)} Mg ha⁻¹`} mono />
              <KV
                k={`Biomass carbon (× ${carbonFraction})`}
                v={`${num(pools.biomassCMgHa, 2)} Mg C ha⁻¹`}
                mono
              />
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="Step 3 — Soil organic carbon"
              sub="Stock from the core; sequestration from accretion"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-line bg-canvas/50 p-3 font-mono text-[11.5px] text-accent">
                C = depth × BD × OC%
              </div>
              <div className="rounded-lg border border-line bg-canvas/50 p-3 font-mono text-[11.5px] text-accent">
                rate = accretion/10 × BD × OC%
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <KV k="Soil carbon stock" v={`${num(soilStockMgCHa(core), 1)} Mg C ha⁻¹`} mono />
              <KV k="Burial rate" v={`${num(soilBurialMgCHaYr(core), 3)} Mg C ha⁻¹ yr⁻¹`} mono />
              <KV k="Total ecosystem carbon" v={`${num(pools.totalCMgHa, 2)} Mg C ha⁻¹`} mono />
              <KV
                k={`CO₂ equivalent (× ${CO2_PER_C.toFixed(3)})`}
                v={`${num(pools.co2eMgHa, 2)} tCO₂e ha⁻¹`}
                mono
              />
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="Step 4 — From removals to credits"
              sub={`${num(areaHa)} ha over ${years} year(s)`}
            />
            <div className="space-y-1">
              {batch.lines.map((l) => (
                <div key={l.key} className="flex items-baseline justify-between gap-3 border-b border-line-soft/60 py-1.5 last:border-0">
                  <div>
                    <p
                      className={`text-[12px] ${l.key === "net" ? "font-semibold text-emerald-300" : "text-ink"}`}
                    >
                      {l.label}
                    </p>
                    <p className="text-[10.5px] text-faint">{l.note}</p>
                  </div>
                  <span
                    className={`tnum shrink-0 text-[12.5px] ${l.sign < 0 ? "text-rose-300" : "text-ink"}`}
                  >
                    {l.sign < 0 ? "−" : ""}
                    {num(Math.abs(l.value))}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-lg border border-line bg-canvas/40 p-2.5 text-[11px] leading-relaxed text-muted">
              Uncertainty is propagated across pools in quadrature, converted to a
              one-sided 90 % interval (z = 1.645) and capped at{" "}
              {(params.maxUncertaintyDeduction * 100).toFixed(0)} %. Buffer pool
              contributions cover non-permanence risk and are not retired against
              claims.
            </p>
          </Card>

          <Card>
            <SectionTitle
              title="Sensitivity"
              sub="How net credits respond to a ±50 % change in one input"
              right={
                <Select
                  value={sensParam}
                  onChange={(e) => setSensParam(e.target.value as typeof sensParam)}
                  className="w-44"
                >
                  <option value="dbh">Mean DBH</option>
                  <option value="carbonFraction">Carbon fraction</option>
                  <option value="oc">Soil organic carbon</option>
                  <option value="rs">Root : shoot ratio</option>
                  <option value="uAgb">AGB uncertainty</option>
                </Select>
              }
            />
            <LineChart
              height={190}
              labels={sensitivity.map((s) => `${Math.round(s.x * 100)}%`)}
              series={[
                {
                  name: "Net credits (tCO₂e)",
                  color: "#a78bfa",
                  values: sensitivity.map((s) => s.net),
                },
              ]}
              formatValue={(v) => `${Math.round(v / 1000)}k`}
            />
            <p className="mt-2 text-[11px] text-faint">
              X axis scales the selected input from 50 % to 150 % of its current value;
              all other inputs held constant.
            </p>
          </Card>

          <Card>
            <SectionTitle title="Method defaults" sub="Values the prototype ships with" />
            <div className="grid gap-4 sm:grid-cols-3">
              {(["mangrove", "seagrass", "saltmarsh"] as Ecosystem[]).map((e) => {
                const d = defaultParams(e);
                return (
                  <div key={e} className="rounded-lg border border-line bg-canvas/40 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-medium">{ECOSYSTEM_LABEL[e]}</span>
                      {e === eco && <Badge tone="emerald">in use</Badge>}
                    </div>
                    <div className="space-y-0.5 text-[11px]">
                      <KV k="Carbon fraction" v={d.carbonFraction} mono />
                      <KV k="Root:shoot" v={d.rootShootRatio} mono />
                      <KV k="Soil stock" v={`${d.soilCarbonStockMgCHa} Mg C ha⁻¹`} mono />
                      <KV k="σ AGB" v={d.uncertainty.agb} mono />
                      <KV k="σ soil" v={d.uncertainty.soil} mono />
                      <KV k="Deduction cap" v={`${(d.maxUncertaintyDeduction * 100).toFixed(0)}%`} mono />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-faint">
              Default wood density where a species is unlisted: {DEFAULT_WOOD_DENSITY}{" "}
              g cm⁻³. Allometric coefficients from Komiyama et al. (2005); soil stock
              and accretion relationships follow the VM0033 tidal-wetland approach.
              Defaults are illustrative — a real project justifies each parameter in
              its validated methodology.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
