require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Jest sets NODE_ENV=test, so tests never touch the development database.
const connectionString =
  process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

const pool = new Pool({ connectionString });

const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { query, getClient, initDb, pool };
