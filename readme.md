# SoTreina

Personal fitness analytics platform built on top of the Strava API. Syncs running activities for multiple users, reconstructs second-by-second streams, classifies workouts, detects intervals/hill repeats/laps, and exposes it all through a full dashboard + training-analysis UI. Long-term vision: an "activity hub" aggregating multiple data sources (running via Strava, strength training, diet, etc.) into a single cross-domain analytics platform.

> **Status:** Live in production at [sotreina.vercel.app](https://sotreina.vercel.app) (custom domain `sotreina.com` migration in progress). Multi-user login via Strava OAuth, sync pipeline, stream processing, a manual lap editor, the dashboard/detail/overview frontend, a mobile-responsive layout, pt/en i18n, and a 9-chart training-analysis page are all in place. `Run > Analysis` is temporarily hidden behind a nav flag while it's being tuned. Currently in migration from a legacy Python pipeline to this TypeScript stack.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [Deployment](#deployment)
- [API Endpoints](#api-endpoints)
- [Data Model](#data-model)
- [Testing](#testing)
- [Tooling & Conventions](#tooling--conventions)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Overview

The platform lets any Strava athlete log in (OAuth doubles as authentication), syncs their running activities into PostgreSQL, and exposes them through a REST API consumed by a React SPA. The longer-term vision is a unified fitness hub aggregating multiple data sources (Strava, strength training, diet tracking) to enable cross-domain correlation.

Key capabilities:

- **Multi-user login via Strava OAuth**: `GET /strava/auth` doubles as both login and sync authorization; find-or-create by `stravaAthleteId` (Strava doesn't return email). Session is a JWT in an httpOnly cookie, with server-side invalidation on logout (`User.tokenVersion`) and CSRF protection (`state` param) on the OAuth flow
- Incremental activity sync via scheduled cron job (every 6h, iterating all connected accounts) and an on-demand HTTP endpoint, with live progress polling (state, phase, counters, adaptive rate-limit countdown, ETA)
- An adaptive rate-limit throttle (`StravaClientService`) that reads Strava's `X-RateLimit-*`/`X-ReadRateLimit-*` headers and sleeps ahead of the 15-minute window reset instead of hitting 429s, plus per-account and per-IP request throttling on the API itself
- Second-by-second stream reconstruction via a multi-stage TypeScript CTE (interpolation, rolling average, HR smoothing/EWM, elevation smoothing, grade, pace, cadence) — used for INTERVAL/HILL activities without recorded laps, and served on-demand (with an in-memory cache) for the lap editor
- Workout classification (easy/long, interval, hill repeats) and automatic lap detection, with native Strava lap support, per-lap net elevation gain, max HR and cadence
- **Manual lap editor**: rebuild an activity's laps (add/split/delete/resize/reorder via drag-and-drop) without a full re-sync, resolved via a single sequential scan of the stream from second 0
- Gear tracking (shoes), best-effort PRs (top-3 per distance, derived — never materialized), and real Strava HR zones (athlete-level and per-activity, premium-gated)
- A dashboard SPA (list + detail), a Run Overview page (all-time totals, calendar, PRs, shoes) and a Run Analysis page recreating the legacy Python charts (weekly volume, pace × volume, Z2 vs above-Z2, pace-zone histogram, training load, ACWR, monotony & strain) plus two new ones (Efficiency Factor, cardiac drift/decoupling) — all client-side, sourced from per-lap data
- **Mobile-responsive layout** (app bar + drawer nav below the `md` breakpoint) and **pt/en i18n** (`react-i18next`, browser-language default), both applied across the whole app
- Onboarding flow for first-time logins: a skeleton shell with a 3-state sync card (intro/syncing/done) gates the dashboard until the initial import finishes
- Legacy Python pipeline retained as a numerical oracle to validate every ported statistical algorithm (ACWR, monotony, strain, etc.)

---

## Architecture

```
┌───────────────────────────────┐        ┌──────────────────────────────────────────────────┐
│       React SPA (Vite)        │  REST  │                  NestJS Server                   │
│  Login (Strava OAuth) gate    │◄──────►│                                                  │
│  Onboarding (first sync)      │  JSON  │ AuthModule (session) │ strava/auth (OAuth)       │
│  Dashboard · Overview         │  cookie│ strava/sync (cron+trigger, multi-account)         │
│  Analysis (9 charts) · Detail │        │ strava/webhook (deauth) │ strava/best-efforts    │
│  Lap editor · Leaflet maps    │        │ strava/hr-zones │ lap-editor                     │
│  Mobile nav · pt/en i18n      │        │                                                  │
│  Tailwind + shadcn/ui         │        │ ActivitiesModule │ GearModule │ PersonalBests │  │
│                               │        │ UsersModule (maxHr) │ throttler guards (IP+acct) │
└───────────────────────────────┘        │                                                  │
                                         │                    Prisma 7 ORM                  │
                                         │                 (@prisma/adapter-pg)             │
                                         └────────────────────────┬─────────────────────────┘
                                                                   │
                                                                   ▼
                                                              PostgreSQL 17
                                                        (Docker locally / Neon in prod)
```

In production, the browser only ever talks to the Vercel-hosted frontend: `client/vercel.json` proxies `/api/*` to the Render-hosted backend (`rewrites`, not `redirects`), so the session cookie is perceived as first-party and survives Safari's third-party cookie blocking. See [Deployment](#deployment).

**Stack:**

| Layer | Technology |
|---|---|
| Runtime | Node.js (via nvm) |
| Backend framework | NestJS |
| ORM | Prisma 7 (`@prisma/adapter-pg`) |
| Database | PostgreSQL 17 (Docker locally, Neon in production) |
| Auth | JWT (`@nestjs/jwt`) in an httpOnly cookie, custom `AuthGuard` (no Passport) |
| Rate limiting | `@nestjs/throttler` (per-IP global guard + a custom per-account `CanActivate` reusing its storage) |
| Scheduler | `@nestjs/schedule` (cron) |
| Backend tests | Vitest |
| Frontend framework | React 19 + Vite |
| Frontend tests | Vitest (pure functions/hooks, no jsdom yet) |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives), Geist Variable font |
| i18n | react-i18next (pt/en, per-feature namespaces) |
| Maps | Leaflet + OpenStreetMap raster tiles |
| Date handling | date-fns |
| Frontend lint/format | ESLint, Prettier |
| Commit tooling | Commitizen + Commitlint (Conventional Commits) via Husky hooks |
| Legacy pipeline | Python, pandas, SQLAlchemy, SQLite (validation oracle only) |
| Hosting | Render (backend, free tier), Neon (Postgres, free tier), Vercel (frontend) |
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
│   │   └── migrations/             # Migration history
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── auth/                   # AuthModule — SessionService (JWT+cookie), AuthGuard,
│   │   │                           # @CurrentUser(), account-level throttler guard, GET /auth/me, POST /auth/logout
│   │   ├── activities/             # ActivitiesModule — GET /activities, /:id, /laps, /hr-zones, /weekly-distance
│   │   ├── lap-editor/             # ActivityStreamsService + LapEditorService — GET .../streams, PUT .../laps
│   │   ├── gear/                   # GearModule — GET /gear, /:id/activities
│   │   ├── personal-bests/         # PersonalBestsModule — GET /personal-bests, /history
│   │   ├── users/                  # UsersModule — GET/PATCH /users/me (maxHr)
│   │   └── strava/
│   │       ├── strava.module.ts
│   │       ├── auth/               # StravaAuthService/Controller — OAuth flow (redirect + callback),
│   │       │                       # doubles as login (find-or-create User+StravaAccount)
│   │       ├── webhook/            # Deauthorization webhook (subscription challenge + account deletion)
│   │       ├── best-efforts/       # BestEffortsSyncService — historical backfill, decoupled from main sync
│   │       ├── hr-zones/           # AthleteZonesSyncService + HrZonesBackfillService — on-demand, decoupled
│   │       └── sync/               # strava-sync.service (orchestration incl. ensureGear, HR-zone fetch,
│   │           │                   # incremental best-effort hook, multi-account syncAllAccounts),
│   │           │                   # strava-client (adaptive rate-limit throttle), types.ts, strava-api.types.ts
│   │           ├── detectors/      # base, interval, hill, lap-classifier, workout-classifier
│   │           └── processors/     # streams-processor (TS CTE), lap-mapper, best-effort-mapper,
│   │                               # gear-mapper, hr-zone-mapper, lap-stats-calculator
│   ├── test/                       # Vitest unit + integration tests
│   └── .env                        # Strava + DB + JWT credentials (not committed)
│
└── client/                         # Vite + React SPA
    ├── vercel.json                  # /api/:path* → Render rewrite (session-cookie proxy) + CSP/security headers
    ├── vitest.config.ts
    ├── src/
    │   ├── App.tsx                 # Login/onboarding gates, Sidebar + content panel, state-based routing
    │   ├── lib/                    # Framework-free helpers (activityFormat, polyline, chartPath, api.ts,
    │   │                           # boot.ts, avatarUrl, theme, dateLocale, API types)
    │   ├── i18n/                   # react-i18next setup, per-feature locale namespaces (pt/en)
    │   ├── components/             # Reusable generic UI (SegmentedControl, shadcn/ui primitives)
    │   └── features/
    │       ├── auth/                # AuthContext, LoginPage (Strava OAuth entry point)
    │       ├── onboarding/          # FirstSyncPage (first-login import gate)
    │       ├── nav/                 # Sidebar, MobileChrome (app bar + drawer), navConfig.ts
    │       ├── profile/             # ProfilePage (mobile-only: account/theme/language/logout)
    │       ├── dashboard/           # Dashboard, Rail, ActivityList, RangeChip, WeeklyChart,
    │       │                        # DateRangePicker, SyncPanel, bins.ts (client-side aggregation)
    │       ├── overview/            # RunOverviewPage, RunCalendar, PersonalRecordsCard, ShoesSection
    │       ├── analysis/            # RunAnalysisPage (9 charts), useTrainingMetrics, useMaxHr,
    │       │                        # useHrZones, useDecoupling, AnalysisCard/ChartGrid/HoverStrip, statsMath.ts
    │       └── activity/            # ActivityDetailView, RouteMap, lap-editor/ (manual lap editing panel)
    └── index.css                    # Design tokens (light/dark/auto theme)
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
STRAVA_REDIRECT_URI=http://localhost:5173/api/strava/auth/callback

# Session
JWT_SECRET=some_random_dev_secret
JWT_EXPIRES_IN=30d

# Strava webhook (deauthorization events)
STRAVA_WEBHOOK_VERIFY_TOKEN=arbitrary_token_you_choose
STRAVA_WEBHOOK_SUBSCRIPTION_ID=id_returned_by_strava_on_subscription_registration

FRONTEND_URL=http://localhost:5173
```

There is no more single-user seed (`SEED_USER_ID` was removed) — any Strava account that completes `GET /strava/auth` becomes a `User` via find-or-create on `stravaAthleteId`.

The `client/` app reads its API base URL from `VITE_API_URL` (defaults to `http://localhost:3000` if unset — see `client/src/lib/apiUrl.ts`). No frontend `.env` is required for local dev if the server runs on the default port.

### Running the App

```bash
# 1. Start PostgreSQL
docker run --name strava-pg -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:17

# 2. Backend
cd server
npm install
npx prisma migrate dev
npm run start:dev           # http://localhost:3000

# 3. Frontend (separate terminal)
cd client
npm install
npm run dev                 # http://localhost:5173
```

Open `http://localhost:5173` and click "Connect with Strava" on the login page. Authorizing on Strava (scope `read,activity:read_all,profile:read_all`) creates your `User`+`StravaAccount`, logs you in, and drops you on the first-sync onboarding screen, which triggers the initial import (`POST /strava/sync`) for you. Optionally set your max HR in Run > Analysis to unlock real Z2/efficiency-factor thresholds, and run the HR-zones/best-efforts backfills below to fill in historical data.

---

## Deployment

- **Backend:** [Render](https://render.com) (free tier, 512MB RAM) — start command must be `npm run start:prod` (`node dist/main`); `nest start --watch` OOMs on the free tier. Needs `NPM_CONFIG_PRODUCTION=false` alongside `NODE_ENV=production`, otherwise `npm install` skips `devDependencies` (where `@nestjs/cli` lives) and the build fails
- **Database:** [Neon](https://neon.tech) (Postgres, free tier)
- **Frontend:** [Vercel](https://vercel.com) — env var `VITE_API_URL=/api` (a relative path, not the Render URL directly)
- **Proxy:** `client/vercel.json` rewrites `/api/:path*` to the Render backend, so the browser only ever talks to the Vercel domain. This is required for the session cookie to survive Safari's Intelligent Tracking Prevention, which blocks `SameSite=None; Secure` cookies set by a genuinely cross-site backend regardless of the `SameSite`/`Secure` attributes. The OAuth `STRAVA_REDIRECT_URI` also points at the Vercel proxy path, not at Render directly, to keep the whole token exchange first-party
- **Security headers:** `client/vercel.json` also sets a restrictive CSP (script hash for the inline pre-paint theme script — recompute via `npm run csp:hash` after touching it), `nosniff`, `frame-ancestors 'none'`, HSTS, COOP, Permissions-Policy
- Registering the Strava webhook subscription and setting `STRAVA_WEBHOOK_SUBSCRIPTION_ID` is a manual one-time step (see the `curl` command in `CLAUDE.md`)

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/strava/auth` | Redirects to the Strava OAuth authorization page (sets anti-CSRF `state`) — doubles as login |
| `GET` | `/strava/auth/callback` | Handles the OAuth callback, exchanges code for tokens, find-or-creates the user, issues the session cookie |
| `GET` | `/auth/me` | Returns the current user (200 + empty body if not logged in, never 401) |
| `POST` | `/auth/logout` | Invalidates all sessions for the current user (`tokenVersion` bump) and clears the cookie |
| `POST` | `/strava/sync` | Fire-and-forget: triggers an incremental sync for the caller's account, returns current progress immediately |
| `GET` | `/strava/sync/status` | Returns live `SyncProgress` for the caller (state, phase incl. `rate_limited`, processed/synced/errors, ETA) |
| `POST` | `/strava/sync/activity/:stravaId` | Synchronous re-sync of a single activity by Strava id — recovery path for activities skipped mid-sync |
| `POST` | `/strava/sync/backfill-polylines` | One-off backfill of `summary_polyline` for activities synced before it was captured |
| `POST` | `/strava/sync/backfill-gear` | One-off backfill linking activities to `Gear` synced before gear resolution existed |
| `POST` | `/strava/sync/backfill-lap-max-hr` | One-off backfill of `ActivityLap.maxHr` for laps synced before it was captured |
| `GET`/`POST` | `/strava/webhook` | Subscription challenge (GET) and deauthorization event handler (POST) — no auth, validated via `subscription_id` |
| `POST` | `/strava/best-efforts/backfill` | Fire-and-forget: backfills `ActivityBestEffort` for activities synced before it existed |
| `POST` | `/strava/hr-zones/sync-athlete` | Syncs the athlete's HR zone definitions (`AthleteHrZones`) — manual/on-demand, not on cron |
| `POST` | `/strava/hr-zones/backfill` | Fire-and-forget: backfills per-activity `ActivityHrZoneTime` for older activities |
| `GET` | `/activities` | Paginated activity list, ordered by `startDate` desc — filters: `page`, `limit`, `workoutType`, `dateFrom`, `dateTo`, `gearId` |
| `GET` | `/activities/:id` | Full detail for a single activity, including laps and route polyline |
| `GET` | `/activities/laps` | Flat list of every `ActivityLap` for the user (no pagination) — feeds Run > Analysis |
| `GET` | `/activities/hr-zones` | Per-activity real HR zone time from Strava (premium-gated) — feeds the Z2 tier system |
| `GET` | `/activities/weekly-distance` | Weekly distance aggregate (Monday-start, zero-filled), same filters as the list endpoint — no current frontend consumer |
| `GET` | `/activities/:id/streams` | Second-by-second stream for the lap editor (DB when available, fetched from Strava on demand otherwise) |
| `PUT` | `/activities/:id/laps` | Replaces an activity's laps from the editor's working list, recalculating stats from scratch |
| `GET` | `/gear` | Lists the user's gear with Strava-reported and locally-computed distance |
| `GET` | `/gear/:id/activities` | Paginated activities for a given gear item (delegates to `ActivitiesService.list`) |
| `GET` | `/personal-bests` | Top-3 best efforts per distance, derived via `$queryRaw` (never materialized) |
| `GET` | `/personal-bests/history?name=` | Full best-effort history for one distance (query param, since names like `"1/2 mile"` contain `/`) |
| `GET` | `/users/me` | Returns `{ maxHr }` |
| `PATCH` | `/users/me` | Updates `maxHr` (integer 100–230) |

The sync job also runs automatically every 6 hours via cron, iterating all connected accounts sequentially (Strava's rate limit is app-wide, not per-account). Every authenticated route requires the `session` cookie (`AuthGuard`); the 8 routes that call the Strava API are additionally capped at 10 req/min per account, and every route sits behind a 100 req/min per-IP limit.

---

## Data Model

```
User (email/firstName/profileImgUrl nullable — Strava OAuth doesn't return email)
 ├── StravaAccount      (OAuth tokens: access/refresh token, expiry — @unique stravaAthleteId is the real identity key)
 ├── AthleteHrZones     (Strava HR zone definitions, one per user)
 ├── Gear               (shoes: name, brand, distance, retired/primary)
 └── Activity           (one per Strava run)
      ├── ActivityLap        (detected, natively-recorded, or manually-edited laps — primary source for analysis)
      ├── ActivitySecond     (second-by-second stream — only for INTERVAL/HILL without recorded laps)
      ├── ActivityBestEffort (Strava best-effort segments, one row per distance per activity)
      └── ActivityHrZoneTime (real HR zone time, one row per zone per activity)
```

Every entity carries a `userId` foreign key from day one, in preparation for cross-domain (lifting, diet, etc.) support. Activities use `startDate` as the canonical correlation timestamp. `Activity.workoutType` (`EASY_OR_LONG` / `INTERVAL` / `HILL_REPEATS`) and `ActivityLap.lapType` (`RUN` / `WORKOUT` / `REST` / `STEADY` / `WARMUP` / `COOLDOWN` / `ACTIVITY`) are Postgres enums. `Gear` and `ActivityBestEffort` use Strava's raw ID as `@id` (no cuid) — an intentional break from the cuid pattern elsewhere, to avoid duplicating data and BigInt-serialization friction. `ActivityLap.avgHr` is a non-nullable `Float` that uses `0` as a "no HR monitor" sentinel (`maxHr` is the field that's genuinely nullable) — any HR aggregation over laps must check `avgHr > 0` first.

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

Server coverage includes workout classification, lap detectors (interval/hill), pure mappers (lap/split, best-effort, gear, HR-zone), the training-load calculator (fixtures validated against the legacy Python pipeline), the adaptive rate-limit throttle, the lap editor's sequential-scan resolver, and `StravaSyncService`/`BestEffortsSyncService` integration (with `sleep` mocked via `vi.spyOn`, since `vi.useFakeTimers()` conflicts with NestJS/Prisma's internal Promises). Client coverage includes `useTrainingMetrics`/`computeWeekMetrics`, `useDecoupling`, and `lapBoundaryMath` (the client-side mirror of the editor's scan algorithm).

---

## Tooling & Conventions

- **Commits:** Conventional Commits, enforced via Commitlint + Husky (`commit-msg` hook), configured at the repo root; `npm run commit` (from the root) launches Commitizen for a guided commit message.
- **Formatting:** Prettier, consistent config between `server/` and `client/`.
- **Type checking:** run `npx tsc --noEmit` before starting the server after non-trivial changes.
- **Vertical slices:** features are implemented backend + frontend together, not in separate phases (documented exception: `Gear`/`ActivityBestEffort` shipped backend-only; their frontend pages came in a later task).
- **Full-file handoffs:** for substantial changes, complete files are preferred over diffs.

---

## Known Limitations

- `hasRecordedLaps` relies on matching Strava's auto-lap name string (e.g. `'Strava Auto Lap'`) — fragile as a signal, but functional today.
- The weekly bucket in `GET /activities/weekly-distance` uses UTC dates; runs between 9pm and midnight BRT can land in the wrong week. The frontend aggregates in local time instead, so this only affects that one endpoint, which currently has no frontend consumer.
- `StravaSyncService` and the administrative backfills (`BestEffortsSyncService`/`HrZonesBackfillService`) have independent `isSyncing` guards, still global (not per-user) for the backfills — nothing stops firing the main sync and a backfill at the same time, competing for the same Strava rate limit. Acceptable for the current beta-sized group; per-account request throttling reduces (but doesn't eliminate) the practical chance of a collision.
- `useTrainingMetrics` uses real Strava HR-zone data only when `hrZonesSyncedAt` is set and the account is premium; otherwise it falls back to `maxHr * 0.7` (if configured) or a flat `avgHr < 150` heuristic, with a visible UI hint indicating which tier is active.
- `processSteadyActivity` has an early-return path that creates zero laps if an activity has neither recorded laps nor metric splits — 0 of 257 current activities hit this, so no defensive guard was added (YAGNI), but such an activity would be invisible to `GET /activities/laps` (and thus Run > Analysis) despite appearing normally elsewhere.
- The sync resume cursor is implicit (max `startDate` in the DB) and depends on ascending processing order — a non-rate-limit error on one activity is logged and skipped, and if later activities save successfully the cursor moves past it, so it's never re-listed. Manual recovery: `POST /strava/sync/activity/:stravaId`.
- The Strava webhook doesn't sign its payloads; origin validation relies on checking `subscription_id` against a known value, which the Strava dev community itself acknowledges is guessable in theory. Accepted residual risk for the current group size.

---

## Roadmap

- [x] Prisma schema — running domain
- [x] PostgreSQL migrations
- [x] Strava OAuth 2.0 flow (incl. `profile:read_all` for HR zones)
- [x] Multi-user login via Strava OAuth, with server-side session invalidation and CSRF protection
- [x] Incremental activity sync (cron + manual trigger), multi-account, with live progress and adaptive rate-limit handling
- [x] Second-by-second stream ingestion (fallback path for lap-less INTERVAL/HILL, plus on-demand for the lap editor)
- [x] Workout classification + lap detection (ported from the Python pipeline)
- [x] Manual lap editor (add/split/delete/resize/reorder)
- [x] Route polylines + backfill for pre-existing activities
- [x] Gear tracking + best-effort PRs (with derived top-3 records) — backend and frontend
- [x] Real Strava HR zones (athlete + per-activity, premium-gated) with backfill
- [x] Dashboard SPA (list view, weekly/monthly chart, filters, custom date ranges)
- [x] Activity detail view (stats grid, route map, lap table)
- [x] Run Overview page (all-time totals, calendar, personal records, shoes)
- [x] Run Analysis page — 9 charts (weekly volume, pace × volume, Z2 stacked, pace-zone histogram, training load, ACWR, monotony & strain, efficiency factor, cardiac drift), lap-level, client-side — temporarily hidden behind a nav flag while being tuned
- [x] Light/dark/auto theme
- [x] Mobile-responsive layout (app bar + drawer nav, mobile-specific views)
- [x] pt/en i18n
- [x] Custom domain (`sotreina.com`) — DNS/Vercel setup in progress
- [ ] Multi-source hub expansion (strength training, diet, other data sources)
- [ ] Migrate sync from polling (cron) to Strava activity webhooks (deauthorization webhook already exists; activity create/update/delete events are received but currently ignored)
