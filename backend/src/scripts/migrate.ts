/**
 * Apply database migrations before the server starts.
 *
 * Prisma Migrate can't connect to Turso, so when TURSO_DATABASE_URL is set we apply the SQL
 * files Prisma generated in prisma/migrations ourselves, tracking applied ones in a table.
 * Otherwise (local SQLite file) we defer to `prisma migrate deploy`.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { config } from "../config.js";

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, "../../prisma/migrations");

export async function migrateTurso(url: string, authToken?: string) {
  const db = createClient({ url, authToken });
  try {
    await db.execute(
      "CREATE TABLE IF NOT EXISTS _app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)",
    );
    const applied = new Set((await db.execute("SELECT name FROM _app_migrations")).rows.map((r) => String(r.name)));

    const folders = fs
      .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    for (const name of folders) {
      if (applied.has(name)) {
        console.log(`migration ${name}: already applied`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
      // One transaction per migration, so a failure never leaves it half-applied and unrecorded.
      await db.executeMultiple(
        `BEGIN;\n${sql}\nINSERT INTO _app_migrations (name, applied_at) VALUES ('${name.replaceAll("'", "''")}', '${new Date().toISOString()}');\nCOMMIT;`,
      );
      console.log(`migration ${name}: applied`);
    }
  } finally {
    db.close();
  }
}

// Run when executed directly (npm start), not when imported by tests.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (config.TURSO_DATABASE_URL) {
    await migrateTurso(config.TURSO_DATABASE_URL, config.TURSO_AUTH_TOKEN);
  } else {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
  }
}
