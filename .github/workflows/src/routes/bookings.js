const express = require('express');
const db = require('../db');
const { wrap, isPositiveInt, isValidDate, isValidEmail } = require('../utils');

const router = express.Router();

const COLUMNS = `id, hotel_id, guest_name, guest_email,
  check_in::text AS check_in, check_out::text AS check_out, status, created_at`;

// POST /api/bookings
router.post('/', wrap(async (req, res) => {
  const { hotelId, guestName, guestEmail, checkIn, checkOut } = req.body || {};
  const errors = [];

  if (!Number.isInteger(hotelId) || hotelId <= 0) errors.push('hotelId must be a positive integer');
  if (typeof guestName !== 'string' || !guestName.trim()) errors.push('guestName is required');
  if (!isValidEmail(guestEmail)) errors.push('guestEmail is invalid');
  if (!isValidDate(checkIn)) errors.push('checkIn must be a valid date (YYYY-MM-DD)');
  if (!isValidDate(checkOut)) errors.push('checkOut must be a valid date (YYYY-MM-DD)');
  if (isValidDate(checkIn) && isValidDate(checkOut) && checkOut <= checkIn) {
    errors.push('checkOut must be after checkIn');
  }
  if (errors.length) return res.status(400).json({ errors });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Lock the hotel row so two simultaneous requests cannot both take the last room.
    const hotel = await client.query('SELECT id, total_rooms FROM hotels WHERE id = $1 FOR UPDATE', [hotelId]);
    if (hotel.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Hotel not found' });
    }

    // Count confirmed bookings whose dates overlap the requested stay.
    const overlap = await client.query(
      `SELECT COUNT(*)::int AS booked FROM bookings
       WHERE hotel_id = $1 AND status = 'confirmed'
         AND check_in < $3::date AND check_out > $2::date`,
      [hotelId, checkIn, checkOut]
    );
    if (overlap.rows[0].booked >= hotel.rows[0].total_rooms) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'No rooms available for these dates' });
    }

    const inserted = await client.query(
      `INSERT INTO bookings (hotel_id, guest_name, guest_email, check_in, check_out)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLUMNS}`,
      [hotelId, guestName.trim(), guestEmail, checkIn, checkOut]
    );
    await client.query('COMMIT');
    res.status(201).json(inserted.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// GET /api/bookings/:id
router.get('/:id', wrap(async (req, res) => {
  if (!isPositiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid booking id' });
  const { rows } = await db.query(`SELECT ${COLUMNS} FROM bookings WHERE id = $1`, [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
  res.json(rows[0]);
}));

// DELETE /api/bookings/:id  (cancels the booking and frees the room)
router.delete('/:id', wrap(async (req, res) => {
  if (!isPositiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid booking id' });
  const { rows } = await db.query(
    `UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING ${COLUMNS}`,
    [req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
  res.json(rows[0]);
}));

module.exports = router;
