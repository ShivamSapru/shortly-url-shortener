const { pool } = require("./pool");

// Returns null when short_code is already taken. ON CONFLICT makes the
// check-and-insert a single atomic statement, so two concurrent requests
// can never both claim the same code.
async function insertUrlIfCodeFree({ shortCode, longUrl }) {
  const result = await pool.query(
    `INSERT INTO urls (short_code, long_url)
     VALUES ($1, $2)
     ON CONFLICT (short_code) DO NOTHING
     RETURNING id, short_code, long_url, created_at`,
    [shortCode, longUrl]
  );
  return result.rows[0] || null;
}

async function findByShortCode(shortCode) {
  const result = await pool.query(
    `SELECT id, short_code, long_url, created_at
     FROM urls
     WHERE short_code = $1`,
    [shortCode]
  );
  return result.rows[0] || null;
}

module.exports = { insertUrlIfCodeFree, findByShortCode };
