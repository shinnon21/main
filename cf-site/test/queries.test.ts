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

test("ties on published date fall back to id ASC (matches the WP archive order)", async () => {
  const q = db((e) => {
    e.posts[0].date = "2026-07-03 15:21:55"; e.posts[1].date = "2026-07-03 15:21:55";
    e.posts.push(mk(5, "works", "w5", "2026-07-03 15:21:55"));
  });
  const ids = (await listPage(q, "works", 1)).posts.map((p) => p.wp_id);
  expect(ids).toEqual([5, 10, 11]);
  expect((await latest(q, "works", 3)).map((p) => p.wp_id)).toEqual([5, 10, 11]);
});

import { allSkills } from "../src/lib/queries.ts";
test("allSkills is name-ordered like WP get_terms (ASCII first, ー ignored, then codepoint)", async () => {
  const names = ["起業", "コミュニティ構築", "コーディネーター", "Weeave", "DX", "GovTech", "下水サーベイランス"];
  const q = db((e) => {
    e.terms = names.map((n, i) => ({ taxonomy: "skill", slug: `s${i}`, name: n, description: "" }));
    e.posts[0].terms = names.map((_, i) => ({ taxonomy: "skill", slug: `s${i}` }));
  });
  expect((await allSkills(q)).map((s) => s.name)).toEqual(["DX", "GovTech", "Weeave", "コーディネーター", "コミュニティ構築", "下水サーベイランス", "起業"]);
});

import { isListType, isTaxonomy, loadTermPage } from "../src/lib/queries.ts";
test("isListType/isTaxonomy reject prototype keys and unknown names", () => {
  for (const k of ["works", "column", "news"]) expect(isListType(k)).toBe(true);
  for (const k of ["constructor", "toString", "__proto__", "valueOf", "hasOwnProperty", "foo", ""]) { expect(isListType(k), k).toBe(false); expect(isTaxonomy(k), k).toBe(false); }
  for (const k of ["works_type", "skill", "industry", "news_type"]) expect(isTaxonomy(k)).toBe(true);
});
test("listPage tolerates prototype-key types without throwing a non-numeric LIMIT", async () => {
  expect((await listPage(db(), "constructor", 1)).posts).toEqual([]);
});
test("loadTermPage paginates terms and returns null for missing term or out-of-range page", async () => {
  const q = db((e) => {
    e.terms.push({ taxonomy: "skill", slug: "many", name: "Many", description: "" });
    for (let i = 0; i < 11; i++) e.posts.push({ ...mk(200 + i, "column", `c${i}`, `2026-01-${10 + i}T00:00:00`), terms: [{ taxonomy: "skill", slug: "many" }] } as never);
  });
  const p1 = await loadTermPage(q, "skill", "many", 1);
  expect(p1?.data.pages).toBe(2); expect(p1?.data.posts).toHaveLength(10);
  expect((await loadTermPage(q, "skill", "many", 2))?.data.posts).toHaveLength(1);
  expect(await loadTermPage(q, "skill", "many", 3)).toBeNull();
  expect(await loadTermPage(q, "skill", "nope", 1)).toBeNull();
  expect(await loadTermPage(q, "bogus", "many", 1)).toBeNull();
});

import { profileFull } from "../src/lib/queries.ts";
test("profileFull returns all profile fields, falls back only for name/kana/role, and exposes body + avatar", async () => {
  const q = db((e) => {
    e.posts[4].content = "<p>本文</p>";
    e.posts[4].meta = { profile_name: "名", profile_career: "2025 | A | b", profile_research_title: "R" };
  });
  const p = await profileFull(q);
  expect(p).toMatchObject({ name: "名", kana: "こばやし しんのすけ", career: "2025 | A | b", researchTitle: "R", bio: "", skills: "", activities: "", researchBody: "", content: "<p>本文</p>" });
  const none = await profileFull(db((e) => { e.posts.splice(4, 1); }));
  expect(none.name).toBe("小林 慎之助"); expect(none.content).toBe(""); expect(none.avatar).toBeNull();
});
