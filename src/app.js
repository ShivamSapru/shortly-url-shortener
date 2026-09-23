const express = require("express");
const { apiRouter } = require("./routes/api.routes");
const { redirectRouter } = require("./routes/redirect.routes");
const { errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  // Render (like most hosts) sits one proxy hop in front of us. Without this,
  // req.ip is the proxy's address and every user shares one rate-limit bucket.
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));

  app.use("/api", apiRouter);
  app.use("/", redirectRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use(errorHandler);

  return app;
}

module.exports = { app: createApp(), createApp };
