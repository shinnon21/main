import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAdminApi } from "../src/admin/api.ts";

const ORIGIN = "https://admin.test";
function setup() {
  const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s);
  raw.exec("insert into contacts(created_at,name,email,company,kind,message,lang,status,notify_status) values('2026-10-01 00:00:00','山田','y@example.com','','相談','秘密の本文','ja','new','sent')");
  raw.exec("insert into media(key,content_type,size,alt,uploaded_by,uploaded_at) values('2026/10/a.png','image/png',10,'a','me@x','2026-10-01 00:00:00')");
  return { raw, db: d1(raw) };
}
const get = (s: ReturnType<typeof setup>, q = "") => handleAdminApi(new Request(`${ORIGIN}/admin/api/export${q}`, { method: "GET" }), { db: s.db, email: "me@x", nowUtc: "2026-10-15 03:04:05" });

test("export is a JSON attachment with posts/meta/terms/settings/media and no contacts by default", async () => {
  const s = setup(); const r = await get(s);
  expect(r.status).toBe(200);
  expect(r.headers.get("Content-Type")).toMatch(/^application\/json/); expect(r.headers.get("Content-Disposition")).toBe('attachment; filename="kobayashi-backup-20261015-030405.json"'); expect(r.headers.get("Cache-Control")).toBe("no-store");
  const d = await r.json() as any;
  expect(d.format).toBe("kb-site-backup/1"); expect(d.exported_at).toBe("2026-10-15 03:04:05");
  expect(d.posts).toHaveLength(3); expect(d.post_meta.length).toBeGreaterThan(0); expect(d.terms.length).toBe(2); expect(d.post_terms.length).toBeGreaterThan(0);
  expect(d.settings.some((x: any) => x.key === "blogname")).toBe(true); expect(d.media).toHaveLength(1); expect("contacts" in d).toBe(false);
  expect(JSON.stringify(d)).not.toContain("秘密の本文");
});
test("contacts are included only with ?contacts=1", async () => {
  const s = setup(); const d = await (await get(s, "?contacts=1")).json() as any;
  expect(d.contacts).toHaveLength(1); expect(d.contacts[0].message).toBe("秘密の本文");
  expect("contacts" in (await (await get(s, "?contacts=0")).json() as any)).toBe(false);
});
test("export does not mark the CMS as initialized (read-only)", async () => {
  const s = setup(); await get(s);
  expect(s.raw.prepare("select count(*) c from settings where key='cms_initialized'").get()).toEqual({ c: 0 });
});

test("export includes PV counts and revisions (which cannot be rebuilt)", async () => {
  const s = setup();
  s.raw.exec("insert or replace into views(post_id,count) select id,5 from posts limit 1");
  s.raw.exec("insert into revisions(post_id,saved_at,saved_by,snapshot) select id,'t','me','{}' from posts limit 1");
  const d = await (await get(s)).json() as any;
  expect(d.views).toHaveLength(1); expect(d.revisions).toHaveLength(1);
});
