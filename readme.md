# Strava Dashboard

Personal fitness analytics platform built on top of the Strava API. Syncs running activities, reconstructs second-by-second streams, classifies workouts, detects intervals/hill repeats/laps, and exposes it all through a full dashboard UI. Long-term vision: an "activity hub" aggregating multiple data sources (running via Strava, strength training, diet, etc.) into a single cross-domain analytics platform.

> **Status:** Active development — OAuth, sync pipeline, stream processing and the full dashboard/detail frontend are in place; training-load analytics (ACWR, monotony, strain) are next.

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

The platform syncs running activities from Strava, stores them in PostgreSQL, and exposes them through a REST API consumed by a React dashboard. The longer-term vision is a unified fitness hub aggregating multiple data sources (Strava, strength training, diet tracking) to enable cross-domain correlation.

Key capabilities:

- OAuth 2.0 integration with Strava (token exchange, automatic refresh)
- Incremental activity sync via scheduled cron job (every 6h) and an on-demand HTTP endpoint, with live progress polling (state, phase, counters, ETA)
- Second-by-second stream reconstruction via a multi-stage PostgreSQL CTE (interpolation, rolling average, HR smoothing/EWM, elevation smoothing, grade, pace)
- Workout classification (easy/long, interval, hill repeats) and automatic lap detection, with native Strava lap support and per-lap net elevation gain
- A dashboard SPA with weekly/monthly aggregation, custom date-range filtering, route maps and a full activity detail view — all derived client-side from a single data fetch
- Legacy Python pipeline retained as a numerical oracle to validate every ported statistical algorithm (ACWR, monotony, strain, etc.)

---

## Architecture

```
┌───────────────────────────────┐        ┌────────────────────────────────────────────┐
│       React SPA (Vite)        │  REST  │                NestJS Server               │
│                               │◄──────►│                                            │
│  Dashboard · Detail · Charts  │  JSON  │  StravaAuth │ StravaClient │ StravaSync    │
│  Leaflet route maps           │        │ (OAuth flow)│ (HTTP+token) │ (cron+trigger)│
│  Tailwind + shadcn/ui         │        │                                            │
│                               │        │  ActivitiesModule (GET /activities, ...)   │
└───────────────────────────────┘        │                                            │
                                         │              Prisma 7 ORM                  │
                                         │           (@prisma/adapter-pg)             │
                                         └────────────────────┬───────────────────────┘
                                                              │
                                                              ▼
                                                         PostgreSQL 17
                                                           (Docker)
```

**Stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (via nvm) |
| Backend framework | NestJS 11 |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL 17 (Docker) |
| Scheduler | `@nestjs/schedule` (cron) |
| Backend tests | Vitest |
| Frontend framework | React 19 + Vite |
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
├── python-pipeline/               # Legacy Python pipeline (pandas, SQLAlchemy, SQLite)
│                                  # Retained as numerical oracle for validating TS ports
│
├── server/                        # NestJS application
│   ├── prisma/
│   │   ├── schema.prisma          # Data model
│   │   ├── migrations/            # Migration history
│   │   └── seed.ts                # Single-user seed
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── activities/            # ActivitiesModule — GET /activities, /:id, /weekly-distance
│   │   └── strava/
│   │       ├── strava.module.ts
│   │       ├── auth/              # OAuth flow (redirect + callback)
│   │       ├── client/            # Strava API HTTP client + token management
│   │       └── sync/
│   │           ├── detectors/     # base, interval, hill, lap-classifier
│   │           └── processors/    # stream processing (steady / structured activities)
│   ├── test/                      # Vitest unit + integration tests
│   └── .env                       # Strava + DB credentials (not committed)
│
└── client/                        # Vite + React SPA
    ├── src/
    │   ├── App.tsx
    │   ├── Dashboard.tsx          # List view: rail + weekly/monthly chart + activity list
    │   ├── ActivityDetailView.tsx # Detail view: stats grid, route map, lap table
    │   ├── WeeklyChart.tsx        # SVG area/line chart (week or month bins)
    │   ├── DateRangePicker.tsx    # Custom date-range popover with presets
    │   ├── SegmentedControl.tsx   # Shared period/theme toggle
    │   ├── SyncPanel.tsx          # Sync trigger + progress polling
    │   ├── RouteMap.tsx           # Leaflet map + theme-aware polyline styling
    │   ├── polyline.ts            # Strava encoded-polyline decoder
    │   ├── activityFormat.ts      # Formatting helpers (pace, distance, dates)
    │   └── components/ui/         # shadcn/ui primitives
    └── index.css                  # Design tokens (light/dark theme)
```

---

## Getting Started

### Prerequisites

- Node.js 20+ (via [nvm](https://github.com/nvm-sh/nvm))
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

Authorize the app on Strava, then trigger an initial sync (or use the "Sync" button in the dashboard rail):

```bash
curl -X POST http://localhost:3000/strava/sync
```

Then open `http://localhost:5173` to view the dashboard.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/strava/auth` | Redirects to the Strava OAuth authorization page |
| `GET` | `/strava/auth/callback` | Handles the OAuth callback, exchanges code for tokens |
| `POST` | `/strava/sync` | Fire-and-forget: triggers an incremental sync, returns current progress immediately |
| `GET` | `/strava/sync/status` | Returns live `SyncProgress` (state, phase, processed/synced/errors, ETA) |
| `POST` | `/strava/sync/backfill-polylines` | One-off backfill of `summary_polyline` for activities synced before it was captured |
| `GET` | `/activities` | Paginated activity list, ordered by `startDate` desc — filters: `page`, `limit`, `workoutType`, `dateFrom`, `dateTo` |
| `GET` | `/activities/:id` | Full detail for a single activity, including laps and route polyline |
| `GET` | `/activities/weekly-distance` | Weekly distance aggregate (Monday-start, zero-filled), same filters as the list endpoint |

The sync job also runs automatically every 6 hours via cron. CORS is open for `http://localhost:5173`.

---

## Data Model

```
User
 └── StravaAccount     (OAuth tokens: access/refresh token, expiry)
 └── Activity           (one per Strava run)
      ├── ActivityLap    (detected or natively-recorded laps)
      └── ActivitySecond (second-by-second reconstructed stream)
```

Every entity carries a `userId` foreign key from day one, in preparation for multi-user and cross-domain (lifting, diet, etc.) support. Activities use `startDate` as the canonical correlation timestamp. `Activity.workoutType` (`EASY_OR_LONG` / `INTERVAL` / `HILL_REPEATS`) and `ActivityLap.lapType` (`RUN` / `WORKOUT` / `REST` / `STEADY` / `WARMUP` / `COOLDOWN` / `ACTIVITY`) are Postgres enums.

---

## Testing

```bash
cd server
npm test           # vitest run
npm run test:watch
npm run test:cov
```

Coverage includes workout classification, lap detectors (interval/hill), stream processors, and `StravaSyncService` integration tests (with `sleep` mocked via `vi.spyOn`, since `vi.useFakeTimers()` conflicts with NestJS/Prisma's internal Promises).

---

## Tooling & Conventions

- **Commits:** Conventional Commits, enforced via Commitlint + Husky (`commit-msg` hook); `npm run commit` launches Commitizen for a guided commit message.
- **Formatting:** Prettier, consistent config between `server/` and `client/`.
- **Type checking:** run `npx tsc --noEmit` before starting the server after non-trivial changes.
- **Vertical slices:** features are implemented backend + frontend together, not in separate phases.

---

## Known Limitations

- Lap-mapping logic is duplicated between the steady and structured activity processors — pending extraction into a shared helper.
- `hasRecordedLaps` relies on matching Strava's auto-lap name string (e.g. `'Strava Auto Lap'`) — fragile as a signal, but functional today.
- The weekly bucket in `GET /activities/weekly-distance` uses UTC dates (consistent with the `dateFrom`/`dateTo` filters); runs between 9pm and midnight BRT can land in the wrong week. The frontend aggregates in local time instead, so this only affects that one endpoint.
- `GET /activities/weekly-distance` currently has no frontend consumer (the dashboard aggregates client-side) — kept for now, may be removed once the redesign stabilizes.

---

## Roadmap

- [x] Prisma schema — running domain
- [x] PostgreSQL migrations
- [x] Strava OAuth 2.0 flow
- [x] Incremental activity sync (cron + manual trigger) with live progress
- [x] Second-by-second stream ingestion via SQL CTE
- [x] Workout classification + lap detection (ported from the Python pipeline)
- [x] Route polylines + backfill for pre-existing activities
- [x] Dashboard SPA (list view, weekly/monthly chart, filters, custom date ranges)
- [x] Activity detail view (stats grid, route map, lap table)
- [x] Light/dark theme
- [ ] Training load analytics via PostgreSQL window functions (ACWR, monotony, strain)
- [ ] More charts ported from the Python pipeline (weekly pace, pace histogram, Z2 time)
- [ ] Multi-source hub expansion (strength training, diet, other data sources)
