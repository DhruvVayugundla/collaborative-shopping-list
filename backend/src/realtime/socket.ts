import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { COOKIE_NAME, verifyToken, type AuthUser } from "../auth/jwt.js";
import { getRole } from "../services/access.js";

type Ack = (res: { ok: true } | { ok: false; error: string }) => void;

interface ClientToServer {
  "list:join": (payload: { listId: string }, ack?: Ack) => void;
  "list:leave": (payload: { listId: string }) => void;
}

interface SocketData {
  user: AuthUser;
}

let io: Server<ClientToServer, Record<string, (payload: unknown) => void>, {}, SocketData> | null = null;

const listRoom = (listId: string) => `list:${listId}`;
const userRoom = (userId: string) => `user:${userId}`;
const joinSchema = z.object({ listId: z.string().min(1) });

export function attachSocket(server: HttpServer) {
  io = new Server(server);

  // Authenticate the handshake with the same httpOnly cookie the REST API uses.
  io.use((socket, next) => {
    const cookies = parseCookie(socket.request.headers.cookie ?? "");
    const user = verifyToken(cookies[COOKIE_NAME]);
    if (!user) return next(new Error("UNAUTHENTICATED"));
    socket.data.user = user;
    next();
  });

  io.on("connection", (socket: Socket<ClientToServer, {}, {}, SocketData>) => {
    const { user } = socket.data;
    socket.join(userRoom(user.id));

    socket.on("list:join", async (payload, ack) => {
      const parsed = joinSchema.safeParse(payload);
      if (!parsed.success) return ack?.({ ok: false, error: "VALIDATION_ERROR" });
      const role = await getRole(parsed.data.listId, user.id).catch(() => null);
      if (!role) return ack?.({ ok: false, error: "NOT_FOUND" });
      await socket.join(listRoom(parsed.data.listId));
      ack?.({ ok: true });
    });

    socket.on("list:leave", (payload) => {
      const parsed = joinSchema.safeParse(payload);
      if (parsed.success) socket.leave(listRoom(parsed.data.listId));
    });
  });

  return io;
}

/** Broadcast helpers called by REST handlers after a successful write. No-ops when no socket server is attached (tests). */
export const realtime = {
  toList(listId: string, event: string, payload: unknown) {
    io?.to(listRoom(listId)).emit(event, payload);
  },
  toUsers(userIds: string[], event: string, payload: unknown) {
    if (!io || userIds.length === 0) return;
    io.to(userIds.map(userRoom)).emit(event, payload);
  },
  /** Stop a user's open sockets from receiving a list's events (after removal). */
  removeUserFromList(userId: string, listId: string) {
    io?.in(userRoom(userId)).socketsLeave(listRoom(listId));
  },
  closeList(listId: string) {
    io?.in(listRoom(listId)).socketsLeave(listRoom(listId));
  },
};
