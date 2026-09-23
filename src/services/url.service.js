const { AppError } = require("../utils/AppError");
const { generateShortCode } = require("../utils/shortCode");
const urlRepository = require("../db/url.repository");
const { config } = require("../config");

const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_URL_LENGTH = 2048;
const SHORT_CODE_PATTERN = /^[0-9A-Za-z]{4,16}$/;

// Returns the normalised URL, or throws a 400 whose message says exactly what
// is wrong. Only http(s) is allowed: javascript: or data: URLs would turn
// the short link into an XSS / phishing vector.
function validateLongUrl(longUrl, { ownHost } = {}) {
  if (longUrl === undefined || longUrl === null) {
    throw new AppError("longUrl is required", 400);
  }
  if (typeof longUrl !== "string") {
    throw new AppError("longUrl must be a string", 400);
  }
  const trimmed = longUrl.trim();
  if (trimmed === "") {
    throw new AppError("longUrl is required", 400);
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new AppError(`longUrl must be at most ${MAX_URL_LENGTH} characters`, 400);
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError(
      "longUrl must be a valid absolute URL, e.g. https://example.com",
      400
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AppError("longUrl must use the http or https protocol", 400);
  }
  if (!parsed.hostname) {
    throw new AppError("longUrl must include a hostname", 400);
  }
  // Shortening our own links would allow redirect loops.
  if (ownHost && parsed.host === ownHost) {
    throw new AppError("longUrl cannot point at this URL shortener", 400);
  }
  return parsed.href;
}

function createUrlService({
  urls = urlRepository,
  generateCode = generateShortCode,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  ownHost = new URL(config.baseUrl).host,
} = {}) {
  async function shortenUrl(longUrl) {
    const normalised = validateLongUrl(longUrl, { ownHost });

    // The UNIQUE constraint is the real guarantee; retrying just picks a new
    // code in the (~1 in 350,000 at 10M rows) case that one is taken.
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const row = await urls.insertUrlIfCodeFree({
        shortCode: generateCode(),
        longUrl: normalised,
      });
      if (row) return row;
    }
    throw new AppError("Could not generate a unique short code", 500);
  }

  // Malformed codes are a 404 rather than a 400: to the client it's simply a
  // link that doesn't exist. Checking the pattern first skips a DB round trip
  // for noise like /favicon.ico.
  async function getByShortCode(shortCode) {
    const row = SHORT_CODE_PATTERN.test(shortCode)
      ? await urls.findByShortCode(shortCode)
      : null;
    if (!row) {
      throw new AppError("Short URL not found", 404);
    }
    return row;
  }

  return { shortenUrl, getByShortCode };
}

const urlService = createUrlService();

module.exports = { createUrlService, urlService, validateLongUrl };
