const { statsService } = require("../services/stats.service");

async function getStats(req, res) {
  const stats = await statsService.getStats(req.params.shortCode);
  return res.status(200).json(stats);
}

module.exports = { getStats };
