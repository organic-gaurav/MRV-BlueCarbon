# MRV-BlueCarbon

A working prototype of an **MRV platform for coastal blue-carbon projects** —
Monitoring, Reporting and Verification for mangrove, seagrass and saltmarsh
restoration and conservation.

It is a clickable, end-to-end prototype: field measurement → carbon accounting →
verification → credit issuance → reporting → audit. Every number on screen is
computed from the stored plot measurements; nothing is hard-coded.

```
npm install
npm run dev        # http://localhost:3000  (editing / hot reload)
```

**For a demo, use the production build** — it is dramatically snappier:

```
npm run serve      # install + build + start, all in one  -> http://localhost:3000
```

(`npm run serve` is the one command you need on a fresh clone or after
`rm -rf node_modules .next`. It is equivalent to
`npm install && npm run build && npm run start`.)

Measured in this repo: dev mode ships ~800 KB of uncompressed HTML per page
(~1.2 s to navigate); the production build serves the same page gzipped in
~78 KB (~20–50 ms). Use `npm run dev` only while editing.

Other scripts: `npm run typecheck`, `npm run check` (prints a summary of the
generated dataset and the credit calculation for every project).

---

## Deploying

The app is fully prerendered, so it ships as a **static site** — no server, no
database. `.github/workflows/deploy.yml` builds it with
`NEXT_OUTPUT=export GH_PAGES=true npm run build` (output in `out/`) and
publishes to **GitHub Pages**.

One-time setup in the repo:

1. **Settings → Pages → Build and deployment → Source → `GitHub Actions`**
2. Push to this branch (or re-run the failed workflow) — the Action builds and
   deploys.

The site then lives at:

```
https://organic-gaurav.github.io/MRV-BlueCarbon/
```

`basePath` is applied automatically when `GH_PAGES=true`, so assets resolve
correctly under the `/MRV-BlueCarbon/` project path. To host it elsewhere
(Vercel, Netlify, S3), deploy the `out/` folder — or use the default server
build with `npm run serve`.

## Branding

All names, handles and credit lines live in one file — `src/lib/branding.ts`.
Change `BRAND` and the sidebar, browser tab, favicon, page metadata and printed
report footer all follow.

## What's in the box

Nine screens, one shared data model.

| Screen | What it does |
| --- | --- |
| **Overview** `/` | Portfolio KPIs, stock-over-time, ecosystem split, issuance by vintage, MRV pipeline status |
| **Projects** `/projects` | Register with filters; per-project carbon density, credits, quality score |
| **Geospatial** `/map` | Site polygons, permanent plots and latest satellite pass on an offline SVG basemap |
| **Field collection** `/collect` | Ecosystem-specific survey form with a live carbon read-out and an offline sync queue |
| **Carbon engine** `/engine` | Interactive sandbox: change an input, watch allometry → pools → CO₂e → credits, with every formula shown |
| **Verification** `/verification` | Verifier workspace: checklist, findings, opinion, reject / approve / issue |
| **Registry** `/registry` | Serialised credits, buffer pool, retirement against corporate claims |
| **Monitoring report** `/reports` | Printable/PDF monitoring report regenerated from live data; JSON export |
| **Audit trail** `/audit` | Append-only, hash-chained log with integrity verification |

### Data

Runs entirely offline — **no API keys, no tile server, no database**. A seeded
PRNG generates a deterministic portfolio of 6 projects across Indian coastal
states (Sundarbans, Gulf of Kutch, Pichavaram, Gulf of Mannar, Andaman
archipelago, Konkan), 17 sites, 79 permanent plots and 324 plot surveys. The
dataset is persisted to `localStorage`, so edits survive a refresh;
**Reset demo data** in the sidebar restores the pristine seed.

The geospatial view draws a deliberately coarse offline coastline of peninsular
India, Sri Lanka and the Andamans. Swap in MapLibre + a tile provider when real
geospatial work starts.

---

## The carbon engine

`src/lib/carbon.ts` is all pure functions, so results are reproducible and can be
shown step by step to an auditor.

**Biomass**

- Above-ground: `AGB = 0.251 · ρ · D^2.46` (Komiyama et al. 2005 mangrove
  allometry; `D` = DBH cm, `ρ` = species wood density).
- Below-ground: root:shoot ratio, or `BGB = 0.199 · ρ^0.899 · D^2.22`.
- Seagrass and saltmarsh pools come from quadrat harvests (g DW m⁻² × 0.01 →
  Mg ha⁻¹).

**Soil** — the dominant pool in blue carbon

- Stock: `C = depth · bulk density · OC%` (Mg C ha⁻¹).
- Burial: `rate = accretion/10 · bulk density · OC%` (Mg C ha⁻¹ yr⁻¹).

**From removals to credits**

```
gross      = Δ biomass C + soil burial + baseline losses avoided
subtotal   = gross − leakage
net        = subtotal − uncertainty deduction − buffer pool contribution
```

Uncertainty is propagated across pools in quadrature, converted to a one-sided
90 % interval (z = 1.645) and capped by the methodology. The buffer pool
contribution covers non-permanence risk.

Defaults are illustrative and shipped per ecosystem (`defaultParams`); a real
project justifies each parameter in its validated methodology.

---

## Architecture

```
src/
  app/                    Next.js App Router pages (all client-side)
  components/             UI kit, charts (hand-rolled SVG), map, app shell
  lib/
    types.ts              domain model
    carbon.ts             carbon accounting engine (pure)
    seed.ts               deterministic synthetic dataset generator
    derive.ts             portfolio-level aggregations
    store.tsx             client store: reducer + localStorage persistence
    geo.ts                offline basemap geometry + projection
    format.ts             number/date formatting
scripts/check.ts          sanity check for engine + seed
```

State lives in a `useReducer` store; mutations are typed actions, and each one
appends to a hash-chained audit log (`prevHash → hash`), so history is
tamper-evident and the audit screen can verify it.

### Deliberate prototype shortcuts

- Auth is mocked — roles are labels on audit entries, not enforced.
- No backend; persistence is `localStorage`. A real deployment needs Postgres +
  PostGIS and a proper registry integration.
- Allometric and soil parameters are seeded, not measured; the methodology is
  referenced but not validated.
- Remote-sensing values are synthetic summaries, not derived from imagery.

---

## Tech

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · zero runtime
dependencies beyond React (charts and map are hand-written SVG).
