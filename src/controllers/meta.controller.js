const { config } = require("../config");

// Landing response for anyone who opens the base URL in a browser.
function index(_req, res) {
  return res.status(200).json({
    name: "Shortly — URL Shortener API",
    docs: "https://github.com/ShivamSapru/shortly-url-shortener#api",
    endpoints: {
      shorten: `POST ${config.baseUrl}/api/shorten  { "longUrl": "https://..." }`,
      redirect: `GET  ${config.baseUrl}/:shortCode`,
      stats: `GET  ${config.baseUrl}/api/stats/:shortCode`,
    },
  });
}

// Liveness only: deliberately doesn't query the database, so frequent health
// checks don't keep Neon's compute awake (it scales to zero when idle).
function health(_req, res) {
  return res.status(200).json({ status: "ok" });
}

module.exports = { index, health };
