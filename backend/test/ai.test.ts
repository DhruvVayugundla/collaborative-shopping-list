import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { io as connect } from "socket.io-client";
import { AppError } from "../src/errors.js";

// Never call the real Claude API from tests.
const ai = vi.hoisted(() => ({ enabled: true, parseItems: vi.fn() }));
vi.mock("../src/ai/parseItems.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/ai/parseItems.js")>()),
  aiEnabled: () => ai.enabled,
  parseItems: ai.parseItems,
}));

const { normalizeDrafts } = await import("../src/ai/parseItems.js");
const { attachSocket } = await import("../src/realtime/socket.js");
const { app, createList, signUp } = await import("./helpers.js");

beforeEach(() => {
  ai.enabled = true;
  ai.parseItems.mockReset();
});

describe("normalizeDrafts", () => {
  it("clamps quantities, converts rupees to paise and drops empty names", () => {
    expect(
      normalizeDrafts([
        { name: "  Milk ", quantity: 2, priceRupees: 32.5 },
        { name: "   ", quantity: 1, priceRupees: null },
        { name: "Eggs", quantity: 0, priceRupees: null },
        { name: "Rice", quantity: 50000, priceRupees: -3 },
      ]),
    ).toEqual([
      { name: "Milk", quantity: 2, estimatedPriceCents: 3250 },
      { name: "Eggs", quantity: 1, estimatedPriceCents: 0 },
      { name: "Rice", quantity: 9999, estimatedPriceCents: 0 },
    ]);
  });

  it("caps the number of drafts at 50", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ name: `Item ${i}`, quantity: 1, priceRupees: null }));
    expect(normalizeDrafts(many)).toHaveLength(50);
  });
});

describe("POST /lists/:listId/items/parse", () => {
  it("returns drafts without saving anything", async () => {
    const { agent } = await signUp();
    const list = await createList(agent);
    const drafts = [{ name: "Milk", quantity: 2, estimatedPriceCents: 3000 }];
    ai.parseItems.mockResolvedValue(drafts);

    const res = await agent.post(`/api/v1/lists/${list.id}/items/parse`).send({ text: "2 milk ~30" });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual(drafts);
    expect(ai.parseItems).toHaveBeenCalledWith("2 milk ~30");
    expect((await agent.get(`/api/v1/lists/${list.id}`)).body.list.items).toHaveLength(0);
  });

  it("validates text and membership before calling the AI", async () => {
    const owner = await signUp();
    const outsider = await signUp();
    const list = await createList(owner.agent);
    const url = `/api/v1/lists/${list.id}/items/parse`;

    expect((await owner.agent.post(url).send({ text: "   " })).status).toBe(400);
    expect((await owner.agent.post(url).send({ text: "x".repeat(2001) })).status).toBe(400);
    expect((await outsider.agent.post(url).send({ text: "milk" })).status).toBe(404);
    expect(ai.parseItems).not.toHaveBeenCalled();
  });

  it("passes through AI errors with their status", async () => {
    const { agent } = await signUp();
    const list = await createList(agent);
    ai.parseItems.mockRejectedValue(new AppError("AI_UNAVAILABLE", "not set up"));
    const res = await agent.post(`/api/v1/lists/${list.id}/items/parse`).send({ text: "milk" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AI_UNAVAILABLE");
  });
});

describe("GET /features", () => {
  it("reports whether AI quick-add is enabled", async () => {
    const { agent } = await signUp();
    expect((await agent.get("/api/v1/features")).body).toEqual({ aiQuickAdd: true });
    ai.enabled = false;
    expect((await agent.get("/api/v1/features")).body).toEqual({ aiQuickAdd: false });
  });
});

describe("POST /lists/:listId/items/bulk", () => {
  const server = http.createServer(app);
  attachSocket(server);
  const ready = new Promise<string>((resolve) =>
    server.listen(0, () => resolve(`http://localhost:${(server.address() as AddressInfo).port}`)),
  );
  afterAll(() => new Promise((resolve) => server.close(resolve)));

  it("creates all items and broadcasts each one", async () => {
    const url = await ready;
    const owner = await signUp(server);
    const member = await signUp(server);
    const list = await createList(owner.agent);
    await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: member.user.username });

    const socket = connect(url, { extraHeaders: { cookie: member.cookie }, transports: ["websocket"] });
    await socket.emitWithAck("list:join", { listId: list.id });
    const received: string[] = [];
    socket.on("item:created", (p: { item: { name: string } }) => received.push(p.item.name));

    const res = await owner.agent.post(`/api/v1/lists/${list.id}/items/bulk`).send({
      items: [
        { name: "Milk", quantity: 2, estimatedPriceCents: 3000 },
        { name: "Bread", quantity: 1, estimatedPriceCents: 4500 },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.items.map((i: { name: string }) => i.name)).toEqual(["Milk", "Bread"]);

    await vi.waitFor(() => expect(received).toEqual(["Milk", "Bread"]));
    socket.disconnect();
  });

  it("rejects invalid batches and non-members", async () => {
    const owner = await signUp(server);
    const outsider = await signUp(server);
    const list = await createList(owner.agent);
    const url = `/api/v1/lists/${list.id}/items/bulk`;
    const many = Array.from({ length: 51 }, () => ({ name: "x" }));

    expect((await owner.agent.post(url).send({ items: [] })).status).toBe(400);
    expect((await owner.agent.post(url).send({ items: many })).status).toBe(400);
    expect((await owner.agent.post(url).send({ items: [{ name: "ok" }, { name: "" }] })).status).toBe(400);
    expect((await outsider.agent.post(url).send({ items: [{ name: "x" }] })).status).toBe(404);
    // An invalid batch saves nothing.
    expect((await owner.agent.get(`/api/v1/lists/${list.id}`)).body.list.items).toHaveLength(0);
  });
});
