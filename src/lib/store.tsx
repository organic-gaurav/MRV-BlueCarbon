"use client";

/**
 * Client-side store for the prototype.
 *
 * The dataset is generated deterministically on first load and then persisted
 * to localStorage, so every mutation the user makes (new survey, verification
 * decision, credit issuance) survives a refresh — but a "Reset demo data"
 * action always restores the pristine seeded state.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildDataset, hashEvent } from "./seed";
import {
  CO2_PER_C,
  DEFAULT_OPTIONS,
  computeCredits,
  projectSeries,
  projectStock,
} from "./carbon";
import type {
  AuditAction,
  AuditEvent,
  Campaign,
  Dataset,
  Issuance,
  Observation,
  Project,
  UserRole,
} from "./types";

const STORAGE_KEY = "mrv-bluecarbon:dataset:v1";

export type Action =
  | { type: "add-observation"; projectId: string; observation: Observation }
  | { type: "submit-campaign"; campaignId: string }
  | { type: "start-review"; campaignId: string }
  | { type: "resolve-finding"; verificationId: string; findingId: string; response: string }
  | { type: "raise-finding"; verificationId: string; severity: "minor" | "major" | "observation"; clause: string; title: string; detail: string }
  | { type: "set-checklist"; verificationId: string; itemId: string; state: "pass" | "fail" | "open" }
  | { type: "verify-campaign"; campaignId: string; opinion: "positive" | "qualified-positive" | "adverse"; statement: string }
  | { type: "reject-campaign"; campaignId: string; reason: string }
  | { type: "issue-credits"; campaignId: string }
  | { type: "retire-credits"; issuanceId: string; buyer: string }
  | { type: "update-params"; projectId: string; params: Project["params"] }
  | { type: "reset" };

function audit(
  data: Dataset,
  ts: string,
  actor: string,
  role: UserRole,
  action: AuditAction,
  entity: string,
  entityId: string,
  note: string,
): AuditEvent[] {
  const prev = data.audit.length ? data.audit[data.audit.length - 1].hash : "genesis";
  const base = {
    id: `ev-${data.audit.length + 1}`,
    ts,
    actor,
    role,
    action,
    entity,
    entityId,
    note,
    prevHash: prev,
  };
  return [...data.audit, { ...base, hash: hashEvent(prev, base) }];
}

const now = () => new Date().toISOString().slice(0, 10);

export function reducer(data: Dataset, action: Action): Dataset {
  switch (action.type) {
    case "add-observation": {
      const exists = data.observations.some(
        (o) =>
          o.plotId === action.observation.plotId &&
          o.ts.slice(0, 4) === action.observation.ts.slice(0, 4),
      );
      if (exists) return data;
      const campaign = data.campaigns
        .filter((c) => c.projectId === action.projectId)
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
      const next: Dataset = {
        ...data,
        observations: [...data.observations, action.observation],
        campaigns: campaign
          ? data.campaigns.map((c) =>
              c.id === campaign.id
                ? {
                    ...c,
                    status: "in-progress",
                    plotsSurveyed: Math.min(
                      c.plotsPlanned,
                      c.plotsSurveyed + 1,
                    ),
                  }
                : c,
            )
          : data.campaigns,
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "Field App (offline queue)",
          "field-coordinator",
          "survey-upload",
          "observation",
          action.observation.id,
          `Plot survey synced for ${action.observation.ts}`,
        ),
      };
    }

    case "submit-campaign": {
      const next = {
        ...data,
        campaigns: data.campaigns.map((c) =>
          c.id === action.campaignId
            ? { ...c, status: "submitted" as const, submittedOn: now() }
            : c,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "Field coordinator",
          "field-coordinator",
          "submit",
          "campaign",
          action.campaignId,
          "Monitoring report submitted for verification",
        ),
      };
    }

    case "start-review": {
      const next = {
        ...data,
        campaigns: data.campaigns.map((c) =>
          c.id === action.campaignId ? { ...c, status: "under-review" as const } : c,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "Coastal Assurance Bureau",
          "verifier",
          "review-start",
          "campaign",
          action.campaignId,
          "Verification opened — desk review started",
        ),
      };
    }

    case "set-checklist": {
      return {
        ...data,
        verifications: data.verifications.map((v) =>
          v.id === action.verificationId
            ? {
                ...v,
                checklist: v.checklist.map((c) =>
                  c.id === action.itemId ? { ...c, state: action.state } : c,
                ),
              }
            : v,
        ),
      };
    }

    case "raise-finding": {
      const v = data.verifications.find((x) => x.id === action.verificationId);
      if (!v) return data;
      const id = `fn-${v.id}-${v.findings.length + 1}`;
      const next = {
        ...data,
        verifications: data.verifications.map((x) =>
          x.id === action.verificationId
            ? {
                ...x,
                findings: [
                  ...x.findings,
                  {
                    id,
                    severity: action.severity,
                    clause: action.clause,
                    title: action.title,
                    detail: action.detail,
                    raisedOn: now(),
                    raisedBy: "You (verifier)",
                    status: "open" as const,
                  },
                ],
              }
            : x,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "You (verifier)",
          "verifier",
          "finding-raised",
          "finding",
          id,
          `${action.severity.toUpperCase()} — ${action.title}`,
        ),
      };
    }

    case "resolve-finding": {
      const next = {
        ...data,
        verifications: data.verifications.map((v) =>
          v.id === action.verificationId
            ? {
                ...v,
                findings: v.findings.map((f) =>
                  f.id === action.findingId
                    ? { ...f, status: "resolved" as const, response: action.response }
                    : f,
                ),
              }
            : v,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "You (verifier)",
          "verifier",
          "finding-resolved",
          "finding",
          action.findingId,
          "Finding closed — corrective action accepted",
        ),
      };
    }

    case "verify-campaign": {
      const next = {
        ...data,
        campaigns: data.campaigns.map((c) =>
          c.id === action.campaignId ? { ...c, status: "verified" as const } : c,
        ),
        verifications: data.verifications.map((v) =>
          v.campaignId === action.campaignId
            ? {
                ...v,
                completedOn: now(),
                opinion: action.opinion,
                statement: action.statement,
                findings: v.findings.map((f) => ({
                  ...f,
                  status: "resolved" as const,
                  response: f.response ?? "Closed at verification opinion.",
                })),
                checklist: v.checklist.map((c) =>
                  c.state === "open" ? { ...c, state: "pass" as const } : c,
                ),
              }
            : v,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "You (verifier)",
          "verifier",
          "approve",
          "campaign",
          action.campaignId,
          `${action.opinion === "positive" ? "Positive" : "Qualified positive"} verification opinion issued`,
        ),
      };
    }

    case "reject-campaign": {
      const next = {
        ...data,
        campaigns: data.campaigns.map((c) =>
          c.id === action.campaignId ? { ...c, status: "rejected" as const } : c,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "You (verifier)",
          "verifier",
          "reject",
          "campaign",
          action.campaignId,
          `Verification rejected: ${action.reason}`,
        ),
      };
    }

    case "issue-credits": {
      const campaign = data.campaigns.find((c) => c.id === action.campaignId);
      if (!campaign) return data;
      const project = data.projects.find((p) => p.id === campaign.projectId);
      if (!project) return data;
      const siteIds = data.sites
        .filter((s) => s.projectId === project.id)
        .map((s) => s.id);
      const plotIds = data.plots
        .filter((p) => siteIds.includes(p.siteId))
        .map((p) => p.id);
      const areaHa = data.sites
        .filter((s) => s.projectId === project.id)
        .reduce((a, s) => a + s.areaHa, 0);

      const shape = data.campaigns
        .filter((c) => c.projectId === project.id)
        .map((c) => ({
          id: c.id,
          vintage: c.vintage,
          periodEnd: c.periodEnd,
          status: c.status,
        }));
      // The first monitored vintage has no predecessor, so anchor it against a
      // project-start reference stock (restoration starts nearly bare).
      const probe = projectSeries(
        project,
        data.sites,
        data.plots,
        data.observations,
        shape,
        DEFAULT_OPTIONS,
      );
      const b0 = probe.length ? probe[0].biomassCMg : 0;
      const t0 = {
        date: `${campaign.vintage}-01-01`,
        biomassCMg:
          project.activity === "restoration" ? b0 * 0.04 : b0 * 0.78,
      };
      const series = projectSeries(
        project,
        data.sites,
        data.plots,
        data.observations,
        shape,
        DEFAULT_OPTIONS,
        t0,
      );
      const idx = series.findIndex((s) => s.campaignId === campaign.id);
      const pt = series[idx];
      if (!pt) return data;

      const batch = computeCredits({
        project,
        areaHa,
        years: pt.years,
        biomassDeltaMgC: pt.biomassDeltaMgC,
        soilAccrualMgC: pt.soilAccrualCo2eMg / CO2_PER_C,
        firstPeriod: idx === 0,
      });
      const qty = Math.max(0, Math.round(batch.net));

      const maxSerial = data.issuances.reduce((a, i) => {
        const n = Number(i.serialTo.split("-").pop() ?? 0);
        return Math.max(a, Number.isFinite(n) ? n : 0);
      }, 100_000);
      const from = maxSerial + 1;

      const issuance: Issuance = {
        id: `iss-${campaign.id}`,
        projectId: project.id,
        campaignId: campaign.id,
        vintage: campaign.vintage,
        issuedOn: now(),
        serialFrom: `IN-${project.code.slice(-3)}-${campaign.vintage}-${String(from).padStart(6, "0")}`,
        serialTo: `IN-${project.code.slice(-3)}-${campaign.vintage}-${String(from + qty).padStart(6, "0")}`,
        grossT: Math.round(batch.gross),
        baselineT: Math.round(batch.baseline),
        leakageT: Math.round(batch.leakage),
        uncertaintyT: Math.round(batch.uncertainty),
        bufferT: Math.round(batch.buffer),
        netT: qty,
        status: "issued",
      };

      const next: Dataset = {
        ...data,
        issuances: [
          ...data.issuances.filter((i) => i.campaignId !== campaign.id),
          issuance,
        ],
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "Registry operations",
          "registry-admin",
          "issue",
          "issuance",
          issuance.id,
          `${qty.toLocaleString("en-IN")} tCO₂e issued for vintage ${campaign.vintage}`,
        ),
      };
    }

    case "retire-credits": {
      const next: Dataset = {
        ...data,
        issuances: data.issuances.map((i) =>
          i.id === action.issuanceId
            ? {
                ...i,
                status: "retired",
                retiredBy: action.buyer,
                retiredOn: now(),
              }
            : i,
        ),
      };
      const iss = data.issuances.find((i) => i.id === action.issuanceId);
      return {
        ...next,
        audit: audit(
          next,
          now(),
          action.buyer,
          "registry-admin",
          "retire",
          "issuance",
          action.issuanceId,
          `${iss ? iss.netT.toLocaleString("en-IN") : "0"} tCO₂e retired against a corporate claim`,
        ),
      };
    }

    case "update-params": {
      const next: Dataset = {
        ...data,
        projects: data.projects.map((p) =>
          p.id === action.projectId ? { ...p, params: action.params } : p,
        ),
      };
      return {
        ...next,
        audit: audit(
          next,
          now(),
          "You (project developer)",
          "project-developer",
          "parameter-change",
          "project",
          action.projectId,
          "Accounting parameters updated — all results recomputed",
        ),
      };
    }

    case "reset":
      return buildDataset();
  }
}

interface StoreValue {
  data: Dataset | null;
  dispatch: React.Dispatch<Action>;
  reset: () => void;
  ready: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  children,
  initialData,
}: {
  children: React.ReactNode;
  /** Server-generated seed so the first paint already has content */
  initialData?: Dataset;
}) {
  const [data, setData] = useState<Dataset | null>(initialData ?? null);
  const [ready, setReady] = useState(Boolean(initialData));

  useEffect(() => {
    let loaded: Dataset | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Dataset;
        if (parsed?.version === 1 && Array.isArray(parsed.projects)) loaded = parsed;
      }
    } catch {
      loaded = null;
    }
    if (loaded) setData(loaded);
    else if (!initialData) setData(buildDataset());
    setReady(true);
  }, [initialData]);

  useEffect(() => {
    if (!data || !ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full — the prototype still works in-memory */
    }
  }, [data, ready]);

  const dispatch = useCallback((action: Action) => {
    setData((d) => (d ? reducer(d, action) : d));
  }, []);

  const reset = useCallback(() => {
    setData(buildDataset());
  }, []);

  const value = useMemo(
    () => ({ data, dispatch, reset, ready }),
    [data, dispatch, reset, ready],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/* ---------------- derived selectors ---------------- */

export function useProject(projectId: string) {
  const { data } = useStore();
  return useMemo(() => {
    if (!data) return null;
    return data.projects.find((p) => p.id === projectId) ?? null;
  }, [data, projectId]);
}

export function useProjectSeries(project: Project | null) {
  const { data } = useStore();
  return useMemo(() => {
    if (!data || !project) return [];
    return projectSeries(
      project,
      data.sites,
      data.plots,
      data.observations,
      data.campaigns
        .filter((c) => c.projectId === project.id)
        .map((c) => ({
          id: c.id,
          vintage: c.vintage,
          periodEnd: c.periodEnd,
          status: c.status,
        })),
    );
  }, [data, project]);
}

export function useProjectStock(project: Project | null) {
  const { data } = useStore();
  return useMemo(() => {
    if (!data || !project) return null;
    return projectStock(project, data.sites, data.plots, data.observations);
  }, [data, project]);
}

export function campaignOf(data: Dataset | null, id: string): Campaign | undefined {
  return data?.campaigns.find((c) => c.id === id);
}
