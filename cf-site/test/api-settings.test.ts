import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAdminApi } from "../src/admin/api.ts";
import { resolveSns } from "../src/lib/sns-data.ts";

const ORIGIN = "https://admin.test";
function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return { raw, db: d1(raw) }; }
const call = (s: ReturnType<typeof setup>, method: string, path: string, body?: unknown) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), { db: s.db, email: "me@x", nowUtc: "t" });
const val = (s: ReturnType<typeof setup>, k: string) => { const r = s.raw.prepare("select value from settings where key=?").get(k) as any; return r ? JSON.parse(r.value) : undefined; };

test("GET returns current name/description and the SNS urls (defaults when nothing is saved)", async () => {
  const s = setup();
  const r = await (await call(s, "GET", "/settings")).json() as any;
  expect(typeof r.blogname).toBe("string"); expect(r.sns.x).toBe("https://x.com/snnnuke"); expect(Object.keys(r.sns)).toEqual(["linkedin", "facebook", "x", "instagram", "note"]);
});
test("PUT saves name, description and sns urls; empty url hides that service", async () => {
  const s = setup();
  const ok = await call(s, "PUT", "/settings", { blogname: " 小林慎之助 ", blogdescription: "説明", sns: { linkedin: "https://www.linkedin.com/in/x/", facebook: "", x: "https://x.com/a", instagram: "https://www.instagram.com/a/", note: "https://note.com/a" } });
  expect(ok.status).toBe(200);
  expect(val(s, "blogname")).toBe("小林慎之助"); expect(val(s, "blogdescription")).toBe("説明");
  const sns = await resolveSns(s.db);
  expect(sns.map((x) => x.key)).toEqual(["linkedin", "x", "instagram", "note"]); expect(sns.find((x) => x.key === "x")!.url).toBe("https://x.com/a");
  const back = await (await call(s, "GET", "/settings")).json() as any; expect(back.sns.facebook).toBe("");
});
test("PUT validation: https only, no javascript:, no whitespace, name required, unknown sns keys rejected", async () => {
  const s = setup();
  const base = { blogname: "n", blogdescription: "d", sns: { linkedin: "", facebook: "", x: "", instagram: "", note: "" } };
  for (const bad of [
    { ...base, blogname: "" }, { ...base, blogname: "x".repeat(101) }, { ...base, blogdescription: "x".repeat(301) },
    { ...base, sns: { ...base.sns, x: "javascript:alert(1)" } }, { ...base, sns: { ...base.sns, x: "http://x.com/a" } },
    { ...base, sns: { ...base.sns, x: "https://x.com/a b" } }, { ...base, sns: { ...base.sns, x: "https://x.com/" + "a".repeat(400) } },
    { ...base, sns: { ...base.sns, evil: "https://e.com" } }, { ...base, sns: "nope" }, { blogname: "n" },
  ]) expect((await call(s, "PUT", "/settings", bad)).status, JSON.stringify(bad)).toBe(400);
  expect(val(s, "sns_urls")).toBeUndefined();
});
test("resolveSns: falls back to defaults when unsaved or the stored JSON is corrupt", async () => {
  const s = setup();
  expect((await resolveSns(s.db)).length).toBe(5);
  s.raw.prepare("insert into settings(key,value) values('sns_urls','not json')").run();
  expect((await resolveSns(s.db)).length).toBe(5);
});
