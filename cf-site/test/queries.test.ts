import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { listPage, featuredWorks, latest, topSkills, ranking, relatedByTerm, termBySlug, listByTerm, profileSummary, PER_PAGE } from "../src/lib/queries.ts";

function db(mut?: (e: typeof exp) => void) {
  const e = structuredClone(exp); mut?.(e);
  const raw = newDb(); for (const s of buildImportSql(e).statements) raw.exec(s);
  return d1(raw);
}
const mk = (id: number, type: string, slug: string, date: string, extra: object = {}) =>
  ({ ...exp.posts[1], id, type, slug, title: slug, date, modified: date, thumbnail_id: null, terms: [], meta: {}, views: 0, ...extra });

test("PER_PAGE matches the WP theme", () => { expect(PER_PAGE).toEqual({ works: 12, column: 10, news: 15 }); });

test("listPage paginates newest-first and reports totals", async () => {
  const q = db((e) => { for (let i = 0; i < 13; i++) e.posts.push(mk(100 + i, "works", `w${i}`, `2026-0${1 + (i % 9)}-15T00:00:00`)); });
  const p1 = await listPage(q, "works", 1);
  expect(p1.total).toBe(15); expect(p1.pages).toBe(2); expect(p1.posts).toHaveLength(12);
  const p2 = await listPage(q, "works", 2);
  expect(p2.posts).toHaveLength(3);
  expect((await listPage(q, "works", 3)).posts).toEqual([]);
});
test("listPage attaches terms and period meta for cards", async () => {
  const q = db((e) => { e.posts[0].meta.period_start = "2025.09"; });
  const a = (await listPage(q, "works", 1)).posts.find((p) => p.slug === "site-a")!;
  expect(a.terms.map((t) => t.slug).sort()).toEqual(["seo", "web"]);
  expect(a.meta.period_start).toBe("2025.09");
});
test("featuredWorks uses is_featured and falls back to newest when none flagged", async () => {
  const flagged = db((e) => { e.posts[1].meta.is_featured = "1"; });
  expect((await featuredWorks(flagged)).map((p) => p.slug)).toEqual(["site-b"]);
  const none = db();
  expect((await featuredWorks(none)).map((p) => p.slug)).toEqual(["site-a", "site-b"]);
});
test("latest returns [] for empty types and never throws", async () => {
  expect(await latest(db(), "column", 4)).toEqual([]);
  expect((await latest(db(), "works", 1))).toHaveLength(1);
});
test("topSkills orders by usage count", async () => {
  const q = db((e) => {
    e.terms.push({ taxonomy: "skill", slug: "dx", name: "DX", description: "" });
    e.posts[0].terms.push({ taxonomy: "skill", slug: "dx" });
    e.posts[1].terms.push({ taxonomy: "skill", slug: "dx" });
  });
  expect((await topSkills(q, 14))[0].slug).toBe("dx");
});
test("ranking orders works+column by views and excludes news/page", async () => {
  const q = db((e) => { e.posts[1].views = 99; });
  const r = await ranking(q, 5);
  expect(r.map((p) => p.slug)).toEqual(["site-b", "site-a"]);
});
test("relatedByTerm returns same-term posts excluding itself", async () => {
  const q = db((e) => { e.posts[1].terms.push({ taxonomy: "works_type", slug: "web" }); });
  const a = (await listPage(q, "works", 1)).posts.find((p) => p.slug === "site-a")!;
  expect((await relatedByTerm(q, a, "works_type", 3)).map((p) => p.slug)).toEqual(["site-b"]);
});
test("termBySlug / listByTerm", async () => {
  const q = db();
  expect(await termBySlug(q, "skill", "seo")).toMatchObject({ slug: "seo", name: "SEO" });
  expect(await termBySlug(q, "skill", "nope")).toBeNull();
  const r = await listByTerm(q, "skill", "seo", 1, 10);
  expect(r.total).toBe(1); expect(r.posts[0].slug).toBe("site-a");
});
test("profileSummary falls back to defaults when meta is empty and uses meta when present", async () => {
  const empty = await profileSummary(db((e) => { e.posts[4].meta = {}; }));
  expect(empty.name).toBe("小林 慎之助");
  const set = await profileSummary(db());
  expect(set.name).toBe("小林慎之助");
});
