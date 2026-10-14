import { expect, test } from "vitest";
import { SNS } from "../src/lib/sns.ts";
test("SNS list mirrors kb_sns_accounts with inline SVG", () => {
  expect(SNS.map((s) => s.key)).toEqual(["linkedin", "facebook", "x", "instagram", "note"]);
  expect(SNS.find((s) => s.key === "x")!.url).toBe("https://x.com/snnnuke");
  for (const s of SNS) { expect(s.svg).toMatch(/^<svg[\s\S]*<path[\s\S]*<\/svg>$/); expect(s.url).toMatch(/^https:\/\//); }
});
