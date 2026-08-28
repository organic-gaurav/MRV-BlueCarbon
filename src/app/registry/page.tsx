"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { BarChart, Donut, HBar } from "@/components/charts";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  KV,
  SectionTitle,
  Select,
  Stat,
  Table,
} from "@/components/ui";
import { dateShort, num, tCO2e } from "@/lib/format";

export default function RegistryPage() {
  const { data, dispatch, ready } = useStore();
  const [projectId, setProjectId] = useState("all");
  const [buyer, setBuyer] = useState("Meridian Freight");
  const [status, setStatus] = useState<"all" | "issued" | "retired">("all");

  const rows = useMemo(() => {
    if (!data) return [];
    return data.issuances
      .map((i) => ({
        i,
        project: data.projects.find((p) => p.id === i.projectId)!,
      }))
      .filter((r) => (projectId === "all" ? true : r.project.id === projectId))
      .filter((r) => (status === "all" ? true : r.i.status === status))
      .sort((a, b) => b.i.vintage.localeCompare(a.i.vintage));
  }, [data, projectId, status]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading registry…</div>;
  }

  const issued = rows.reduce((a, r) => a + r.i.netT, 0);
  const retired = rows.filter((r) => r.i.status === "retired").reduce((a, r) => a + r.i.netT, 0);
  const buffer = rows.reduce((a, r) => a + r.i.bufferT, 0);
  const gross = rows.reduce((a, r) => a + r.i.grossT, 0);
  const deductions = gross - issued;

  const byVintage = [...new Set(rows.map((r) => r.i.vintage))]
    .sort()
    .map((v) => {
      const inV = rows.filter((r) => r.i.vintage === v);
      return {
        vintage: v,
        net: inV.reduce((a, r) => a + r.i.netT, 0),
        buffer: inV.reduce((a, r) => a + r.i.bufferT, 0),
        deductions: inV.reduce(
          (a, r) => a + r.i.leakageT + r.i.uncertaintyT,
          0,
        ),
      };
    });

  const byBuyer = [...new Set(rows.filter((r) => r.i.retiredBy).map((r) => r.i.retiredBy!))].map(
    (b) => ({
      buyer: b,
      t: rows.filter((r) => r.i.retiredBy === b).reduce((a, r) => a + r.i.netT, 0),
    }),
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Registry & credits</h1>
          <p className="mt-1 text-[13px] text-muted">
            Serialised credits, buffer pool contributions and retirement against
            corporate claims
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All projects</option>
            {data.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All statuses</option>
            <option value="issued">Issued</option>
            <option value="retired">Retired</option>
          </Select>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Gross mitigation" value={num(gross)} unit="tCO₂e" tone="cyan" />
        <Stat label="Deductions" value={num(deductions)} unit="tCO₂e" tone="rose" hint="Leakage + uncertainty" />
        <Stat label="Net issued" value={num(issued)} unit="tCO₂e" tone="emerald" />
        <Stat label="Buffer pool" value={num(buffer)} unit="tCO₂e" tone="amber" hint="Non-permanence reserve" />
        <Stat label="Retired" value={num(retired)} unit="tCO₂e" tone="violet" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle title="Issuance by vintage" sub="Where each gross tonne goes" />
          <BarChart
            height={210}
            labels={byVintage.map((v) => v.vintage)}
            values={[]}
            stacked={[
              { name: "Net issued", color: "#ffffff", values: byVintage.map((v) => v.net) },
              { name: "Buffer pool", color: "#8a8a8a", values: byVintage.map((v) => v.buffer) },
              {
                name: "Leakage + uncertainty",
                color: "#3a3a3a",
                values: byVintage.map((v) => v.deductions),
              },
            ]}
            formatValue={(v) => `${Math.round(v / 1000)}k`}
          />
        </Card>

        <Card>
          <SectionTitle title="Credit status" />
          <Donut
            size={140}
            segments={[
              { label: "Available", value: Math.max(0, issued - retired), color: "#ffffff" },
              { label: "Retired", value: retired, color: "#c2c2c2" },
            ]}
            centre={{ value: tCO2e(issued), label: "issued" }}
          />
          <div className="mt-4 space-y-1">
            <KV k="Serial ranges" v={rows.length} mono />
            <KV k="Vintages" v={byVintage.length} mono />
            <KV k="Buffer share" v={`${issued ? num((buffer / (gross || 1)) * 100, 1) : "0"}%`} mono />
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Credit ledger"
          sub="Every issuance carries a contiguous serial range; retiring removes it from circulation permanently"
        />
        <Table
          head={[
            "Vintage",
            "Project",
            "Serial range",
            "Gross",
            "Leakage",
            "Uncertainty",
            "Buffer",
            "Net",
            "Status",
            "",
          ]}
          rows={rows.map(({ i, project }) => [
            <span key="v" className="tnum font-medium">
              {i.vintage}
            </span>,
            <span key="p" className="text-[11.5px]">
              {project.code}
              <span className="block text-[10px] text-faint">{project.registry}</span>
            </span>,
            <span key="s" className="tnum font-mono text-[10.5px]">
              {i.serialFrom}
              <span className="block text-faint">{i.serialTo}</span>
            </span>,
            <span key="g" className="tnum">
              {num(i.grossT)}
            </span>,
            <span key="l" className="tnum text-neutral-400">
              −{num(i.leakageT)}
            </span>,
            <span key="u" className="tnum text-neutral-400">
              −{num(i.uncertaintyT)}
            </span>,
            <span key="b" className="tnum text-neutral-400">
              −{num(i.bufferT)}
            </span>,
            <span key="n" className="tnum font-semibold text-white">
              {num(i.netT)}
            </span>,
            i.status === "retired" ? (
              <span key="st">
                <Badge tone="slate">retired</Badge>
                <span className="mt-0.5 block text-[10px] text-faint">
                  {i.retiredBy} · {dateShort(i.retiredOn ?? "")}
                </span>
              </span>
            ) : (
              <Badge key="st" tone="emerald">
                issued
              </Badge>
            ),
            i.status === "retired" ? (
              <span key="a" className="text-faint">
                —
              </span>
            ) : (
              <Button
                key="a"
                size="sm"
                onClick={() =>
                  dispatch({ type: "retire-credits", issuanceId: i.id, buyer })
                }
              >
                Retire
              </Button>
            ),
          ])}
        />
        <div className="mt-3 flex items-end gap-2 border-t border-line pt-3">
          <div className="w-64">
            <Field label="Retiring on behalf of">
              <Input value={buyer} onChange={(e) => setBuyer(e.target.value)} />
            </Field>
          </div>
          <p className="pb-2 text-[11px] text-faint">
            Retirement is permanent and recorded in the audit trail.
          </p>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Retirements by buyer" sub="Corporate claims against issued credits" />
          {byBuyer.length === 0 ? (
            <p className="text-[12px] text-faint">No credits retired yet in this view.</p>
          ) : (
            <HBar
              items={byBuyer.map((b) => ({ label: b.buyer, value: b.t, color: "#c2c2c2" }))}
              formatValue={(v) => `${num(v)} tCO₂e`}
            />
          )}
        </Card>

        <Card>
          <SectionTitle title="Buffer pool" sub="Held back for non-permanence risk" />
          <HBar
            items={data.projects.map((p) => ({
              label: `${p.code} · ${p.name}`,
              value: rows.filter((r) => r.project.id === p.id).reduce((a, r) => a + r.i.bufferT, 0),
              color: "#8a8a8a",
              sub: `${p.bufferPct}% contribution rate`,
            }))}
            formatValue={(v) => `${num(v)} tCO₂e`}
          />
        </Card>
      </div>
    </div>
  );
}
