import { expect, test } from "vitest";
import { readFileSync, existsSync } from "node:fs";
const root = new URL("../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");

test("design tokens are unchanged", () => {
  const css = read("cf-site/src/styles/global.css");
  for (const tok of ["--crimson:#C22740", "--crimson-dark:#A61F35", "--deep:#84192A", "--tint:#F6D8DD", "--tint-light:#FBECEE", "--bg:#FDF9F9", "--ink:#1A1A1A", "--gray:#5C5C5C", "--line:#E6DCDE"]) expect(css).toContain(tok);
});
// main.js はWPテーマ廃止後（2026-10）このサイトで保守する。移行時の完全一致確認は外し、主要機能の存在だけ確認する
test("main.js keeps its core behaviours and the brand images exist", () => {
  const js = read("cf-site/public/assets/main.js");
  for (const feature of ["IntersectionObserver", "kbTicker", "heroNet"]) expect(js, feature).toContain(feature);
  for (const f of ["logo-horizontal.svg", "logo-mark.png", "favicon-32.png", "favicon-192.png", "apple-touch-icon.png", "kobayashi-hero.webp", "og-default.png", "kb-avatar-face.jpg"])
    expect(existsSync(new URL(`cf-site/public/assets/img/${f}`, root)), f).toBe(true);
});
