"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { CO2_PER_C, dataQualityScore } from "@/lib/carbon";
import { creditsForCampaign } from "@/lib/derive";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  KV,
  Progress,
  SectionTitle,
  Select,
  Stat,
  Table,
  Tabs,
  TextArea,
} from "@/components/ui";
import { dateShort, num, titleCase } from "@/lib/format";
import type { Campaign, ChecklistState } from "@/lib/types";

const STATUS_TONE: Record<string, "emerald" | "amber" | "blue" | "rose" | "slate" | "cyan"> = {
  verified: "emerald",
  "under-review": "amber",
  submitted: "blue",
  rejected: "rose",
  "in-progress": "cyan",
  planned: "slate",
};

function VerificationInner() {
  const params = useSearchParams();
  const { data, dispatch, ready } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(
    params?.get("campaign") ?? null,
  );
  const [tab, setTab] = useState<"queue" | "review">("queue");
  const [statement, setStatement] = useState(
    "The monitoring report is materially correct and conforms to the applied methodology; the reported removals are fairly stated.",
  );
  const [rejectReason, setRejectReason] = useState("");
  const [newFinding, setNewFinding] = useState({
    severity: "minor" as "minor" | "major" | "observation",
    clause: "MRV §4.1",
    title: "",
    detail: "",
  });

  const campaigns = useMemo(() => {
    if (!data) return [];
    return data.campaigns
      .map((c) => ({
        c,
        project: data.projects.find((p) => p.id === c.projectId)!,
      }))
      .sort((a, b) => {
        const order: Record<string, number> = {
          "under-review": 0,
          submitted: 1,
          "in-progress": 2,
          verified: 3,
          rejected: 4,
          planned: 5,
        };
        return (
          (order[a.c.status] ?? 9) - (order[b.c.status] ?? 9) ||
          b.c.periodEnd.localeCompare(a.c.periodEnd)
        );
      });
  }, [data]);

  const selected = useMemo(
    () => campaigns.find((x) => x.c.id === selectedId) ?? null,
    [campaigns, selectedId],
  );

  const review = useMemo(() => {
    if (!data || !selected) return null;
    const v = data.verifications.find((x) => x.campaignId === selected.c.id) ?? null;
    const siteIds = data.sites
      .filter((s) => s.projectId === selected.project.id)
      .map((s) => s.id);
    const plots = data.plots.filter((p) => siteIds.includes(p.siteId));
    const plotIds = new Set(plots.map((p) => p.id));
    const obs = data.observations.filter(
      (o) => plotIds.has(o.plotId) && o.ts.slice(0, 4) === selected.c.vintage,
    );
    const batch = creditsForCampaign(data, selected.c);
    const issued = data.issuances.find((i) => i.campaignId === selected.c.id);
    const quality = dataQualityScore({
      plotsPlanned: selected.c.plotsPlanned,
      plotsSurveyed: selected.c.plotsSurveyed,
      completenessPct: selected.c.completenessPct,
      gpsAccuracyM:
        obs.reduce((a, o) => a + o.gpsAccuracyM, 0) / Math.max(obs.length, 1),
      hasSoilCores: obs.some((o) => o.soilCores.length > 0),
      hasPhotos: obs.some((o) => o.photoCount > 0),
      verified: selected.c.status === "verified",
    });
    return { v, obs, plots, batch, issued, quality };
  }, [data, selected]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading verification queue…</div>;
  }

  const openFindings = data.verifications
    .flatMap((v) => v.findings)
    .filter((f) => f.status === "open");

  const setChecklist = (verificationId: string, itemId: string, state: ChecklistState) =>
    dispatch({ type: "set-checklist", verificationId, itemId, state });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Verification</h1>
          <p className="mt-1 text-[13px] text-muted">
            Independent review of monitoring reports — checklist, findings and opinion
          </p>
        </div>
        <div className="flex gap-3">
          <Stat
            label="Awaiting review"
            value={String(
              data.campaigns.filter(
                (c) => c.status === "submitted" || c.status === "under-review",
              ).length,
            )}
            tone="amber"
          />
          <Stat label="Verified vintages" value={String(data.campaigns.filter((c) => c.status === "verified").length)} tone="emerald" />
          <Stat label="Open findings" value={String(openFindings.length)} tone={openFindings.length ? "rose" : "emerald"} />
        </div>
      </header>

      <Tabs
        active={tab}
        onChange={(t) => setTab(t as "queue" | "review")}
        tabs={[
          { id: "queue", label: "Queue", count: campaigns.length },
          { id: "review", label: "Review workspace" },
        ]}
      />

      {tab === "queue" && (
        <Card>
          <SectionTitle
            title="Monitoring reports"
            sub="Sorted by review priority. Open one to run the verification workflow."
          />
          <Table
            head={[
              "Campaign",
              "Project",
              "Vintage",
              "Plots",
              "Completeness",
              "Submitted",
              "Verifier",
              "Findings",
              "Status",
              "",
            ]}
            rows={campaigns.map(({ c, project }) => {
              const v = data.verifications.find((x) => x.campaignId === c.id);
              const openF = v?.findings.filter((f) => f.status === "open").length ?? 0;
              return [
                <span key="c" className="font-medium">
                  {c.code}
                </span>,
                <span key="p" className="text-[11.5px] text-muted">
                  {project.code} · {project.name.slice(0, 26)}
                </span>,
                <span key="v" className="tnum">
                  {c.vintage}
                </span>,
                <span key="pl" className="flex items-center gap-2">
                  <Progress
                    value={(c.plotsSurveyed / Math.max(c.plotsPlanned, 1)) * 100}
                    tone={c.plotsSurveyed >= c.plotsPlanned ? "emerald" : "amber"}
                    className="w-12"
                  />
                  <span className="tnum text-[11px]">
                    {c.plotsSurveyed}/{c.plotsPlanned}
                  </span>
                </span>,
                <span key="cp" className="tnum">
                  {c.completenessPct}%
                </span>,
                c.submittedOn ? dateShort(c.submittedOn) : "—",
                <span key="b" className="text-[11.5px]">
                  {v?.body ?? "—"}
                </span>,
                openF > 0 ? (
                  <Badge key="f" tone="rose">
                    {openF} open
                  </Badge>
                ) : (
                  <span key="f" className="text-faint">
                    none
                  </span>
                ),
                <Badge key="s" tone={STATUS_TONE[c.status] ?? "slate"}>
                  {titleCase(c.status)}
                </Badge>,
                <button
                  key="go"
                  onClick={() => {
                    setSelectedId(c.id);
                    setTab("review");
                  }}
                  className="text-[11.5px] text-accent hover:underline"
                >
                  Open →
                </button>,
              ];
            })}
          />
        </Card>
      )}

      {tab === "review" && (
        <div>
          <div className="mb-4">
            <Select
              value={selectedId ?? ""}
              onChange={(e) => setSelectedId(e.target.value)}
              className="max-w-md"
            >
              <option value="">Select a monitoring report…</option>
              {campaigns.map(({ c, project }) => (
                <option key={c.id} value={c.id}>
                  {project.code} · {c.code} · vintage {c.vintage} ·{" "}
                  {titleCase(c.status)}
                </option>
              ))}
            </Select>
          </div>

          {!selected || !review ? (
            <EmptyState
              title="No report selected"
              body="Pick a monitoring report from the queue to run the verification workflow."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <Card>
                  <SectionTitle
                    title={`${selected.project.code} · ${selected.c.code} — vintage ${selected.c.vintage}`}
                    sub={`${selected.project.methodology} · ${selected.project.registry}`}
                    right={
                      <Badge tone={STATUS_TONE[selected.c.status] ?? "slate"}>
                        {titleCase(selected.c.status)}
                      </Badge>
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-muted">
                        Monitoring period
                      </p>
                      <p className="text-[12px]">
                        {dateShort(selected.c.periodStart)} →{" "}
                        {dateShort(selected.c.periodEnd)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-muted">
                        Field team
                      </p>
                      <p className="text-[12px]">{selected.c.leadTeam}</p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-muted">
                        Plots surveyed
                      </p>
                      <p className="tnum text-[12px]">
                        {selected.c.plotsSurveyed} / {selected.c.plotsPlanned}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10.5px] uppercase tracking-wider text-muted">
                        Data completeness
                      </p>
                      <p className="tnum text-[12px]">{selected.c.completenessPct}%</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.c.status === "submitted" && (
                      <Button
                        variant="primary"
                        onClick={() => dispatch({ type: "start-review", campaignId: selected.c.id })}
                      >
                        Start verification
                      </Button>
                    )}
                    {selected.c.status === "under-review" && (
                      <>
                        <Button
                          variant="primary"
                          disabled={
                            (review.v?.findings.filter((f) => f.status === "open" && f.severity === "major").length ?? 0) > 0
                          }
                          onClick={() =>
                            dispatch({
                              type: "verify-campaign",
                              campaignId: selected.c.id,
                              opinion:
                                (review.v?.findings.length ?? 0) > 0
                                  ? "qualified-positive"
                                  : "positive",
                              statement,
                            })
                          }
                        >
                          Issue verification opinion
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            dispatch({
                              type: "reject-campaign",
                              campaignId: selected.c.id,
                              reason: rejectReason || "Material non-conformance",
                            })
                          }
                        >
                          Reject report
                        </Button>
                      </>
                    )}
                    {selected.c.status === "verified" && !review.issued && (
                      <Button
                        variant="primary"
                        onClick={() => dispatch({ type: "issue-credits", campaignId: selected.c.id })}
                      >
                        Issue {num(review.batch?.net ?? 0)} tCO₂e
                      </Button>
                    )}
                    {review.issued && (
                      <Badge tone="violet">
                        {num(review.issued.netT)} tCO₂e issued · {review.issued.serialFrom}
                      </Badge>
                    )}
                  </div>
                  {selected.c.status === "under-review" && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <Field label="Verification statement">
                        <TextArea rows={2} value={statement} onChange={(e) => setStatement(e.target.value)} />
                      </Field>
                      <Field label="Rejection reason (if rejecting)">
                        <Input
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Material non-conformance…"
                        />
                      </Field>
                    </div>
                  )}
                </Card>

                {review.v && (
                  <Card>
                    <SectionTitle
                      title="Verification checklist"
                      sub={`${review.v.body} · lead auditor ${review.v.leadAuditor}`}
                    />
                    <div className="space-y-2">
                      {review.v.checklist.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-line bg-canvas/40 p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="text-[12px] text-ink">{c.requirement}</p>
                            <p className="text-[10.5px] text-faint">
                              {c.ref}
                              {c.note ? ` · ${c.note}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {(["pass", "fail", "open"] as ChecklistState[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => setChecklist(review.v!.id, c.id, s)}
                                className={`rounded-md border px-2 py-0.5 text-[10.5px] transition-colors ${
                                  c.state === s
                                    ? s === "pass"
                                      ? "border-white bg-white text-black font-semibold"
                                      : s === "fail"
                                        ? "border-white/45 bg-white/[0.14] text-white"
                                        : "border-white/20 bg-white/[0.07] text-neutral-200"
                                    : "border-line text-faint hover:text-ink"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {review.v && (
                  <Card>
                    <SectionTitle
                      title="Findings"
                      sub="Non-conformances raised against the monitoring report"
                    />
                    <div className="space-y-2">
                      {review.v.findings.length === 0 && (
                        <p className="text-[12px] text-faint">No findings raised.</p>
                      )}
                      {review.v.findings.map((f) => (
                        <div
                          key={f.id}
                          className={`rounded-lg border p-3 ${
                            f.status === "resolved"
                              ? "border-white/25 bg-white/[0.06]"
                              : f.severity === "major"
                                ? "border-white/40 bg-white/[0.09]"
                                : "border-white/[0.14] bg-white/[0.04]"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              tone={
                                f.severity === "major"
                                  ? "rose"
                                  : f.severity === "minor"
                                    ? "amber"
                                    : "slate"
                              }
                            >
                              {f.severity}
                            </Badge>
                            <span className="text-[12px] font-medium text-ink">
                              {f.title}
                            </span>
                            <span className="text-[10.5px] text-faint">{f.clause}</span>
                            <span className="ml-auto text-[10.5px] text-faint">
                              {dateShort(f.raisedOn)} · {f.raisedBy}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
                            {f.detail}
                          </p>
                          {f.status === "resolved" ? (
                            <p className="mt-2 border-t border-white/20 pt-1.5 text-[11px] text-white">
                              ✓ Closed — {f.response}
                            </p>
                          ) : (
                            <div className="mt-2 flex gap-2">
                              <Button
                                size="sm"
                                onClick={() =>
                                  dispatch({
                                    type: "resolve-finding",
                                    verificationId: review.v!.id,
                                    findingId: f.id,
                                    response:
                                      "Revised dataset and supporting evidence submitted; verifier accepted the correction.",
                                  })
                                }
                              >
                                Mark resolved
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-lg border border-dashed border-line p-3">
                      <p className="mb-2 text-[10.5px] uppercase tracking-wider text-muted">
                        Raise a new finding
                      </p>
                      <div className="grid gap-2 sm:grid-cols-4">
                        <Select
                          value={newFinding.severity}
                          onChange={(e) =>
                            setNewFinding((n) => ({
                              ...n,
                              severity: e.target.value as typeof n.severity,
                            }))
                          }
                        >
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                          <option value="observation">Observation</option>
                        </Select>
                        <Input
                          value={newFinding.clause}
                          onChange={(e) =>
                            setNewFinding((n) => ({ ...n, clause: e.target.value }))
                          }
                          placeholder="Clause"
                        />
                        <Input
                          className="sm:col-span-2"
                          value={newFinding.title}
                          onChange={(e) =>
                            setNewFinding((n) => ({ ...n, title: e.target.value }))
                          }
                          placeholder="Finding title"
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <TextArea
                          rows={2}
                          value={newFinding.detail}
                          onChange={(e) =>
                            setNewFinding((n) => ({ ...n, detail: e.target.value }))
                          }
                          placeholder="Describe the non-conformance and the evidence required…"
                        />
                        <Button
                          disabled={!newFinding.title}
                          onClick={() => {
                            dispatch({
                              type: "raise-finding",
                              verificationId: review.v!.id,
                              severity: newFinding.severity,
                              clause: newFinding.clause,
                              title: newFinding.title,
                              detail:
                                newFinding.detail ||
                                "Evidence observed during desk review does not fully reconcile with the monitoring report narrative.",
                            });
                            setNewFinding({
                              severity: "minor",
                              clause: "MRV §4.1",
                              title: "",
                              detail: "",
                            });
                          }}
                        >
                          Raise
                        </Button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              <div className="space-y-4">
                <Card>
                  <SectionTitle title="Data quality" sub="Gate before an opinion is issued" />
                  <div className="space-y-1">
                    <KV k="Score" v={`${review.quality} / 100`} mono />
                    <KV k="Plot coverage" v={`${selected.c.plotsSurveyed}/${selected.c.plotsPlanned}`} mono />
                    <KV k="Field completeness" v={`${selected.c.completenessPct}%`} mono />
                    <KV
                      k="Mean GPS accuracy"
                      v={`${num(
                        review.obs.reduce((a, o) => a + o.gpsAccuracyM, 0) /
                          Math.max(review.obs.length, 1),
                        1,
                      )} m`}
                      mono
                    />
                    <KV k="Surveys on file" v={review.obs.length} mono />
                    <KV
                      k="Soil cores"
                      v={review.obs.filter((o) => o.soilCores.length > 0).length}
                      mono
                    />
                  </div>
                  <Progress value={review.quality} tone={review.quality > 80 ? "emerald" : "amber"} className="mt-3" />
                </Card>

                {review.batch && (
                  <Card>
                    <SectionTitle title="Quantification check" sub="Recomputed independently by the platform" />
                    <div className="space-y-1">
                      {review.batch.lines
                        .filter((l) =>
                          ["gross", "leakage", "uncertainty", "buffer", "net"].includes(l.key),
                        )
                        .map((l) => (
                          <KV
                            key={l.key}
                            k={l.label}
                            v={`${l.sign < 0 ? "−" : ""}${num(Math.abs(l.value))}`}
                            mono
                          />
                        ))}
                    </div>
                    <p className="mt-2 text-[10.5px] leading-relaxed text-faint">
                      Uncertainty deduction capped at{" "}
                      {(selected.project.params.maxUncertaintyDeduction * 100).toFixed(0)} %;
                      buffer pool {selected.project.bufferPct} %.
                    </p>
                  </Card>
                )}

                {review.v && (
                  <Card>
                    <SectionTitle title="Verification activities" />
                    <ul className="space-y-1 text-[11.5px] text-muted">
                      {review.v.activities.map((a) => (
                        <li key={a} className="flex gap-2">
                          <span className="text-accent">·</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 space-y-1">
                      <KV k="Body" v={review.v.body} />
                      <KV k="Lead auditor" v={review.v.leadAuditor} />
                      <KV k="Opened" v={dateShort(review.v.startedOn)} />
                      <KV k="Completed" v={review.v.completedOn ? dateShort(review.v.completedOn) : "—"} />
                      {review.v.opinion && (
                        <KV k="Opinion" v={titleCase(review.v.opinion)} />
                      )}
                    </div>
                  </Card>
                )}

                <Card>
                  <SectionTitle title="Remote-sensing cross-check" />
                  <div className="space-y-2">
                    {data.remoteSensing
                      .filter((r) => r.campaignId === selected.c.id)
                      .slice(0, 6)
                      .map((r) => (
                        <div key={r.id} className="rounded-lg border border-line bg-canvas/40 p-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11.5px] font-medium">{r.sensor}</span>
                            <span className="text-[10px] text-faint">{dateShort(r.date)}</span>
                          </div>
                          <div className="mt-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-[10px] text-muted">NDVI</span>
                              <Progress value={r.ndvi * 100} tone="emerald" className="flex-1" />
                              <span className="tnum text-[10px]">{r.ndvi.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="w-12 text-[10px] text-muted">Extent</span>
                              <span className="tnum text-[10.5px] text-ink">
                                {num(r.extentHa)} ha
                              </span>
                              <span className="ml-auto text-[10px] text-faint">
                                {r.resolutionM} m · {r.cloudCoverPct}% cloud
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
                    {data.remoteSensing.filter((r) => r.campaignId === selected.c.id).length ===
                      0 && (
                      <p className="text-[12px] text-faint">
                        No satellite pass linked to this campaign.
                      </p>
                    )}
                  </div>
                </Card>

                <Card>
                  <SectionTitle title="Project context" />
                  <div className="space-y-1">
                    <KV k="Proponent" v={selected.project.proponent} />
                    <KV k="Region" v={selected.project.region} />
                    <KV k="Activity" v={titleCase(selected.project.activity)} />
                    <KV k="Baseline" v={`${selected.project.baseline.biomassLossRateMgCHaYr} Mg C ha⁻¹ yr⁻¹`} mono />
                  </div>
                  <Link
                    href={`/projects/${selected.project.id}`}
                    className="mt-3 inline-block text-[11.5px] text-accent hover:underline"
                  >
                    Open full project record →
                  </Link>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading…</div>}>
      <VerificationInner />
    </Suspense>
  );
}
