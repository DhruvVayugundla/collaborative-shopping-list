export type Role = "owner" | "member";

export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: number;
  /** Per-unit price in minor units (paise). */
  estimatedPriceCents: number;
  purchased: boolean;
  createdBy: { id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

export interface Member {
  userId: string;
  username: string;
  role: Role;
  addedAt: string;
}

export interface ListSummary {
  id: string;
  name: string;
  role: Role;
  owner: { id: string; username: string };
  memberCount: number;
  itemCount: number;
  purchasedCount: number;
  totalCents: number;
  pendingCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListDetail {
  id: string;
  name: string;
  ownerId: string;
  role: Role;
  items: Item[];
  members: Member[];
  createdAt: string;
  updatedAt: string;
}
