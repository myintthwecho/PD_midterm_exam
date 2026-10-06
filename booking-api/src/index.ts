import { Hono } from "hono";

type Env = { Bindings: { DB: D1Database } };

type BookingBody = {
  equipmentId?: unknown;
  borrowerName?: unknown;
  startAt?: unknown;
  endAt?: unknown;
  purpose?: unknown;
};

type BookingRow = {
  id: string;
  equipmentId: string;
  borrowerName: string;
  startAt: string;
  endAt: string;
  purpose: string;
  createdAt: string;
};

const app = new Hono<Env>();

const errorJson = (c: any, status: 400 | 404 | 409 | 500, message: string) =>
  c.json({ error: message }, status);

const toIso = (value: unknown): string | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isBookingBody = (value: unknown): value is BookingBody =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const bookingJson = (row: BookingRow) => ({
  id: row.id,
  equipmentId: row.equipmentId,
  borrowerName: row.borrowerName,
  startAt: row.startAt,
  endAt: row.endAt,
  purpose: row.purpose,
  createdAt: row.createdAt,
});

const equipmentExists = async (db: D1Database, id: string): Promise<boolean> => {
  const row = await db
    .prepare("SELECT 1 AS ok FROM equipment WHERE id = ?")
    .bind(id)
    .first();
  return row !== null;
};

const findConflict = async (
  db: D1Database,
  equipmentId: string,
  startAt: string,
  endAt: string,
  excludeId: string | null,
): Promise<BookingRow | null> => {
  const sql = `
    SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, createdAt
    FROM bookings
    WHERE equipmentId = ?
      AND startAt < ?
      AND endAt > ?
      AND (? IS NULL OR id != ?)
    LIMIT 1`;
  const row = await db
    .prepare(sql)
    .bind(equipmentId, endAt, startAt, excludeId, excludeId)
    .first<BookingRow>();
  return row ?? null;
};

app.get("/api/equipment", async (c) => {
  const rows = await c.env.DB.prepare(
    "SELECT id, name, location FROM equipment ORDER BY id",
  ).all<{ id: string; name: string; location: string }>();
  return c.json(rows.results, 200);
});

app.get("/api/bookings", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, createdAt
     FROM bookings ORDER BY startAt`,
  ).all<BookingRow>();
  return c.json(rows.results.map(bookingJson), 200);
});

app.get("/api/bookings/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, createdAt
     FROM bookings WHERE id = ?`,
  )
    .bind(c.req.param("id"))
    .first<BookingRow>();
  if (!row) return errorJson(c, 404, `Booking ${c.req.param("id")} not found`);
  return c.json(bookingJson(row), 200);
});

app.post("/api/bookings", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return errorJson(c, 400, "Request body must be valid JSON");
  }
  if (!isBookingBody(body)) {
    return errorJson(c, 400, "Request body must be a JSON object");
  }

  if (
    !isNonEmptyString(body.equipmentId) ||
    !isNonEmptyString(body.borrowerName) ||
    !isNonEmptyString(body.purpose)
  ) {
    return errorJson(
      c,
      400,
      "equipmentId, borrowerName, and purpose are required non-empty strings",
    );
  }

  const startAt = toIso(body.startAt);
  const endAt = toIso(body.endAt);
  if (!startAt || !endAt) {
    return errorJson(c, 400, "startAt and endAt must be valid ISO 8601 datetimes");
  }
  if (startAt >= endAt) {
    return errorJson(c, 400, "startAt must be before endAt");
  }

  if (!(await equipmentExists(c.env.DB, body.equipmentId))) {
    return errorJson(c, 400, `Equipment ${body.equipmentId} does not exist`);
  }

  const conflict = await findConflict(c.env.DB, body.equipmentId, startAt, endAt, null);
  if (conflict) {
    return errorJson(
      c,
      409,
      `Equipment ${body.equipmentId} is already booked from ${conflict.startAt} to ${conflict.endAt}`,
    );
  }

  const id = crypto.randomUUID();
  const row: BookingRow = {
    id,
    equipmentId: body.equipmentId,
    borrowerName: body.borrowerName,
    startAt,
    endAt,
    purpose: body.purpose,
    createdAt: new Date().toISOString(),
  };

  await c.env.DB.prepare(
    `INSERT INTO bookings (id, equipmentId, borrowerName, startAt, endAt, purpose, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(row.id, row.equipmentId, row.borrowerName, row.startAt, row.endAt, row.purpose, row.createdAt)
    .run();

  return c.json(bookingJson(row), 201);
});

app.patch("/api/bookings/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare(
    `SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, createdAt
     FROM bookings WHERE id = ?`,
  )
    .bind(id)
    .first<BookingRow>();
  if (!existing) return errorJson(c, 404, `Booking ${id} not found`);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return errorJson(c, 400, "Request body must be valid JSON");
  }
  if (!isBookingBody(body)) {
    return errorJson(c, 400, "Request body must be a JSON object");
  }

  const keys = Object.keys(body);
  if (keys.length === 0) {
    return errorJson(c, 400, "At least one field to update is required");
  }

  const equipmentId =
    body.equipmentId === undefined ? existing.equipmentId : body.equipmentId;
  if (!isNonEmptyString(equipmentId)) {
    return errorJson(c, 400, "equipmentId must be a non-empty string");
  }

  const borrowerName =
    body.borrowerName === undefined ? existing.borrowerName : body.borrowerName;
  if (!isNonEmptyString(borrowerName)) {
    return errorJson(c, 400, "borrowerName must be a non-empty string");
  }

  const purpose = body.purpose === undefined ? existing.purpose : body.purpose;
  if (!isNonEmptyString(purpose)) {
    return errorJson(c, 400, "purpose must be a non-empty string");
  }

  let startAt = existing.startAt;
  if (body.startAt !== undefined) {
    const parsed = toIso(body.startAt);
    if (!parsed) return errorJson(c, 400, "startAt must be a valid ISO 8601 datetime");
    startAt = parsed;
  }

  let endAt = existing.endAt;
  if (body.endAt !== undefined) {
    const parsed = toIso(body.endAt);
    if (!parsed) return errorJson(c, 400, "endAt must be a valid ISO 8601 datetime");
    endAt = parsed;
  }

  if (startAt >= endAt) {
    return errorJson(c, 400, "startAt must be before endAt");
  }

  if (!(await equipmentExists(c.env.DB, equipmentId))) {
    return errorJson(c, 400, `Equipment ${equipmentId} does not exist`);
  }

  const conflict = await findConflict(c.env.DB, equipmentId, startAt, endAt, id);
  if (conflict) {
    return errorJson(
      c,
      409,
      `Equipment ${equipmentId} is already booked from ${conflict.startAt} to ${conflict.endAt}`,
    );
  }

  await c.env.DB.prepare(
    `UPDATE bookings
     SET equipmentId = ?, borrowerName = ?, startAt = ?, endAt = ?, purpose = ?
     WHERE id = ?`,
  )
    .bind(equipmentId, borrowerName, startAt, endAt, purpose, id)
    .run();

  const updated = await c.env.DB.prepare(
    `SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, createdAt
     FROM bookings WHERE id = ?`,
  )
    .bind(id)
    .first<BookingRow>();

  return c.json(bookingJson(updated as BookingRow), 200);
});

app.delete("/api/bookings/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await c.env.DB.prepare("SELECT id FROM bookings WHERE id = ?")
    .bind(id)
    .first();
  if (!existing) return errorJson(c, 404, `Booking ${id} not found`);
  await c.env.DB.prepare("DELETE FROM bookings WHERE id = ?").bind(id).run();
  return c.body(null, 204);
});

app.notFound((c) => errorJson(c, 404, "Route not found"));

app.onError((err, c) => {
  console.error(err);
  return errorJson(c, 500, "Internal server error");
});

export default app;
