import "dotenv/config";
import { readFileSync } from "node:fs";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const pool = new Pool({ connectionString: url });
const sql = readFileSync(new URL("../src/db/seed.sql", import.meta.url), "utf8");
await pool.query(sql);
console.log("seed applied");
await pool.end();
