import { expect, test } from "vitest";
import { validateSlug, defaultSlug, jstLocalToUtc, utcToJstLocal, cleanPostInput } from "../src/admin/validate.ts";
import { HttpError } from "../src/admin/types.ts";

test("validateSlug", () => {
  for (const ok of ["a", "weeave-founded", "日本語-slug", "a".repeat(200)]) expect(validateSlug(ok), ok).toBeNull();
  for (const ng of ["", " ", "a b", "a/b", "a?b", "a#b", "a%20b", "a".repeat(201), "new", "page", "admin"]) expect(validateSlug(ng), ng).not.toBeNull();
});
test("defaultSlug is deterministic and valid", () => {
  const s = defaultSlug(1_800_000_000_000); expect(s).toMatch(/^post-[0-9a-z]+$/); expect(validateSlug(s)).toBeNull();
});
test("JST<->UTC conversion", () => {
  expect(jstLocalToUtc("2026-07-05T00:21")).toBe("2026-07-04 15:21:00");
  expect(utcToJstLocal("2026-07-04 15:21:55")).toBe("2026-07-05T00:21");
  expect(() => jstLocalToUtc("2026-13-40T99:99")).toThrow(HttpError);
  expect(() => jstLocalToUtc("garbage")).toThrow(HttpError);
});
const base = { type: "works", title: "T", title_en: "", slug: "s", status: "draft", published_at: null, excerpt: "", excerpt_en: "", content: "<p>x</p>", content_en: "", thumbnail: null, meta: {}, terms: [] };
test("cleanPostInput sanitizes content, filters meta keys and normalizes values", () => {
  const c = cleanPostInput({ ...base, content: '<p onclick="x">a</p><script>1</script>', meta: { client_name: "C", scope: "運用", is_featured: true, kpi_results: [{ label: "L", value: "V" }, { label: "", value: "" }], evil_key: "x", ssp_meta_title: "S" }, terms: [{ taxonomy: "works_type", slug: "web" }, { taxonomy: "skill", slug: "seo" }] });
  expect(c.content).toBe("<p>a</p>");
  expect(c.meta).toEqual({ client_name: "C", scope: ["運用"], is_featured: "1", kpi_results: [{ label: "L", value: "V" }], ssp_meta_title: "S" });
});
test("cleanPostInput rejects bad type/status/title/terms/lengths", () => {
  for (const bad of [{ type: "post" }, { status: "x" }, { title: "" }, { title: "a".repeat(501) }, { terms: [{ taxonomy: "skill", slug: "x" }], type: "news" }, { terms: "x" }, { meta: [] }, { content: "a".repeat(2_000_001) }, { meta: { site_url: "javascript:alert(1)" } }, { thumbnail: "../etc/passwd" }])
    expect(() => cleanPostInput({ ...base, ...bad }), JSON.stringify(bad).slice(0, 40)).toThrow(HttpError);
  expect(() => cleanPostInput(null)).toThrow(HttpError);
});
test("cleanPostInput: slug auto-filled when empty; published_at converted; type-specific meta only", () => {
  const c = cleanPostInput({ ...base, slug: "", published_at: "2026-07-05T00:21", status: "publish" });
  expect(c.slug).toMatch(/^post-/); expect(c.published_at).toBe("2026-07-04 15:21:00");
  const col = cleanPostInput({ ...base, type: "column", meta: { client_name: "x", media_youtube: "y", ssp_meta_title: "t" } });
  expect(col.meta).toEqual({ ssp_meta_title: "t" });
  const news = cleanPostInput({ ...base, type: "news", meta: { media_youtube: "dQw4w9WgXcQ", client_name: "x" }, terms: [{ taxonomy: "news_type", slug: "x" }] });
  expect(news.meta).toEqual({ media_youtube: "dQw4w9WgXcQ" });
});
