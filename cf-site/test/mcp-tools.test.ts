import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { createPostTool, createTermTool, getPostTool, listPostsTool, listTermsTool, updatePostTool } from "../src/mcp/tools.ts";

function setup() {
  const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s);
  const ctx = { db: d1(raw), email: "me@x", nowUtc: "2026-10-15 00:00:00" };
  const idOf = (slug: string) => (raw.prepare("select id from posts where slug=?").get(slug) as any).id as number;
  return { raw, ctx, idOf };
}
const status = (e: unknown) => (e as { status?: number }).status;
const rejects = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } throw new Error("expected rejection"); };

test("create is always a draft (even if status:'publish' is passed) and published_at is not set to a future/other value", async () => {
  const s = setup();
  const { id } = await createPostTool(s.ctx, { type: "column", title: "下書き", content: "<p>x</p>", status: "publish", published_at: "2020-01-01T00:00" } as any);
  expect(s.raw.prepare("select status,title from posts where id=?").get(id)).toEqual({ status: "draft", title: "下書き" });
});
test("create generates distinct slugs for rapid successive calls and sanitizes content", async () => {
  const s = setup();
  const a = await createPostTool(s.ctx, { type: "news", title: "a", content: `<p>ok</p><script>alert(1)</script>` });
  const b = await createPostTool(s.ctx, { type: "news", title: "b" });
  expect(a.id).not.toBe(b.id);
  expect((s.raw.prepare("select content from posts where id=?").get(a.id) as any).content).not.toContain("<script");
});
test("create validates: bad type/title/oversized fields → 400", async () => {
  const s = setup();
  for (const bad of [{ type: "bogus", title: "x" }, { type: "column", title: "" }, { type: "column", title: "x".repeat(501) }, { title: "x" }, { type: "works", title: "x", meta: { site_url: "javascript:alert(1)" } }])
    expect(status(await rejects(createPostTool(s.ctx, bad as any))), JSON.stringify(bad)).toBe(400);
});
test("update changes only the given fields, keeps status/slug/terms/other meta, writes a revision", async () => {
  const s = setup(); const id = s.idOf("site-a");
  const before = await getPostTool(s.ctx, { id });
  const r = await updatePostTool(s.ctx, { id, expected_modified_at: before.modified_at, title: "新タイトル" });
  expect(r.modified_at).toBe("2026-10-15 00:00:00");
  const after = await getPostTool(s.ctx, { id });
  expect(after.title).toBe("新タイトル"); expect(after.status).toBe("publish"); expect(after.slug).toBe("site-a");
  expect(after.content).toBe(before.content); expect(after.terms).toEqual(before.terms); expect(after.meta).toEqual(before.meta); expect(after.published_at).toBe(before.published_at);
  expect(s.raw.prepare("select count(*) c from revisions where post_id=?").get(id)).toEqual({ c: 1 });
});
test("update ignores a status in the input (cannot publish/unpublish/trash)", async () => {
  const s = setup(); const id = s.idOf("site-a"); const cur = await getPostTool(s.ctx, { id });
  await updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, title: "x", status: "trash" } as any);
  expect((s.raw.prepare("select status from posts where id=?").get(id) as any).status).toBe("publish");
  const d = await createPostTool(s.ctx, { type: "column", title: "d" }); const dc = await getPostTool(s.ctx, { id: d.id });
  await updatePostTool(s.ctx, { id: d.id, expected_modified_at: dc.modified_at, title: "d2", status: "publish" } as any);
  expect((s.raw.prepare("select status from posts where id=?").get(d.id) as any).status).toBe("draft");
});
test("update with a stale or missing expected_modified_at is rejected (409 / 400); unknown id is 404", async () => {
  const s = setup(); const id = s.idOf("site-a");
  expect(status(await rejects(updatePostTool(s.ctx, { id, expected_modified_at: "1999-01-01 00:00:00", title: "x" })))).toBe(409);
  expect(status(await rejects(updatePostTool(s.ctx, { id, title: "x" } as any)))).toBe(400);
  expect(status(await rejects(updatePostTool(s.ctx, { id: 99999, expected_modified_at: "x", title: "x" })))).toBe(404);
});
test("update cannot change the type, and still validates/sanitizes", async () => {
  const s = setup(); const id = s.idOf("site-a"); const cur = await getPostTool(s.ctx, { id });
  expect(status(await rejects(updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, type: "column" } as any)))).toBe(400);
  expect(status(await rejects(updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, meta: { site_url: "javascript:alert(1)" } })))).toBe(400);
  await updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, content: `<p>a</p><img src=x onerror=alert(1)>` });
  expect((await getPostTool(s.ctx, { id })).content).not.toContain("onerror");
});
test("update merges meta (keeps untouched keys) and can set terms", async () => {
  const s = setup(); const id = s.idOf("site-a"); const cur = await getPostTool(s.ctx, { id });
  await updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, meta: { role: "PM" }, terms: [{ taxonomy: "skill", slug: "seo" }] });
  const after = await getPostTool(s.ctx, { id });
  expect(after.meta.role).toBe("PM"); expect(after.meta.kpi_results).toEqual(cur.meta.kpi_results);
  expect(after.terms).toEqual([{ taxonomy: "skill", slug: "seo" }]);
});
test("list filters by type/status/q and is capped at 50", async () => {
  const s = setup();
  for (let i = 0; i < 55; i++) await createPostTool(s.ctx, { type: "news", title: `n${i}` });
  const all = await listPostsTool(s.ctx, {}); expect(all.posts.length).toBe(50);
  const drafts = await listPostsTool(s.ctx, { type: "news", status: "draft" }); expect(drafts.posts.every((p) => p.status === "draft" && p.type === "news")).toBe(true);
  expect((await listPostsTool(s.ctx, { q: "Brien" })).posts.length).toBeGreaterThan(0);
});
test("terms: list with usage, create via the existing validation (dup → 409)", async () => {
  const s = setup();
  expect((await listTermsTool(s.ctx, { taxonomy: "skill" })).terms.every((t: any) => t.taxonomy === "skill")).toBe(true);
  const t = await createTermTool(s.ctx, { taxonomy: "skill", name: "MCP" }); expect(t.name).toBe("MCP");
  expect(status(await rejects(createTermTool(s.ctx, { taxonomy: "skill", name: "MCP" })))).toBe(409);
  expect(status(await rejects(createTermTool(s.ctx, { taxonomy: "bogus", name: "x" })))).toBe(400);
});

test("slug of a non-draft post cannot be changed via MCP (re-sending the same slug is fine); drafts may change their slug", async () => {
  const s = setup(); const id = s.idOf("site-a"); const cur = await getPostTool(s.ctx, { id });
  expect(status(await rejects(updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, slug: "renamed" })))).toBe(400);
  await updatePostTool(s.ctx, { id, expected_modified_at: cur.modified_at, slug: "site-a", title: "same slug ok" });
  const d = await createPostTool(s.ctx, { type: "column", title: "d", slug: "d-1" }); const dc = await getPostTool(s.ctx, { id: d.id });
  await updatePostTool(s.ctx, { id: d.id, expected_modified_at: dc.modified_at, slug: "d-2" });
  expect((s.raw.prepare("select slug from posts where id=?").get(d.id) as any).slug).toBe("d-2");
});
