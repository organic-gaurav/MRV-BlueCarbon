"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  CO2_PER_C,
  MANGROVE_SPECIES,
  SALTMARSH_SPECIES,
  SEAGRASS_SPECIES,
  computePools,
  quadratAgbGPerM2,
  soilBurialMgCHaYr,
  soilStockMgCHa,
  stemAgbKg,
  woodDensity,
} from "@/lib/carbon";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  KV,
  SectionTitle,
  Select,
  Table,
  TextArea,
} from "@/components/ui";
import { num } from "@/lib/format";
import type { Ecosystem, Observation, Quadrat, SoilCore, Stem } from "@/lib/types";

const QUEUE_KEY = "mrv-bluecarbon:queue:v1";

interface Draft {
  projectId: string;
  siteId: string;
  plotId: string;
  ts: string;
  observer: string;
  device: string;
  gpsAccuracyM: number;
  photoCount: number;
  salinityPpt: number;
  waterTempC: number;
  tidalInundationClass: string;
  notes: string;
  stems: Stem[];
  quadrats: Quadrat[];
  cores: SoilCore[];
}

const emptyStem = (): Stem => ({
  id: `st-${Math.random().toString(36).slice(2, 8)}`,
  species: "Rhizophora mucronata",
  dbhCm: 6,
  heightM: 5,
  vigour: "live",
});

const emptyQuadrat = (eco: Ecosystem): Quadrat => ({
  id: `qd-${Math.random().toString(36).slice(2, 8)}`,
  areaM2: eco === "seagrass" ? 0.25 : 1,
  species: eco === "seagrass" ? "Cymodocea serrulata" : "Spartina alterniflora",
  coverPct: 40,
  shootDensityPerM2: eco === "seagrass" ? 320 : undefined,
  shootMassG: eco === "seagrass" ? 0.22 : undefined,
  agbGPerM2: eco === "seagrass" ? 90 : 420,
  canopyHeightCm: eco === "seagrass" ? 18 : 45,
});

const emptyCore = (): SoilCore => ({
  id: `sc-${Math.random().toString(36).slice(2, 8)}`,
  depthCm: 100,
  bulkDensityGPerCm3: 0.65,
  organicCarbonPct: 4.8,
  accretionMmPerYr: 4.2,
});

let draftSeq = 0;
const nextId = (p: string) => `${p}-${Date.now().toString(36)}-${draftSeq++}`;

export default function CollectPage() {
  const { data, dispatch, ready } = useStore();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [queue, setQueue] = useState<Observation[]>([]);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(QUEUE_KEY);
      if (raw) setQueue(JSON.parse(raw) as Observation[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {
      /* ignore */
    }
  }, [queue]);

  // initialise the draft once the dataset is available
  useEffect(() => {
    if (!data || draft) return;
    const project = data.projects[0];
    const site = data.sites.find((s) => s.projectId === project.id)!;
    const plot = data.plots.find((p) => p.siteId === site.id)!;
    setDraft({
      projectId: project.id,
      siteId: site.id,
      plotId: plot.id,
      ts: "2026-03-14",
      observer: "You (field crew)",
      device: "Field App / Android 14",
      gpsAccuracyM: 3.4,
      photoCount: 6,
      salinityPpt: 18,
      waterTempC: 28,
      tidalInundationClass: "Regularly flooded",
      notes: "",
      stems: [],
      quadrats: [],
      cores: [emptyCore()],
    });
  }, [data, draft]);

  const project = useMemo(
    () => data?.projects.find((p) => p.id === draft?.projectId) ?? null,
    [data, draft],
  );
  const site = useMemo(
    () => data?.sites.find((s) => s.id === draft?.siteId) ?? null,
    [data, draft],
  );
  const plot = useMemo(
    () => data?.plots.find((p) => p.id === draft?.plotId) ?? null,
    [data, draft],
  );

  const ecosystem: Ecosystem = site?.ecosystem ?? "mangrove";

  const pools = useMemo(() => {
    if (!draft || !plot || !project) return null;
    const obs: Observation = {
      id: "draft",
      plotId: draft.plotId,
      ts: draft.ts,
      observer: draft.observer,
      device: draft.device,
      gpsAccuracyM: draft.gpsAccuracyM,
      photoCount: draft.photoCount,
      stems: draft.stems,
      quadrats: draft.quadrats,
      soilCores: draft.cores,
    };
    return computePools(obs, ecosystem, plot.areaM2, project.params);
  }, [draft, plot, project, ecosystem]);

  const history = useMemo(() => {
    if (!data || !plot) return [];
    return data.observations
      .filter((o) => o.plotId === plot.id)
      .sort((a, b) => a.ts.localeCompare(b.ts))
      .map((o) => ({
        o,
        pools: computePools(o, ecosystem, plot.areaM2, project!.params),
      }));
  }, [data, plot, ecosystem, project]);

  if (!data || !ready || !draft || !project || !site || !plot || !pools) {
    return <div className="p-8 text-sm text-muted">Loading field module…</div>;
  }

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  const projectSites = data.sites.filter((s) => s.projectId === draft.projectId);
  const sitePlots = data.plots.filter((p) => p.siteId === draft.siteId);

  const addToQueue = () => {
    const obs: Observation = {
      id: nextId(`obs-draft`),
      plotId: draft.plotId,
      ts: draft.ts,
      observer: draft.observer,
      device: draft.device,
      gpsAccuracyM: draft.gpsAccuracyM,
      photoCount: draft.photoCount,
      salinityPpt: draft.salinityPpt,
      waterTempC: draft.waterTempC,
      tidalInundationClass: draft.tidalInundationClass,
      notes: draft.notes || undefined,
      stems: draft.stems,
      quadrats: draft.quadrats,
      soilCores: draft.cores,
    };
    setQueue((q) => [...q, obs]);
    setSaved(`${plot.code} · ${draft.ts}`);
    // reset the measurement rows but keep the location context
    setDraft((d) =>
      d ? { ...d, stems: [], quadrats: [], cores: [emptyCore()], notes: "" } : d,
    );
    setTimeout(() => setSaved(null), 4000);
  };

  const sync = () => {
    for (const o of queue) dispatch({ type: "add-observation", projectId: draft.projectId, observation: o });
    setQueue([]);
  };

  const speciesList =
    ecosystem === "mangrove"
      ? MANGROVE_SPECIES
      : ecosystem === "seagrass"
        ? SEAGRASS_SPECIES
        : SALTMARSH_SPECIES;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Field data collection</h1>
        <p className="mt-1 text-[13px] text-muted">
          Plot re-measurement for {project.code}. The carbon read-out on the right
          recomputes on every keystroke from the raw measurements.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* ---------------- form ---------------- */}
        <div className="space-y-4 lg:col-span-3">
          <Card>
            <SectionTitle
              title="1 · Location"
              sub="Every record is tied to a monumented permanent sample plot"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Project">
                <Select
                  value={draft.projectId}
                  onChange={(e) => {
                    const pid = e.target.value;
                    const s = data.sites.find((x) => x.projectId === pid)!;
                    const p = data.plots.find((x) => x.siteId === s.id)!;
                    setDraft((d) =>
                      d ? { ...d, projectId: pid, siteId: s.id, plotId: p.id } : d,
                    );
                  }}
                >
                  {data.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Site">
                <Select
                  value={draft.siteId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    const p = data.plots.find((x) => x.siteId === sid)!;
                    setDraft((d) => (d ? { ...d, siteId: sid, plotId: p.id } : d));
                  }}
                >
                  {projectSites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Plot">
                <Select
                  value={draft.plotId}
                  onChange={(e) => set("plotId", e.target.value)}
                >
                  {sitePlots.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
              <Badge tone={site.ecosystem === "mangrove" ? "emerald" : site.ecosystem === "seagrass" ? "cyan" : "lime"}>
                {site.ecosystem} protocol
              </Badge>
              <Badge tone="slate">{plot.areaM2} m² plot</Badge>
              <Badge tone={plot.monumented ? "emerald" : "amber"}>
                {plot.monumented ? "Marker installed" : "No marker"}
              </Badge>
              <span className="tnum font-mono text-faint">
                {plot.lat.toFixed(5)}, {plot.lon.toFixed(5)}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <Field label="Survey date">
                <Input type="date" value={draft.ts} onChange={(e) => set("ts", e.target.value)} />
              </Field>
              <Field label="Observer">
                <Input value={draft.observer} onChange={(e) => set("observer", e.target.value)} />
              </Field>
              <Field label="GPS accuracy (m)">
                <Input
                  type="number"
                  step="0.1"
                  value={draft.gpsAccuracyM}
                  onChange={(e) => set("gpsAccuracyM", Number(e.target.value))}
                />
              </Field>
              <Field label="Photos">
                <Input
                  type="number"
                  value={draft.photoCount}
                  onChange={(e) => set("photoCount", Number(e.target.value))}
                />
              </Field>
            </div>
          </Card>

          <Card>
            <SectionTitle
              title={ecosystem === "mangrove" ? "2 · Stem measurements" : "2 · Quadrat measurements"}
              sub={
                ecosystem === "mangrove"
                  ? "Diameter at breast height and height for every stem above the 1 cm threshold"
                  : "Cover, shoot density and harvested dry biomass per quadrat"
              }
              right={
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              stems: [
                                ...d.stems,
                                ...Array.from({ length: 10 }, () => {
                                  const sp =
                                    speciesList[
                                      Math.floor(Math.random() * speciesList.length)
                                    ];
                                  const dbh = 3 + Math.random() * 14;
                                  return {
                                    id: nextId("st"),
                                    species: sp,
                                    dbhCm: Number(dbh.toFixed(1)),
                                    heightM: Number((1.5 + dbh * 0.7).toFixed(2)),
                                    vigour: Math.random() < 0.08 ? ("dead" as const) : ("live" as const),
                                  };
                                }),
                              ],
                            }
                          : d,
                      )
                    }
                  >
                    Fill 10 sample stems
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              [ecosystem === "mangrove" ? "stems" : "quadrats"]:
                                ecosystem === "mangrove"
                                  ? [...d.stems, emptyStem()]
                                  : [...d.quadrats, emptyQuadrat(ecosystem)],
                            }
                          : d,
                      )
                    }
                  >
                    + Add {ecosystem === "mangrove" ? "stem" : "quadrat"}
                  </Button>
                </div>
              }
            />

            {ecosystem === "mangrove" ? (
              <div className="space-y-2">
                {draft.stems.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12px] text-faint">
                    No stems recorded yet. Add them individually or generate a sample
                    cohort.
                  </p>
                )}
                {draft.stems.map((s, i) => (
                  <div
                    key={s.id}
                    className="grid grid-cols-12 items-end gap-2 rounded-lg border border-line bg-canvas/40 p-2"
                  >
                    <span className="col-span-1 pt-2 text-center text-[11px] text-faint">
                      {i + 1}
                    </span>
                    <div className="col-span-4">
                      <Select
                        value={s.species}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  stems: d.stems.map((x) =>
                                    x.id === s.id ? { ...x, species: e.target.value } : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      >
                        {speciesList.map((sp) => (
                          <option key={sp} value={sp}>
                            {sp}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={s.dbhCm}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  stems: d.stems.map((x) =>
                                    x.id === s.id
                                      ? { ...x, dbhCm: Number(e.target.value) }
                                      : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={s.heightM}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  stems: d.stems.map((x) =>
                                    x.id === s.id
                                      ? { ...x, heightM: Number(e.target.value) }
                                      : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Select
                        value={s.vigour}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  stems: d.stems.map((x) =>
                                    x.id === s.id
                                      ? { ...x, vigour: e.target.value as Stem["vigour"] }
                                      : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      >
                        <option value="live">Live</option>
                        <option value="dead">Dead</option>
                      </Select>
                    </div>
                    <div className="col-span-1 pb-1.5 text-right">
                      <button
                        onClick={() =>
                          setDraft((d) =>
                            d ? { ...d, stems: d.stems.filter((x) => x.id !== s.id) } : d,
                          )
                        }
                        className="text-[13px] text-faint hover:text-white"
                        aria-label="Remove stem"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="col-span-12 -mt-1 flex gap-3 pl-8 text-[10px] text-faint">
                      <span>ρ = {woodDensity(s.species).toFixed(2)} g cm⁻³</span>
                      <span className="tnum">
                        AGB = {num(stemAgbKg(s), 1)} kg
                      </span>
                      <span className="tnum">
                        BGB = {num(stemAgbKg(s) * project.params.rootShootRatio, 1)} kg
                      </span>
                    </div>
                  </div>
                ))}
                {draft.stems.length > 0 && (
                  <p className="pt-1 text-[10.5px] text-faint">
                    Columns: species · DBH (cm) · height (m) · vigour
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {draft.quadrats.length === 0 && (
                  <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-[12px] text-faint">
                    No quadrats recorded yet.
                  </p>
                )}
                {draft.quadrats.map((q) => (
                  <div
                    key={q.id}
                    className="grid grid-cols-12 items-end gap-2 rounded-lg border border-line bg-canvas/40 p-2"
                  >
                    <div className="col-span-3">
                      <Select
                        value={q.species}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  quadrats: d.quadrats.map((x) =>
                                    x.id === q.id ? { ...x, species: e.target.value } : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      >
                        {speciesList.map((sp) => (
                          <option key={sp} value={sp}>
                            {sp}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="1"
                        value={q.coverPct}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  quadrats: d.quadrats.map((x) =>
                                    x.id === q.id
                                      ? { ...x, coverPct: Number(e.target.value) }
                                      : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      />
                    </div>
                    {ecosystem === "seagrass" && (
                      <div className="col-span-2">
                        <Input
                          type="number"
                          value={q.shootDensityPerM2 ?? 0}
                          onChange={(e) =>
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    quadrats: d.quadrats.map((x) =>
                                      x.id === q.id
                                        ? { ...x, shootDensityPerM2: Number(e.target.value) }
                                        : x,
                                    ),
                                  }
                                : d,
                            )
                          }
                        />
                      </div>
                    )}
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="1"
                        value={q.agbGPerM2 ?? 0}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  quadrats: d.quadrats.map((x) =>
                                    x.id === q.id
                                      ? { ...x, agbGPerM2: Number(e.target.value) }
                                      : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="1"
                        value={q.canopyHeightCm ?? 0}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  quadrats: d.quadrats.map((x) =>
                                    x.id === q.id
                                      ? { ...x, canopyHeightCm: Number(e.target.value) }
                                      : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      />
                    </div>
                    <div className="col-span-1 pb-1.5 text-right">
                      <button
                        onClick={() =>
                          setDraft((d) =>
                            d
                              ? { ...d, quadrats: d.quadrats.filter((x) => x.id !== q.id) }
                              : d,
                          )
                        }
                        className="text-[13px] text-faint hover:text-white"
                        aria-label="Remove quadrat"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="col-span-12 -mt-1 pl-3 text-[10px] text-faint">
                      AGB = {num(quadratAgbGPerM2(q), 1)} g DW m⁻² →{" "}
                      {num(quadratAgbGPerM2(q) * 0.01, 2)} Mg ha⁻¹
                    </div>
                  </div>
                ))}
                {draft.quadrats.length > 0 && (
                  <p className="pt-1 text-[10.5px] text-faint">
                    Columns: species · cover % ·{" "}
                    {ecosystem === "seagrass" ? "shoots m⁻² · " : ""}AGB g m⁻² · canopy
                    cm
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle
              title="3 · Soil core"
              sub="The dominant carbon pool in every blue-carbon ecosystem"
              right={
                <Button
                  size="sm"
                  onClick={() => setDraft((d) => (d ? { ...d, cores: [...d.cores, emptyCore()] } : d))}
                >
                  + Add core
                </Button>
              }
            />
            <div className="space-y-2">
              {draft.cores.map((c, i) => (
                <div
                  key={c.id}
                  className="grid grid-cols-12 items-end gap-2 rounded-lg border border-line bg-canvas/40 p-2"
                >
                  <span className="col-span-1 pt-2 text-center text-[11px] text-faint">
                    {i + 1}
                  </span>
                  {(
                    [
                      ["depthCm", "Depth (cm)", 1],
                      ["bulkDensityGPerCm3", "Bulk density", 0.01],
                      ["organicCarbonPct", "Organic C (%)", 0.1],
                      ["accretionMmPerYr", "Accretion (mm/yr)", 0.1],
                    ] as const
                  ).map(([k, label, step]) => (
                    <div key={k} className="col-span-2">
                      <span className="mb-1 block text-[9.5px] uppercase tracking-wide text-faint">
                        {label}
                      </span>
                      <Input
                        type="number"
                        step={step}
                        value={c[k]}
                        onChange={(e) =>
                          setDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  cores: d.cores.map((x) =>
                                    x.id === c.id ? { ...x, [k]: Number(e.target.value) } : x,
                                  ),
                                }
                              : d,
                          )
                        }
                      />
                    </div>
                  ))}
                  <div className="col-span-3 pb-1 text-right text-[10px] text-faint">
                    <div className="tnum">{num(soilStockMgCHa(c), 0)} Mg C ha⁻¹</div>
                    <div className="tnum">
                      +{num(soilBurialMgCHaYr(c), 2)} Mg C ha⁻¹ yr⁻¹
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="Salinity (ppt)">
                <Input
                  type="number"
                  value={draft.salinityPpt}
                  onChange={(e) => set("salinityPpt", Number(e.target.value))}
                />
              </Field>
              <Field label="Water temp (°C)">
                <Input
                  type="number"
                  value={draft.waterTempC}
                  onChange={(e) => set("waterTempC", Number(e.target.value))}
                />
              </Field>
              <Field label="Inundation class">
                <Select
                  value={draft.tidalInundationClass}
                  onChange={(e) => set("tidalInundationClass", e.target.value)}
                >
                  {["Irregularly flooded", "Regularly flooded", "Subtidal"].map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Field notes">
                <TextArea
                  rows={2}
                  placeholder="Anything a verifier should know about this visit…"
                  value={draft.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button variant="primary" onClick={addToQueue}>
                Save to offline queue
              </Button>
              {saved && (
                <span className="text-[11.5px] text-white">
                  Queued: {saved}
                </span>
              )}
            </div>
          </Card>
        </div>

        {/* ---------------- live computation ---------------- */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <SectionTitle
              title="Live carbon read-out"
              sub="Recomputed from your raw measurements"
            />
            <div className="space-y-1">
              <KV k="Stems / ha" v={num(pools.stemsPerHa, 0)} mono />
              <KV k="Basal area" v={`${num(pools.basalAreaM2Ha, 1)} m² ha⁻¹`} mono />
              <KV k="Mean DBH" v={`${num(pools.meanDbhCm, 1)} cm`} mono />
              <KV k="Mean height" v={`${num(pools.meanHeightM, 1)} m`} mono />
              {ecosystem !== "mangrove" && (
                <>
                  <KV k="Mean cover" v={`${num(pools.meanCoverPct, 0)} %`} mono />
                  <KV k="Shoot density" v={`${num(pools.shootDensityPerM2, 0)} m⁻²`} mono />
                </>
              )}
              <KV k="Survival" v={`${num(pools.survivalPct, 0)} %`} mono />
              <KV k="Species" v={pools.speciesRichness} mono />
            </div>

            <div className="mt-4 space-y-1 border-t border-line pt-3">
              <p className="mb-1 text-[10.5px] uppercase tracking-wider text-muted">
                Carbon pools
              </p>
              <KV k="Above-ground biomass" v={`${num(pools.agbMgHa, 2)} Mg ha⁻¹`} mono />
              <KV k="Below-ground biomass" v={`${num(pools.bgbMgHa, 2)} Mg ha⁻¹`} mono />
              <KV
                k={`Biomass C (×${project.params.carbonFraction})`}
                v={`${num(pools.biomassCMgHa, 2)} Mg C ha⁻¹`}
                mono
              />
              <KV k="Soil organic carbon" v={`${num(pools.soilCMgHa, 1)} Mg C ha⁻¹`} mono />
              <KV
                k="Soil burial rate"
                v={`${num(pools.soilBurialMgCHaYr, 2)} Mg C ha⁻¹ yr⁻¹`}
                mono
              />
            </div>

            <div className="mt-4 rounded-xl border border-accent/25 bg-accent/8 p-3">
              <p className="text-[10.5px] uppercase tracking-wider text-accent">
                Total ecosystem carbon
              </p>
              <p className="tnum mt-1 text-2xl font-semibold text-ink">
                {num(pools.totalCMgHa, 1)}
                <span className="ml-1 text-xs font-normal text-muted">Mg C ha⁻¹</span>
              </p>
              <p className="tnum mt-0.5 text-[13px] text-accent">
                {num(pools.co2eMgHa, 1)} tCO₂e ha⁻¹
              </p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                Scaled to {site.name} ({num(site.areaHa)} ha) this is{" "}
                <span className="tnum">
                  {num(pools.totalCMgHa * site.areaHa * CO2_PER_C, 0)}
                </span>{" "}
                tCO₂e of standing stock.
              </p>
            </div>
          </Card>

          <Card>
            <SectionTitle
              title="Offline sync queue"
              sub="Records are held on the device until connectivity is available"
              right={
                <Button
                  size="sm"
                  variant="primary"
                  disabled={queue.length === 0}
                  onClick={sync}
                >
                  Sync {queue.length}
                </Button>
              }
            />
            {queue.length === 0 ? (
              <p className="text-[12px] text-faint">
                Queue empty. Saved surveys appear here before they are merged into
                the project dataset.
              </p>
            ) : (
              <div className="max-h-52 space-y-1.5 overflow-y-auto">
                {queue.map((o) => {
                  const pl = data.plots.find((p) => p.id === o.plotId);
                  return (
                    <div
                      key={o.id}
                      className="flex items-center justify-between rounded-lg border border-line bg-canvas/40 px-2.5 py-1.5"
                    >
                      <div>
                        <p className="text-[11.5px] text-ink">
                          {pl?.code} · {o.ts}
                        </p>
                        <p className="text-[10px] text-faint">
                          {o.stems.length} stems · {o.quadrats.length} quadrats ·{" "}
                          {o.soilCores.length} cores
                        </p>
                      </div>
                      <Badge tone="amber">pending</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle
              title={`Survey history — ${plot.code}`}
              sub="Every previous measurement at this plot"
            />
            <Table
              head={["Date", "Stems", "Mg C ha⁻¹", "tCO₂e ha⁻¹"]}
              rows={history.map(({ o, pools: pp }) => [
                <span key="d" className="tnum">
                  {o.ts}
                </span>,
                <span key="s" className="tnum">
                  {o.stems.length || `${o.quadrats.length}q`}
                </span>,
                <span key="c" className="tnum">
                  {num(pp.totalCMgHa, 1)}
                </span>,
                <span key="t" className="tnum">
                  {num(pp.co2eMgHa, 1)}
                </span>,
              ])}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
