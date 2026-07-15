# Strava Dashboard

Personal fitness analytics platform built on top of the Strava API. Syncs running activities, reconstructs second-by-second streams, classifies workouts, detects intervals/hill repeats/laps, and exposes it all through a full dashboard + training-analysis UI. Long-term vision: an "activity hub" aggregating multiple data sources (running via Strava, strength training, diet, etc.) into a single cross-domain analytics platform.

> **Status:** Active development — OAuth, sync pipeline, stream processing, the dashboard/detail/overview frontend, and a 9-chart training-analysis page (load, ACWR, monotony/strain, Z2, efficiency factor, cardiac drift) are in place. Currently in migration from a legacy Python pipeline to this TypeScript stack.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [API Endpoints](#api-endpoints)
- [Data Model](#data-model)
- [Testing](#testing)
- [Tooling & Conventions](#tooling--conventions)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Overview

The platform syncs running activities from Strava, stores them in PostgreSQL, and exposes them through a REST API consumed by a React SPA. The longer-term vision is a unified fitness hub aggregating multiple data sources (Strava, strength training, diet tracking) to enable cross-domain correlation.

Key capabilities:

- OAuth 2.0 integration with Strava (token exchange, automatic refresh, `profile:read_all` scope for HR zones)
- Incremental activity sync via scheduled cron job (every 6h) and an on-demand HTTP endpoint, with live progress polling (state, phase, counters, ETA)
- Second-by-second stream reconstruction via a multi-stage TypeScript CTE (interpolation, rolling average, HR smoothing/EWM, elevation smoothing, grade, pace) — used only for INTERVAL/HILL activities without recorded laps
- Workout classification (easy/long, interval, hill repeats) and automatic lap detection, with native Strava lap support, per-lap net elevation gain and max HR
- Gear tracking (shoes), best-effort PRs (top-3 per distance, derived — never materialized), and real Strava HR zones (athlete-level and per-activity, premium-gated)
- A dashboard SPA (list + detail), a Run Overview page (all-time totals, calendar, PRs, shoes) and a Run Analysis page recreating the legacy Python charts (weekly volume, pace × volume, Z2 vs above-Z2, pace-zone histogram, training load, ACWR, monotony & strain) plus two new ones (Efficiency Factor, cardiac drift/decoupling) — all client-side, sourced from per-lap data
- Legacy Python pipeline retained as a numerical oracle to validate every ported statistical algorithm (ACWR, monotony, strain, etc.)

---

## Architecture

```
┌───────────────────────────────┐        ┌──────────────────────────────────────────────────┐
│       React SPA (Vite)        │  REST  │                  NestJS Server                   │
│                               │◄──────►│                                                  │
│  Dashboard · Overview         │  JSON  │ StravaAuth │ StravaSync │ BestEffortsSync │      │
│  Analysis (9 charts) · Detail │        │ (OAuth)    │(cron+trig.)│ AthleteZonesSync│      │
│  Leaflet route maps           │        │                         │ HrZonesBackfill │      │
│  Tailwind + shadcn/ui         │        │                                                  │
│                               │        │ ActivitiesModule │ GearModule │ PersonalBests │  │
│                               │        │ UsersModule (maxHr, first write endpoint)        │
└───────────────────────────────┘        │                                                  │
                                         │                    Prisma 7 ORM                  │
                                         │                 (@prisma/adapter-pg)             │
                                         └────────────────────────┬─────────────────────────┘
                                                                   │
                                                                   ▼
                                                              PostgreSQL 17
                                                                (Docker)
```

**Stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js (via nvm) |
| Backend framework | NestJS |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL 17 (Docker) |
| Scheduler | `@nestjs/schedule` (cron) |
| Backend tests | Vitest |
| Frontend framework | React 19 + Vite |
| Frontend tests | Vitest (pure functions/hooks, no jsdom yet) |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives), Geist Variable font |
| Maps | Leaflet + OpenStreetMap raster tiles |
| Date handling | date-fns |
| Frontend lint/format | ESLint, Prettier |
| Commit tooling | Commitizen + Commitlint (Conventional Commits) via Husky hooks |
| Legacy pipeline | Python, pandas, SQLAlchemy, SQLite (validation oracle only) |
| Environment | WSL2 + Ubuntu |

---

## Project Structure

```
strava_dashboard/
├── python-pipeline/                # Legacy Python pipeline (pandas, SQLAlchemy, SQLite)
│                                   # Retained as numerical oracle for validating TS ports
│
├── server/                         # NestJS application
│   ├── prisma/
│   │   ├── schema.prisma           # Data model
│   │   ├── migrations/             # Migration history
│   │   └── seed.ts                 # Single-user seed
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── activities/             # ActivitiesModule — GET /activities, /:id, /laps, /hr-zones, /weekly-distance
│   │   ├── gear/                   # GearModule — GET /gear, /:id/activities
│   │   ├── personal-bests/         # PersonalBestsModule — GET /personal-bests, /history
│   │   ├── users/                  # UsersModule — GET/PATCH /users/me (maxHr)
│   │   └── strava/
│   │       ├── strava.module.ts
│   │       ├── auth/               # OAuth flow (redirect + callback)
│   │       ├── best-efforts/       # BestEffortsSyncService — historical backfill, decoupled from main sync
│   │       ├── hr-zones/           # AthleteZonesSyncService + HrZonesBackfillService — on-demand, decoupled
│   │       └── sync/               # strava-sync.service (orchestration incl. ensureGear, HR-zone fetch,
│   │           │                   # incremental best-effort hook), types.ts, strava-api.types.ts
│   │           ├── detectors/      # base, interval, hill, lap-classifier, workout-classifier
│   │           └── processors/     # streams-processor (TS CTE), lap-mapper, best-effort-mapper,
│   │                               # gear-mapper, hr-zone-mapper
│   ├── test/                       # Vitest unit + integration tests
│   └── .env                        # Strava + DB credentials (not committed)
│
└── client/                         # Vite + React SPA
    ├── vitest.config.ts
    ├── src/
    │   ├── App.tsx                 # Sidebar + content panel, state-based routing (no react-router)
    │   ├── lib/                    # Framework-free helpers (activityFormat, polyline, chartPath, API types)
    │   ├── components/             # Reusable generic UI (SegmentedControl, shadcn/ui primitives)
    │   └── features/
    │       ├── nav/                # Sidebar, navConfig.ts, PlaceholderPage
    │       ├── dashboard/          # Dashboard, Rail, ActivityList, RangeChip, WeeklyChart,
    │       │                       # DateRangePicker, SyncPanel, bins.ts (client-side aggregation)
    │       ├── overview/           # RunOverviewPage, RunCalendar, PersonalRecordsCard, ShoesSection
    │       ├── analysis/           # RunAnalysisPage (9 charts), useTrainingMetrics, useMaxHr,
    │       │                       # useHrZones, useDecoupling, AnalysisCard/ChartGrid/HoverStrip, statsMath.ts
    │       └── activity/           # ActivityDetailView, RouteMap
    └── index.css                   # Design tokens (light/dark theme)
```

---

## Getting Started

### Prerequisites

- Node.js (via [nvm](https://github.com/nvm-sh/nvm))
- Docker (for PostgreSQL)
- A [Strava API application](https://www.strava.com/settings/api)

### Environment Variables

Create a `.env` file inside `server/`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/strava_dashboard

# Strava OAuth
STRAVA_CLIENT_ID=your_client_id
STRAVA_CLIENT_SECRET=your_client_secret
STRAVA_REDIRECT_URI=https://localhost

# Single-user seed (cuid generated by `npx prisma db seed`,
# must be regenerated after every Docker volume reset)
SEED_USER_ID=your_seed_user_id
```

The `client/` app currently talks to the API at a hardcoded `http://localhost:3000`, so no frontend `.env` is required.

### Running the App

```bash
# 1. Start PostgreSQL
docker run --name strava-pg -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:17

# 2. Backend
cd server
npm install
npx prisma migrate dev
npx prisma db seed          # creates the single user + StravaAccount placeholder
npm run start:dev           # http://localhost:3000

# 3. Frontend (separate terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

After starting the server, complete the Strava OAuth flow by navigating to:

```
http://localhost:3000/strava/auth
```

Authorize the app on Strava (grants `read,activity:read_all,profile:read_all`), then trigger an initial sync (or use the "Sync" button in the dashboard rail):

```bash
curl -X POST http://localhost:3000/strava/sync
```

Then open `http://localhost:5173` to view the dashboard. Optionally set your max HR in Run > Analysis to unlock real Z2/efficiency-factor thresholds, and run the HR-zones/best-efforts backfills below to fill in historical data.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/strava/auth` | Redirects to the Strava OAuth authorization page |
| `GET` | `/strava/auth/callback` | Handles the OAuth callback, exchanges code for tokens |
| `POST` | `/strava/sync` | Fire-and-forget: triggers an incremental sync, returns current progress immediately |
| `GET` | `/strava/sync/status` | Returns live `SyncProgress` (state, phase, processed/synced/errors, ETA) |
| `POST` | `/strava/sync/backfill-polylines` | One-off backfill of `summary_polyline` for activities synced before it was captured |
| `POST` | `/strava/sync/backfill-gear` | One-off backfill linking activities to `Gear` synced before gear resolution existed |
| `POST` | `/strava/sync/backfill-lap-max-hr` | One-off backfill of `ActivityLap.maxHr` for laps synced before it was captured |
| `POST` | `/strava/best-efforts/backfill` | Fire-and-forget: backfills `ActivityBestEffort` for activities synced before it existed |
| `POST` | `/strava/hr-zones/sync-athlete` | Syncs the athlete's HR zone definitions (`AthleteHrZones`) — manual/on-demand, not on cron |
| `POST` | `/strava/hr-zones/backfill` | Fire-and-forget: backfills per-activity `ActivityHrZoneTime` for older activities |
| `GET` | `/activities` | Paginated activity list, ordered by `startDate` desc — filters: `page`, `limit`, `workoutType`, `dateFrom`, `dateTo`, `gearId` |
| `GET` | `/activities/:id` | Full detail for a single activity, including laps and route polyline |
| `GET` | `/activities/laps` | Flat list of every `ActivityLap` for the user (no pagination) — feeds Run > Analysis |
| `GET` | `/activities/hr-zones` | Per-activity real HR zone time from Strava (premium-gated) — feeds the Z2 tier system |
| `GET` | `/activities/weekly-distance` | Weekly distance aggregate (Monday-start, zero-filled), same filters as the list endpoint — no current frontend consumer |
| `GET` | `/gear` | Lists the user's gear with Strava-reported and locally-computed distance |
| `GET` | `/gear/:id/activities` | Paginated activities for a given gear item (delegates to `ActivitiesService.list`) |
| `GET` | `/personal-bests` | Top-3 best efforts per distance, derived via `$queryRaw` (never materialized) |
| `GET` | `/personal-bests/history?name=` | Full best-effort history for one distance (query param, since names like `"1/2 mile"` contain `/`) |
| `GET` | `/users/me` | Returns `{ maxHr }` |
| `PATCH` | `/users/me` | Updates `maxHr` (integer 100–230) — first write endpoint in the project |

The sync job also runs automatically every 6 hours via cron. CORS is open for `http://localhost:5173`.

---

## Data Model

```
User
 ├── StravaAccount      (OAuth tokens: access/refresh token, expiry)
 ├── AthleteHrZones     (Strava HR zone definitions, one per user)
 ├── Gear               (shoes: name, brand, distance, retired/primary)
 └── Activity           (one per Strava run)
      ├── ActivityLap        (detected or natively-recorded laps — primary source for analysis)
      ├── ActivitySecond     (second-by-second stream — only for INTERVAL/HILL without recorded laps)
      ├── ActivityBestEffort (Strava best-effort segments, one row per distance per activity)
      └── ActivityHrZoneTime (real HR zone time, one row per zone per activity)
```

Every entity carries a `userId` foreign key from day one, in preparation for multi-user and cross-domain (lifting, diet, etc.) support. Activities use `startDate` as the canonical correlation timestamp. `Activity.workoutType` (`EASY_OR_LONG` / `INTERVAL` / `HILL_REPEATS`) and `ActivityLap.lapType` (`RUN` / `WORKOUT` / `REST` / `STEADY` / `WARMUP` / `COOLDOWN` / `ACTIVITY`) are Postgres enums. `Gear` and `ActivityBestEffort` use Strava's raw ID as `@id` (no cuid) — an intentional break from the cuid pattern elsewhere, to avoid duplicating data and BigInt-serialization friction.

---

## Testing

```bash
cd server
npm test           # vitest run
npm run test:watch
npm run test:cov
```

```bash
cd client
npm test           # vitest run — pure functions/hooks only, no jsdom yet
```

Server coverage includes workout classification, lap detectors (interval/hill), pure mappers (lap/split, best-effort, gear, HR-zone), the training-load calculator (fixtures validated against the legacy Python pipeline), and `StravaSyncService`/`BestEffortsSyncService` integration (with `sleep` mocked via `vi.spyOn`, since `vi.useFakeTimers()` conflicts with NestJS/Prisma's internal Promises). Client coverage includes `useTrainingMetrics`/`computeWeekMetrics` and `useDecoupling`.

---

## Tooling & Conventions

- **Commits:** Conventional Commits, enforced via Commitlint + Husky (`commit-msg` hook); `npm run commit` launches Commitizen for a guided commit message.
- **Formatting:** Prettier, consistent config between `server/` and `client/`.
- **Type checking:** run `npx tsc --noEmit` before starting the server after non-trivial changes.
- **Vertical slices:** features are implemented backend + frontend together, not in separate phases (documented exception: `Gear`/`ActivityBestEffort` shipped backend-only; their frontend pages exist as nav placeholders).
- **Full-file handoffs:** for substantial changes, complete files are preferred over diffs.

---

## Known Limitations

- `hasRecordedLaps` relies on matching Strava's auto-lap name string (e.g. `'Strava Auto Lap'`) — fragile as a signal, but functional today.
- The weekly bucket in `GET /activities/weekly-distance` uses UTC dates; runs between 9pm and midnight BRT can land in the wrong week. The frontend aggregates in local time instead, so this only affects that one endpoint, which currently has no frontend consumer.
- `StravaSyncService` and `BestEffortsSyncService` (and the HR-zones backfill) have independent `isSyncing` guards — nothing stops firing the main sync and a backfill at the same time, competing for the same Strava rate limit. Acceptable today (single-user app, manual triggers); revisit if usage grows.
- `useTrainingMetrics` uses real Strava HR-zone data only when `hrZonesSyncedAt` is set and the account is premium; otherwise it falls back to `maxHr * 0.7` (if configured) or a flat `avgHr < 150` heuristic, with a visible UI hint indicating which tier is active.
- `processSteadyActivity` has an early-return path that creates zero laps if an activity has neither recorded laps nor metric splits — 0 of 257 current activities hit this, so no defensive guard was added (YAGNI), but such an activity would be invisible to `GET /activities/laps` (and thus Run > Analysis) despite appearing normally elsewhere.

---

## Roadmap

- [x] Prisma schema — running domain
- [x] PostgreSQL migrations
- [x] Strava OAuth 2.0 flow (incl. `profile:read_all` for HR zones)
- [x] Incremental activity sync (cron + manual trigger) with live progress
- [x] Second-by-second stream ingestion (fallback path for lap-less INTERVAL/HILL)
- [x] Workout classification + lap detection (ported from the Python pipeline)
- [x] Route polylines + backfill for pre-existing activities
- [x] Gear tracking + best-effort PRs (backend, with derived top-3 records)
- [x] Real Strava HR zones (athlete + per-activity, premium-gated) with backfill
- [x] Dashboard SPA (list view, weekly/monthly chart, filters, custom date ranges)
- [x] Activity detail view (stats grid, route map, lap table)
- [x] Run Overview page (all-time totals, calendar, personal records, shoes)
- [x] Run Analysis page — 9 charts (weekly volume, pace × volume, Z2 stacked, pace-zone histogram, training load, ACWR, monotony & strain, efficiency factor, cardiac drift), lap-level, client-side
- [x] Light/dark theme
- [X] Frontend for Gear ("Shoes") and "Personal Best" pages (backend already shipped)
- [ ] Multi-source hub expansion (strength training, diet, other data sources)
