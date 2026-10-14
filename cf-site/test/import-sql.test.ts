import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";

function load() { const db = newDb(); const r = buildImportSql(exp); for (const s of r.statements) db.exec(s); return { db, r }; }

test("imports only published, non-protected posts", () => {
  const { db, r } = load();
  expect(db.prepare("select count(*) c from posts").get()).toEqual({ c: 3 });
  expect(r.skipped.map((s) => s.reason).sort()).toEqual(["password_protected", "status:draft"]);
});
test("special characters round-trip exactly", () => {
  const { db } = load();
  expect((db.prepare("select title from posts where wp_id=?").get(exp.posts[0].id) as any).title).toBe(exp.posts[0].title);
});
test("missing thumbnail attachment -> NULL, no throw", () => {
  const { db } = load();
  expect((db.prepare("select thumbnail from posts where wp_id=?").get(exp.posts[1].id) as any).thumbnail).toBeNull();
  expect((db.prepare("select thumbnail from posts where wp_id=?").get(exp.posts[0].id) as any).thumbnail).toBe("2026/07/a.jpg");
});
test("EN fields: empty -> NULL, present kept; not duplicated in post_meta", () => {
  const { db } = load();
  const p = db.prepare("select title_en, content_en from posts where wp_id=?").get(exp.posts[0].id) as any;
  expect(p).toEqual({ title_en: "EN", content_en: null });
  expect(db.prepare("select count(*) c from post_meta where key in ('title_en','excerpt_en','content_en')").get()).toEqual({ c: 0 });
});
test("content URLs rewritten to /media/", () => {
  const { db } = load();
  expect((db.prepare("select content from posts where wp_id=?").get(10) as any).content).toBe(`<img src="/media/2026/07/a.jpg">`);
});
test("array/object meta stored as JSON and round-trips; underscore meta excluded", () => {
  const { db } = load();
  const row = db.prepare("select value from post_meta pm join posts p on p.id=pm.post_id where p.wp_id=? and pm.key='kpi_results'").get(10) as any;
  expect(JSON.parse(row.value)).toEqual([{ label: "CV", value: "1.5倍" }]);
  expect(db.prepare("select count(*) c from post_meta where key like '\\_%' escape '\\'").get()).toEqual({ c: 0 });
});
test("terms linked, views and settings stored, rerun is idempotent", () => {
  const { db, r } = load();
  expect(db.prepare("select count(*) c from post_terms").get()).toEqual({ c: 2 });
  expect((db.prepare("select count from views v join posts p on p.id=v.post_id where p.wp_id=?").get(10) as any).count).toBe(12);
  expect(JSON.parse((db.prepare("select value from settings where key='blogname'").get() as any).value)).toBe("小林慎之助 公式ホームページ");
  for (const s of r.statements) db.exec(s);
  expect(db.prepare("select count(*) c from posts").get()).toEqual({ c: 3 });
});

test("block comments are stripped on import and not reported as artifacts", () => {
  const { db, r } = load();
  expect((db.prepare("select content from posts where wp_id=11").get() as any).content).toBe("<p>B</p>\n");
  expect(r.artifacts).toEqual([]);
});

test("percent-encoded WP slugs (posts and terms) are stored decoded and still link", () => {
  const e = structuredClone(exp);
  e.posts = [{ ...exp.posts[0], id: 20, slug: "%e6%97%a5%e6%9c%ac-x", title: "日本", terms: [{ taxonomy: "skill", slug: "%e6%97%a5" }] }];
  e.terms = [{ taxonomy: "skill", slug: "%e6%97%a5", name: "日", description: "" }];
  const db = newDb();
  for (const s of buildImportSql(e).statements) db.exec(s);
  expect((db.prepare("select slug from posts").get() as any).slug).toBe("日本-x");
  expect((db.prepare("select slug from terms").get() as any).slug).toBe("日");
  expect(db.prepare("select count(*) c from post_terms").get()).toEqual({ c: 1 });
});
test("malformed percent sequences fall back to the raw slug", () => {
  const e = structuredClone(exp);
  e.posts = [{ ...exp.posts[0], id: 21, slug: "100%-off", terms: [] }];
  const db = newDb();
  for (const s of buildImportSql(e).statements) db.exec(s);
  expect((db.prepare("select slug from posts").get() as any).slug).toBe("100%-off");
});
