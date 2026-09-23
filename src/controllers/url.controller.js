const { urlService } = require("../services/url.service");
const { config } = require("../config");

async function shorten(req, res) {
  const row = await urlService.shortenUrl(req.body?.longUrl);
  const shortUrl = `${config.baseUrl}/${row.short_code}`;
  return res.status(201).location(shortUrl).json({
    shortCode: row.short_code,
    shortUrl,
    longUrl: row.long_url,
  });
}

module.exports = { shorten };
