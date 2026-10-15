import { expect, test } from "vitest";
import { capBody } from "../src/mcp/limits.ts";

const post = (body: BodyInit, headers: Record<string, string> = {}) => new Request("https://x.test/oauth/register", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });

test("capBody passes a small body through unchanged (the returned request can still be read)", async () => {
  const r = await capBody(post(JSON.stringify({ client_name: "c" })), 8192);
  expect(r instanceof Request).toBe(true); expect(await (r as Request).json()).toEqual({ client_name: "c" });
});
test("capBody refuses an oversize body with 413 — by Content-Length and by streamed bytes (chunked / lying header)", async () => {
  const big = "x".repeat(9000);
  expect(((await capBody(post(big, { "Content-Length": "9000" }), 8192)) as Response).status).toBe(413);
  const stream = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close(); } });
  const chunked = new Request("https://x.test/oauth/register", { method: "POST", body: stream, duplex: "half" } as any);
  expect(((await capBody(chunked, 8192)) as Response).status).toBe(413);
});
