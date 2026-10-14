import type { WpExport } from "../../scripts/lib/types.ts";

const base = { excerpt: "", content: "", date: "2026-07-01T00:00:00", modified: "2026-07-02T00:00:00", menu_order: 0, password_protected: false, views: 0, meta: {}, terms: [], thumbnail_id: null as number | null };

export const exp: WpExport = {
  exported_at: "2026-10-14T00:00:00+00:00",
  site_url: "https://shinnosuke-kobayashi.jp",
  posts: [
    { ...base, id: 10, type: "works", slug: "site-a", status: "publish",
      title: "O'Brien \"Q\" \\ 😀\n2行目",
      content: `<img src="https://shinnosuke-kobayashi.jp/wp-content/uploads/2026/07/a-300x200.jpg">`,
      thumbnail_id: 100, views: 12,
      meta: { gallery: [1, 2], kpi_results: [{ label: "CV", value: "1.5倍" }], title_en: "EN", content_en: "", _edit_lock: "x" },
      terms: [{ taxonomy: "works_type", slug: "web" }, { taxonomy: "skill", slug: "seo" }] },
    { ...base, id: 11, type: "works", slug: "site-b", status: "publish", title: "B", thumbnail_id: 999, date: "2026-06-01T00:00:00" },
    { ...base, id: 12, type: "column", slug: "draft-col", status: "draft", title: "Draft" },
    { ...base, id: 13, type: "news", slug: "secret", status: "publish", title: "Secret", password_protected: true },
    { ...base, id: 14, type: "page", slug: "profile", status: "publish", title: "Profile", meta: { profile_name: "小林慎之助" } },
  ],
  terms: [
    { taxonomy: "works_type", slug: "web", name: "Web", description: "" },
    { taxonomy: "skill", slug: "seo", name: "SEO", description: "" },
  ],
  attachments: [{ id: 100, path: "2026/07/a.jpg", mime: "image/jpeg" }],
  options: { blogname: "小林慎之助 公式ホームページ" },
};
