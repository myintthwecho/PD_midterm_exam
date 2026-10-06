DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS equipment;

CREATE TABLE equipment (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  equipmentId TEXT NOT NULL,
  borrowerName TEXT NOT NULL,
  startAt TEXT NOT NULL,
  endAt TEXT NOT NULL,
  purpose TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (equipmentId) REFERENCES equipment(id)
);

CREATE INDEX idx_bookings_equipment_time ON bookings (equipmentId, startAt, endAt);

INSERT INTO equipment (id, name, location) VALUES
  ('eq-1', 'Projector A', 'Building 1'),
  ('eq-2', 'Camera B', 'Building 2');
