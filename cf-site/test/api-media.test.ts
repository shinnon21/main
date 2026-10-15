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

// --- security review: key collisions must never overwrite or delete an existing object ---
const ctxWith = (s: ReturnType<typeof setup>, rand: () => string) => ({ ...ctx(s), rand });
const up2 = (s: ReturnType<typeof setup>, c: ReturnType<typeof ctxWith>) =>
  handleAdminApi(new Request(`${ORIGIN}/admin/api/media`, { method: "POST", body: png, headers: { Origin: ORIGIN, "X-Kb-Admin": "1", "Content-Type": "image/png", "X-Filename": "photo.png" } }), c);
const seedExisting = (s: ReturnType<typeof setup>, key: string) => {
  s.store.set(key, { bytes: Uint8Array.from([9, 9, 9]), type: "image/png" });
  s.raw.prepare("insert into media(key,content_type,size,alt,uploaded_at,uploaded_by) values(?,?,?,?,?,?)").run(key, "image/png", 3, "", "2026-01-01 00:00:00", "wp-import");
};
test("M1: on a key collision the existing object is untouched and the upload retries with a new suffix", async () => {
  const s = setup();
  const y = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(), mo = String(new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1).padStart(2, "0");
  const taken = `${y}/${mo}/photo-aaaaaa.png`; seedExisting(s, taken);
  const seq = ["aaaaaa", "bbbbbb"]; const res = await up2(s, ctxWith(s, () => seq.shift()!));
  expect(res.status).toBe(201); expect(((await res.json()) as any).key).toBe(`${y}/${mo}/photo-bbbbbb.png`);
  expect(Array.from(s.store.get(taken)!.bytes)).toEqual([9, 9, 9]);
  expect((s.raw.prepare("select count(*) c from media where key=?").get(taken) as any).c).toBe(1);
});
test("M1: repeated collisions give 409 and leave the existing object and row intact", async () => {
  const s = setup();
  const y = new Date(Date.now() + 9 * 3600e3).getUTCFullYear(), mo = String(new Date(Date.now() + 9 * 3600e3).getUTCMonth() + 1).padStart(2, "0");
  const taken = `${y}/${mo}/photo-aaaaaa.png`; seedExisting(s, taken);
  const res = await up2(s, ctxWith(s, () => "aaaaaa"));
  expect(res.status).toBe(409);
  expect(Array.from(s.store.get(taken)!.bytes)).toEqual([9, 9, 9]); expect(s.store.has(taken)).toBe(true);
  expect((s.raw.prepare("select count(*) c from media").get() as any).c).toBe(1);
});
test("M1: if the R2 put fails the D1 row is removed again (no ghost library entry)", async () => {
  const s = setup();
  const failing = { put: async () => { throw new Error("r2 down"); }, delete: async () => {} };
  const res = await handleAdminApi(new Request(`${ORIGIN}/admin/api/media`, { method: "POST", body: png, headers: { Origin: ORIGIN, "X-Kb-Admin": "1", "Content-Type": "image/png" } }), { ...ctx(s), media: failing });
  expect(res.status).toBe(500);
  expect((s.raw.prepare("select count(*) c from media").get() as any).c).toBe(0);
});
