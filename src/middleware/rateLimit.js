const rateLimit = require("express-rate-limit");
const { config } = require("../config");

const shortenRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.nodeEnv === "test",
  message: { error: "Too many shorten requests, please try again later" },
});

module.exports = { shortenRateLimit };
