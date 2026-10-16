import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { attachSocket } from "../src/realtime/socket.js";
import { app, createList, signUp } from "./helpers.js";

let server: http.Server;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  server = http.createServer(app);
  attachSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.disconnect());
  await new Promise((resolve) => server.close(resolve));
});

function open(cookie: string) {
  const socket = connect(url, { extraHeaders: { cookie }, transports: ["websocket"], reconnection: false });
  sockets.push(socket);
  return socket;
}

function once<T>(socket: Socket, event: string) {
  return new Promise<T>((resolve) => socket.once(event, resolve));
}

function join(socket: Socket, listId: string) {
  return socket.emitWithAck("list:join", { listId }) as Promise<{ ok: boolean; error?: string }>;
}

describe("realtime", () => {
  it("rejects connections without a valid cookie", async () => {
    const socket = open("token=bogus");
    const err = await once<Error>(socket, "connect_error");
    expect(err.message).toBe("UNAUTHENTICATED");
  });

  it("broadcasts item changes to list members and blocks outsiders", async () => {
    const owner = await signUp(server);
    const member = await signUp(server);
    const outsider = await signUp(server);
    const list = await createList(owner.agent);
    await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: member.user.username });

    const memberSocket = open(member.cookie);
    const outsiderSocket = open(outsider.cookie);
    expect(await join(memberSocket, list.id)).toEqual({ ok: true });
    expect(await join(outsiderSocket, list.id)).toEqual({ ok: false, error: "NOT_FOUND" });

    const created = once<{ item: { name: string; id: string } }>(memberSocket, "item:created");
    await owner.agent.post(`/api/v1/lists/${list.id}/items`).send({ name: "Tea", estimatedPriceCents: 25000 });
    const { item } = await created;
    expect(item.name).toBe("Tea");

    const updated = once<{ item: { purchased: boolean } }>(memberSocket, "item:updated");
    await owner.agent.patch(`/api/v1/lists/${list.id}/items/${item.id}`).send({ purchased: true });
    expect((await updated).item.purchased).toBe(true);
  });

  it("notifies a user when added, and stops events after removal", async () => {
    const owner = await signUp(server);
    const member = await signUp(server);
    const list = await createList(owner.agent);
    const memberSocket = open(member.cookie);
    await once(memberSocket, "connect");

    const changed = once(memberSocket, "lists:changed");
    await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: member.user.username });
    await changed;
    expect(await join(memberSocket, list.id)).toEqual({ ok: true });

    const removed = once<{ userId: string }>(memberSocket, "member:removed");
    await owner.agent.delete(`/api/v1/lists/${list.id}/members/${member.user.id}`);
    expect((await removed).userId).toBe(member.user.id);

    let leaked = false;
    memberSocket.on("item:created", () => (leaked = true));
    await owner.agent.post(`/api/v1/lists/${list.id}/items`).send({ name: "Secret" });
    await new Promise((r) => setTimeout(r, 150));
    expect(leaked).toBe(false);
  });
});
