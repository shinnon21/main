import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { workClients } from "../src/lib/queries.ts";

function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return raw; }
const setMeta = (raw: any, slug: string, key: string, v: string) => raw.prepare("insert into post_meta(post_id,key,value) select id,?,? from posts where slug=?").run(key, JSON.stringify(v), slug);

test("workClients lists distinct client names of published works (ja / en fallback to ja), newest work first, capped", async () => {
  const raw = setup();
  setMeta(raw, "site-a", "client_name", "株式会社A"); setMeta(raw, "site-a", "client_name_en", "A Inc.");
  setMeta(raw, "site-b", "client_name", "株式会社A"); setMeta(raw, "site-b", "client_name_en", "A Inc."); // 重複は1件にまとめる
  expect(await workClients(d1(raw), "ja", 10)).toEqual(["株式会社A"]);
  expect(await workClients(d1(raw), "en", 10)).toEqual(["A Inc."]);
  const raw2 = setup(); setMeta(raw2, "site-a", "client_name", "株式会社B"); setMeta(raw2, "site-a", "client_name_en", ""); // 空の英語名は日本語にフォールバック
  expect(await workClients(d1(raw2), "en", 10)).toEqual(["株式会社B"]);
});
test("workClients ignores drafts/trash and non-works, and honours the limit", async () => {
  const raw = setup();
  raw.exec("insert into posts(wp_id,type,slug,status,title,published_at,modified_at) values(901,'works','draft-w','draft','d','2026-01-01 00:00:00','2026-01-01 00:00:00')");
  setMeta(raw, "draft-w", "client_name", "下書きの組織");
  setMeta(raw, "site-a", "client_name", "公開A"); setMeta(raw, "site-b", "client_name", "公開B");
  const ja = await workClients(d1(raw), "ja", 10); expect(ja).not.toContain("下書きの組織");
  expect(await workClients(d1(raw), "ja", 1)).toHaveLength(1);
});
