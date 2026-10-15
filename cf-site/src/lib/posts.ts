import type { D1Like } from "./d1.ts";

export interface PostRow {
  excerpt_en: string | null;
  id: number; wp_id: number; type: string; slug: string; title: string; title_en: string | null; excerpt: string | null; modified_at: string;
  content: string | null; content_en: string | null; thumbnail: string | null; published_at: string;
}

const COLS = "id,wp_id,type,slug,title,title_en,excerpt,excerpt_en,content,content_en,thumbnail,published_at,modified_at";

export async function listPosts(db: D1Like, type: string, limit = 50): Promise<PostRow[]> {
  const { results } = await db
    .prepare(`SELECT ${COLS} FROM posts WHERE type=? AND status='publish' ORDER BY published_at DESC LIMIT ?`)
    .bind(type, limit)
    .all<PostRow>();
  return results;
}

export async function getPostBySlug(db: D1Like, type: string, slug: string) {
  const post = await db
    .prepare(`SELECT ${COLS} FROM posts WHERE type=? AND slug=? AND status='publish'`)
    .bind(type, slug)
    .first<PostRow>();
  if (!post) return null;
  const m = await db.prepare("SELECT key,value FROM post_meta WHERE post_id=?").bind(post.id).all<{ key: string; value: string }>();
  const t = await db
    .prepare("SELECT t.taxonomy,t.slug,t.name FROM post_terms pt JOIN terms t ON t.id=pt.term_id WHERE pt.post_id=?")
    .bind(post.id)
    .all<{ taxonomy: string; slug: string; name: string }>();
  return {
    ...post,
    meta: Object.fromEntries(m.results.map((r) => [r.key, JSON.parse(r.value)])) as Record<string, unknown>,
    terms: t.results,
  };
}
