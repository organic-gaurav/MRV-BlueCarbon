"use client";

import React, { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { hashEvent } from "@/lib/seed";
import {
  Badge,
  Card,
  Input,
  SectionTitle,
  Select,
  Stat,
  Table,
} from "@/components/ui";
import { dateShort, num, titleCase } from "@/lib/format";

const ACTION_TONE: Record<string, "emerald" | "amber" | "rose" | "blue" | "cyan" | "slate" | "violet"> = {
  approve: "emerald",
  reject: "rose",
  issue: "violet",
  retire: "slate",
  "review-start": "amber",
  "finding-raised": "rose",
  "finding-resolved": "emerald",
  submit: "blue",
  "survey-upload": "cyan",
  "parameter-change": "amber",
  create: "slate",
  sync: "cyan",
};

export default function AuditPage() {
  const { data, ready } = useStore();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("all");
  const [verified, setVerified] = useState<boolean | null>(null);

  const events = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return [...data.audit]
      .sort((a, b) => b.ts.localeCompare(a.ts) || b.id.localeCompare(a.id))
      .filter((e) => (action === "all" ? true : e.action === action))
      .filter((e) =>
        needle === ""
          ? true
          : `${e.actor} ${e.note} ${e.entity} ${e.entityId}`.toLowerCase().includes(needle),
      );
  }, [data, q, action]);

  const chainCheck = useMemo(() => {
    if (!data) return null;
    let prev = "genesis";
    let bad: string | null = null;
    for (let i = 0; i < data.audit.length; i++) {
      const e = data.audit[i];
      const { hash, ...base } = e;
      const expect = hashEvent(prev, base);
      if (expect !== hash) {
        bad = e.id;
        break;
      }
      prev = hash;
    }
    return { ok: bad == null, firstBad: bad, length: data.audit.length };
  }, [data]);

  if (!data || !ready) {
    return <div className="p-8 text-sm text-muted">Loading audit trail…</div>;
  }

  const actions = [...new Set(data.audit.map((e) => e.action))].sort();

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
        <p className="mt-1 text-[13px] text-muted">
          Append-only, hash-chained log of every action taken in the platform
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Events" value={num(data.audit.length)} tone="cyan" />
        <Stat
          label="Chain integrity"
          value={chainCheck?.ok ? "Verified" : "Broken"}
          tone={chainCheck?.ok ? "emerald" : "rose"}
          hint={
            chainCheck?.ok
              ? "All hashes recompute correctly"
              : `Tampering detected at ${chainCheck?.firstBad}`
          }
        />
        <Stat
          label="Verifier actions"
          value={num(
            data.audit.filter((e) => e.role === "verifier").length,
          )}
          tone="amber"
        />
        <Stat
          label="Issuances & retirements"
          value={num(
            data.audit.filter((e) => e.action === "issue" || e.action === "retire").length,
          )}
          tone="violet"
        />
      </div>

      <Card>
        <SectionTitle
          title="Hash chain"
          sub="Each event stores the hash of the previous one, so any edit to history breaks the chain"
        />
        <div className="flex flex-wrap gap-1.5">
          {data.audit.slice(0, 40).map((e, i) => {
            const ok = i === 0 ? e.prevHash === "genesis" : true;
            return (
              <div
                key={e.id}
                title={`${e.ts} · ${e.action} · ${e.hash}`}
                className={`group relative h-8 w-8 rounded-md border text-center text-[9px] leading-8 ${
                  ok
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-white/45 bg-white/[0.13] text-white"
                }`}
              >
                {e.hash.slice(0, 3)}
              </div>
            );
          })}
          {data.audit.length > 40 && (
            <div className="flex h-8 items-center px-2 text-[10.5px] text-faint">
              +{data.audit.length - 40} more
            </div>
          )}
        </div>
        <p className="mt-2 text-[10.5px] text-faint">
          First three hex characters of each event hash, in chronological order.
          Hover for detail.
        </p>
      </Card>

      <Card>
        <SectionTitle title="Event log" sub="Newest first" />
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            placeholder="Search actor, entity or note…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-64"
          />
          <Select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="all">All actions</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {titleCase(a)}
              </option>
            ))}
          </Select>
        </div>
        <Table
          head={["When", "Actor", "Role", "Action", "Entity", "Note", "Hash"]}
          rows={events.map((e) => [
            <span key="t" className="tnum text-[11.5px]">
              {dateShort(e.ts)}
            </span>,
            <span key="a" className="text-[11.5px]">
              {e.actor}
            </span>,
            <Badge key="r" tone="slate">
              {titleCase(e.role)}
            </Badge>,
            <Badge key="ac" tone={ACTION_TONE[e.action] ?? "slate"}>
              {titleCase(e.action)}
            </Badge>,
            <span key="e" className="text-[11px] text-muted">
              {e.entity}
              <span className="block text-[10px] text-faint">{e.entityId}</span>
            </span>,
            <span key="n" className="max-w-md text-[11.5px] text-ink/90">
              {e.note}
            </span>,
            <span key="h" className="tnum font-mono text-[10px] text-faint">
              {e.prevHash.slice(0, 6)} → {e.hash.slice(0, 6)}
            </span>,
          ])}
        />
      </Card>
    </div>
  );
}
