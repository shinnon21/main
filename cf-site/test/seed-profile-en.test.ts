import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { buildSeedSql } from "../scripts/seed-profile-en.ts";
test("seed SQL writes profile_*_en meta for the profile page and is idempotent", () => {
  const db = newDb();
  db.exec("insert into posts(wp_id,type,slug,title,published_at,modified_at) values(20,'page','profile','p','2026-01-01','2026-01-01')");
  const sql = buildSeedSql({ profile_name: "Shinnosuke O'Kobayashi", profile_career: "2025 | A | b\n2024 | C | d" });
  for (const s of [...sql, ...sql]) db.exec(s);
  const rows = db.prepare("select key,value from post_meta order by key").all() as { key: string; value: string }[];
  expect(rows.map((r) => r.key)).toEqual(["profile_career_en", "profile_name_en"]);
  expect(JSON.parse(rows[1].value)).toBe("Shinnosuke O'Kobayashi");
  expect(JSON.parse(rows[0].value)).toBe("2025 | A | b\n2024 | C | d");
});
