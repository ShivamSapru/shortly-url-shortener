const urlRepository = require("../db/url.repository");
const clickRepository = require("../db/click.repository");
const { createUrlService } = require("./url.service");
const { config } = require("../config");

function createStatsService({
  urls = urlRepository,
  clicks = clickRepository,
  baseUrl = config.baseUrl,
} = {}) {
  const { getByShortCode } = createUrlService({ urls });

  async function getStats(shortCode) {
    const url = await getByShortCode(shortCode);

    // Independent reads, so run them concurrently.
    const [totalClicks, clicksPerDay, referrers] = await Promise.all([
      clicks.countByUrlId(url.id),
      clicks.countPerDayByUrlId(url.id),
      clicks.topReferrersByUrlId(url.id),
    ]);

    return {
      shortCode: url.short_code,
      shortUrl: `${baseUrl}/${url.short_code}`,
      longUrl: url.long_url,
      createdAt: url.created_at,
      totalClicks,
      clicksPerDay,
      referrers,
    };
  }

  return { getStats };
}

const statsService = createStatsService();

module.exports = { createStatsService, statsService };
