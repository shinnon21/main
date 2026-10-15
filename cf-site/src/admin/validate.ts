import { sanitizeHtml } from "../lib/sanitize.ts";
import { HttpError, type CleanPost, type PostStatus, type PostType } from "./types.ts";

const bad = (m: string): never => { throw new HttpError(400, m); };
const RESERVED = new Set(["new", "page", "admin"]);

export function validateSlug(slug: string): string | null {
  if (typeof slug !== "string" || slug.length < 1) return "slug is required";
  if (slug.length > 200) return "slug is too long";
  if (/[\s/?#%]/.test(slug)) return "slug contains forbidden characters";
  if (/^\.+$/.test(slug)) return "slug cannot consist only of dots";
  if (RESERVED.has(slug)) return "slug is reserved";
  return null;
}
export const defaultSlug = (nowMs: number) => `post-${nowMs.toString(36)}`;

const p2 = (n: number) => String(n).padStart(2, "0");
export function jstLocalToUtc(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(s);
  if (!m) return bad("invalid datetime");
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const asJst = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (asJst.getUTCFullYear() !== y || asJst.getUTCMonth() !== mo - 1 || asJst.getUTCDate() !== d || asJst.getUTCHours() !== h || asJst.getUTCMinutes() !== mi) return bad("invalid datetime");
  const u = new Date(asJst.getTime() - 9 * 3600_000);
  return `${u.getUTCFullYear()}-${p2(u.getUTCMonth() + 1)}-${p2(u.getUTCDate())} ${p2(u.getUTCHours())}:${p2(u.getUTCMinutes())}:00`;
}
export function utcToJstLocal(s: string): string {
  const d = new Date(new Date(s.replace(" ", "T") + "Z").getTime() + 9 * 3600_000);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`;
}

const TYPES: PostType[] = ["works", "column", "news", "page"];
const STATUSES: PostStatus[] = ["draft", "publish", "trash"];
const TAXONOMIES: Record<PostType, string[]> = { works: ["works_type", "industry", "skill"], column: ["skill"], news: ["news_type"], page: [] };
const STRING_META: Record<PostType, string[]> = {
  works: ["client_name", "client_name_en", "period_start", "period_end", "role", "role_en", "tech_stack", "tech_stack_en", "site_url"],
  news: ["media_youtube", "media_spotify"], column: [], page: [],
};
const SSP = ["ssp_meta_title", "ssp_meta_description", "ssp_meta_image"];

const str = (v: unknown, name: string, max: number, required = false): string => {
  if (v === undefined || v === null) v = "";
  if (typeof v !== "string") return bad(`${name} must be a string`);
  const t = v.trim();
  if (required && !t) return bad(`${name} is required`);
  if (t.length > max) return bad(`${name} is too long`);
  return t;
};
const kpis = (v: unknown, name: string) => {
  if (!Array.isArray(v)) return bad(`${name} must be an array`);
  if (v.length > 20) return bad(`${name} has too many rows`);
  return v.map((r) => ({ label: str((r as any)?.label, "kpi label", 200), value: str((r as any)?.value, "kpi value", 200) })).filter((r) => r.label || r.value);
};

export function cleanPostInput(raw: unknown): CleanPost {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return bad("invalid body");
  const r = raw as Record<string, unknown>;
  if (!TYPES.includes(r.type as PostType)) return bad("invalid type");
  const type = r.type as PostType;
  if (!STATUSES.includes(r.status as PostStatus)) return bad("invalid status");
  const slugRaw = str(r.slug, "slug", 400);
  const slug = slugRaw || defaultSlug(Date.now());
  const slugErr = validateSlug(slug);
  if (slugErr) return bad(slugErr);
  const pub = r.published_at === null || r.published_at === undefined || r.published_at === "" ? null : jstLocalToUtc(String(r.published_at));
  const thumbnail = str(r.thumbnail, "thumbnail", 500);
  if (thumbnail && (thumbnail.startsWith("/") || thumbnail.split("/").includes("..") || thumbnail.includes("\0"))) return bad("invalid thumbnail");

  if (!r.meta || typeof r.meta !== "object" || Array.isArray(r.meta)) return bad("meta must be an object");
  const m = r.meta as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  for (const k of [...STRING_META[type], ...SSP]) {
    const v = str(m[k], k, 2000);
    if (!v) continue;
    if (k === "site_url" && !/^https?:\/\//i.test(v)) return bad("site_url must be http(s)");
    if (k === "ssp_meta_image" && !/^(https?:\/\/|\/)/i.test(v)) return bad("ssp_meta_image must be http(s) or /path");
    meta[k] = v;
  }
  if (type === "works") {
    if (m.scope !== undefined && m.scope !== null && m.scope !== "") {
      const arr = Array.isArray(m.scope) ? m.scope : [m.scope];
      if (arr.length > 30) return bad("scope has too many items");
      const sc = arr.map((x) => str(x, "scope", 50)).filter(Boolean);
      if (sc.length) meta.scope = sc;
    }
    if (m.is_featured !== undefined && m.is_featured !== null && m.is_featured !== "") meta.is_featured = [true, 1, "1", "true"].includes(m.is_featured as never) ? "1" : "0";
    for (const k of ["kpi_results", "kpi_results_en"]) if (m[k] !== undefined && m[k] !== null) { const rows = kpis(m[k], k); if (rows.length) meta[k] = rows; }
  }

  if (!Array.isArray(r.terms)) return bad("terms must be an array");
  const terms = r.terms.map((t) => {
    const taxonomy = str((t as any)?.taxonomy, "taxonomy", 40, true), s = str((t as any)?.slug, "term slug", 200, true);
    if (!TAXONOMIES[type].includes(taxonomy)) return bad(`taxonomy ${taxonomy} is not allowed for ${type}`);
    return { taxonomy, slug: s };
  });

  return {
    type, title: str(r.title, "title", 500, true), title_en: str(r.title_en, "title_en", 500), slug, status: r.status as PostStatus, published_at: pub,
    excerpt: str(r.excerpt, "excerpt", 2000), excerpt_en: str(r.excerpt_en, "excerpt_en", 2000),
    content: sanitizeHtml(str(r.content, "content", 2_000_000)), content_en: sanitizeHtml(str(r.content_en, "content_en", 2_000_000)),
    thumbnail: thumbnail || null, meta, terms,
    expected_modified_at: typeof r.expected_modified_at === "string" ? r.expected_modified_at : undefined,
  };
}

/** 管理画面が編集するメタキー（これら以外のメタ＝profile_* や kb_views などは更新時に触れない） */
export const editableMetaKeys = (type: PostType): string[] =>
  type === "works" ? [...STRING_META.works, ...SSP, "scope", "is_featured", "kpi_results", "kpi_results_en"] : [...STRING_META[type], ...SSP];
export const allowedTaxonomies = (type: PostType): string[] => TAXONOMIES[type];
