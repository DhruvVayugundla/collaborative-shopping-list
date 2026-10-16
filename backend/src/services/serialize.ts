import type { Item, ListMember, User } from "@prisma/client";

export const itemInclude = { createdBy: { select: { id: true, username: true } } } as const;
export const memberInclude = { user: { select: { id: true, username: true } } } as const;

export function toItem(item: Item & { createdBy: Pick<User, "id" | "username"> }) {
  return {
    id: item.id,
    listId: item.listId,
    name: item.name,
    quantity: item.quantity,
    estimatedPriceCents: item.estimatedPriceCents,
    purchased: item.purchased,
    createdBy: item.createdBy,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function toMember(m: ListMember & { user: Pick<User, "id" | "username"> }) {
  return {
    userId: m.userId,
    username: m.user.username,
    role: m.role,
    addedAt: m.addedAt.toISOString(),
  };
}

type PricedItem = Pick<Item, "quantity" | "estimatedPriceCents" | "purchased">;

export function computeTotals(items: PricedItem[]) {
  let totalCents = 0;
  let pendingCents = 0;
  let purchasedCount = 0;
  for (const i of items) {
    const line = i.quantity * i.estimatedPriceCents;
    totalCents += line;
    if (i.purchased) purchasedCount++;
    else pendingCents += line;
  }
  return { itemCount: items.length, purchasedCount, totalCents, pendingCents };
}
