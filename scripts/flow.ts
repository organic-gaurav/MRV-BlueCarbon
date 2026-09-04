/** Exercise the reducer paths a user would click through in the UI. */
import { buildDataset, hashEvent } from "../src/lib/seed";
import { reducer } from "../src/lib/store";
import type { Dataset } from "../src/lib/types";

let d: Dataset = buildDataset();
const step = (label: string, action: Parameters<typeof reducer>[1]) => {
  const before = {
    obs: d.observations.length,
    audit: d.audit.length,
    iss: d.issuances.length,
    verified: d.campaigns.filter((c) => c.status === "verified").length,
  };
  d = reducer(d, action);
  const after = {
    obs: d.observations.length,
    audit: d.audit.length,
    iss: d.issuances.length,
    verified: d.campaigns.filter((c) => c.status === "verified").length,
  };
  const delta = Object.entries(after)
    .map(([k, v]) => `${k} ${before[k as keyof typeof before]}→${v}`)
    .join("  ");
  console.log(`${label.padEnd(28)} ${delta}`);
  return d;
};

// a submitted campaign awaiting verification
const target = d.campaigns.find((c) => c.status === "submitted")!;
console.log("campaign under test:", target.code, "vintage", target.vintage, "\n");

step("start-review", { type: "start-review", campaignId: target.id });
const v = d.verifications.find((x) => x.campaignId === target.id);
if (v) {
  step("raise-finding", {
    type: "raise-finding", verificationId: v.id, severity: "minor",
    clause: "MRV §4.1", title: "Test finding", detail: "detail",
  });
  const f = d.verifications.find((x) => x.id === v.id)!.findings.at(-1)!;
  step("resolve-finding", {
    type: "resolve-finding", verificationId: v.id, findingId: f.id, response: "closed",
  });
}
step("verify-campaign", {
  type: "verify-campaign", campaignId: target.id,
  opinion: "qualified-positive", statement: "ok",
});
step("issue-credits", { type: "issue-credits", campaignId: target.id });

const iss = d.issuances.find((i) => i.campaignId === target.id);
console.log("\nissuance created:", iss ? {
  vintage: iss.vintage, netT: iss.netT, grossT: iss.grossT,
  serial: `${iss.serialFrom} → ${iss.serialTo}`, status: iss.status,
} : "NONE");

if (iss) step("retire-credits", { type: "retire-credits", issuanceId: iss.id, buyer: "Test Buyer" });

// field-collection sync path
const plot = d.plots[0];
const proj = d.projects[0];
step("add-observation (sync)", {
  type: "add-observation", projectId: proj.id,
  observation: {
    id: "obs-test-1", plotId: plot.id, ts: "2026-04-01", observer: "qa",
    device: "test", gpsAccuracyM: 3, photoCount: 4,
    stems: [{ id: "s1", species: "Rhizophora mucronata", dbhCm: 12, heightM: 8, vigour: "live" }],
    quadrats: [], soilCores: [],
  },
});

// audit chain integrity after all mutations
let prev = "genesis";
let bad: string | null = null;
for (const e of d.audit) {
  const { hash, ...base } = e;
  if (hashEvent(prev, base) !== hash) { bad = e.id; break; }
  prev = hash;
}
console.log("\naudit chain after all mutations:", bad ? `BROKEN at ${bad}` : "INTACT");
console.log("duplicate observations for same plot+year prevented:",
  reducer(d, { type: "add-observation", projectId: proj.id,
    observation: { id: "obs-test-2", plotId: plot.id, ts: "2026-05-01", observer: "qa",
      device: "test", gpsAccuracyM: 3, photoCount: 4, stems: [], quadrats: [], soilCores: [] }
  }).observations.length === d.observations.length ? "yes" : "no");
