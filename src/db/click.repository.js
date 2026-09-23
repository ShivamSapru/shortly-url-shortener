const { pool } = require("./pool");

async function insertClick({ urlId, referrer, userAgent }) {
  await pool.query(
    `INSERT INTO clicks (url_id, referrer, user_agent)
     VALUES ($1, $2, $3)`,
    [urlId, referrer, userAgent]
  );
}

async function countByUrlId(urlId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM clicks
     WHERE url_id = $1`,
    [urlId]
  );
  return result.rows[0].total;
}

// Days are bucketed in UTC so results don't depend on the server's timezone.
async function countPerDayByUrlId(urlId) {
  const result = await pool.query(
    `SELECT to_char(clicked_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS clicks
     FROM clicks
     WHERE url_id = $1
     GROUP BY day
     ORDER BY day`,
    [urlId]
  );
  return result.rows;
}

async function topReferrersByUrlId(urlId, limit = 10) {
  const result = await pool.query(
    `SELECT COALESCE(referrer, 'direct') AS referrer,
            COUNT(*)::int AS clicks
     FROM clicks
     WHERE url_id = $1
     GROUP BY 1
     ORDER BY clicks DESC, referrer
     LIMIT $2`,
    [urlId, limit]
  );
  return result.rows;
}

module.exports = {
  insertClick,
  countByUrlId,
  countPerDayByUrlId,
  topReferrersByUrlId,
};
