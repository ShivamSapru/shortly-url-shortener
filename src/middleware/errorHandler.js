const { AppError } = require("../utils/AppError");

// Express 4 doesn't forward rejected promises to error middleware on its own.
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// The single place where errors become status codes.
function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  // Raised by express.json() before any route runs.
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must be valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request body is too large" });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
}

module.exports = { asyncHandler, errorHandler };
