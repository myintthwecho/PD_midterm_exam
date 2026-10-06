# Campus Equipment Booking API

Backend API for reserving shared faculty equipment (cameras, projectors, meeting rooms) with **overlap-safe booking windows**. Built with **Hono + TypeScript on Cloudflare Workers**, storage in **D1 (SQLite)** — tested locally with `wrangler dev`.

## Run instructions

```bash
cd booking-api
npm install                 # if node_modules is missing
npm run db:local            # create + seed tables (2 equipment records)
npm run dev                 # starts API at http://localhost:8787
```

- **Base API URL:** `http://localhost:8787/api`
- **Deployed Base API URL:** `https://booking-api.mtc-api.workers.dev/api`
- Re-run `npm run db:local` any time to reset the database.

## Deploy to Cloudflare Workers

The production API runs on Cloudflare Workers with a remote D1 database:

```bash
npx wrangler login
npx wrangler d1 execute booking-db --remote --file=schema.sql
npx wrangler deploy
```

The deployed API URL is:

```text
https://booking-api.mtc-api.workers.dev/api
```

The remote D1 database is configured in `wrangler.toml`. Do not run the
schema command against the remote database again unless you intend to reset
the tables and seed data.

## Test

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File run_tests.ps1
```

Runs 11 curl cases (happy path, 400, 404, 409) and writes `test_results.json`. Latest run: **11/11 passed** — see [TEST_EVIDENCE.md](TEST_EVIDENCE.md).

## Endpoints (summary)

| Method | Path | Success | Errors |
|---|---|---:|---|
| GET | `/api/equipment` | 200 | — |
| GET | `/api/bookings` | 200 | — |
| GET | `/api/bookings/:id` | 200 | 404 |
| POST | `/api/bookings` | 201 | 400, 409 |
| PATCH | `/api/bookings/:id` | 200 | 400, 404, 409 |
| DELETE | `/api/bookings/:id` | 204 | 404 |

Full contract, payloads, and status-code rationale: [API_CONTRACT.md](API_CONTRACT.md).

## Schema / ERD

```
equipment 1 ──── * bookings
```

```sql
equipment (
  id        TEXT PRIMARY KEY,          -- e.g. 'eq-1'
  name      TEXT NOT NULL,
  location  TEXT NOT NULL
)

bookings (
  id           TEXT PRIMARY KEY,       -- uuid v4
  equipmentId  TEXT NOT NULL REFERENCES equipment(id),
  borrowerName TEXT NOT NULL,
  startAt      TEXT NOT NULL,          -- ISO 8601 UTC, normalized
  endAt        TEXT NOT NULL,          -- ISO 8601 UTC, normalized
  purpose      TEXT NOT NULL,
  createdAt    TEXT NOT NULL
)
CREATE INDEX idx_bookings_equipment_time ON bookings (equipmentId, startAt, endAt);
```

Seed data: `eq-1` Projector A (Building 1), `eq-2` Camera B (Building 2).

## Business rules

1. `equipmentId` must reference an existing equipment row.
2. `startAt` must be strictly before `endAt` (after UTC normalization).
3. Bookings of the same equipment must not overlap: `newStart < existingEnd AND newEnd > existingStart` (half-open intervals → back-to-back allowed). Enforced on **create and update**; on update the booking itself is excluded.
4. All SQL uses parameter binding — request data is never concatenated into SQL.

## Project layout

```
booking-api/
├── src/index.ts          # Hono app: routes, validation, overlap check
├── schema.sql            # tables + seed data
├── wrangler.toml         # Workers + D1 binding
├── run_tests.ps1         # curl test suite (11 cases)
├── TEST_EVIDENCE.md      # requests, statuses, responses
├── API_CONTRACT.md       # endpoints, payloads, status rationale
├── QUALITY_GATE_REVIEW.md# 3+ findings: found → fixed → evidence
├── AI_LOG.md             # AI usage log (prompts, use, verification)
└── README.md             # this file
```

## Documents

- [API_CONTRACT.md](API_CONTRACT.md) — contract & assumptions
- [TEST_EVIDENCE.md](TEST_EVIDENCE.md) — 11 curl cases with evidence
- [QUALITY_GATE_REVIEW.md](QUALITY_GATE_REVIEW.md) — review findings & fixes
- [AI_LOG.md](AI_LOG.md) — AI responsibility log
