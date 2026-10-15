import { expect, test } from "vitest";
import { sanitizeHtml as s } from "../src/lib/sanitize.ts";

const bad: [string, RegExp][] = [
  ['<img src=x onerror="alert(1)">', /onerror/i],
  ['<a href="javascript:alert(1)">x</a>', /javascript/i],
  ['<a href="JaVa\tScRiPt:alert(1)">x</a>', /script:/i],
  ['<a href=" javascript:alert(1)">x</a>', /javascript/i],
  ['<a href="data:text/html,<script>alert(1)</script>">x</a>', /data:/i],
  ['<svg onload=alert(1)><path/></svg>', /<svg|onload/i],
  ['<iframe src="https://evil.example/x"></iframe>', /evil/],
  ['<script>alert(1)</script>ok', /script|alert/i],
  ['<style>body{display:none}</style>ok', /style|display/i],
  ['<!-- <script>alert(1)</script> -->ok', /script/i],
  ['<math><mi xlink:href="javascript:alert(1)">x</mi></math>', /javascript|<math/i],
  ['<p onclick="x()">t</p>', /onclick/i],
  ['<img src="javascript:alert(1)">', /javascript/i],
];
test.each(bad)("strips dangerous markup: %s", (input, forbidden) => { expect(s(input)).not.toMatch(forbidden); });

test("keeps the formatting the site actually uses", () => {
  const html = '<h2>概要</h2><p>本文 <strong>太字</strong> <a href="https://example.com/x" target="_blank" rel="noopener">リンク</a></p><ul><li>a</li></ul><img src="/media/2026/07/a.jpg" alt="x" class="wp-image-71"><blockquote><p>q</p></blockquote>';
  expect(s(html)).toBe(html);
});
test("target=_blank always gets rel=noopener", () => {
  expect(s('<a href="https://e.com" target="_blank">x</a>')).toContain('rel="noopener"');
});
test("allows only YouTube/Spotify embeds in iframes", () => {
  const yt = '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="YouTube" allowfullscreen></iframe>';
  expect(s(yt)).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  expect(s('<iframe src="https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk"></iframe>')).toContain("open.spotify.com/embed/");
  expect(s('<iframe src="https://www.youtube.com/embed/x"></iframe>')).not.toContain("iframe");
});
test("relative, anchor and mailto links survive", () => {
  expect(s('<a href="/profile/">p</a><a href="#top">t</a><a href="mailto:a@b.co">m</a>')).toBe('<a href="/profile/">p</a><a href="#top">t</a><a href="mailto:a@b.co">m</a>');
});
test("empty and non-string input are safe", () => { expect(s("")).toBe(""); expect(s(undefined as unknown as string)).toBe(""); });

test("empty alt stays a valid empty-alt image (serialized as boolean attribute)", () => {
  expect(s('<img src="/media/a.jpg" alt="">')).toMatch(/^<img src="\/media\/a\.jpg" alt>$/);
});

test("style attribute: only harmless sizing/alignment properties survive", () => {
  expect(s('<img src="/media/a.jpg" alt="x" style="width:840px;height:auto">')).toMatch(/style="width:\s*840px;\s*height:\s*auto;?"/);
  expect(s('<p style="text-align:center">c</p>')).toMatch(/text-align:\s*center/);
  for (const evil of ['<p style="background:url(javascript:alert(1))">x</p>', '<p style="position:fixed;top:0;left:0;width:100%;height:100%">x</p>', '<p style="width:expression(alert(1))">x</p>', '<p style="behavior:url(x.htc)">x</p>'])
    expect(s(evil), evil).not.toMatch(/javascript|position|expression|behavior|url\(/i);
});
