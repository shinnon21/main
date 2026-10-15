import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { handleAdminApi } from "../src/admin/api.ts";
import { MAX_BYTES } from "../src/admin/media.ts";

const ORIGIN = "https://admin.test";
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3]);
function setup() {
  const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s);
  const store = new Map<string, { bytes: Uint8Array; type: string }>();
  const media = {
    put: async (key: string, body: ArrayBuffer | Uint8Array, o: { httpMetadata: { contentType: string } }) => { store.set(key, { bytes: new Uint8Array(body as ArrayBuffer), type: o.httpMetadata.contentType }); },
    delete: async (key: string) => { store.delete(key); },
  };
  return { raw, db: d1(raw), store, media };
}
let n = 0;
const ctx = (s: ReturnType<typeof setup>) => ({ db: s.db, media: s.media, email: "me@x", nowUtc: `2026-10-15 10:00:00.${String(++n).padStart(3, "0")}` });
const upload = (s: ReturnType<typeof setup>, body: BodyInit | null, headers: Record<string, string> = {}) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api/media`, { method: "POST", body, headers: { Origin: ORIGIN, "X-Kb-Admin": "1", "Content-Type": "image/png", "X-Filename": encodeURIComponent("My Photo.png"), ...headers } }), ctx(s));
const json = (s: ReturnType<typeof setup>, method: string, path: string, body?: unknown) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api${path}`, { method, headers: { Origin: ORIGIN, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), ctx(s));

test("upload stores the object in R2 with the sniffed type, records it in D1 and returns its URL", async () => {
  const s = setup();
  const res = await upload(s, png);
  expect(res.status).toBe(201);
  const m = await res.json() as any;
  expect(m.key).toMatch(/^\d{4}\/\d{2}\/my-photo-[a-z0-9]{6}\.png$/); expect(m.url).toBe(`/media/${m.key}`); expect(m.content_type).toBe("image/png"); expect(m.size).toBe(png.length);
  expect(s.store.get(m.key)?.type).toBe("image/png");
  const list = await (await json(s, "GET", "/media")).json() as any;
  expect(list.media.map((x: any) => x.key)).toContain(m.key);
});
test("upload rejects disguised/unsupported/oversized/empty files and writes nothing", async () => {
  const s = setup();
  const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
  expect((await upload(s, html)).status).toBe(415);
  expect((await upload(s, new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="x()"></svg>'), { "Content-Type": "image/svg+xml" })).status).toBe(415);
  expect((await upload(s, png, { "Content-Type": "image/jpeg" })).status).toBe(415);
  expect((await upload(s, new Uint8Array())).status).toBe(400);
  const big = new Uint8Array(MAX_BYTES + 1); big.set(png);
  expect((await upload(s, big)).status).toBe(413);
  expect((await upload(s, png, { "Content-Length": String(MAX_BYTES + 5) })).status).toBe(413);
  expect(s.store.size).toBe(0);
  expect((s.raw.prepare("select count(*) c from media").get() as any).c).toBe(0);
});
test("upload CSRF: requires Origin match and the X-Kb-Admin header", async () => {
  const s = setup();
  const raw = (h: Record<string, string>) => handleAdminApi(new Request(`${ORIGIN}/admin/api/media`, { method: "POST", body: png, headers: h }), ctx(s));
  expect((await raw({ "Content-Type": "image/png" })).status).toBe(403);
  expect((await raw({ "Content-Type": "image/png", Origin: ORIGIN })).status).toBe(403);
  expect((await raw({ "Content-Type": "image/png", "X-Kb-Admin": "1" })).status).toBe(403);
  expect((await raw({ "Content-Type": "image/png", Origin: "https://evil.test", "X-Kb-Admin": "1" })).status).toBe(403);
  expect((await raw({ "Content-Type": "image/png", Origin: ORIGIN, "X-Kb-Admin": "1" })).status).toBe(201);
});
test("a malicious X-Filename cannot influence the key's directory or extension", async () => {
  const s = setup();
  for (const f of ["../../etc/passwd", "evil.html", "a/b\\c.svg", "%00.png", "%E0%A4%A"]) {
    const res = await upload(s, png, { "X-Filename": f.includes("%") ? f : encodeURIComponent(f) });
    expect(res.status, f).toBe(201);
    expect(((await res.json()) as any).key).toMatch(/^\d{4}\/\d{2}\/[a-z0-9-]+-[a-z0-9]{6}\.png$/);
  }
});
test("alt update, and delete refuses in-use media (409 with usage) but removes unused media from R2 and D1", async () => {
  const s = setup();
  const m = await (await upload(s, png)).json() as any;
  expect((await json(s, "PUT", `/media/${m.id}`, { alt: "説明文" })).status).toBe(200);
  expect(((await (await json(s, "GET", "/media")).json()) as any).media[0].alt).toBe("説明文");
  s.raw.prepare("update posts set content=? where wp_id=10").run(`<p><img src="/media/${m.key}"></p>`);
  const inUse = await json(s, "DELETE", `/media/${m.id}`);
  expect(inUse.status).toBe(409); expect(((await inUse.json()) as any).usage.length).toBe(1);
  expect(s.store.has(m.key)).toBe(true);
  s.raw.prepare("update posts set content=null where wp_id=10").run();
  expect((await json(s, "DELETE", `/media/${m.id}`)).status).toBe(204);
  expect(s.store.has(m.key)).toBe(false);
  expect((await json(s, "DELETE", `/media/${m.id}`)).status).toBe(404);
  expect((await json(s, "PUT", "/media/99999", { alt: "x" })).status).toBe(404);
});
test("media endpoints without an R2 binding fail with 503 instead of crashing", async () => {
  const s = setup();
  const res = await handleAdminApi(new Request(`${ORIGIN}/admin/api/media`, { method: "POST", body: png, headers: { Origin: ORIGIN, "X-Kb-Admin": "1", "Content-Type": "image/png" } }), { db: s.db, email: "me@x", nowUtc: "t" });
  expect(res.status).toBe(503);
});
