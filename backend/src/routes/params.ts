import type { Request } from "express";

/** Read a route param, including ones inherited through `mergeParams`. */
export function param(req: Request, name: string): string {
  return String((req.params as Record<string, string>)[name]);
}
