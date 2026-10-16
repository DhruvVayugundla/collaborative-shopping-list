import { describe, expect, it } from "vitest";
import { computeTotals, removeItem, sortItems, upsertItem } from "./cache";
import { parseMoney } from "../lib/format";
import type { Item, ListDetail } from "../types";

const item = (over: Partial<Item>): Item => ({
  id: "i1",
  listId: "l1",
  name: "Milk",
  quantity: 1,
  estimatedPriceCents: 0,
  purchased: false,
  createdBy: { id: "u1", username: "a" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...over,
});

const list = (items: Item[]): ListDetail => ({
  id: "l1",
  name: "L",
  ownerId: "u1",
  role: "owner",
  items,
  members: [],
  createdAt: "",
  updatedAt: "",
});

describe("cache updaters", () => {
  it("upsert is idempotent and ignores stale versions", () => {
    const a = item({});
    let l = upsertItem(list([]), a);
    l = upsertItem(l, a);
    expect(l.items).toHaveLength(1);

    const newer = item({ purchased: true, updatedAt: "2026-01-02T00:00:00.000Z" });
    l = upsertItem(l, newer);
    expect(l.items[0].purchased).toBe(true);

    l = upsertItem(l, a); // late echo of the older version
    expect(l.items[0].purchased).toBe(true);

    expect(removeItem(l, "i1").items).toHaveLength(0);
  });

  it("computes totals with quantity", () => {
    const totals = computeTotals([
      item({ id: "a", quantity: 2, estimatedPriceCents: 3000 }),
      item({ id: "b", quantity: 1, estimatedPriceCents: 4550, purchased: true }),
    ]);
    expect(totals).toEqual({ totalCents: 10550, pendingCents: 6000, purchasedCount: 1 });
  });

  it("sorts pending before purchased", () => {
    const sorted = sortItems([
      item({ id: "p", purchased: true, createdAt: "2026-01-01" }),
      item({ id: "n", createdAt: "2026-01-03" }),
      item({ id: "o", createdAt: "2026-01-02" }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(["o", "n", "p"]);
  });
});

describe("parseMoney", () => {
  it("parses amounts into minor units", () => {
    expect(parseMoney("45.5")).toBe(4550);
    expect(parseMoney("0.07")).toBe(7);
    expect(parseMoney("")).toBe(0);
    expect(parseMoney("-1")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
});
