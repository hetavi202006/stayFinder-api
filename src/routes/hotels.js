const express = require('express');
const db = require('../db');
const { wrap, isPositiveInt } = require('../utils');

const router = express.Router();

// GET /api/hotels?city=Goa&maxPrice=3000
router.get('/', wrap(async (req, res) => {
  const conditions = [];
  const params = [];

  if (req.query.city) {
    params.push(req.query.city);
    conditions.push(`LOWER(city) = LOWER($${params.length})`);
  }
  if (req.query.maxPrice !== undefined) {
    const max = Number(req.query.maxPrice);
    if (Number.isNaN(max) || max <= 0) {
      return res.status(400).json({ error: 'maxPrice must be a positive number' });
    }
    params.push(max);
    conditions.push(`price_per_night <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT * FROM hotels ${where} ORDER BY rating DESC NULLS LAST, id`,
    params
  );
  res.json(rows);
}));

// GET /api/hotels/:id
router.get('/:id', wrap(async (req, res) => {
  if (!isPositiveInt(req.params.id)) return res.status(400).json({ error: 'Invalid hotel id' });
  const { rows } = await db.query('SELECT * FROM hotels WHERE id = $1', [req.params.id]);
  if (rows.length === 0) return res.status(404).json({ error: 'Hotel not found' });
  res.json(rows[0]);
}));

// POST /api/hotels
router.post('/', wrap(async (req, res) => {
  const { name, city, pricePerNight, totalRooms, rating = null } = req.body || {};
  const errors = [];

  if (typeof name !== 'string' || !name.trim()) errors.push('name is required');
  if (typeof city !== 'string' || !city.trim()) errors.push('city is required');
  if (typeof pricePerNight !== 'number' || pricePerNight <= 0) errors.push('pricePerNight must be a positive number');
  if (!Number.isInteger(totalRooms) || totalRooms <= 0) errors.push('totalRooms must be a positive integer');
  if (rating !== null && (typeof rating !== 'number' || rating < 0 || rating > 5)) errors.push('rating must be between 0 and 5');

  if (errors.length) return res.status(400).json({ errors });

  const { rows } = await db.query(
    `INSERT INTO hotels (name, city, price_per_night, total_rooms, rating)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name.trim(), city.trim(), pricePerNight, totalRooms, rating]
  );
  res.status(201).json(rows[0]);
}));

module.exports = router;
