import type { D1Like } from "../lib/d1.ts";
import { createPost, getAdminPost, listAdminPosts, updatePost } from "../admin/store.ts";
import { createTerm, listTerms } from "../admin/terms.ts";
import { cleanPostInput, defaultSlug, utcToJstLocal } from "../admin/validate.ts";
import { HttpError } from "../admin/types.ts";

export interface ToolCtx { db: D1Like; email: string; nowUtc: string }

const LIST_MAX = 50;
const rand4 = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => (b % 36).toString(36)).join("");
const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

// 公開・削除・種別変更・日時指定に関わる項目（status, published_at, type など）は意図的に受け付けない
const CREATE_KEYS = ["type", "title", "title_en", "slug", "excerpt", "excerpt_en", "content", "content_en", "thumbnail", "meta", "terms"];
const UPDATE_KEYS = ["title", "title_en", "slug", "excerpt", "excerpt_en", "content", "content_en", "thumbnail", "terms"];

export async function listPostsTool(ctx: ToolCtx, f: { type?: string; status?: string; q?: string }) {
  return { posts: await listAdminPosts(ctx.db, f, LIST_MAX) };
}

export async function getPostTool(ctx: ToolCtx, a: { id: number }) {
  const p = await getAdminPost(ctx.db, a.id);
  if (!p) throw new HttpError(404, "not found");
  return { ...p, published_at: p.published_at ? utcToJstLocal(p.published_at) : null };
}

/** 常に下書きで作成する。status / published_at が渡されても無視する */
export async function createPostTool(ctx: ToolCtx, input: Record<string, unknown>) {
  const base = pick(input, CREATE_KEYS);
  const clean = cleanPostInput({
    meta: {}, terms: [], ...base,
    slug: typeof base.slug === "string" && base.slug.trim() ? base.slug : `${defaultSlug(Date.now())}-${rand4()}`,
    status: "draft", published_at: null,
  });
  return createPost(ctx.db, clean, ctx.email, ctx.nowUtc);
}

/** 渡した項目だけを現状にマージして更新する。status は変更せず、種別も変更できない。expected_modified_at 必須（競合は409） */
export async function updatePostTool(ctx: ToolCtx, input: Record<string, unknown> & { id: number }) {
  const cur = await getAdminPost(ctx.db, input.id);
  if (!cur) throw new HttpError(404, "not found");
  if (typeof input.expected_modified_at !== "string" || !input.expected_modified_at) throw new HttpError(400, "expected_modified_at is required");
  if (input.type !== undefined && input.type !== cur.type) throw new HttpError(400, "type cannot be changed");
  const patchMeta = input.meta;
  if (patchMeta !== undefined && (!patchMeta || typeof patchMeta !== "object" || Array.isArray(patchMeta))) throw new HttpError(400, "meta must be an object");
  const clean = cleanPostInput({
    ...cur,
    published_at: cur.published_at ? utcToJstLocal(cur.published_at) : null,
    ...pick(input, UPDATE_KEYS),
    meta: { ...cur.meta, ...(patchMeta as object | undefined) },
    status: cur.status,
    expected_modified_at: input.expected_modified_at,
  });
  return updatePost(ctx.db, input.id, clean, ctx.email, ctx.nowUtc);
}

export async function listTermsTool(ctx: ToolCtx, a: { taxonomy?: string }) {
  const all = (await listTerms(ctx.db)) as { taxonomy: string }[];
  return { terms: a.taxonomy ? all.filter((t) => t.taxonomy === a.taxonomy) : all };
}

export const createTermTool = (ctx: ToolCtx, a: { taxonomy: string; name: string }) => createTerm(ctx.db, { taxonomy: a.taxonomy, name: a.name });
