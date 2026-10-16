import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const TEST_DB = path.resolve(import.meta.dirname, "../prisma/test.db");

/** Start every run from a fresh, test-only SQLite file built from the real migrations. */
export default function setup() {
  for (const file of [TEST_DB, `${TEST_DB}-journal`]) fs.rmSync(file, { force: true });
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });
}
