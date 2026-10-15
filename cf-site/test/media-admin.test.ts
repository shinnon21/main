import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { buildImportSql } from "../scripts/lib/import-sql.ts";
import { exp } from "./fixtures/export.ts";
import { MAX_BYTES, detectImageType, makeKey, validateUpload, findUsage, insertMedia, listMedia, getMedia, setAlt, deleteMediaRow } from "../src/admin/media.ts";
import { HttpError } from "../src/admin/types.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const gif = new TextEncoder().encode("GIF89a\x01\x00\x01\x00\x00\x00");
const webp = new TextEncoder().encode("RIFF\x00\x00\x00\x00WEBPVP8 ");
const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');

test("detectImageType trusts bytes only: jpeg/png/gif/webp; html, svg, empty and short input are null", () => {
  expect(detectImageType(png)).toBe("image/png"); expect(detectImageType(jpg)).toBe("image/jpeg");
  expect(detectImageType(gif)).toBe("image/gif"); expect(detectImageType(webp)).toBe("image/webp");
  for (const bad of [html, svg, new Uint8Array(), Uint8Array.from([0xff, 0xd8]), new TextEncoder().encode("GIF"), new TextEncoder().encode("RIFF....WAVEfmt ")]) expect(detectImageType(bad)).toBeNull();
});
test("makeKey: YYYY/MM/<ascii-stem>-<rand>.<ext from sniffed type>, never trusting the client filename", () => {
  const now = new Date("2026-10-15T01:02:03Z");
  expect(makeKey("My Photo (1).PNG", "image/png", now, "ab12cd")).toBe("2026/10/my-photo-1-ab12cd.png");
  expect(makeKey("写真.jpg", "image/jpeg", now, "ab12cd")).toBe("2026/10/image-ab12cd.jpg");
  expect(makeKey("../../etc/passwd", "image/png", now, "ab12cd")).toBe("2026/10/etc-passwd-ab12cd.png");
  expect(makeKey("evil.html", "image/webp", now, "ab12cd")).toBe("2026/10/evil-ab12cd.webp");
  expect(makeKey("a".repeat(300) + ".gif", "image/gif", now, "ab12cd").length).toBeLessThan(100);
  expect(makeKey("x", "image/png", new Date("2026-01-05T15:30:00Z"), "r")).toMatch(/^2026\/01\//);
  expect(makeKey("x", "image/png", new Date("2026-12-31T20:00:00Z"), "r")).toMatch(/^2027\/01\//); // JSTで月を決める
});
test("validateUpload: type from bytes, 415 for non-images/claimed mismatch, 413 for too big, 400 for empty", () => {
  expect(validateUpload(png, "image/png")).toEqual({ type: "image/png" });
  expect(validateUpload(jpg, "application/octet-stream")).toEqual({ type: "image/jpeg" });
  for (const [bytes, claimed, status] of [[html, "image/png", 415], [svg, "image/svg+xml", 415], [png, "image/jpeg", 415], [new Uint8Array(), "image/png", 400]] as const) {
    try { validateUpload(bytes, claimed); expect.unreachable(); } catch (e) { expect(e).toBeInstanceOf(HttpError); expect((e as HttpError).status).toBe(status); }
  }
  const big = new Uint8Array(MAX_BYTES + 1); big.set(png);
  try { validateUpload(big, "image/png"); expect.unreachable(); } catch (e) { expect((e as HttpError).status).toBe(413); }
});

function setup() { const raw = newDb(); for (const s of buildImportSql(structuredClone(exp)).statements) raw.exec(s); return { raw, db: d1(raw) }; }
test("media rows: insert, list (newest first, search), get, alt update, delete", async () => {
  const { db } = setup();
  const a = await insertMedia(db, { key: "2026/10/a-x.png", content_type: "image/png", size: 10, uploaded_by: "me@x", now: "2026-10-15 10:00:00.001" });
  const b = await insertMedia(db, { key: "2026/10/b-y.jpg", content_type: "image/jpeg", size: 20, uploaded_by: "me@x", now: "2026-10-15 10:00:00.002" });
  expect((await listMedia(db, {})).map((m) => m.id)).toEqual([b.id, a.id]);
  expect((await listMedia(db, { q: "a-x" })).map((m) => m.id)).toEqual([a.id]);
  await setAlt(db, a.id, "説明");
  expect((await getMedia(db, a.id))!.alt).toBe("説明");
  await deleteMediaRow(db, b.id);
  expect(await getMedia(db, b.id)).toBeNull();
  await expect(insertMedia(db, { key: "2026/10/a-x.png", content_type: "image/png", size: 1, uploaded_by: "x", now: "t" })).rejects.toThrow();
});
test("findUsage finds thumbnail, content, content_en and meta references (and LIKE wildcards in keys do not over-match)", async () => {
  const { raw, db } = setup();
  raw.prepare("update posts set thumbnail=? where wp_id=11").run("2026/07/thumb.jpg");
  raw.prepare("update posts set content=? where wp_id=10").run('<p><img src="/media/2026/07/in-body.jpg"></p>');
  raw.prepare("update posts set content_en=? where wp_id=14").run('<p><img src="/media/2026/07/in-en.jpg"></p>');
  raw.prepare("insert into post_meta(post_id,key,value) select id,'ssp_meta_image','\"/media/2026/07/og.jpg\"' from posts where wp_id=10").run();
  for (const [key, wp] of [["2026/07/thumb.jpg", 11], ["2026/07/in-body.jpg", 10], ["2026/07/in-en.jpg", 14], ["2026/07/og.jpg", 10]] as const) {
    const u = await findUsage(db, key); expect(u.length, key).toBe(1);
    expect((raw.prepare("select wp_id from posts where id=?").get(u[0].id) as any).wp_id).toBe(wp);
  }
  expect(await findUsage(db, "2026/07/unused.jpg")).toEqual([]);
  expect(await findUsage(db, "2026/07/%.jpg")).toEqual([]);
});
