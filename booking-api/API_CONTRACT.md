# API Contract — Campus Equipment Booking API

**Base URL (local):** `http://localhost:8787/api`
**Content type:** `application/json` (UTF-8) for all request and response bodies.

## Assumptions

1. Timestamps are ISO 8601 strings. The API normalizes every accepted time to UTC `YYYY-MM-DDTHH:mm:ss.sssZ`, so stored values always compare correctly as strings.
2. Booking intervals are **half-open** `[startAt, endAt)`: a booking ending at 11:00 and another starting at 11:00 on the same equipment do **not** conflict (back-to-back allowed).
3. A `equipmentId` that does not exist is an **invalid payload reference** → `400`. A `booking id` that does not exist is a **missing resource** → `404`.
4. All fields in the payload are required for `POST`; `PATCH` accepts any subset but must contain at least one field, and the *merged* result must still satisfy every validation rule.
5. `purpose` and `borrowerName` must be non-empty strings (trimmed).

## Endpoints

### GET `/equipment`

List all equipment.

- **200** — array of equipment objects

```json
[{ "id": "eq-1", "name": "Projector A", "location": "Building 1" }]
```

### GET `/bookings`

List all bookings ordered by `startAt`.

- **200** — array of booking objects

### GET `/bookings/:id`

- **200** — the booking
- **404** — `{"error": "Booking <id> not found"}`

### POST `/bookings`

Create a booking.

Request:

```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

- **201** — created booking (includes `id`, `createdAt`)
- **400** — missing/empty required field, non-JSON body, invalid datetime, `startAt >= endAt`, or unknown `equipmentId`
- **409** — time overlaps an existing booking of the same equipment

### PATCH `/bookings/:id`

Partial update. Only provided fields change; validation runs against the merged result.

- **200** — updated booking
- **400** — invalid JSON body, empty body, invalid field value, `startAt >= endAt`, or unknown `equipmentId`
- **404** — booking id does not exist
- **409** — merged interval overlaps another booking of the same equipment (**excluding the booking itself**)

### DELETE `/bookings/:id`

- **204** — deleted (empty body)
- **404** — booking id does not exist

## Booking object

```json
{
  "id": "uuid-v4",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation",
  "createdAt": "2026-10-06T06:51:05.282Z"
}
```

## Error format

Every error response (all statuses) uses:

```json
{ "error": "human-readable message" }
```

Unknown routes also return `404` in this shape; unexpected exceptions return `500` in this shape.

## Why 400 / 404 / 409

| Status | Meaning | Used when |
|---|---|---|
| `400 Bad Request` | The **client's input** is invalid or incomplete | missing/empty fields, malformed JSON, unparseable datetime, `startAt >= endAt`, unknown `equipmentId` (a bad reference inside the payload) |
| `404 Not Found` | The **addressed resource** does not exist | `GET/PATCH/DELETE /bookings/<unknown id>`, unknown route |
| `409 Conflict` | The request is well-formed but **violates a business rule** against current state | proposed interval overlaps an existing booking of the same equipment |

## Conflict rule

Two intervals conflict iff they belong to the same `equipmentId` and:

```
new.startAt < existing.endAt AND new.endAt > existing.startAt
```

For `PATCH`, the booking being updated is excluded from the check (`AND id != :id`).
