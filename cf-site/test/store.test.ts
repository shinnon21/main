import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { listPage } from "../src/lib/queries.ts";
import { cleanPostInput } from "../src/admin/validate.ts";
import { HttpError, type CleanPost } from "../src/admin/types.ts";
import { REVISION_LIMIT, createPost, getAdminPost, listAdminPosts, listRevisions, restoreRevision, setStatus, updatePost } from "../src/admin/store.ts";

function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return { raw, db: d1(raw) }; }
const mk = (over: Record<string, unknown> = {}): CleanPost => cleanPostInput({ type: "works", title: "新規", title_en: "New", slug: "new-work", status: "draft", published_at: null, excerpt: "e", excerpt_en: "ee", content: "<p>本文</p>", content_en: "<p>body</p>", thumbnail: null, meta: { client_name: "C", scope: ["運用"], kpi_results: [{ label: "L", value: "V" }] }, terms: [{ taxonomy: "works_type", slug: "web" }, { taxonomy: "skill", slug: "seo" }], ...over });
const T0 = "2026-10-15 10:00:00.000";
const tick = (n: number) => `2026-10-15 10:00:${String(n % 60).padStart(2, "0")}.${String(Math.floor(n / 60)).padStart(3, "0")}`;
const expectHttp = async (p: Promise<unknown>, status: number) => { await expect(p).rejects.toMatchObject({ status }); await p.catch((e) => expect(e).toBeInstanceOf(HttpError)); };

test("createPost allocates wp_id>=1000 and getAdminPost round-trips every field", async () => {
  const { raw, db } = setup();
  const { id } = await createPost(db, mk(), "me@x", T0);
  expect((raw.prepare("select wp_id from posts where id=?").get(id) as any).wp_id).toBeGreaterThanOrEqual(1000);
  const p = (await getAdminPost(db, id))!;
  expect(p).toMatchObject({ id, type: "works", title: "新規", title_en: "New", slug: "new-work", status: "draft", excerpt: "e", excerpt_en: "ee", content: "<p>本文</p>", content_en: "<p>body</p>", modified_at: T0 });
  expect(p.meta).toEqual({ client_name: "C", scope: ["運用"], kpi_results: [{ label: "L", value: "V" }] });
  expect(p.terms.map((t) => `${t.taxonomy}/${t.slug}`).sort()).toEqual(["skill/seo", "works_type/web"]);
  const { id: id2 } = await createPost(db, mk({ slug: "second" }), "me@x", T0);
  expect((raw.prepare("select wp_id from posts where id=?").get(id2) as any).wp_id).toBeGreaterThan((raw.prepare("select wp_id from posts where id=?").get(id) as any).wp_id);
});
test("duplicate slug within a type is 409; same slug in another type is fine", async () => {
  const { db } = setup();
  await createPost(db, mk(), "me@x", T0);
  await expectHttp(createPost(db, mk(), "me@x", T0), 409);
  await expect(createPost(db, mk({ type: "column", terms: [{ taxonomy: "skill", slug: "seo" }], meta: {} }), "me@x", T0)).resolves.toHaveProperty("id");
});
test("unknown term is 400 and nothing is written", async () => {
  const { raw, db } = setup();
  const before = (raw.prepare("select count(*) c from posts").get() as any).c;
  await expectHttp(createPost(db, mk({ terms: [{ taxonomy: "skill", slug: "nope" }] }), "me@x", T0), 400);
  expect((raw.prepare("select count(*) c from posts").get() as any).c).toBe(before);
});
test("draft/trash are invisible to the public queries, publish is visible", async () => {
  const { db } = setup();
  const { id } = await createPost(db, mk({ slug: "vis", status: "publish" }), "me@x", T0);
  expect((await listPage(db, "works", 1)).posts.map((p) => p.slug)).toContain("vis");
  await setStatus(db, id, "draft", "me@x", tick(1));
  expect((await listPage(db, "works", 1)).posts.map((p) => p.slug)).not.toContain("vis");
  await setStatus(db, id, "publish", "me@x", tick(2));
  await setStatus(db, id, "trash", "me@x", tick(3));
  expect((await listPage(db, "works", 1)).posts.map((p) => p.slug)).not.toContain("vis");
});
test("updatePost: updates fields and meta/terms, keeps non-editable meta, bumps modified_at", async () => {
  const { raw, db } = setup();
  const prof = (raw.prepare("select id from posts where slug='profile'").get() as any).id;
  const before = (await getAdminPost(db, prof))!;
  const { id } = await createPost(db, mk(), "me@x", T0);
  raw.prepare("insert into post_meta(post_id,key,value) values(?, 'kb_views', '\"5\"')").run(id);
  await updatePost(db, id, mk({ title: "変更", meta: { client_name: "D" }, terms: [{ taxonomy: "works_type", slug: "web" }], expected_modified_at: T0 }), "me@x", tick(1));
  const p = (await getAdminPost(db, id))!;
  expect(p.title).toBe("変更"); expect(p.meta).toEqual({ client_name: "D" }); expect(p.terms).toEqual([{ taxonomy: "works_type", slug: "web" }]); expect(p.modified_at).toBe(tick(1));
  expect((raw.prepare("select value from post_meta where post_id=? and key='kb_views'").get(id) as any).value).toBe('"5"');
  expect((await getAdminPost(db, prof))!.modified_at).toBe(before.modified_at);
});
test("updatePost: stale expected_modified_at is 409, type change 400, missing id 404, slug clash 409", async () => {
  const { db } = setup();
  const { id } = await createPost(db, mk(), "me@x", T0);
  await expectHttp(updatePost(db, id, mk({ expected_modified_at: "2000-01-01 00:00:00.000" }), "me@x", tick(1)), 409);
  await expectHttp(updatePost(db, id, mk({ type: "column", terms: [], meta: {}, expected_modified_at: T0 }), "me@x", tick(1)), 400);
  await expectHttp(updatePost(db, 999999, mk(), "me@x", tick(1)), 404);
  await createPost(db, mk({ slug: "other" }), "me@x", T0);
  await expectHttp(updatePost(db, id, mk({ slug: "other", expected_modified_at: T0 }), "me@x", tick(1)), 409);
});
test("two saves in the same second are still ordered by millisecond modified_at (second stale save is 409)", async () => {
  const { db } = setup();
  const { id } = await createPost(db, mk(), "me@x", "2026-10-15 10:00:00.100");
  const a = await updatePost(db, id, mk({ title: "A", expected_modified_at: "2026-10-15 10:00:00.100" }), "me@x", "2026-10-15 10:00:00.200");
  await expectHttp(updatePost(db, id, mk({ title: "B", expected_modified_at: "2026-10-15 10:00:00.100" }), "me@x", "2026-10-15 10:00:00.300"), 409);
  expect(a.modified_at).toBe("2026-10-15 10:00:00.200");
});
test("revisions: one per update, capped at REVISION_LIMIT (oldest dropped); restore brings content back and is itself recorded", async () => {
  const { db } = setup();
  const { id } = await createPost(db, mk({ title: "v0" }), "me@x", tick(0));
  let last = tick(0);
  for (let i = 1; i <= REVISION_LIMIT + 5; i++) { const t = tick(i); await updatePost(db, id, mk({ title: `v${i}`, expected_modified_at: last }), "me@x", t); last = t; }
  const revs = await listRevisions(db, id);
  expect(revs).toHaveLength(REVISION_LIMIT);
  expect(revs[0].saved_by).toBe("me@x");
  const target = revs[revs.length - 1];
  await restoreRevision(db, id, target.id, "me@x", tick(200));
  const restored = (await getAdminPost(db, id))!;
  expect(restored.title).toMatch(/^v\d+$/); expect(restored.title).not.toBe(`v${REVISION_LIMIT + 5}`);
  expect((await listRevisions(db, id)).length).toBe(REVISION_LIMIT);
  await expectHttp(restoreRevision(db, id, 999999, "me@x", tick(201)), 404);
});
test("listAdminPosts: excludes trash by default, filters by type/status/q", async () => {
  const { db } = setup();
  const { id } = await createPost(db, mk({ slug: "to-trash", title: "ゴミ箱行き" }), "me@x", T0);
  await createPost(db, mk({ slug: "visible", title: "見える" }), "me@x", T0);
  await setStatus(db, id, "trash", "me@x", tick(1));
  const all = await listAdminPosts(db, {});
  expect(all.map((r) => r.slug)).not.toContain("to-trash"); expect(all.map((r) => r.slug)).toContain("visible");
  expect((await listAdminPosts(db, { status: "trash" })).map((r) => r.slug)).toEqual(["to-trash"]);
  expect((await listAdminPosts(db, { type: "works", q: "見える" })).map((r) => r.slug)).toEqual(["visible"]);
  expect((await listAdminPosts(db, { type: "column" })).length).toBe(0);
  expect((await listAdminPosts(db, { q: "100%" })).length).toBe(0);
});
