import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { handleContactSubmit } from "../src/lib/contact-api.ts";
import { KINDS } from "../src/lib/contact.ts";

const ORIGIN = "https://site.test";
function setup(over: Record<string, unknown> = {}) {
  const raw = newDb(); const db = d1(raw);
  const kvm = new Map<string, string>(); const kv = { get: async (k: string) => kvm.get(k) ?? null, put: async (k: string, v: string) => { kvm.set(k, v); } };
  const sent: any[] = []; const pending: Promise<unknown>[] = [];
  const mail = { send: async (m: any) => { sent.push(m); return { messageId: "id" }; } };
  const deps = { db, kv, mail, verify: async (i: { token: string }) => i.token === "good", cfg: { turnstileSecret: "sec", to: "owner@site.test", from: "noreply@site.test", ipSalt: "salt", siteUrl: "https://site.test" }, nowUtc: "2026-10-15 10:00:00.000", waitUntil: (p: Promise<unknown>) => { pending.push(p); }, ...over } as any;
  return { raw, kvm, sent, pending, deps };
}
const body = (over: object = {}) => ({ name: "山田", email: "taro@example.com", company: "", kind: KINDS[0], message: "こんにちは", consent: true, website: "", lang: "ja", turnstile: "good", ...over });
const post = (b: unknown, headers: Record<string, string> = {}) => new Request(`${ORIGIN}/api/contact/`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "CF-Connecting-IP": "203.0.113.9", "User-Agent": "UA/1", ...headers }, body: typeof b === "string" ? b : JSON.stringify(b) });
const rows = (raw: any) => raw.prepare("select * from contacts").all() as any[];

test("success: stored without the raw IP, owner notified (reply-to = sender) and sender auto-replied; notify status recorded", async () => {
  const s = setup();
  const res = await handleContactSubmit(post(body()), s.deps);
  expect(res.status).toBe(200); expect(await res.json()).toEqual({ ok: true });
  await Promise.all(s.pending);
  const r = rows(s.raw); expect(r).toHaveLength(1);
  expect(r[0]).toMatchObject({ name: "山田", email: "taro@example.com", kind: KINDS[0], message: "こんにちは", lang: "ja", status: "new", notify_status: "sent", user_agent: "UA/1" });
  expect(JSON.stringify(r[0])).not.toContain("203.0.113.9"); expect(r[0].ip_hash).toMatch(/^[0-9a-f]{32}$/);
  expect(s.sent).toHaveLength(2);
  expect(s.sent[0]).toMatchObject({ to: "owner@site.test", from: "noreply@site.test", replyTo: "taro@example.com" });
  expect(s.sent[1]).toMatchObject({ to: "taro@example.com", from: "noreply@site.test" });
  expect(s.sent[1].replyTo).toBeUndefined();
});
test("auto-reply is sent at most once per address per day (no mail-bombing a victim through the form)", async () => {
  const s = setup();
  for (let i = 0; i < 3; i++) { await handleContactSubmit(post(body({ message: `m${i}` }), { "CF-Connecting-IP": `203.0.113.${i + 10}` }), s.deps); }
  await Promise.all(s.pending);
  expect(rows(s.raw)).toHaveLength(3);
  expect(s.sent.filter((m) => m.to === "taro@example.com")).toHaveLength(1);
  expect(s.sent.filter((m) => m.to === "owner@site.test")).toHaveLength(3);
});
test("honeypot: bots get a normal-looking 200 but nothing is stored or sent", async () => {
  const s = setup();
  const res = await handleContactSubmit(post(body({ website: "http://spam" })), s.deps);
  expect(res.status).toBe(200); expect(await res.json()).toEqual({ ok: true });
  await Promise.all(s.pending); expect(rows(s.raw)).toHaveLength(0); expect(s.sent).toHaveLength(0);
});
test("validation errors are 400 with per-field messages and store nothing", async () => {
  const s = setup();
  const res = await handleContactSubmit(post(body({ email: "bad", name: "" })), s.deps);
  expect(res.status).toBe(400); const j = await res.json() as any; expect(Object.keys(j.errors).sort()).toEqual(["email", "name"]);
  expect(rows(s.raw)).toHaveLength(0);
});
test("Turnstile: missing or failing challenge is 400 and nothing is stored; unconfigured secret is 503 (fail closed)", async () => {
  const s = setup();
  expect((await handleContactSubmit(post(body({ turnstile: "" })), s.deps)).status).toBe(400);
  expect((await handleContactSubmit(post(body({ turnstile: "bad" })), s.deps)).status).toBe(400);
  expect(rows(s.raw)).toHaveLength(0);
  const u = setup({ cfg: { turnstileSecret: "", to: "o@x", from: "n@x", ipSalt: "s", siteUrl: "https://site.test" } });
  const r = await handleContactSubmit(post(body()), u.deps); expect(r.status).toBe(503); expect(rows(u.raw)).toHaveLength(0);
});
test("CSRF/shape: foreign or missing Origin 403, non-JSON 415, GET 405, oversized 413, invalid JSON 400", async () => {
  const s = setup();
  expect((await handleContactSubmit(post(body(), { Origin: "https://evil.test" }), s.deps)).status).toBe(403);
  const noOrigin = new Request(`${ORIGIN}/api/contact/`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body()) });
  expect((await handleContactSubmit(noOrigin, s.deps)).status).toBe(403);
  expect((await handleContactSubmit(post(body(), { "Content-Type": "text/plain" }), s.deps)).status).toBe(415);
  expect((await handleContactSubmit(new Request(`${ORIGIN}/api/contact/`), s.deps)).status).toBe(405);
  expect((await handleContactSubmit(post(body({ message: "x".repeat(30000) })), s.deps)).status).toBe(413);
  expect((await handleContactSubmit(post("{not json"), s.deps)).status).toBe(400);
  expect(rows(s.raw)).toHaveLength(0);
});
test("rate limit: more than 5 submissions per IP per hour get 429 (and are not stored)", async () => {
  const s = setup();
  const codes: number[] = []; for (let i = 0; i < 7; i++) codes.push((await handleContactSubmit(post(body({ message: `m${i}`, email: `u${i}@example.com` })), s.deps)).status);
  expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]); expect(rows(s.raw)).toHaveLength(5);
});
test("mail failure never loses the message and never fails the visitor: stored, ok, notify_status=error with the code", async () => {
  const boom = { send: async () => { const e: any = new Error("sender domain not verified"); e.code = "E_SENDER_NOT_VERIFIED"; throw e; } };
  const s = setup({ mail: boom });
  const res = await handleContactSubmit(post(body()), s.deps); expect(res.status).toBe(200);
  await Promise.all(s.pending);
  const r = rows(s.raw)[0]; expect(r.notify_status).toBe("error"); expect(r.notify_error).toContain("E_SENDER_NOT_VERIFIED");
});
test("no mail binding: stored with notify_status=disabled", async () => {
  const s = setup({ mail: undefined });
  await handleContactSubmit(post(body()), s.deps); await Promise.all(s.pending);
  expect(rows(s.raw)[0].notify_status).toBe("disabled");
});
test("CRLF/header-injection attempts in name/email never reach mail headers", async () => {
  const s = setup();
  const res = await handleContactSubmit(post(body({ name: "A\r\nBcc: evil@x.com", email: "a@b.com\r\nBcc: evil@x.com" })), s.deps);
  expect(res.status).toBe(400);
  const ok = await handleContactSubmit(post(body({ name: "A\r\nBcc: evil@x.com" })), s.deps); expect(ok.status).toBe(200);
  await Promise.all(s.pending);
  for (const m of s.sent) { expect(m.subject).not.toMatch(/[\r\n]/); expect(String(m.replyTo ?? "")).not.toMatch(/[\r\n]/); }
});

// --- security review: relay/phishing abuse and rate-limit ordering ---
test("auto-reply never contains attacker-controlled text (name/company/message/kind) — no phishing relay through our domain", async () => {
  const s = setup();
  await handleContactSubmit(post(body({ name: "CLICK http://evil.example/pay NOW", company: "http://evil2.example", message: "visit http://evil3.example" })), s.deps);
  await Promise.all(s.pending);
  const ar = s.sent.find((m) => m.to === "taro@example.com");
  expect(ar).toBeTruthy();
  for (const part of [ar.subject, ar.text, ar.html]) expect(part).not.toMatch(/evil|CLICK|http:\/\//i);
});
test("auto-replies have a global daily cap so the form cannot be used to spray many different addresses", async () => {
  const s = setup();
  for (let i = 0; i < 60; i++) await handleContactSubmit(post(body({ email: `victim${i}@example.com` }), { "CF-Connecting-IP": `198.51.100.${i}` }), s.deps);
  await Promise.all(s.pending);
  expect(s.sent.filter((m) => m.to !== "owner@site.test").length).toBeLessThanOrEqual(50);
  expect(s.sent.filter((m) => m.to === "owner@site.test")).toHaveLength(60);
});
test("requests that fail the challenge never consume the global quota (a botnet cannot lock real visitors out)", async () => {
  const s = setup();
  for (let i = 0; i < 250; i++) await handleContactSubmit(post(body({ turnstile: "bad" }), { "CF-Connecting-IP": `192.0.2.${i % 250}${i > 249 ? "9" : ""}` }), s.deps);
  const res = await handleContactSubmit(post(body(), { "CF-Connecting-IP": "203.0.113.200" }), s.deps);
  expect(res.status).toBe(200);
});
