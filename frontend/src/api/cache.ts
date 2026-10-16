import type { Item, ListDetail, Member } from "../types";

/**
 * Pure updaters for the cached list detail. Both mutation results and socket events go through
 * these, so applying the same change twice (our own echo) is harmless.
 */

export function upsertItem(list: ListDetail, item: Item): ListDetail {
  const existing = list.items.find((i) => i.id === item.id);
  if (!existing) return { ...list, items: [...list.items, item] };
  // Ignore stale events that arrive after a newer version.
  if (existing.updatedAt > item.updatedAt) return list;
  return { ...list, items: list.items.map((i) => (i.id === item.id ? item : i)) };
}

export function removeItem(list: ListDetail, itemId: string): ListDetail {
  return { ...list, items: list.items.filter((i) => i.id !== itemId) };
}

export function upsertMember(list: ListDetail, member: Member): ListDetail {
  const others = list.members.filter((m) => m.userId !== member.userId);
  return { ...list, members: [...others, member] };
}

export function removeMember(list: ListDetail, userId: string): ListDetail {
  return { ...list, members: list.members.filter((m) => m.userId !== userId) };
}

export function computeTotals(items: Item[]) {
  let totalCents = 0;
  let pendingCents = 0;
  for (const i of items) {
    const line = i.quantity * i.estimatedPriceCents;
    totalCents += line;
    if (!i.purchased) pendingCents += line;
  }
  return { totalCents, pendingCents, purchasedCount: items.filter((i) => i.purchased).length };
}

/** Pending items first, then purchased; oldest first within each group. */
export function sortItems(items: Item[]): Item[] {
  return [...items].sort(
    (a, b) => Number(a.purchased) - Number(b.purchased) || a.createdAt.localeCompare(b.createdAt),
  );
}
