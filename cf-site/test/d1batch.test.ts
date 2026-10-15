import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
test("batch applies all statements atomically and rolls back on failure", async () => {
  const raw = newDb(); const db = d1(raw);
  await db.batch([
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").bind("a", '"1"'),
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").bind("b", '"2"'),
  ]);
  expect((raw.prepare("select count(*) c from settings").get() as any).c).toBe(2);
  await expect(db.batch([
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").bind("c", '"3"'),
    db.prepare("INSERT INTO settings(key,value) VALUES(?,?)").bind("a", '"dup"'),
  ])).rejects.toThrow();
  expect((raw.prepare("select count(*) c from settings").get() as any).c).toBe(2);
});
test("run() reports changes and last_row_id", async () => {
  const raw = newDb(); const db = d1(raw);
  const r = await db.prepare("INSERT INTO terms(taxonomy,slug,name) VALUES(?,?,?)").bind("skill", "x", "X").run();
  expect(r.meta.changes).toBe(1); expect(r.meta.last_row_id).toBeGreaterThan(0);
});
test("revisions table exists", () => {
  const raw = newDb();
  expect((raw.prepare("select name from sqlite_master where name='revisions'").get() as any)?.name).toBe("revisions");
});
