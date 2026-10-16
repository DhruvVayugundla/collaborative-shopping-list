import { Router } from "express";
import { prisma } from "../db.js";
import { AppError } from "../errors.js";
import { currentUser } from "../auth/middleware.js";
import { createItemSchema, updateItemSchema } from "../validation.js";
import { assertMember } from "../services/access.js";
import { itemInclude, toItem } from "../services/serialize.js";
import { realtime } from "../realtime/socket.js";
import { param } from "./params.js";

export const itemsRouter = Router({ mergeParams: true });

itemsRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  await assertMember(listId, me.id);
  const data = createItemSchema.parse(req.body);

  const item = toItem(
    await prisma.item.create({ data: { ...data, listId, createdById: me.id }, include: itemInclude }),
  );
  realtime.toList(listId, "item:created", { listId, item });
  res.status(201).json({ item });
});

itemsRouter.patch("/:itemId", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  const itemId = param(req, "itemId");
  await assertMember(listId, me.id);
  const data = updateItemSchema.parse(req.body);

  const exists = await prisma.item.findFirst({ where: { id: itemId, listId }, select: { id: true } });
  if (!exists) throw new AppError("NOT_FOUND", "Item not found");

  // Last write wins: concurrent edits simply overwrite, and everyone receives the final state.
  const item = toItem(await prisma.item.update({ where: { id: itemId }, data, include: itemInclude }));
  realtime.toList(listId, "item:updated", { listId, item });
  res.json({ item });
});

itemsRouter.delete("/:itemId", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  const itemId = param(req, "itemId");
  await assertMember(listId, me.id);

  const { count } = await prisma.item.deleteMany({ where: { id: itemId, listId } });
  if (count === 0) throw new AppError("NOT_FOUND", "Item not found");

  realtime.toList(listId, "item:deleted", { listId, itemId });
  res.status(204).end();
});
