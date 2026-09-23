const path = require("path");
const { config } = require("../config");

const LANDING_PAGE = path.join(__dirname, "../public/index.html");

// Content negotiation on the Accept header: browsers get the landing page,
// API clients (curl, Postman, fetch with Accept: application/json) get JSON.
// json is listed first because "Accept: */*" (curl's default) picks the
// first entry; browsers explicitly prefer text/html so they still get the page.
function index(_req, res) {
  res.format({
    json: () =>
      res.status(200).json({
        name: "Shortly — URL Shortener API",
        docs: "https://github.com/ShivamSapru/shortly-url-shortener#api",
        endpoints: {
          shorten: `POST ${config.baseUrl}/api/shorten  { "longUrl": "https://..." }`,
          redirect: `GET  ${config.baseUrl}/:shortCode`,
          stats: `GET  ${config.baseUrl}/api/stats/:shortCode`,
        },
      }),
    html: () => res.sendFile(LANDING_PAGE),
  });
}

// Liveness only: deliberately doesn't query the database, so frequent health
// checks don't keep Neon's compute awake (it scales to zero when idle).
function health(_req, res) {
  return res.status(200).json({ status: "ok" });
}

module.exports = { index, health };
