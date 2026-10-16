import { Router } from "express";
import { prisma } from "../db.js";
import { currentUser } from "../auth/middleware.js";
import { listBodySchema } from "../validation.js";
import { assertMember, assertOwner, memberIds } from "../services/access.js";
import { computeTotals, itemInclude, memberInclude, toItem, toMember } from "../services/serialize.js";
import { realtime } from "../realtime/socket.js";
import { param } from "./params.js";

export const listsRouter = Router();

const summaryInclude = {
  owner: { select: { id: true, username: true } },
  items: { select: { quantity: true, estimatedPriceCents: true, purchased: true } },
  _count: { select: { members: true } },
} as const;

listsRouter.get("/", async (req, res) => {
  const me = currentUser(req);
  const memberships = await prisma.listMember.findMany({
    where: { userId: me.id },
    include: { list: { include: summaryInclude } },
    orderBy: { list: { updatedAt: "desc" } },
  });
  res.json({
    lists: memberships.map(({ role, list }) => ({
      id: list.id,
      name: list.name,
      role,
      owner: list.owner,
      memberCount: list._count.members,
      ...computeTotals(list.items),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    })),
  });
});

listsRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const { name } = listBodySchema.parse(req.body);
  const list = await prisma.shoppingList.create({
    data: { name, ownerId: me.id, members: { create: { userId: me.id, role: "owner" } } },
    include: summaryInclude,
  });
  res.status(201).json({
    list: {
      id: list.id,
      name: list.name,
      role: "owner",
      owner: list.owner,
      memberCount: list._count.members,
      ...computeTotals(list.items),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    },
  });
});

listsRouter.get("/:listId", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  const role = await assertMember(listId, me.id);
  const list = await prisma.shoppingList.findUniqueOrThrow({
    where: { id: listId },
    include: {
      items: { include: itemInclude, orderBy: { createdAt: "asc" } },
      members: { include: memberInclude, orderBy: { addedAt: "asc" } },
    },
  });
  res.json({
    list: {
      id: list.id,
      name: list.name,
      ownerId: list.ownerId,
      role,
      items: list.items.map(toItem),
      members: list.members.map(toMember),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    },
  });
});

listsRouter.patch("/:listId", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  await assertOwner(listId, me.id);
  const { name } = listBodySchema.parse(req.body);
  const list = await prisma.shoppingList.update({ where: { id: listId }, data: { name } });
  const payload = { id: list.id, name: list.name, updatedAt: list.updatedAt.toISOString() };

  realtime.toList(listId, "list:updated", { list: payload });
  realtime.toUsers(await memberIds(listId), "lists:changed", {});
  res.json({ list: payload });
});

listsRouter.delete("/:listId", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  await assertOwner(listId, me.id);
  const members = await memberIds(listId);
  await prisma.shoppingList.delete({ where: { id: listId } });

  realtime.toList(listId, "list:deleted", { listId });
  realtime.toUsers(members, "lists:changed", {});
  realtime.closeList(listId);
  res.status(204).end();
});
