import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAdminApi } from "../src/admin/api.ts";

const ORIGIN = "https://admin.test";
function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return d1(raw); }
let n = 0;
const ctx = (db: ReturnType<typeof setup>) => ({ db, email: "me@x", nowUtc: `2026-10-15 10:00:00.${String(++n).padStart(3, "0")}` });
const call = (db: ReturnType<typeof setup>, method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api${path}`, { method, headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), Origin: ORIGIN, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), ctx(db));
const post = (over: Record<string, unknown> = {}) => ({ type: "works", title: "T", title_en: "", slug: "api-made", status: "draft", published_at: null, excerpt: "", excerpt_en: "", content: "<p>x</p>", content_en: "", thumbnail: null, meta: {}, terms: [{ taxonomy: "works_type", slug: "web" }], ...over });

test("create -> get -> list -> update -> trash -> restore round trip", async () => {
  const db = setup();
  const c = await call(db, "POST", "/posts", post({ published_at: "2026-07-05T00:21", status: "publish" }));
  expect(c.status).toBe(201);
  const { id } = await c.json() as { id: number };
  const g = await call(db, "GET", `/posts/${id}`);
  const got = await g.json() as any;
  expect(g.status).toBe(200); expect(got.published_at).toBe("2026-07-05T00:21"); expect(got.slug).toBe("api-made");
  expect(g.headers.get("Cache-Control")).toBe("no-store");
  const list = await (await call(db, "GET", "/posts?type=works&q=T")).json() as any;
  expect(list.posts.map((p: any) => p.id)).toContain(id);
  const u = await call(db, "PUT", `/posts/${id}`, { ...post({ title: "更新" }), published_at: got.published_at, expected_modified_at: got.modified_at });
  expect(u.status).toBe(200);
  expect((await (await call(db, "GET", `/posts/${id}`)).json() as any).title).toBe("更新");
  expect((await call(db, "DELETE", `/posts/${id}`)).status).toBe(204);
  expect((await (await call(db, "GET", `/posts/${id}`)).json() as any).status).toBe("trash");
  const revs = await (await call(db, "GET", `/posts/${id}/revisions`)).json() as any;
  expect(revs.revisions.length).toBeGreaterThanOrEqual(2);
  const r = await call(db, "POST", `/posts/${id}/restore/${revs.revisions[revs.revisions.length - 1].id}`, {});
  expect(r.status).toBe(200);
  expect((await call(db, "POST", `/posts/${id}/status`, { status: "publish" })).status).toBe(200);
});
test("terms endpoint lists existing terms", async () => {
  const body = await (await call(setup(), "GET", "/terms")).json() as any;
  expect(body.terms.map((t: any) => `${t.taxonomy}/${t.slug}`)).toContain("skill/seo");
});
test("CSRF: non-JSON content type is 415; missing or foreign Origin is 403; GET needs no Origin", async () => {
  const db = setup();
  const raw = (headers: Record<string, string>) => handleAdminApi(new Request(`${ORIGIN}/admin/api/posts`, { method: "POST", headers, body: JSON.stringify(post()) }), ctx(db));
  expect((await raw({ "Content-Type": "text/plain", Origin: ORIGIN })).status).toBe(415);
  expect((await raw({ "Content-Type": "application/json" })).status).toBe(403);
  expect((await raw({ "Content-Type": "application/json", Origin: "https://evil.test" })).status).toBe(403);
  expect((await raw({ "Content-Type": "application/json; charset=utf-8", Origin: ORIGIN })).status).toBe(201);
  expect((await handleAdminApi(new Request(`${ORIGIN}/admin/api/posts`), ctx(db))).status).toBe(200);
  expect((await handleAdminApi(new Request(`${ORIGIN}/admin/api/posts/1`, { method: "DELETE" }), ctx(db))).status).toBe(403);
});
test("errors: 404 unknown id/path, 405 wrong method, 400 validation, 409 conflicts, bad JSON 400", async () => {
  const db = setup();
  expect((await call(db, "GET", "/posts/999999")).status).toBe(404);
  expect((await call(db, "GET", "/nope")).status).toBe(404);
  expect((await call(db, "PATCH", "/posts", {})).status).toBe(405);
  const bad = await call(db, "POST", "/posts", post({ title: "" }));
  expect(bad.status).toBe(400); expect(await bad.json()).toHaveProperty("error");
  expect((await call(db, "POST", "/posts", post())).status).toBe(201);
  expect((await call(db, "POST", "/posts", post())).status).toBe(409);
  const { id } = await (await call(db, "GET", "/posts?type=works&q=T")).json().then((x: any) => x.posts[0]);
  expect((await call(db, "PUT", `/posts/${id}`, { ...post(), expected_modified_at: "2000-01-01 00:00:00.000" })).status).toBe(409);
  const badJson = await handleAdminApi(new Request(`${ORIGIN}/admin/api/posts`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN }, body: "{not json" }), ctx(db));
  expect(badJson.status).toBe(400);
  expect((await call(db, "POST", `/posts/${id}/status`, { status: "bogus" })).status).toBe(400);
  expect((await call(db, "GET", "/posts/abc")).status).toBe(404);
});
test("unexpected errors are 500 without leaking details", async () => {
  const db = setup();
  const broken = { ...db, prepare: () => { throw new Error("secret sql detail"); } } as never;
  const res = await handleAdminApi(new Request(`${ORIGIN}/admin/api/terms`), { db: broken, email: "me@x", nowUtc: "x" });
  expect(res.status).toBe(500); expect(JSON.stringify(await res.json())).not.toMatch(/secret/);
});
