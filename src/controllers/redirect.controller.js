const { urlService } = require("../services/url.service");
const clickRepository = require("../db/click.repository");

async function redirect(req, res) {
  const row = await urlService.getByShortCode(req.params.shortCode);

  // 302, not 301: browsers cache 301s forever and would skip us (and the
  // click log) on repeat visits.
  res.redirect(302, row.long_url);

  // Logged after responding so the user never waits on analytics. Trade-off:
  // a click can be lost if the process dies in between. Errors must be
  // caught here — nothing upstream is listening any more.
  clickRepository
    .insertClick({
      urlId: row.id,
      referrer: req.get("referer") || null,
      userAgent: req.get("user-agent") || null,
    })
    .catch((err) => console.error("Failed to record click", err));
}

module.exports = { redirect };
