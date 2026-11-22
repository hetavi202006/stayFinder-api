CREATE TABLE IF NOT EXISTS hotels (
  id               SERIAL PRIMARY KEY,
  name             TEXT NOT NULL,
  city             TEXT NOT NULL,
  price_per_night  NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0),
  total_rooms      INTEGER NOT NULL CHECK (total_rooms > 0),
  rating           NUMERIC(2,1) CHECK (rating >= 0 AND rating <= 5)
);

CREATE TABLE IF NOT EXISTS bookings (
  id           SERIAL PRIMARY KEY,
  hotel_id     INTEGER NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_name   TEXT NOT NULL,
  guest_email  TEXT NOT NULL,
  check_in     DATE NOT NULL,
  check_out    DATE NOT NULL,
  status       TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE INDEX IF NOT EXISTS idx_hotels_city ON hotels (LOWER(city));
CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings (hotel_id, check_in, check_out);
