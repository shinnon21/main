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
