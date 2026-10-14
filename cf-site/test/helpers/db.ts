import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function newDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../../migrations/0001_init.sql", import.meta.url), "utf8"));
  return db;
}
