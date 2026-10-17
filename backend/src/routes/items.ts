import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { AppError, errorBody } from "../errors.js";
import { currentUser } from "../auth/middleware.js";
import { bulkItemsSchema, createItemSchema, parseTextSchema, updateItemSchema } from "../validation.js";
import { assertMember } from "../services/access.js";
import { itemInclude, toItem } from "../services/serialize.js";
import { realtime } from "../realtime/socket.js";
import { parseItems } from "../ai/parseItems.js";
import { param } from "./params.js";

export const itemsRouter = Router({ mergeParams: true });

// Each parse is a paid API call, so cap it per user.
const parseLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => currentUser(req).id,
  skip: () => config.NODE_ENV === "test",
  handler: (_req, res) => {
    res.status(429).json(errorBody("RATE_LIMITED", "Too many AI requests. Try again in a few minutes."));
  },
});

/** AI quick-add step 1: turn free text into draft items. Nothing is saved. */
itemsRouter.post("/parse", parseLimiter, async (req, res) => {
  const me = currentUser(req);
  await assertMember(param(req, "listId"), me.id);
  const { text } = parseTextSchema.parse(req.body);
  res.json({ items: await parseItems(text) });
});

/** AI quick-add step 2: save the reviewed drafts in one go. */
itemsRouter.post("/bulk", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  await assertMember(listId, me.id);
  const { items: inputs } = bulkItemsSchema.parse(req.body);

  const created = await prisma.$transaction(
    inputs.map((data) =>
      prisma.item.create({ data: { ...data, listId, createdById: me.id }, include: itemInclude }),
    ),
  );
  const items = created.map(toItem);
  for (const item of items) realtime.toList(listId, "item:created", { listId, item });
  res.status(201).json({ items });
});

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
