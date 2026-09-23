const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

process.env.NODE_ENV = "test";
require("../../src/config"); // loads .env / .env.local

// This suite truncates tables: it only runs against a dedicated test database.
const skip = process.env.TEST_DATABASE_URL
  ? false
  : "TEST_DATABASE_URL not set (point it at a throwaway Neon branch)";

// Clicks are logged after the redirect is sent, so poll briefly.
async function waitFor(check, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await check();
    if (result || Date.now() > deadline) return result;
    await new Promise((r) => setTimeout(r, 50));
  }
}

describe("API integration", { skip }, () => {
  let app;
  let pool;

  before(async () => {
    const { migrate } = require("../../scripts/migrate");
    ({ pool } = require("../../src/db/pool"));
    ({ app } = require("../../src/app"));
    await migrate();
    await pool.query("TRUNCATE TABLE urls RESTART IDENTITY CASCADE");
  });

  after(async () => {
    await pool.end();
  });

  it("returns 400 with a clear message for an invalid longUrl", async () => {
    const res = await request(app)
      .post("/api/shorten")
      .send({ longUrl: "not-a-url" })
      .expect(400);
    assert.match(res.body.error, /valid absolute URL/);
  });

  it("returns 400 when longUrl is missing", async () => {
    const res = await request(app).post("/api/shorten").send({}).expect(400);
    assert.equal(res.body.error, "longUrl is required");
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await request(app)
      .post("/api/shorten")
      .set("Content-Type", "application/json")
      .send("{bad json")
      .expect(400);
    assert.equal(res.body.error, "Request body must be valid JSON");
  });

  it("rejects javascript: URLs", async () => {
    const res = await request(app)
      .post("/api/shorten")
      .send({ longUrl: "javascript:alert(1)" })
      .expect(400);
    assert.match(res.body.error, /http or https/i);
  });

  it("shortens a URL, redirects, and reports stats", async () => {
    const created = await request(app)
      .post("/api/shorten")
      .send({ longUrl: "https://example.com/docs" })
      .expect(201);

    const { shortCode, shortUrl } = created.body;
    assert.match(shortCode, /^[0-9A-Za-z]{7}$/);
    assert.ok(shortUrl.endsWith(`/${shortCode}`));
    assert.equal(created.headers.location, shortUrl);

    const redirected = await request(app)
      .get(`/${shortCode}`)
      .set("Referer", "https://news.example/")
      .expect(302);
    assert.equal(redirected.headers.location, "https://example.com/docs");
    await request(app).get(`/${shortCode}`).expect(302);

    const stats = await waitFor(async () => {
      const res = await request(app).get(`/api/stats/${shortCode}`).expect(200);
      return res.body.totalClicks === 2 ? res.body : null;
    });

    assert.ok(stats, "expected 2 clicks to be recorded");
    assert.equal(stats.clicksPerDay.length, 1);
    assert.equal(stats.clicksPerDay[0].clicks, 2);
    assert.match(stats.clicksPerDay[0].day, /^\d{4}-\d{2}-\d{2}$/);
    assert.deepEqual(
      stats.referrers.map((r) => [r.referrer, r.clicks]).sort(),
      [["direct", 1], ["https://news.example/", 1]]
    );
  });

  it("returns 404 for unknown and malformed short codes", async () => {
    await request(app).get("/api/stats/zzzzzzz").expect(404);
    await request(app).get("/zzzzzzz").expect(404);
    await request(app).get("/favicon.ico").expect(404);
  });
});
