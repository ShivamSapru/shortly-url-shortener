const { Pool } = require("pg");
const { config } = require("../config");

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
});

module.exports = { pool };
