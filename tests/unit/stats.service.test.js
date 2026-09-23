const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { AppError } = require("../../src/utils/AppError");
const { createStatsService } = require("../../src/services/stats.service");

describe("stats.service", () => {
  it("returns total, per-day and referrer stats for an existing code", async () => {
    const service = createStatsService({
      baseUrl: "http://localhost:3000",
      urls: {
        findByShortCode: async () => ({
          id: 9,
          short_code: "abc1234",
          long_url: "https://example.com",
          created_at: "2026-01-01T00:00:00.000Z",
        }),
      },
      clicks: {
        countByUrlId: async () => 3,
        countPerDayByUrlId: async () => [
          { day: "2026-01-02", clicks: 2 },
          { day: "2026-01-03", clicks: 1 },
        ],
        topReferrersByUrlId: async () => [
          { referrer: "direct", clicks: 2 },
          { referrer: "https://ref.example", clicks: 1 },
        ],
      },
    });

    const stats = await service.getStats("abc1234");
    assert.equal(stats.shortUrl, "http://localhost:3000/abc1234");
    assert.equal(stats.totalClicks, 3);
    assert.equal(stats.clicksPerDay.length, 2);
    assert.equal(stats.referrers[0].referrer, "direct");
  });

  it("throws 404 when the short code does not exist", async () => {
    const service = createStatsService({
      urls: { findByShortCode: async () => null },
      clicks: {},
    });
    await assert.rejects(
      () => service.getStats("nope123"),
      (err) => err instanceof AppError && err.statusCode === 404
    );
  });
});
