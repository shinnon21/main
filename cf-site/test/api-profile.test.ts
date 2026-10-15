import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAdminApi } from "../src/admin/api.ts";
import { profileFull } from "../src/lib/queries.ts";

const ORIGIN = "https://admin.test";
function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return { raw, db: d1(raw) }; }
const call = (s: ReturnType<typeof setup>, method: string, path: string, body?: unknown) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), { db: s.db, email: "me@x", nowUtc: "2026-10-15 00:00:00" });

test("GET returns every JA/EN field (empty when unset) and the photo", async () => {
  const s = setup();
  const r = await (await call(s, "GET", "/profile")).json() as any;
  expect(r.fields.profile_name).toBe("小林慎之助"); expect(r.fields.profile_bio).toBe(""); expect(r.fields.profile_bio_en).toBe(""); expect(r.thumbnail).toBeNull();
  expect(Object.keys(r.fields)).toHaveLength(18);
});
test("PUT saves fields (public profile reflects them), photo, a revision, and drops emptied fields", async () => {
  const s = setup();
  const before = (s.raw.prepare("select count(*) c from revisions").get() as any).c;
  const r = await call(s, "PUT", "/profile", { fields: { profile_name: "新 名前", profile_bio: "自己紹介\n2行目", profile_bio_en: "Hello", profile_career: "2020|Weeave|創業" }, thumbnail: "2026/10/me.png" });
  expect(r.status).toBe(200);
  const p = await profileFull(s.db, "ja"); expect(p.name).toBe("新 名前"); expect(p.bio).toBe("自己紹介\n2行目"); expect(p.avatar).toBe("2026/10/me.png");
  expect((await profileFull(s.db, "en")).bio).toBe("Hello");
  expect((s.raw.prepare("select count(*) c from revisions").get() as any).c).toBe(before + 1);
  await call(s, "PUT", "/profile", { fields: { profile_name: "", profile_bio: "x", profile_career: "" }, thumbnail: "" });
  expect((await profileFull(s.db, "ja")).name).toBe("小林 慎之助"); // 空欄は組み込み既定にフォールバック
  expect((await profileFull(s.db, "ja")).avatar).toBeNull();
  expect((s.raw.prepare("select count(*) c from post_meta where key='profile_career'").get() as any).c).toBe(0);
});
test("PUT validation: unknown keys, non-strings, too long, bad thumbnail → 400 and nothing changes", async () => {
  const s = setup();
  for (const bad of [
    { fields: { kb_views: "9" } }, { fields: { profile_name: 5 } }, { fields: { profile_name: "x".repeat(201) } }, { fields: { profile_bio: "x".repeat(20001) } },
    { fields: {}, thumbnail: "/etc/passwd" }, { fields: {}, thumbnail: "a/../b" }, { fields: "no" }, {},
  ]) expect((await call(s, "PUT", "/profile", bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);
  expect((s.raw.prepare("select count(*) c from revisions").get() as any).c).toBe(0);
});
test("404 when the profile page does not exist", async () => {
  const s = setup(); s.raw.exec("delete from posts where slug='profile'");
  expect((await call(s, "GET", "/profile")).status).toBe(404); expect((await call(s, "PUT", "/profile", { fields: {} })).status).toBe(404);
});
