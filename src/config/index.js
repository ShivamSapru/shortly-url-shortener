const path = require("path");
const dotenv = require("dotenv");

const root = path.join(__dirname, "../..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 3000,
  // Render sets RENDER_EXTERNAL_URL to the service's public URL automatically.
  baseUrl: (
    process.env.BASE_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, ""),
  // Tests truncate tables, so they must never fall back to DATABASE_URL.
  get databaseUrl() {
    return this.nodeEnv === "test"
      ? required("TEST_DATABASE_URL")
      : required("DATABASE_URL");
  },
};

module.exports = { config };
