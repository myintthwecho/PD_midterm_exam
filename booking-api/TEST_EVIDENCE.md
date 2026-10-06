# Test Evidence — Campus Equipment Booking API

- **Base API URL used for testing:** `http://localhost:8787/api`
- **Server:** `npm run dev` (wrangler dev, local D1)
- **Date:** 2026-10-06
- **Runner:** `run_tests.ps1` (curl under the hood) — raw results in `test_results.json`
- **Result: 11/11 passed** (5 required cases minimum; 11 recorded, covering success + validation + not-found + conflict)

---

## Case 1 — List equipment (happy path)

```bash
curl -s -X GET http://localhost:8787/api/equipment
```

**Expected:** `200` — **Actual:** `200`

```json
[{"id":"eq-1","name":"Projector A","location":"Building 1"},{"id":"eq-2","name":"Camera B","location":"Building 2"}]
```

## Case 2 — Create booking (happy path)

```bash
curl -s -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation"}'
```

**Expected:** `201` — **Actual:** `201`

```json
{"id":"1b1237f3-358d-4a5b-a228-473c78ad303e","equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:00:00.000Z","purpose":"Class presentation","createdAt":"2026-10-06T06:51:05.282Z"}
```

## Case 3 — Overlapping booking → conflict

Overlaps Case 2 (10:00–12:00 vs 09:00–11:00 on eq-1).

```bash
curl -s -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-1","borrowerName":"prung Pendee","startAt":"2026-10-20T10:00:00.000Z","endAt":"2026-10-20T12:00:00.000Z","purpose":"Video shoot"}'
```

**Expected:** `409` — **Actual:** `409`

```json
{"error":"Equipment eq-1 is already booked from 2026-10-20T09:00:00.000Z to 2026-10-20T11:00:00.000Z"}
```

## Case 4 — Validation: end before start

```bash
curl -s -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-1","borrowerName":"Bad Time","startAt":"2026-10-20T11:00:00.000Z","endAt":"2026-10-20T09:00:00.000Z","purpose":"Invalid range"}'
```

**Expected:** `400` — **Actual:** `400`

```json
{"error":"startAt must be before endAt"}
```

## Case 5 — Validation: unknown equipmentId

```bash
curl -s -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-999","borrowerName":"No Gear","startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T10:00:00.000Z","purpose":"Ghost booking"}'
```

**Expected:** `400` — **Actual:** `400`

```json
{"error":"Equipment eq-999 does not exist"}
```

## Case 6 — Not found: missing booking id

```bash
curl -s -X GET http://localhost:8787/api/bookings/no-such-id
```

**Expected:** `404` — **Actual:** `404`

```json
{"error":"Booking no-such-id not found"}
```

## Case 7a — Update own booking (self-exclusion on overlap check)

PATCH moving only `endAt` of Case 2's booking: must NOT conflict with itself.

```bash
curl -s -X PATCH http://localhost:8787/api/bookings/1b1237f3-358d-4a5b-a228-473c78ad303e \
  -H "Content-Type: application/json" \
  -d '{"purpose":"Class presentation (updated)","endAt":"2026-10-20T11:30:00.000Z"}'
```

**Expected:** `200` — **Actual:** `200`

```json
{"id":"1b1237f3-358d-4a5b-a228-473c78ad303e","equipmentId":"eq-1","borrowerName":"Somchai Jaidee","startAt":"2026-10-20T09:00:00.000Z","endAt":"2026-10-20T11:30:00.000Z","purpose":"Class presentation (updated)","createdAt":"2026-10-06T06:51:05.282Z"}
```

## Case 7b — Update into conflicting window

First a second booking was created on eq-1 for 2026-10-21 09:00–11:00 (`201`), then Case 2's booking was PATCHed into exactly that window.

```bash
curl -s -X PATCH http://localhost:8787/api/bookings/1b1237f3-358d-4a5b-a228-473c78ad303e \
  -H "Content-Type: application/json" \
  -d '{"startAt":"2026-10-21T09:00:00.000Z","endAt":"2026-10-21T11:00:00.000Z"}'
```

**Expected:** `409` — **Actual:** `409`

```json
{"error":"Equipment eq-1 is already booked from 2026-10-21T09:00:00.000Z to 2026-10-21T11:00:00.000Z"}
```

## Case 8a — Delete booking

```bash
curl -s -X DELETE http://localhost:8787/api/bookings/1b1237f3-358d-4a5b-a228-473c78ad303e
```

**Expected:** `204` — **Actual:** `204` (empty body)

## Case 8b — Read after delete

```bash
curl -s -X GET http://localhost:8787/api/bookings/1b1237f3-358d-4a5b-a228-473c78ad303e
```

**Expected:** `404` — **Actual:** `404`

```json
{"error":"Booking 1b1237f3-358d-4a5b-a228-473c78ad303e not found"}
```

## Case 9 — Validation: zero-length window (start == end)

```bash
curl -s -X POST http://localhost:8787/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"equipmentId":"eq-2","borrowerName":"Boundary Test","startAt":"2026-10-22T09:00:00.000Z","endAt":"2026-10-22T09:00:00.000Z","purpose":"zero length"}'
```

**Expected:** `400` — **Actual:** `400`

```json
{"error":"startAt must be before endAt"}
```

---

## Coverage summary

| # | Case | Status | Type |
|---|---|---|---|
| 1 | List equipment | 200 | Success |
| 2 | Create booking | 201 | Success |
| 3 | Overlapping create | 409 | Conflict |
| 4 | End before start | 400 | Validation |
| 5 | Unknown equipmentId | 400 | Validation |
| 6 | Missing booking id | 404 | Not found |
| 7a | PATCH own booking | 200 | Success |
| 7b | PATCH into conflict | 409 | Conflict |
| 8a | DELETE booking | 204 | Success |
| 8b | GET after delete | 404 | Not found |
| 9 | Zero-length window | 400 | Validation |
