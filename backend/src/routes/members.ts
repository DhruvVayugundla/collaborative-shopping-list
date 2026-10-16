import { Router } from "express";
import { prisma } from "../db.js";
import { AppError } from "../errors.js";
import { currentUser } from "../auth/middleware.js";
import { memberBodySchema } from "../validation.js";
import { assertMember, assertOwner } from "../services/access.js";
import { memberInclude, toMember } from "../services/serialize.js";
import { realtime } from "../realtime/socket.js";
import { param } from "./params.js";

export const membersRouter = Router({ mergeParams: true });

membersRouter.post("/", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  await assertOwner(listId, me.id);
  const { username } = memberBodySchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) throw new AppError("NOT_FOUND", `No user named "${username}"`);

  const existing = await prisma.listMember.findUnique({
    where: { listId_userId: { listId, userId: user.id } },
  });
  if (existing) throw new AppError("CONFLICT", `${username} is already a member of this list`);

  const member = await prisma.listMember.create({
    data: { listId, userId: user.id, role: "member" },
    include: memberInclude,
  });
  const payload = toMember(member);

  realtime.toList(listId, "member:added", { listId, member: payload });
  realtime.toUsers([user.id], "lists:changed", {});
  res.status(201).json({ member: payload });
});

/** Owner removes a member, or a member removes themselves (leaves the list). */
membersRouter.delete("/:userId", async (req, res) => {
  const me = currentUser(req);
  const listId = param(req, "listId");
  const targetId = param(req, "userId");
  const myRole = await assertMember(listId, me.id);

  if (targetId === me.id) {
    if (myRole === "owner") {
      throw new AppError("VALIDATION_ERROR", "The owner can't leave their own list. Delete it instead.");
    }
  } else if (myRole !== "owner") {
    throw new AppError("FORBIDDEN", "Only the list owner can remove members");
  }

  const { count } = await prisma.listMember.deleteMany({ where: { listId, userId: targetId } });
  if (count === 0) throw new AppError("NOT_FOUND", "Member not found");

  realtime.toList(listId, "member:removed", { listId, userId: targetId });
  realtime.toUsers([targetId], "lists:changed", {});
  realtime.removeUserFromList(targetId, listId);
  res.status(204).end();
});
