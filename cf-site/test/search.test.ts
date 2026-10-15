import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { parseSearchParams, monthStartUtc, nextMonthStartUtc, monthOptions, searchPosts, SEARCH_PER_PAGE } from "../src/lib/search.ts";

const q = (s: string) => new URLSearchParams(s);

test("parseSearchParams: validates and normalizes every parameter", () => {
  const p = parseSearchParams(q("kw=%20DX%20%20支援%20&from=2026-07&to=2026-09&types[]=works&types[]=bogus&types[]=news&skills[]=dx&skills[]=seo&sort=modified&page=3"));
  expect(p).toEqual({ kw: "DX 支援", from: "2026-07", to: "2026-09", types: ["works", "news"], skills: ["dx", "seo"], sort: "modified", page: 3, did: true });
  const e = parseSearchParams(q(""));
  expect(e).toEqual({ kw: "", from: "", to: "", types: [], skills: [], sort: "date", page: 1, did: false });
  for (const bad of ["from=2026-13", "from=2026-7", "from=abc", "to=2026-00", "from=2026-07-01"]) expect(parseSearchParams(q(bad)).from + parseSearchParams(q(bad)).to, bad).toBe("");
  expect(parseSearchParams(q("page=0")).page).toBe(1); expect(parseSearchParams(q("page=abc")).page).toBe(1); expect(parseSearchParams(q("page=99999999999")).page).toBe(1);
  expect(parseSearchParams(q("sort=evil")).sort).toBe("date");
  expect(parseSearchParams(q("kw=" + "x".repeat(500))).kw.length).toBe(100);
  expect(parseSearchParams(q(Array.from({ length: 60 }, (_, i) => `skills[]=s${i}`).join("&"))).skills.length).toBe(30);
  expect(parseSearchParams(q("skills=dx")).skills).toEqual(["dx"]); // skills=dx（配列でない形）も受理
});
test("month boundaries are JST: 2026-07 starts at 2026-06-30 15:00 UTC; the range end is the start of the next month", () => {
  expect(monthStartUtc("2026-07")).toBe("2026-06-30 15:00:00"); expect(nextMonthStartUtc("2026-07")).toBe("2026-07-31 15:00:00");
  expect(nextMonthStartUtc("2026-12")).toBe("2026-12-31 15:00:00"); expect(monthStartUtc("2026-01")).toBe("2025-12-31 15:00:00");
});
test("monthOptions walks back from the given month without duplicates or gaps (the month-end rollover bug of the old theme)", () => {
  const m = monthOptions(new Date("2026-10-31T00:00:00Z"), 5);
  expect(m).toEqual(["2026-10", "2026-09", "2026-08", "2026-07", "2026-06"]);
  const all = monthOptions(new Date("2026-03-31T00:00:00Z"), 48); expect(new Set(all).size).toBe(48);
});

function setup(mut?: (e: typeof exp) => void) {
  const e = structuredClone(exp);
  e.posts[0].title = "JSIPで東南アジア支援"; e.posts[0].meta.title_en = "Supporting SEA at JSIP"; e.posts[0].excerpt = "シンガポール拠点"; e.posts[0].date = "2026-07-10 00:00:00"; e.posts[0].modified = "2026-07-12 00:00:00";
  e.posts[1].title = "選挙シミュレーション"; e.posts[1].content = "<p>データ分析で戦略立案。100%の精度_?</p>"; e.posts[1].date = "2026-06-30 16:00:00"; e.posts[1].modified = "2026-08-01 00:00:00";
  e.posts[1].terms = [{ taxonomy: "skill", slug: "seo" }];
  mut?.(e);
  const raw = newDb(); for (const s of buildImportSql(e).statements) raw.exec(s); return d1(raw);
}
const slugs = async (db: ReturnType<typeof setup>, p: object = {}, lang: "ja" | "en" = "ja") => (await searchPosts(db, { kw: "", from: "", to: "", types: [], skills: [], sort: "date", page: 1, did: true, ...p } as never, lang)).posts.map((x) => x.slug);

test("keyword search: title, excerpt, content and English fields; AND across words; case-insensitive for ASCII; LIKE wildcards are literal", async () => {
  const db = setup();
  expect(await slugs(db, { kw: "東南アジア" })).toEqual(["site-a"]);
  expect(await slugs(db, { kw: "シンガポール" })).toEqual(["site-a"]);
  expect(await slugs(db, { kw: "戦略立案" })).toEqual(["site-b"]);
  expect(await slugs(db, { kw: "supporting sea" })).toEqual(["site-a"]);
  expect(await slugs(db, { kw: "JSIP 東南アジア" })).toEqual(["site-a"]);
  expect(await slugs(db, { kw: "JSIP 戦略立案" })).toEqual([]);
  expect(await slugs(db, { kw: "100%" })).toEqual(["site-b"]);
  expect(await slugs(db, { kw: "%" })).toEqual(["site-b"]);
  expect(await slugs(db, { kw: "_?" })).toEqual(["site-b"]);
  expect(await slugs(db, { kw: "存在しない語" })).toEqual([]);
});
test("filters: type, skills (any of), period by JST month, sort by modified; drafts and trash never match", async () => {
  const db = setup((e) => { e.posts.push({ ...e.posts[1], id: 50, slug: "draft-x", status: "draft", title: "選挙の下書き" } as never); });
  expect(await slugs(db, { kw: "選挙" })).toEqual(["site-b"]);
  expect(await slugs(db, { types: ["column"] })).toEqual([]);
  expect((await slugs(db, { types: ["works"] })).sort()).toEqual(["site-a", "site-b"]);
  expect(await slugs(db, { skills: ["seo"] })).toEqual(expect.arrayContaining(["site-a", "site-b"]));
  expect(await slugs(db, { skills: ["nope"] })).toEqual([]);
  expect(await slugs(db, { from: "2026-07", to: "2026-07" })).toEqual(["site-a", "site-b"]);
  expect(await slugs(db, { from: "2026-08" })).toEqual([]);
  expect(await slugs(db, { to: "2026-06" })).toEqual([]);
  expect(await slugs(db, { sort: "date" })).toEqual(["site-a", "site-b"]);
  expect(await slugs(db, { sort: "modified" })).toEqual(["site-b", "site-a"]);
});
test("pagination: 10 per page with accurate totals; out-of-range page is empty", async () => {
  const db = setup((e) => { for (let i = 0; i < 25; i++) e.posts.push({ ...e.posts[1], id: 100 + i, slug: `p${i}`, title: `多数${i}`, date: `2026-01-${String(1 + (i % 28)).padStart(2, "0")} 00:00:00`, terms: [] } as never); });
  const r1 = await searchPosts(db, { kw: "多数", from: "", to: "", types: [], skills: [], sort: "date", page: 1, did: true }, "ja");
  expect(r1.total).toBe(25); expect(r1.pages).toBe(3); expect(r1.posts).toHaveLength(SEARCH_PER_PAGE);
  expect((await searchPosts(db, { kw: "多数", from: "", to: "", types: [], skills: [], sort: "date", page: 3, did: true }, "ja")).posts).toHaveLength(5);
  expect((await searchPosts(db, { kw: "多数", from: "", to: "", types: [], skills: [], sort: "date", page: 4, did: true }, "ja")).posts).toEqual([]);
});
test("hostile keywords cannot break the query (quotes, backslashes, NUL, huge word counts)", async () => {
  const db = setup();
  for (const kw of ["'", '"; DROP TABLE posts;--', "\\", "\u0000", "a ".repeat(200), "%%%%", "\\%"]) await expect(slugs(db, { kw }), kw).resolves.toBeDefined();
  expect(await slugs(db, { kw: "JSIP" })).toEqual(["site-a"]);
});
