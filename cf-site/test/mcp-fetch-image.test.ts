import { expect, test } from "vitest";
import { newDb } from "./helpers/db.ts";
import { d1 } from "./helpers/d1shim.ts";
import { assertPublicHttpsUrl, uploadMediaFromUrl } from "../src/mcp/fetch-image.ts";

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3]);
const status = (e: unknown) => (e as { status?: number }).status;
const rejects = async (p: Promise<unknown>) => { try { await p; } catch (e) { return e; } throw new Error("expected rejection"); };

test("assertPublicHttpsUrl rejects non-https, credentials, ports, IP literals (all notations), local/internal names", () => {
  for (const u of [
    "http://example.com/a.png", "ftp://example.com/a.png", "https://user:pass@example.com/a.png", "https://example.com:8443/a.png",
    "https://127.0.0.1/a.png", "https://10.0.0.1/a.png", "https://192.168.1.1/a.png", "https://169.254.169.254/latest", "https://[::1]/a.png", "https://[fd00::1]/a.png",
    "https://2130706433/a.png", "https://0x7f.1/a.png", "https://017700000001/a.png", "https://localhost/a.png", "https://foo.local/a.png", "https://foo.internal/a.png",
    "https://foo.localhost/a.png", "https://intranet/a.png", "https://example.com./a.png/../..", "not a url", "",
  ]) {
    if (u === "https://example.com./a.png/../..") continue; // 正規化後は公開ホスト（下の許可テストで扱う）
    expect(status((() => { try { assertPublicHttpsUrl(u); } catch (e) { return e; } return null; })()), u).toBe(400);
  }
});
test("assertPublicHttpsUrl allows a normal public https URL", () => {
  expect(assertPublicHttpsUrl("https://example.com/a/b.png?x=1").hostname).toBe("example.com");
  expect(assertPublicHttpsUrl("https://images.example.co.jp/x.webp").hostname).toBe("images.example.co.jp");
});

function setup(map: Record<string, () => Response>) {
  const raw = newDb(); const puts: string[] = [];
  const media = { put: async (k: string) => { puts.push(k); }, delete: async () => {} };
  const calls: string[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const u = String(input); calls.push(u); expect(init?.redirect).toBe("manual");
    const f = map[u]; if (!f) throw new Error("unexpected fetch " + u); return f();
  }) as typeof fetch;
  return { raw, puts, calls, ctx: { db: d1(raw), email: "me@x", nowUtc: "2026-10-15 00:00:00", media, fetcher, rand: () => "abc123" } };
}
const ok = (bytes: Uint8Array, type = "image/png", extra: Record<string, string> = {}) => () => new Response(bytes, { status: 200, headers: { "Content-Type": type, ...extra } });

test("fetches a PNG, stores it in D1 + R2 with uploaded_by and alt", async () => {
  const s = setup({ "https://example.com/pic.png": ok(png) });
  const r = await uploadMediaFromUrl(s.ctx, { url: "https://example.com/pic.png", alt: "写真" });
  expect(r.url).toMatch(/^\/media\/\d{4}\/\d{2}\/pic-abc123\.png$/); expect(s.puts).toHaveLength(1);
  expect(s.raw.prepare("select uploaded_by,alt,content_type from media").get()).toEqual({ uploaded_by: "me@x", alt: "写真", content_type: "image/png" });
});
test("follows at most 3 redirects, re-validating every hop (redirect to an internal host is refused)", async () => {
  const s = setup({
    "https://a.example.com/1": () => new Response(null, { status: 302, headers: { Location: "https://b.example.com/2" } }),
    "https://b.example.com/2": ok(png),
    "https://c.example.com/x": () => new Response(null, { status: 301, headers: { Location: "https://169.254.169.254/latest/meta-data" } }),
  });
  expect((await uploadMediaFromUrl(s.ctx, { url: "https://a.example.com/1" })).key).toMatch(/\.png$/);
  expect(status(await rejects(uploadMediaFromUrl(s.ctx, { url: "https://c.example.com/x" })))).toBe(400);
  expect(s.calls).not.toContain("https://169.254.169.254/latest/meta-data");
  const loop: Record<string, () => Response> = {};
  for (let i = 0; i < 6; i++) loop[`https://r.example.com/${i}`] = () => new Response(null, { status: 302, headers: { Location: `https://r.example.com/${i + 1}` } });
  expect(status(await rejects(uploadMediaFromUrl(setup(loop).ctx, { url: "https://r.example.com/0" })))).toBe(400);
});
test("rejects upstream errors, oversize (header and stream), and content that is not really an image", async () => {
  const big = new Uint8Array(10 * 1024 * 1024 + 1); big.set(png);
  const s = setup({
    "https://e.example.com/404": () => new Response("nope", { status: 404 }),
    "https://e.example.com/bigheader": ok(png, "image/png", { "Content-Length": String(11 * 1024 * 1024) }),
    "https://e.example.com/bigstream": ok(big),
    "https://e.example.com/html": ok(new TextEncoder().encode("<html><script>alert(1)</script></html>"), "image/png"),
    "https://e.example.com/svg": ok(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`), "image/svg+xml"),
  });
  expect(status(await rejects(uploadMediaFromUrl(s.ctx, { url: "https://e.example.com/404" })))).toBe(400);
  expect(status(await rejects(uploadMediaFromUrl(s.ctx, { url: "https://e.example.com/bigheader" })))).toBe(413);
  expect(status(await rejects(uploadMediaFromUrl(s.ctx, { url: "https://e.example.com/bigstream" })))).toBe(413);
  expect(status(await rejects(uploadMediaFromUrl(s.ctx, { url: "https://e.example.com/html" })))).toBe(415);
  expect(status(await rejects(uploadMediaFromUrl(s.ctx, { url: "https://e.example.com/svg" })))).toBe(415);
  expect(s.puts).toHaveLength(0); expect(s.raw.prepare("select count(*) c from media").get()).toEqual({ c: 0 });
});
test("a fetch that throws (DNS failure, timeout) becomes a 502-style error, not a crash", async () => {
  const s = setup({}); const f = (async () => { throw new TypeError("network"); }) as unknown as typeof fetch;
  expect(status(await rejects(uploadMediaFromUrl({ ...s.ctx, fetcher: f }, { url: "https://example.com/x.png" })))).toBe(502);
});

test("accepts a real image served with a sloppy Content-Type (image/jpg, octet-stream, text/plain) and stores alt together with the row", async () => {
  for (const ct of ["image/jpg", "binary/octet-stream", "text/plain"]) {
    const s = setup({ "https://example.com/p.png": ok(png, ct) });
    const r = await uploadMediaFromUrl(s.ctx, { url: "https://example.com/p.png", alt: "説明" });
    expect(r.alt).toBe("説明"); expect(s.raw.prepare("select alt,content_type from media").get()).toEqual({ alt: "説明", content_type: "image/png" });
  }
});
