import request from "supertest";
import type { App } from "supertest/types.js";
import { createApp } from "../src/app.js";

export const app = createApp();

let counter = 0;
export function uniqueName(prefix = "user") {
  counter++;
  return `${prefix}_${Date.now().toString(36)}_${counter}`.slice(0, 30);
}

/** Registers a fresh user and returns a cookie-carrying agent for them. */
export async function signUp(target: App = app, username = uniqueName()) {
  const agent = request.agent(target);
  const res = await agent.post("/api/v1/auth/register").send({ username, password: "password123" });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = ([] as string[]).concat(res.headers["set-cookie"] ?? [])[0]?.split(";")[0] ?? "";
  return { agent, user: res.body.user as { id: string; username: string }, cookie };
}

export async function createList(agent: request.Agent, name = "Groceries") {
  const res = await agent.post("/api/v1/lists").send({ name });
  if (res.status !== 201) throw new Error(`create list failed: ${res.status}`);
  return res.body.list as { id: string; name: string };
}
