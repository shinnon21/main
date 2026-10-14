import { expect, test } from "vitest";
import { mediaKey, originalsOnly } from "../scripts/lib/media.ts";
test("mediaKey rejects traversal", () => {
  expect(mediaKey("2026/07/a.webp")).toBe("2026/07/a.webp");
  expect(() => mediaKey("../etc/passwd")).toThrow();
  expect(() => mediaKey("/abs.png")).toThrow();
});
test("originalsOnly drops resized variants", () => {
  expect(originalsOnly(["a.jpg", "a-300x200.jpg", "b-1x1-final.png"])).toEqual(["a.jpg", "b-1x1-final.png"]);
});

import { sniffContentType } from "../scripts/lib/media.ts";
test("sniffContentType trusts bytes over the WP mime, falls back to extension", () => {
  expect(sniffContentType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]), "a.png")).toBe("image/jpeg");
  expect(sniffContentType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "a.jpg")).toBe("image/png");
  expect(sniffContentType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "), "a.bin")).toBe("image/webp");
  expect(sniffContentType(new TextEncoder().encode("GIF89a"), "a.bin")).toBe("image/gif");
  expect(sniffContentType(new TextEncoder().encode("%PDF-1.7"), "a.bin")).toBe("application/pdf");
  expect(sniffContentType(new TextEncoder().encode("hello"), "x.svg")).toBe("image/svg+xml");
  expect(sniffContentType(new TextEncoder().encode("hello"), "x.unknown")).toBe("application/octet-stream");
});
