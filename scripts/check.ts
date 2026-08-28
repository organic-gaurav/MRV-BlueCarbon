/** Sanity check for the carbon engine + seed generator (npm run check). */
import { buildDataset } from "../src/lib/seed";
import { projectStock, projectSeries, computeCredits, CO2_PER_C } from "../src/lib/carbon";

const data = buildDataset();
console.log("projects       :", data.projects.length);
console.log("sites          :", data.sites.length);
console.log("plots          :", data.plots.length);
console.log("campaigns      :", data.campaigns.length);
console.log("observations   :", data.observations.length);
console.log("verifications  :", data.verifications.length);
console.log("rs passes      :", data.remoteSensing.length);
console.log("issuances      :", data.issuances.length);
console.log("audit events   :", data.audit.length);
console.log("");

for (const p of data.projects) {
  const st = projectStock(p, data.sites, data.plots, data.observations);
  const campaigns = data.campaigns
    .filter((c) => c.projectId === p.id)
    .map((c) => ({ id: c.id, vintage: c.vintage, periodEnd: c.periodEnd, status: c.status }));
  const series = projectSeries(p, data.sites, data.plots, data.observations, campaigns);
  const issued = data.issuances.filter((i) => i.projectId === p.id);
  console.log(
    `${p.code} ${p.name.slice(0, 34).padEnd(34)} ${String(Math.round(st.areaHa)).padStart(5)} ha  ` +
      `${st.cMgHa.toFixed(0).padStart(4)} MgC/ha  ` +
      `${Math.round(st.totalCo2eMg).toLocaleString().padStart(9)} tCO2e stock  ` +
      `burial ${st.burialMgCYr.toFixed(0).padStart(4)} MgC/yr  ` +
      `series ${series.length}  issued ${issued.reduce((a, i) => a + i.netT, 0).toLocaleString()} t`,
  );
  const last = series[series.length - 1];
  if (last) {
    const batch = computeCredits({
      project: p,
      areaHa: st.areaHa,
      years: last.years,
      biomassDeltaMgC: series.length > 1 ? last.biomassCMg - series[series.length - 2].biomassCMg : last.biomassCMg,
      soilAccrualMgC: last.soilAccrualCo2eMg / CO2_PER_C,
      firstPeriod: series.length === 1,
    });
    console.log(
      `   latest vintage ${last.vintage}: gross ${batch.gross.toFixed(0)}  baseline ${batch.baseline.toFixed(0)}  ` +
        `leakage ${batch.leakage.toFixed(0)}  unc ${batch.uncertainty.toFixed(0)} (${(batch.uncertaintyRel * 100).toFixed(1)}%)  ` +
        `buffer ${batch.buffer.toFixed(0)}  NET ${batch.net.toFixed(0)} tCO2e  (${batch.netPerHaYr.toFixed(2)} t/ha/yr)`,
    );
  }
  console.log(
    "   series:",
    series
      .map((s) => `${s.vintage}:${Math.round(s.totalCMg)}/${Math.round(s.deltaCo2eMg)}`)
      .join("  "),
  );
  console.log("");
}
