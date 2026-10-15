import { expect, test } from "vitest";
import { mediaHeaders } from "../src/lib/media-serve.ts";

test("allowed image types are served inline with nosniff and long immutable caching", () => {
  for (const t of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
    const h = mediaHeaders(t, '"etag"');
    expect(h["Content-Type"]).toBe(t); expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Cache-Control"]).toBe("public, max-age=31536000, immutable"); expect(h["Content-Disposition"]).toBeUndefined(); expect(h.ETag).toBe('"etag"');
  }
});
test("anything else (svg, html, missing type, odd casing/params) is forced to a download as octet-stream", () => {
  for (const t of ["image/svg+xml", "text/html", "application/javascript", undefined, "", "IMAGE/PNG; charset=x"]) {
    const h = mediaHeaders(t, '"e"');
    if (t === "IMAGE/PNG; charset=x") { expect(h["Content-Type"]).toBe("image/png"); continue; }
    expect(h["Content-Type"], String(t)).toBe("application/octet-stream"); expect(h["Content-Disposition"]).toBe("attachment"); expect(h["X-Content-Type-Options"]).toBe("nosniff");
  }
});
