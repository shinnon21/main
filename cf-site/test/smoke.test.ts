import { expect, test } from "vitest";
import { DatabaseSync } from "node:sqlite";
test("node:sqlite is available", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("create table t(a)");
  expect(db.prepare("select count(*) c from t").get()).toEqual({ c: 0 });
});
