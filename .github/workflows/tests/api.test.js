const request = require('supertest');
const app = require('../src/app');
const db = require('../src/db');

beforeAll(async () => {
  await db.initDb();
});

beforeEach(async () => {
  await db.query('TRUNCATE bookings, hotels RESTART IDENTITY CASCADE');
});

afterAll(async () => {
  await db.pool.end();
});

const createHotel = (overrides = {}) =>
  request(app).post('/api/hotels').send({
    name: 'Sea View', city: 'Goa', pricePerNight: 2500, totalRooms: 1, rating: 4.5, ...overrides,
  });

const book = (hotelId, checkIn, checkOut, overrides = {}) =>
  request(app).post('/api/bookings').send({
    hotelId, guestName: 'Asha', guestEmail: 'asha@example.com', checkIn, checkOut, ...overrides,
  });

describe('health', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('hotels', () => {
  test('creates a hotel', async () => {
    const res = await createHotel();
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Sea View');
  });

  test('rejects invalid hotel data', async () => {
    const res = await createHotel({ pricePerNight: -5, totalRooms: 0 });
    expect(res.status).toBe(400);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  test('filters by city and max price', async () => {
    await createHotel({ name: 'A', city: 'Goa', pricePerNight: 2000 });
    await createHotel({ name: 'B', city: 'Goa', pricePerNight: 6000 });
    await createHotel({ name: 'C', city: 'Delhi', pricePerNight: 1500 });

    const res = await request(app).get('/api/hotels?city=goa&maxPrice=3000');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('A');
  });

  test('returns 404 for a missing hotel', async () => {
    const res = await request(app).get('/api/hotels/999');
    expect(res.status).toBe(404);
  });

  test('returns 400 for a bad hotel id', async () => {
    const res = await request(app).get('/api/hotels/abc');
    expect(res.status).toBe(400);
  });
});

describe('bookings', () => {
  test('creates a booking', async () => {
    const hotel = (await createHotel()).body;
    const res = await book(hotel.id, '2026-12-01', '2026-12-05');
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.check_in).toBe('2026-12-01');
  });

  test('rejects checkout before checkin', async () => {
    const hotel = (await createHotel()).body;
    const res = await book(hotel.id, '2026-12-05', '2026-12-01');
    expect(res.status).toBe(400);
  });

  test('rejects a booking for an unknown hotel', async () => {
    const res = await book(999, '2026-12-01', '2026-12-05');
    expect(res.status).toBe(404);
  });

  test('prevents overbooking on overlapping dates', async () => {
    const hotel = (await createHotel({ totalRooms: 1 })).body;
    expect((await book(hotel.id, '2026-12-01', '2026-12-05')).status).toBe(201);
    const second = await book(hotel.id, '2026-12-03', '2026-12-07');
    expect(second.status).toBe(409);
  });

  test('allows back-to-back stays (checkout day = next checkin)', async () => {
    const hotel = (await createHotel({ totalRooms: 1 })).body;
    expect((await book(hotel.id, '2026-12-01', '2026-12-05')).status).toBe(201);
    expect((await book(hotel.id, '2026-12-05', '2026-12-08')).status).toBe(201);
  });

  test('handles simultaneous requests for the last room', async () => {
    const hotel = (await createHotel({ totalRooms: 1 })).body;
    const results = await Promise.all([
      book(hotel.id, '2026-12-10', '2026-12-12'),
      book(hotel.id, '2026-12-10', '2026-12-12'),
      book(hotel.id, '2026-12-10', '2026-12-12'),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409]);
  });

  test('cancelling a booking frees the room', async () => {
    const hotel = (await createHotel({ totalRooms: 1 })).body;
    const first = await book(hotel.id, '2026-12-01', '2026-12-05');

    const cancelled = await request(app).delete(`/api/bookings/${first.body.id}`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');

    expect((await book(hotel.id, '2026-12-01', '2026-12-05')).status).toBe(201);
  });
});
