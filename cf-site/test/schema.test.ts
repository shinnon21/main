import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
test("tables exist and slug is unique per type", () => {
  const db = newDb();
  const names = db.prepare("select name from sqlite_master where type='table' order by name").all().map((r: any) => r.name);
  for (const t of ["post_meta", "post_terms", "posts", "settings", "terms", "views"]) expect(names).toContain(t);
  db.exec("insert into posts(wp_id,type,slug,title,published_at,modified_at) values(1,'works','a','t','2026-01-01','2026-01-01')");
  expect(() => db.exec("insert into posts(wp_id,type,slug,title,published_at,modified_at) values(2,'works','a','t','2026-01-01','2026-01-01')")).toThrow();
});
