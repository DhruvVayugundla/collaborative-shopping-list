import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { migrateTurso } from "../src/scripts/migrate.js";

// A local libSQL file stands in for Turso: same client, same SQL.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "turso-migrate-"));
const url = `file:${path.join(dir, "db.sqlite").replaceAll("\\", "/")}`;

afterAll(() => {
  // On Windows the native libSQL handle can hold the file briefly after close(); a leftover temp dir is harmless.
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
});

describe("migrateTurso", () => {
  it("applies every migration once and is safe to re-run", async () => {
    await migrateTurso(url);
    await migrateTurso(url); // second run must skip, not fail on existing tables

    const db = createClient({ url });
    const tables = (await db.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).rows.map((r) =>
      String(r.name),
    );
    expect(tables).toEqual(expect.arrayContaining(["User", "ShoppingList", "ListMember", "Item", "_app_migrations"]));

    const migrations = fs.readdirSync(path.resolve(import.meta.dirname, "../prisma/migrations"), { withFileTypes: true });
    const expected = migrations.filter((d) => d.isDirectory()).length;
    const recorded = await db.execute("SELECT COUNT(*) AS n FROM _app_migrations");
    expect(Number(recorded.rows[0].n)).toBe(expected);
    db.close();
  });
});
