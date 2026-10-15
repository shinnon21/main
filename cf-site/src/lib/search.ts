import type { D1Like } from "./d1.ts";
import { toJst } from "./format.ts";
import type { Lang } from "./i18n.ts";
import { POST_COLS, decorate, type CardPost } from "./queries.ts";
import type { PostRow } from "./posts.ts";

export const SEARCH_PER_PAGE = 10;
const TYPES = ["works", "column", "news"] as const;
const CTRL = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f]", "g");
const YM = /^\d{4}-(?:0[1-9]|1[0-2])$/;

export interface SearchParams { kw: string; from: string; to: string; types: string[]; skills: string[]; sort: "date" | "modified"; page: number; did: boolean }

export function parseSearchParams(sp: URLSearchParams): SearchParams {
  const kw = (sp.get("kw") ?? sp.get("s") ?? "").replace(CTRL, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  const ym = (k: string) => { const v = (sp.get(k) ?? "").trim(); return YM.test(v) ? v : ""; };
  const many = (k: string) => [...sp.getAll(`${k}[]`), ...sp.getAll(k)].map((v) => v.trim()).filter(Boolean);
  const types = [...new Set(many("types").filter((t): t is (typeof TYPES)[number] => (TYPES as readonly string[]).includes(t)))];
  const skills = [...new Set(many("skills").filter((s) => s.length <= 200))].slice(0, 30);
  const n = Number.parseInt(sp.get("page") ?? "1", 10);
  return {
    kw, from: ym("from"), to: ym("to"), types, skills,
    sort: sp.get("sort") === "modified" ? "modified" : "date",
    page: Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 1,
    did: ["kw", "from", "to", "types[]", "types", "skills[]", "skills"].some((k) => sp.has(k)),
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`;
/** JST の月初 00:00 を UTC 文字列で返す */
export function monthStartUtc(ym: string): string { const [y, m] = ym.split("-").map(Number); return fmt(new Date(Date.UTC(y, m - 1, 1) - 9 * 3600_000)); }
/** 翌月の月初（JST 00:00 の UTC）。範囲の終端（排他的） */
export function nextMonthStartUtc(ym: string): string { const [y, m] = ym.split("-").map(Number); return fmt(new Date(Date.UTC(y, m, 1) - 9 * 3600_000)); }
/** 現在（JST）の月から遡った 'YYYY-MM' の一覧（月末の日付繰り上がりで重複・欠落しないよう年月で計算） */
export function monthOptions(now: Date, count: number): string[] {
  const j = toJst(now.toISOString()); let y = j.getUTCFullYear(), m = j.getUTCMonth() + 1;
  const out: string[] = [];
  for (let i = 0; i < count; i++) { out.push(`${y}-${p2(m)}`); m--; if (m === 0) { m = 12; y--; } }
  return out;
}

const like = (s: string) => `%${s.replace(/[\\%_]/g, "\\$&")}%`;
const FIELDS = ["p.title", "p.excerpt", "p.content", "p.title_en", "p.excerpt_en", "p.content_en"];

export async function searchPosts(db: D1Like, p: SearchParams, _lang: Lang): Promise<{ posts: CardPost[]; total: number; pages: number }> {
  const where: string[] = ["p.status='publish'"]; const args: unknown[] = [];
  const types = p.types.length ? p.types : [...TYPES];
  where.push(`p.type IN (${types.map(() => "?").join(",")})`); args.push(...types);
  for (const term of p.kw.replace(CTRL, " ").split(" ").filter(Boolean).slice(0, 5)) {
    where.push(`(${FIELDS.map((f) => `${f} LIKE ? ESCAPE '\\'`).join(" OR ")})`); args.push(...FIELDS.map(() => like(term)));
  }
  if (p.skills.length) {
    where.push(`EXISTS (SELECT 1 FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=p.id AND t.taxonomy='skill' AND t.slug IN (${p.skills.map(() => "?").join(",")}))`); args.push(...p.skills);
  }
  if (p.from) { where.push("p.published_at >= ?"); args.push(monthStartUtc(p.from)); }
  if (p.to) { where.push("p.published_at < ?"); args.push(nextMonthStartUtc(p.to)); }
  const w = where.join(" AND ");
  const total = (await db.prepare(`SELECT COUNT(*) c FROM posts p WHERE ${w}`).bind(...args).first<{ c: number }>())?.c ?? 0;
  const order = p.sort === "modified" ? "p.modified_at DESC" : "p.published_at DESC";
  const rows = (await db.prepare(`SELECT ${POST_COLS} FROM posts p WHERE ${w} ORDER BY ${order}, p.wp_id ASC LIMIT ? OFFSET ?`).bind(...args, SEARCH_PER_PAGE, (p.page - 1) * SEARCH_PER_PAGE).all<PostRow>()).results;
  return { posts: await decorate(db, rows), total, pages: Math.max(1, Math.ceil(total / SEARCH_PER_PAGE)) };
}
