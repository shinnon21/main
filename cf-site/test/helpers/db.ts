import { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
export function newDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".sql")).sort()) db.exec(readFileSync(new URL(f, dir), "utf8"));
  return db;
}
