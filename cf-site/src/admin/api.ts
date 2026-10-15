import type { D1Like } from "../lib/d1.ts";
import { createPost, getAdminPost, listAdminPosts, listRevisions, restoreRevision, setStatus, updatePost } from "./store.ts";
import { HttpError, type PostStatus } from "./types.ts";
import { cleanPostInput, utcToJstLocal } from "./validate.ts";

export interface ApiCtx { db: D1Like; email: string; nowUtc: string }

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function body(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new HttpError(400, "invalid JSON"); }
}
const STATUSES = ["draft", "publish", "trash"];

export async function handleAdminApi(req: Request, ctx: ApiCtx): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/admin\/api/, "") || "/";
    const method = req.method.toUpperCase();

    if (method !== "GET" && method !== "HEAD") {
      if (req.headers.get("Origin") !== url.origin) throw new HttpError(403, "bad origin");
      // 本文を持つメソッドはJSONのみ受け付ける（フォームPOST等によるCSRFを拒否）
      if ((method === "POST" || method === "PUT" || method === "PATCH") && !/^application\/json(\s*;|$)/i.test(req.headers.get("Content-Type") ?? "")) {
        throw new HttpError(415, "content-type must be application/json");
      }
    }

    const { db, email, nowUtc } = ctx;
    if (path === "/posts") {
      if (method === "GET") return json({ posts: await listAdminPosts(db, { type: url.searchParams.get("type") ?? undefined, status: url.searchParams.get("status") ?? undefined, q: url.searchParams.get("q") ?? undefined }) });
      if (method === "POST") { const { id } = await createPost(db, cleanPostInput(await body(req)), email, nowUtc); return json({ id }, 201); }
      throw new HttpError(405, "method not allowed");
    }
    if (path === "/terms") {
      if (method !== "GET") throw new HttpError(405, "method not allowed");
      return json({ terms: (await db.prepare("SELECT taxonomy,slug,name FROM terms ORDER BY taxonomy,id").bind().all()).results });
    }
    const m = path.match(/^\/posts\/(\d+)(?:\/(revisions|status|restore\/(\d+)))?$/);
    if (!m) throw new HttpError(404, "not found");
    const id = Number(m[1]);
    const sub = m[2];

    if (!sub) {
      if (method === "GET") {
        const p = await getAdminPost(db, id);
        if (!p) throw new HttpError(404, "not found");
        return json({ ...p, published_at: p.published_at ? utcToJstLocal(p.published_at) : null });
      }
      if (method === "PUT") { const r = await updatePost(db, id, cleanPostInput(await body(req)), email, nowUtc); return json(r); }
      if (method === "DELETE") { await setStatus(db, id, "trash", email, nowUtc); return new Response(null, { status: 204 }); }
      throw new HttpError(405, "method not allowed");
    }
    if (sub === "revisions") {
      if (method !== "GET") throw new HttpError(405, "method not allowed");
      if (!(await getAdminPost(db, id))) throw new HttpError(404, "not found");
      return json({ revisions: await listRevisions(db, id) });
    }
    if (sub === "status") {
      if (method !== "POST") throw new HttpError(405, "method not allowed");
      const s = ((await body(req)) as { status?: string })?.status;
      if (!s || !STATUSES.includes(s)) throw new HttpError(400, "invalid status");
      await setStatus(db, id, s as PostStatus, email, nowUtc);
      return json({ modified_at: nowUtc });
    }
    if (method !== "POST") throw new HttpError(405, "method not allowed");
    await restoreRevision(db, id, Number(m[3]), email, nowUtc);
    return json({ modified_at: nowUtc });
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("admin api error", e);
    return json({ error: "internal error" }, 500);
  }
}
