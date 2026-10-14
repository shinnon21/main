import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { compareCounts, expectedCounts, type Counts } from "../scripts/lib/verify.ts";
import { exp } from "./fixtures/export.ts";

test("import round-trip preserves meta JSON and counts match expectations", () => {
  const db = newDb();
  for (const s of buildImportSql(exp).statements) db.exec(s);
  const row = (k: string) => JSON.parse((db.prepare("select value from post_meta pm join posts p on p.id=pm.post_id where p.wp_id=10 and pm.key=?").get(k) as any).value);
  expect(row("gallery")).toEqual(exp.posts[0].meta.gallery);
  expect(row("kpi_results")).toEqual(exp.posts[0].meta.kpi_results);
  const posts: Record<string, number> = {};
  for (const r of db.prepare("select type, count(*) c from posts group by type").all() as any[]) posts[r.type] = r.c;
  const actual: Counts = {
    posts,
    postTerms: (db.prepare("select count(*) c from post_terms").get() as any).c,
    attachmentsReferenced: (db.prepare("select count(distinct thumbnail) c from posts where thumbnail is not null").get() as any).c,
  };
  expect(compareCounts(expectedCounts(exp), actual)).toEqual([]);
});
