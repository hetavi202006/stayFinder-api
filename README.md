# StayFinder API
[![CI](https://github.com/hetavi202006/stayFinder-api/actions/workflows/ci.yml/badge.svg)](https://github.com/hetavi202006/stayFinder-api/actions/workflows/ci.yml)
A hotel search and booking REST API built with **Node.js, Express and PostgreSQL**.
It prevents double-booking with database transactions and row locking, is covered by
integration tests, and ships with Docker and a GitHub Actions CI pipeline.

## Features
- Search hotels by city and maximum price
- Create bookings with date validation and room-availability checks
- Overbooking prevention using `SELECT ... FOR UPDATE` inside a transaction
- Cancel bookings (frees the room for those dates)
- Relational schema with foreign keys, CHECK constraints and indexes

## Tech stack
Node.js, Express, PostgreSQL, Jest, Supertest, Docker, Docker Compose, GitHub Actions

## Run with Docker
```bash
docker compose up --build
```
API runs at http://localhost:3000

## Run locally
```bash
docker compose up -d db      # start PostgreSQL only
cp .env.example .env
npm install
npm start
```

## Run tests
Tests use a separate database (`stayfinder_test`), created automatically by Docker Compose.
```bash
docker compose up -d db
npm test
```

## API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/hotels?city=&maxPrice=` | Search hotels |
| GET | `/api/hotels/:id` | Get one hotel |
| POST | `/api/hotels` | Create a hotel |
| POST | `/api/bookings` | Create a booking |
| GET | `/api/bookings/:id` | Get a booking |
| DELETE | `/api/bookings/:id` | Cancel a booking |

### Example
```bash
curl -X POST localhost:3000/api/hotels -H "Content-Type: application/json" \
  -d '{"name":"Sea View","city":"Goa","pricePerNight":2500,"totalRooms":2,"rating":4.5}'

curl -X POST localhost:3000/api/bookings -H "Content-Type: application/json" \
  -d '{"hotelId":1,"guestName":"Asha","guestEmail":"asha@example.com","checkIn":"2026-12-01","checkOut":"2026-12-05"}'
```

## CI
Every push runs the test suite against a PostgreSQL service container, then builds the Docker image
(`.github/workflows/ci.yml`).
