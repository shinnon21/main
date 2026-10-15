import type { D1Like } from "./d1.ts";
import type { PostRow } from "./posts.ts";
import type { Lang } from "./i18n.ts";

export interface TermRef { taxonomy: string; slug: string; name: string }
export interface CardPost extends PostRow { terms: TermRef[]; meta: { period_start?: string; period_end?: string } }
export const PER_PAGE = { works: 12, column: 10, news: 15 } as const;
export const TAX_PER_PAGE = { works_type: 12, skill: 10, industry: 10, news_type: 10 } as const;
export const isListType = (t: string): t is keyof typeof PER_PAGE => Object.hasOwn(PER_PAGE, t);
export const isTaxonomy = (t: string): t is keyof typeof TAX_PER_PAGE => Object.hasOwn(TAX_PER_PAGE, t);

const COLS = "p.id,p.wp_id,p.type,p.slug,p.title,p.title_en,p.excerpt,p.excerpt_en,p.content,p.content_en,p.thumbnail,p.published_at,p.modified_at";
const ph = (n: number) => Array(n).fill("?").join(",");

async function rows<T>(db: D1Like, sql: string, ...args: unknown[]): Promise<T[]> {
  return (await db.prepare(sql).bind(...args).all<T>()).results;
}
const one = async <T>(db: D1Like, sql: string, ...args: unknown[]) => db.prepare(sql).bind(...args).first<T>();
const parse = (v: string) => { try { const x = JSON.parse(v); return typeof x === "string" ? x : String(x ?? ""); } catch { return ""; } };

async function decorate(db: D1Like, posts: PostRow[]): Promise<CardPost[]> {
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const terms = await rows<TermRef & { post_id: number }>(db,
    `SELECT pt.post_id, t.taxonomy, t.slug, t.name FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id IN (${ph(ids.length)}) ORDER BY t.id`, ...ids);
  const metas = await rows<{ post_id: number; key: string; value: string }>(db,
    `SELECT post_id,key,value FROM post_meta WHERE post_id IN (${ph(ids.length)}) AND key IN ('period_start','period_end')`, ...ids);
  return posts.map((p) => ({
    ...p,
    terms: terms.filter((t) => t.post_id === p.id).map(({ taxonomy, slug, name }) => ({ taxonomy, slug, name })),
    meta: Object.fromEntries(metas.filter((m) => m.post_id === p.id).map((m) => [m.key, parse(m.value)])),
  }));
}

export async function listPage(db: D1Like, type: string, page: number) {
  const per = isListType(type) ? PER_PAGE[type] : 12;
  const total = (await one<{ c: number }>(db, "SELECT COUNT(*) c FROM posts p WHERE p.type=? AND p.status='publish'", type))?.c ?? 0;
  const posts = await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p WHERE p.type=? AND p.status='publish' ORDER BY p.published_at DESC, p.wp_id ASC LIMIT ? OFFSET ?`, type, per, (Math.max(1, page) - 1) * per);
  return { posts: await decorate(db, posts), total, pages: Math.max(1, Math.ceil(total / per)) };
}

export async function latest(db: D1Like, type: string, n: number): Promise<CardPost[]> {
  return decorate(db, await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p WHERE p.type=? AND p.status='publish' ORDER BY p.published_at DESC, p.wp_id ASC LIMIT ?`, type, n));
}

export async function featuredWorks(db: D1Like, n = 4): Promise<CardPost[]> {
  const flagged = await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p JOIN post_meta m ON m.post_id=p.id AND m.key='is_featured'
     WHERE p.type='works' AND p.status='publish' AND m.value IN ('"1"','1','true') ORDER BY p.published_at DESC, p.id DESC LIMIT ?`, n);
  return flagged.length ? decorate(db, flagged) : latest(db, "works", n);
}

export async function topSkills(db: D1Like, n: number): Promise<TermRef[]> {
  return rows<TermRef>(db,
    `SELECT t.taxonomy,t.slug,t.name FROM terms t JOIN post_terms pt ON pt.term_id=t.id JOIN posts p ON p.id=pt.post_id AND p.status='publish'
     WHERE t.taxonomy='skill' GROUP BY t.id ORDER BY COUNT(*) DESC, t.id LIMIT ?`, n);
}
export async function allSkills(db: D1Like): Promise<TermRef[]> {
  const key = (s: string) => s.toLowerCase().replace(/ー/g, "");
  return (await topSkills(db, 1000)).sort((a, b) => (key(a.name) < key(b.name) ? -1 : key(a.name) > key(b.name) ? 1 : 0));
}

export async function ranking(db: D1Like, n = 5): Promise<CardPost[]> {
  return decorate(db, await rows<PostRow>(db,
    `SELECT ${COLS} FROM posts p JOIN views v ON v.post_id=p.id WHERE p.type IN ('works','column') AND p.status='publish' ORDER BY v.count DESC, p.id LIMIT ?`, n));
}

export async function relatedByTerm(db: D1Like, post: { id: number; type: string }, taxonomy: string, n = 3): Promise<CardPost[]> {
  return decorate(db, await rows<PostRow>(db,
    `SELECT DISTINCT ${COLS} FROM posts p JOIN post_terms pt ON pt.post_id=p.id JOIN terms t ON t.id=pt.term_id
     WHERE p.type=? AND p.status='publish' AND p.id<>? AND t.taxonomy=?
       AND t.id IN (SELECT pt2.term_id FROM post_terms pt2 JOIN terms t2 ON t2.id=pt2.term_id WHERE pt2.post_id=? AND t2.taxonomy=?)
     ORDER BY p.published_at DESC LIMIT ?`, post.type, post.id, taxonomy, post.id, taxonomy, n));
}

export const termBySlug = (db: D1Like, taxonomy: string, slug: string) =>
  one<TermRef>(db, "SELECT taxonomy,slug,name FROM terms WHERE taxonomy=? AND slug=?", taxonomy, slug);

export async function listByTerm(db: D1Like, taxonomy: string, slug: string, page: number, perPage: number) {
  const from = `FROM posts p JOIN post_terms pt ON pt.post_id=p.id JOIN terms t ON t.id=pt.term_id WHERE t.taxonomy=? AND t.slug=? AND p.status='publish'`;
  const total = (await one<{ c: number }>(db, `SELECT COUNT(*) c ${from}`, taxonomy, slug))?.c ?? 0;
  const posts = await rows<PostRow>(db, `SELECT ${COLS} ${from} ORDER BY p.published_at DESC, p.wp_id ASC LIMIT ? OFFSET ?`, taxonomy, slug, perPage, (Math.max(1, page) - 1) * perPage);
  return { posts: await decorate(db, posts), total, pages: Math.max(1, Math.ceil(total / perPage)) };
}

export const postTerms = (db: D1Like, postId: number) =>
  rows<TermRef>(db, "SELECT t.taxonomy,t.slug,t.name FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=? ORDER BY t.id", postId);

const PROFILE_DEFAULTS = {
  kana: "こばやし しんのすけ",
  name: "小林 慎之助",
  role: "Weeave株式会社 共同創業者・代表取締役 CEO ／ 筑波大学 理工学群 社会工学類 経営工学主専攻",
};
export async function profileSummary(db: D1Like, lang: Lang = "ja") {
  const p = await one<{ id: number; thumbnail: string | null }>(db, "SELECT id,thumbnail FROM posts WHERE type='page' AND slug='profile' AND status='publish'");
  const m = p ? await rows<{ key: string; value: string }>(db, "SELECT key,value FROM post_meta WHERE post_id=? AND key LIKE 'profile\\_%' ESCAPE '\\'", p.id) : [];
  const f = fieldGetter(m, lang);
  return { kana: f("profile_kana") || PROFILE_DEFAULTS.kana, name: f("profile_name") || PROFILE_DEFAULTS.name, role: f("profile_role") || PROFILE_DEFAULTS.role, avatar: p?.thumbnail ?? null };
}

function fieldGetter(m: { key: string; value: string }[], lang: Lang) {
  const raw = (k: string) => parse(m.find((x) => x.key === k)?.value ?? '""').trim();
  return (k: string) => (lang === "en" ? raw(k + "_en") : "") || raw(k);
}

export async function profileFull(db: D1Like, lang: Lang = "ja") {
  const p = await one<{ id: number; thumbnail: string | null; content: string | null }>(db, "SELECT id,thumbnail,content FROM posts WHERE type='page' AND slug='profile' AND status='publish'");
  const m = p ? await rows<{ key: string; value: string }>(db, "SELECT key,value FROM post_meta WHERE post_id=? AND key LIKE 'profile\\_%' ESCAPE '\\'", p.id) : [];
  const f = fieldGetter(m, lang);
  return {
    kana: f("profile_kana") || PROFILE_DEFAULTS.kana,
    name: f("profile_name") || PROFILE_DEFAULTS.name,
    role: f("profile_role") || PROFILE_DEFAULTS.role,
    bio: f("profile_bio"), career: f("profile_career"), skills: f("profile_skills"),
    researchTitle: f("profile_research_title"), researchBody: f("profile_research_body"), activities: f("profile_activities"),
    content: p?.content?.trim() ?? "", avatar: p?.thumbnail ?? null,
  };
}

export async function loadTermPage(db: D1Like, taxonomy: string, slug: string, page: number) {
  if (!isTaxonomy(taxonomy) || !Number.isInteger(page) || page < 1) return null;
  const term = await termBySlug(db, taxonomy, slug);
  if (!term) return null;
  const data = await listByTerm(db, taxonomy, term.slug, page, TAX_PER_PAGE[taxonomy]);
  return page > data.pages ? null : { term, data };
}
