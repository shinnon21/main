import { expect, test } from "vitest";
import { KINDS, validateContact, buildNotification, buildAutoReply, hashIp } from "../src/lib/contact.ts";
import { rateLimit } from "../src/lib/ratelimit.ts";
import { verifyTurnstile } from "../src/lib/turnstile.ts";

const ok = { name: "山田 太郎", email: "taro@example.com", company: "株式会社X", kind: KINDS[0], message: "ご相談です。\r\n詳細は以下。", consent: true, website: "", lang: "ja" };

test("validateContact accepts a complete submission and normalizes it", () => {
  const r = validateContact({ ...ok, name: "  山田 太郎 ", email: " Taro@Example.COM " });
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.value).toMatchObject({ name: "山田 太郎", email: "taro@example.com", company: "株式会社X", kind: KINDS[0], message: "ご相談です。\n詳細は以下。", lang: "ja", bot: false });
});
test("validateContact reports per-field errors (ja/en) for missing, malformed and oversized input", () => {
  const bad = (over: object, field: string, lang: "ja" | "en" = "ja") => { const r = validateContact({ ...ok, lang, ...over }); expect(r.ok, JSON.stringify(over)).toBe(false); if (!r.ok) expect(Object.keys(r.errors), JSON.stringify(over)).toContain(field); return r; };
  bad({ name: "" }, "name"); bad({ name: "x".repeat(101) }, "name"); bad({ email: "" }, "email"); bad({ email: "no-at" }, "email"); bad({ email: "a@b" }, "email");
  bad({ email: "a b@c.com" }, "email"); bad({ email: "a@b.com\r\nBcc: x@y.com" }, "email"); bad({ email: "a".repeat(250) + "@b.com" }, "email");
  bad({ kind: "不正な種別" }, "kind"); bad({ message: "" }, "message"); bad({ message: "x".repeat(5001) }, "message"); bad({ consent: false }, "consent"); bad({ consent: "true" }, "consent");
  bad({ company: "x".repeat(101) }, "company");
  const r = bad({ name: "" }, "name", "en"); if (!r.ok) expect(r.errors.name).toMatch(/[A-Za-z]/);
  expect(validateContact(null).ok).toBe(false); expect(validateContact("x").ok).toBe(false); expect(validateContact([]).ok).toBe(false);
});
test("validateContact: honeypot filled => accepted as a bot (so callers can drop it silently); control characters are stripped from single-line fields", () => {
  const r = validateContact({ ...ok, website: "http://spam.example" }); expect(r.ok).toBe(true); if (r.ok) expect(r.value.bot).toBe(true);
  const c = validateContact({ ...ok, name: "A\u0000B\r\nC\tD", company: "Co\u0007mp" }); expect(c.ok).toBe(true); if (c.ok) { expect(c.value.name).not.toMatch(/[\u0000-\u001f]/); expect(c.value.company).not.toMatch(/[\u0000-\u001f]/); }
});
test("English labels map to the Japanese kinds that are stored", () => {
  const r = validateContact({ ...ok, lang: "en", kind: "Work inquiry or consulting" }); expect(r.ok).toBe(true); if (r.ok) expect(r.value.kind).toBe(KINDS[0]);
});
test("notification mail: safe single-line subject, escaped HTML, reply-to data present; no header injection via name", () => {
  const c = { name: "Evil\r\nBcc: x@y.com <script>", email: "a@b.com", company: "<b>Co</b>", kind: KINDS[1], message: "<img src=x onerror=alert(1)>\nline2", lang: "ja" as const, bot: false };
  const n = buildNotification({ ...c, name: c.name.replace(/[\u0000-\u001f]/g, " ") }, 7, "https://shinnosuke-kobayashi.jp");
  expect(n.subject).not.toMatch(/[\r\n]/); expect(n.subject).toContain("お問い合わせ");
  expect(n.text).toContain("a@b.com"); expect(n.text).toContain("line2");
  expect(n.html).not.toContain("<script>"); expect(n.html).not.toContain("<img"); expect(n.html).toContain("&lt;img");
  expect(n.text).toContain("https://shinnosuke-kobayashi.jp/admin/contacts/7/");
});
test("auto-reply is a fixed, language specific template that does not echo any submitted text", () => {
  const ja = buildAutoReply({ lang: "ja" });
  const en = buildAutoReply({ lang: "en" });
  expect(ja.subject).toMatch(/お問い合わせ/); expect(ja.text.length).toBeLessThan(900); expect(en.subject).toMatch(/inquiry/i); expect(en.text).toMatch(/Thank you/);
  for (const m of [ja, en]) expect(m.subject).not.toMatch(/[\r\n]/);
});
test("hashIp is stable, salted and does not contain the IP", async () => {
  const a = await hashIp("203.0.113.5", "salt1"), b = await hashIp("203.0.113.5", "salt1"), c = await hashIp("203.0.113.5", "salt2");
  expect(a).toBe(b); expect(a).not.toBe(c); expect(a).toMatch(/^[0-9a-f]{32}$/); expect(a).not.toContain("203");
  expect(await hashIp("", "s")).toBe("");
});

function fakeKv() { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v); }, m }; }
test("rateLimit allows up to the limit within the window then blocks; separate keys are independent", async () => {
  const kv = fakeKv();
  const res = [] as boolean[]; for (let i = 0; i < 5; i++) res.push((await rateLimit(kv, "ip:1", 3, 3600)).allowed);
  expect(res).toEqual([true, true, true, false, false]);
  expect((await rateLimit(kv, "ip:2", 3, 3600)).allowed).toBe(true);
  expect((await rateLimit(kv, "ip:1", 3, 3600)).remaining).toBe(0);
});
test("rateLimit fails open when KV is unavailable (never blocks real users because of infra errors)", async () => {
  const broken = { get: async () => { throw new Error("kv down"); }, put: async () => { throw new Error("kv down"); } };
  expect((await rateLimit(broken, "k", 1, 60)).allowed).toBe(true);
});
test("verifyTurnstile posts secret/response/ip as form data and returns the success flag; failures are false", async () => {
  let seen: { url: string; body: URLSearchParams } | null = null;
  const f = (success: boolean, status = 200) => (async (url: string, init: any) => { seen = { url, body: new URLSearchParams(init.body) }; return new Response(JSON.stringify({ success }), { status }); }) as unknown as typeof fetch;
  expect(await verifyTurnstile({ token: "tok", secret: "sec", ip: "1.2.3.4", fetcher: f(true) })).toBe(true);
  expect(seen!.url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  expect(seen!.body.get("secret")).toBe("sec"); expect(seen!.body.get("response")).toBe("tok"); expect(seen!.body.get("remoteip")).toBe("1.2.3.4");
  expect(await verifyTurnstile({ token: "tok", secret: "sec", fetcher: f(false) })).toBe(false);
  expect(await verifyTurnstile({ token: "tok", secret: "sec", fetcher: f(true, 500) })).toBe(false);
  expect(await verifyTurnstile({ token: "", secret: "sec", fetcher: f(true) })).toBe(false);
  expect(await verifyTurnstile({ token: "x".repeat(3000), secret: "sec", fetcher: f(true) })).toBe(false);
  expect(await verifyTurnstile({ token: "tok", secret: "sec", fetcher: (async () => { throw new Error("net"); }) as unknown as typeof fetch })).toBe(false);
});

// --- security review regressions ---
import { ipBucket } from "../src/lib/contact.ts";
test("email validation is strict ASCII: no mailto parameter injection, no addresses the mail service would reject", () => {
  const bad = ["x?bcc=evil@atk.com", "x?bcc=evil%40atk.com&body=hi@example.com", "a@b..com", "a@-b.com", "a@b-.com", "テスト@例え.jp", '"a b"@x.com', "a..b@x.com", ".a@x.com", "a.@x.com", "a".repeat(65) + "@x.com", "a@b.c", "a@b", "a@b.com?x=1", "a@b.com#frag", "a&b@x.com", "a/b@x.com", "a@" + "b".repeat(64) + ".com"];
  for (const email of bad) expect(validateContact({ ...ok, email }).ok, email).toBe(false);
  for (const email of ["taro.yamada+news@sub.example.co.jp", "a@b.io", "A_B-c%d@example.com", "x@xn--r8jz45g.jp"]) expect(validateContact({ ...ok, email }).ok, email).toBe(true);
});
test("bidi/zero-width/format characters are stripped from single-line fields (no subject/list spoofing)", () => {
  const r = validateContact({ ...ok, name: "n‮evil​⁦x⁩﻿", company: "c‏؜" });
  expect(r.ok).toBe(true); if (r.ok) { expect(r.value.name).toBe("nevilx"); expect(r.value.company).toBe("c"); }
});
test("ipBucket groups IPv6 by /64 and leaves IPv4 alone", () => {
  expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
  expect(ipBucket("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2");
  expect(ipBucket("2001:db8::1")).toBe("2001:db8:0:0");
  expect(ipBucket("::1")).toBe("0:0:0:0");
  expect(ipBucket("")).toBe("");
});
