import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { listPosts, getPostBySlug } from "../src/lib/posts.ts";
import { exp } from "./fixtures/export.ts";

function setup() { const db = newDb(); for (const s of buildImportSql(exp).statements) db.exec(s); return d1(db); }

test("listPosts returns published posts newest first", async () => {
  const db = setup();
  expect((await listPosts(db, "works")).map((p) => p.slug)).toEqual(["site-a", "site-b"]);
  expect(await listPosts(db, "column")).toEqual([]);
});
test("getPostBySlug returns meta (parsed) and terms", async () => {
  const db = setup();
  const p = await getPostBySlug(db, "works", "site-a");
  expect(p?.meta.kpi_results).toEqual([{ label: "CV", value: "1.5倍" }]);
  expect(p?.terms.map((t) => t.slug).sort()).toEqual(["seo", "web"]);
});
test("getPostBySlug returns null for unknown or wrong-type slug", async () => {
  const db = setup();
  expect(await getPostBySlug(db, "works", "nope")).toBeNull();
  expect(await getPostBySlug(db, "column", "site-a")).toBeNull();
});
