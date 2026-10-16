import { describe, expect, it } from "vitest";
import { createList, signUp } from "./helpers.js";

describe("lists", () => {
  it("creates, renames and deletes a list", async () => {
    const { agent } = await signUp();
    const list = await createList(agent, "  Weekly  ");
    expect(list.name).toBe("Weekly");

    const renamed = await agent.patch(`/api/v1/lists/${list.id}`).send({ name: "Weekend" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.list.name).toBe("Weekend");

    expect((await agent.delete(`/api/v1/lists/${list.id}`)).status).toBe(204);
    expect((await agent.get(`/api/v1/lists/${list.id}`)).status).toBe(404);
  });

  it("returns owned and shared lists with totals", async () => {
    const owner = await signUp();
    const member = await signUp();
    const list = await createList(owner.agent);
    await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: member.user.username });

    const milk = await owner.agent
      .post(`/api/v1/lists/${list.id}/items`)
      .send({ name: "Milk", quantity: 2, estimatedPriceCents: 3000 });
    await owner.agent
      .post(`/api/v1/lists/${list.id}/items`)
      .send({ name: "Bread", quantity: 1, estimatedPriceCents: 4550 });
    await owner.agent.patch(`/api/v1/lists/${list.id}/items/${milk.body.item.id}`).send({ purchased: true });

    const res = await member.agent.get("/api/v1/lists");
    const summary = res.body.lists.find((l: { id: string }) => l.id === list.id);
    expect(summary).toMatchObject({
      role: "member",
      memberCount: 2,
      itemCount: 2,
      purchasedCount: 1,
      totalCents: 2 * 3000 + 4550,
      pendingCents: 4550,
    });
  });
});

describe("permissions", () => {
  async function setup() {
    const owner = await signUp();
    const member = await signUp();
    const outsider = await signUp();
    const list = await createList(owner.agent);
    await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: member.user.username });
    return { owner, member, outsider, list };
  }

  it("hides lists from non-members with 404", async () => {
    const { outsider, list } = await setup();
    expect((await outsider.agent.get(`/api/v1/lists/${list.id}`)).status).toBe(404);
    expect((await outsider.agent.post(`/api/v1/lists/${list.id}/items`).send({ name: "x" })).status).toBe(404);
  });

  it("lets members manage items but not the list", async () => {
    const { member, list } = await setup();
    const item = await member.agent.post(`/api/v1/lists/${list.id}/items`).send({ name: "Eggs" });
    expect(item.status).toBe(201);

    expect((await member.agent.patch(`/api/v1/lists/${list.id}`).send({ name: "Mine" })).status).toBe(403);
    expect((await member.agent.delete(`/api/v1/lists/${list.id}`)).status).toBe(403);
    const addOther = await member.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: "anyone" });
    expect(addOther.status).toBe(403);
  });

  it("owner adds and removes members; member can leave; owner cannot leave", async () => {
    const { owner, member, outsider, list } = await setup();

    const missing = await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: "nobody_here_x" });
    expect(missing.status).toBe(404);
    const dup = await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: member.user.username });
    expect(dup.status).toBe(409);

    await owner.agent.post(`/api/v1/lists/${list.id}/members`).send({ username: outsider.user.username });
    expect((await outsider.agent.get(`/api/v1/lists/${list.id}`)).status).toBe(200);

    // A member can't remove someone else
    expect((await member.agent.delete(`/api/v1/lists/${list.id}/members/${outsider.user.id}`)).status).toBe(403);
    // Owner removes them
    expect((await owner.agent.delete(`/api/v1/lists/${list.id}/members/${outsider.user.id}`)).status).toBe(204);
    expect((await outsider.agent.get(`/api/v1/lists/${list.id}`)).status).toBe(404);

    // Member leaves
    expect((await member.agent.delete(`/api/v1/lists/${list.id}/members/${member.user.id}`)).status).toBe(204);
    expect((await member.agent.get(`/api/v1/lists/${list.id}`)).status).toBe(404);

    // Owner can't leave
    expect((await owner.agent.delete(`/api/v1/lists/${list.id}/members/${owner.user.id}`)).status).toBe(400);
  });
});

describe("items", () => {
  it("supports full CRUD and validates fields", async () => {
    const { agent, user } = await signUp();
    const list = await createList(agent);
    const base = `/api/v1/lists/${list.id}/items`;

    const created = await agent.post(base).send({ name: "Rice", quantity: 3, estimatedPriceCents: 12000 });
    expect(created.status).toBe(201);
    expect(created.body.item).toMatchObject({
      name: "Rice",
      quantity: 3,
      estimatedPriceCents: 12000,
      purchased: false,
      createdBy: { id: user.id },
    });
    const id = created.body.item.id;

    const updated = await agent.patch(`${base}/${id}`).send({ quantity: 5, purchased: true });
    expect(updated.body.item).toMatchObject({ quantity: 5, purchased: true, name: "Rice" });

    expect((await agent.post(base).send({ name: "", quantity: 0 })).status).toBe(400);
    expect((await agent.post(base).send({ name: "x", estimatedPriceCents: -1 })).status).toBe(400);
    expect((await agent.post(base).send({ name: "x", quantity: 1.5 })).status).toBe(400);
    expect((await agent.patch(`${base}/${id}`).send({})).status).toBe(400);

    const detail = await agent.get(`/api/v1/lists/${list.id}`);
    expect(detail.body.list.items).toHaveLength(1);

    expect((await agent.delete(`${base}/${id}`)).status).toBe(204);
    expect((await agent.delete(`${base}/${id}`)).status).toBe(404);
  });

  it("does not allow touching an item through a different list", async () => {
    const { agent } = await signUp();
    const a = await createList(agent, "A");
    const b = await createList(agent, "B");
    const item = await agent.post(`/api/v1/lists/${a.id}/items`).send({ name: "Soap" });
    const res = await agent.patch(`/api/v1/lists/${b.id}/items/${item.body.item.id}`).send({ purchased: true });
    expect(res.status).toBe(404);
  });
});
