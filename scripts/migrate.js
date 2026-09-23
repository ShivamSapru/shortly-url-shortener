const fs = require("fs");
const path = require("path");
const { pool } = require("../src/db/pool");

const MIGRATIONS_DIR = path.join(__dirname, "../migrations");

// Every migration file is idempotent, so running them all in order is safe.
async function migrate() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await pool.query(fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
  }
}

if (require.main === module) {
  migrate()
    .then(() => {
      console.log("Migrations applied");
      return pool.end();
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}

module.exports = { migrate };
