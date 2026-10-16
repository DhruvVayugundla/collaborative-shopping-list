import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, signUp, uniqueName } from "./helpers.js";

describe("auth", () => {
  it("registers, reads the session, logs out", async () => {
    const { agent, user, cookie } = await signUp();
    expect(cookie).toMatch(/^token=/);

    const me = await agent.get("/api/v1/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ id: user.id, username: user.username });
    expect(me.body.user.passwordHash).toBeUndefined();

    expect((await agent.post("/api/v1/auth/logout")).status).toBe(204);
    expect((await agent.get("/api/v1/auth/me")).status).toBe(401);
  });

  it("sets an httpOnly cookie", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ username: uniqueName(), password: "password123" });
    expect(res.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    const { user } = await signUp();
    const ok = await request(app).post("/api/v1/auth/login").send({ username: user.username, password: "password123" });
    expect(ok.status).toBe(200);

    const bad = await request(app).post("/api/v1/auth/login").send({ username: user.username, password: "wrongpass1" });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("treats usernames case-insensitively and rejects duplicates", async () => {
    const name = uniqueName("dup");
    await request(app).post("/api/v1/auth/register").send({ username: name, password: "password123" });
    const dup = await request(app)
      .post("/api/v1/auth/register")
      .send({ username: name.toUpperCase(), password: "password123" });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("CONFLICT");
  });

  it("validates input", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ username: "a", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.issues.length).toBeGreaterThan(0);
  });

  it("rejects requests without a valid cookie", async () => {
    expect((await request(app).get("/api/v1/lists")).status).toBe(401);
    const tampered = await request(app).get("/api/v1/lists").set("Cookie", "token=not-a-jwt");
    expect(tampered.status).toBe(401);
  });
});
