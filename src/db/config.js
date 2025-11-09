// src/db/config.js
const { Pool } = require('pg'); // Make sure to import Pool

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'order_service',
  password: 'postgres',
  port: 5435, // your mapped Docker port
});

pool.on('connect', () => {
  console.log('Connected to Postgres DB');
});

pool.on('error', (err) => {
  console.error('Unexpected DB error', err);
});

module.exports = pool;
