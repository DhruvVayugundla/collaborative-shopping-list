import { prisma } from "../db.js";
import { AppError } from "../errors.js";

export type Role = "owner" | "member";

export async function getRole(listId: string, userId: string): Promise<Role | null> {
  const m = await prisma.listMember.findUnique({
    where: { listId_userId: { listId, userId } },
    select: { role: true },
  });
  return (m?.role as Role | undefined) ?? null;
}

/** Non-members get 404 so the existence of a list isn't leaked. */
export async function assertMember(listId: string, userId: string): Promise<Role> {
  const role = await getRole(listId, userId);
  if (!role) throw new AppError("NOT_FOUND", "List not found");
  return role;
}

export async function assertOwner(listId: string, userId: string): Promise<void> {
  const role = await assertMember(listId, userId);
  if (role !== "owner") throw new AppError("FORBIDDEN", "Only the list owner can do this");
}

export async function memberIds(listId: string): Promise<string[]> {
  const rows = await prisma.listMember.findMany({ where: { listId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}
