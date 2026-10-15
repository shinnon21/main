import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { isBot, recordView, shouldCountRequest } from "../src/lib/views.ts";
import { ranking } from "../src/lib/queries.ts";

const kvOf = () => { const m = new Map<string, string>(); return { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v); }, m }; };
function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return { raw, db: d1(raw), kv: kvOf() }; }
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const count = (raw: any, wp: number) => (raw.prepare("select v.count c from views v join posts p on p.id=v.post_id where p.wp_id=?").get(wp) as any)?.c ?? 0;
const pid = (raw: any, wp: number) => (raw.prepare("select id from posts where wp_id=?").get(wp) as any).id as number;

test("isBot: crawlers, monitors, HTTP libraries and empty UAs are bots; real browsers are not", () => {
  for (const ua of ["Googlebot/2.1", "Mozilla/5.0 (compatible; bingbot/2.0)", "AhrefsBot", "facebookexternalhit/1.1", "Slackbot-LinkExpanding", "curl/8.0", "python-requests/2.31", "Go-http-client/1.1", "HeadlessChrome/120", "Lighthouse", "UptimeRobot/2.0", "ClaudeBot", "GPTBot", "Twitterbot/1.0", "", "x"]) expect(isBot(ua), ua).toBe(true);
  for (const ua of [UA, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"]) expect(isBot(ua), ua).toBe(false);
});
test("recordView creates the row, then increments; the same IP is counted once per 30 minutes whatever its User-Agent; other IPs and posts count separately", async () => {
  const s = setup(); const id = pid(s.raw, 11);
  const rv = (ip: string, ua = UA, post = id) => recordView({ db: s.db, kv: s.kv, postId: post, ip, ua, salt: "s" });
  expect(count(s.raw, 11)).toBe(0);
  expect(await rv("203.0.113.1")).toBe(true); expect(count(s.raw, 11)).toBe(1);
  expect(await rv("203.0.113.1")).toBe(false); expect(count(s.raw, 11)).toBe(1);
  expect(await rv("203.0.113.2")).toBe(true); expect(count(s.raw, 11)).toBe(2);
  expect(await rv("203.0.113.1", UA + " X")).toBe(false); expect(count(s.raw, 11)).toBe(2); // UAを変えても同じ訪問者として扱う（水増し対策）
  expect(await rv("203.0.113.1", UA, pid(s.raw, 10))).toBe(true); expect(count(s.raw, 10)).toBe(12 + 1);
});
test("bots are never counted; KV failure counts nothing and never throws", async () => {
  const s = setup(); const id = pid(s.raw, 11);
  expect(await recordView({ db: s.db, kv: s.kv, postId: id, ip: "1.1.1.1", ua: "Googlebot/2.1", salt: "s" })).toBe(false);
  expect(count(s.raw, 11)).toBe(0);
  const broken = { get: async () => { throw new Error("kv"); }, put: async () => { throw new Error("kv"); } };
  expect(await recordView({ db: s.db, kv: broken, postId: id, ip: "1.1.1.1", ua: UA, salt: "s" })).toBe(false);
  expect(count(s.raw, 11)).toBe(0);
});
test("IPv6 visitors are deduplicated per /64", async () => {
  const s = setup(); const id = pid(s.raw, 11);
  expect(await recordView({ db: s.db, kv: s.kv, postId: id, ip: "2001:db8:1:2::1", ua: UA, salt: "s" })).toBe(true);
  expect(await recordView({ db: s.db, kv: s.kv, postId: id, ip: "2001:db8:1:2:aaaa::9", ua: UA, salt: "s" })).toBe(false);
});
test("shouldCountRequest: GET only, no prefetch/prerender, and never on staging/localhost unless forced", () => {
  const req = (method = "GET", headers: Record<string, string> = {}) => new Request("https://shinnosuke-kobayashi.jp/works/x/", { method, headers });
  expect(shouldCountRequest(req(), "shinnosuke-kobayashi.jp", {})).toBe(true);
  expect(shouldCountRequest(req("HEAD"), "shinnosuke-kobayashi.jp", {})).toBe(false);
  for (const h of [{ Purpose: "prefetch" }, { "Sec-Purpose": "prefetch;prerender" }, { "X-Moz": "prefetch" }, { "X-Purpose": "preview" }]) expect(shouldCountRequest(req("GET", h), "shinnosuke-kobayashi.jp", {}), JSON.stringify(h)).toBe(false);
  expect(shouldCountRequest(req(), "kb-site.curly-wave-c49f.workers.dev", {})).toBe(false);
  expect(shouldCountRequest(req(), "localhost:4321", {})).toBe(false);
  expect(shouldCountRequest(req(), "localhost:4321", { FORCE_VIEW_COUNT: "1" })).toBe(true);
});
test("counted views feed the popularity ranking", async () => {
  const s = setup();
  for (let i = 0; i < 30; i++) await recordView({ db: s.db, kv: s.kv, postId: pid(s.raw, 11), ip: `203.0.113.${i}`, ua: UA, salt: "s" });
  expect((await ranking(s.db, 5))[0].slug).toBe("site-b");
});

test("rotating the User-Agent string cannot inflate a post's count (dedupe is by IP /64 only)", async () => {
  const s = setup(); const id = pid(s.raw, 11);
  for (let i = 0; i < 50; i++) await recordView({ db: s.db, kv: s.kv, postId: id, ip: "203.0.113.50", ua: `${UA} rotate-${i}`, salt: "s" });
  expect(count(s.raw, 11)).toBe(1);
});
test("per-IP daily cap: one address can only add a limited number of views across posts per day (fails closed on KV errors)", async () => {
  const s = setup();
  const ids = [10, 11, 14].map((w) => pid(s.raw, w));
  const results: boolean[] = [];
  for (const id of ids) results.push(await recordView({ db: s.db, kv: s.kv, postId: id, ip: "203.0.113.60", ua: UA, salt: "s", maxPerIpPerDay: 2 }));
  expect(results).toEqual([true, true, false]);
  expect(await recordView({ db: s.db, kv: s.kv, postId: ids[0], ip: "203.0.113.61", ua: UA, salt: "s", maxPerIpPerDay: 2 })).toBe(true);
});
