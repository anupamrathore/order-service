const pool = require('./config');

(async () => {
  try {
    const { rows } = await pool.query('SELECT NOW()');
    console.log('DB OK:', rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('DB ERROR:', err);
    process.exit(1);
  }
})();
