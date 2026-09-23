const express = require("express");
const { shorten } = require("../controllers/url.controller");
const { getStats } = require("../controllers/stats.controller");
const { shortenRateLimit } = require("../middleware/rateLimit");
const { asyncHandler } = require("../middleware/errorHandler");

const router = express.Router();

router.post("/shorten", shortenRateLimit, asyncHandler(shorten));
router.get("/stats/:shortCode", asyncHandler(getStats));

module.exports = { apiRouter: router };
