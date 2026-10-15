import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAdminApi } from "../src/admin/api.ts";
import { termSlugFromName } from "../src/admin/terms.ts";

const ORIGIN = "https://admin.test";
function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return { raw, db: d1(raw) }; }
const call = (s: ReturnType<typeof setup>, method: string, path: string, body?: unknown) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), { db: s.db, email: "me@x", nowUtc: "t" });

test("termSlugFromName: keeps Japanese, lowercases ASCII, hyphenates spaces, strips URL-reserved characters", () => {
  expect(termSlugFromName("Next.js 入門")).toBe("next.js-入門"); expect(termSlugFromName("  GovTech  ")).toBe("govtech"); expect(termSlugFromName("a/b?c#d%e")).toBe("abcde");
  expect(termSlugFromName("コミュニティ構築")).toBe("コミュニティ構築"); expect(termSlugFromName("///")).toMatch(/^term-[0-9a-z]+$/);
});
test("list includes ids and usage counts", async () => {
  const s = setup();
  const list = (await (await call(s, "GET", "/terms")).json() as any).terms;
  const seo = list.find((t: any) => t.slug === "seo"); expect(seo).toMatchObject({ taxonomy: "skill", name: "SEO", uses: 1 }); expect(typeof seo.id).toBe("number");
});
test("create: allowed taxonomies only, trimmed names, auto slug, unique per taxonomy, validation errors", async () => {
  const s = setup();
  const r = await call(s, "POST", "/terms", { taxonomy: "skill", name: "  生成AI  " }); expect(r.status).toBe(201);
  expect(await r.json()).toMatchObject({ taxonomy: "skill", name: "生成AI", slug: "生成ai" });
  expect((await call(s, "POST", "/terms", { taxonomy: "skill", name: "生成AI" })).status).toBe(409);
  expect((await call(s, "POST", "/terms", { taxonomy: "industry", name: "生成AI" })).status).toBe(201);
  for (const bad of [{ taxonomy: "bogus", name: "x" }, { taxonomy: "skill", name: "" }, { taxonomy: "skill", name: "x".repeat(101) }, { taxonomy: "skill" }, { name: "x" }, { taxonomy: "skill", name: "a", slug: "b/c" }, { taxonomy: "skill", name: 5 }])
    expect((await call(s, "POST", "/terms", bad)).status, JSON.stringify(bad)).toBe(400);
  const withSlug = await call(s, "POST", "/terms", { taxonomy: "skill", name: "Custom", slug: "my-slug" }); expect(await withSlug.json()).toMatchObject({ slug: "my-slug" });
});
test("rename changes the name only (the slug never changes); 404 for unknown ids; validation", async () => {
  const s = setup();
  const id = ((await (await call(s, "GET", "/terms")).json() as any).terms.find((t: any) => t.slug === "seo")).id;
  expect((await call(s, "PUT", `/terms/${id}`, { name: "検索最適化", slug: "hacked" })).status).toBe(200);
  const row = s.raw.prepare("select slug,name from terms where id=?").get(id) as any; expect(row).toEqual({ slug: "seo", name: "検索最適化" });
  expect((await call(s, "PUT", `/terms/${id}`, { name: "" })).status).toBe(400);
  expect((await call(s, "PUT", "/terms/99999", { name: "x" })).status).toBe(404);
});
test("delete: refused with usage info while a post uses the term; allowed when unused", async () => {
  const s = setup();
  const used = ((await (await call(s, "GET", "/terms")).json() as any).terms.find((t: any) => t.slug === "seo")).id;
  const r = await call(s, "DELETE", `/terms/${used}`); expect(r.status).toBe(409); expect(await r.json()).toMatchObject({ error: "in use", count: 1 });
  const created = await (await call(s, "POST", "/terms", { taxonomy: "skill", name: "未使用" })).json() as any;
  expect((await call(s, "DELETE", `/terms/${created.id}`)).status).toBe(204);
  expect(s.raw.prepare("select count(*) c from terms where id=?").get(created.id)).toEqual({ c: 0 });
  expect((await call(s, "DELETE", `/terms/${created.id}`)).status).toBe(404);
});
