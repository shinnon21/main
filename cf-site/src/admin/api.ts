import type { D1Like } from "../lib/d1.ts";
import { createPost, getAdminPost, listAdminPosts, listRevisions, restoreRevision, setStatus, updatePost } from "./store.ts";
import { HttpError, type PostStatus } from "./types.ts";
import { cleanPostInput, utcToJstLocal } from "./validate.ts";
import { cleanSettings, readSettings, saveSettings } from "./settings.ts";
import { backupFilename, buildBackup } from "./backup.ts";
import { cleanProfile, readProfile, saveProfile } from "./profile.ts";
import { createTerm, deleteTerm, listTerms, renameTerm } from "./terms.ts";
import { MAX_BYTES, deleteMediaRow, findUsage, getMedia, insertMedia, listMedia, makeKey, setAlt, validateUpload } from "./media.ts";

export interface R2Like {
  put(key: string, body: ArrayBuffer | Uint8Array, opts: { httpMetadata: { contentType: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
}
export interface ApiCtx { db: D1Like; email: string; nowUtc: string; media?: R2Like; rand?: () => string }

const rand6 = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join("");

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function body(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new HttpError(400, "invalid JSON"); }
}
const STATUSES = ["draft", "publish", "trash"];

/** 成功した変更系リクエストのあと、サイトが「CMSで管理されている」印を付ける（取り込みスクリプトの上書き防止ガードが参照する） */
export async function handleAdminApi(req: Request, ctx: ApiCtx): Promise<Response> {
  const res = await route(req, ctx);
  const m = req.method.toUpperCase();
  if (m !== "GET" && m !== "HEAD" && res.status < 300) {
    await ctx.db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('cms_initialized','\"1\"')").bind().run().catch(() => {});
  }
  return res;
}

async function route(req: Request, ctx: ApiCtx): Promise<Response> {
  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/admin\/api/, "") || "/";
    const method = req.method.toUpperCase();

    const isUpload = method === "POST" && path === "/media";
    if (method !== "GET" && method !== "HEAD") {
      if (req.headers.get("Origin") !== url.origin) throw new HttpError(403, "bad origin");
      if (isUpload) {
        // バイナリ送信のため JSON 必須ではなく、カスタムヘッダー（クロスオリジンからは事前確認なしに付けられない）を必須にする
        if (req.headers.get("X-Kb-Admin") !== "1") throw new HttpError(403, "missing admin header");
      } else if ((method === "POST" || method === "PUT" || method === "PATCH") && !/^application\/json(\s*;|$)/i.test(req.headers.get("Content-Type") ?? "")) {
        // 本文を持つメソッドはJSONのみ受け付ける（フォームPOST等によるCSRFを拒否）
        throw new HttpError(415, "content-type must be application/json");
      }
    }

    const { db, email, nowUtc } = ctx;
    const cm = path.match(/^\/contacts(?:\/(\d+)(\/status)?)?$/);
    if (cm) {
      const cid = cm[1] ? Number(cm[1]) : null;
      if (cid === null) {
        if (method !== "GET") throw new HttpError(405, "method not allowed");
        const status = url.searchParams.get("status");
        const where = status ? "WHERE status=?" : "WHERE status<>'spam'";
        const rows = (await db.prepare(`SELECT id,created_at,name,email,company,kind,lang,status,notify_status FROM contacts ${where} ORDER BY created_at DESC, id DESC LIMIT 200`).bind(...(status ? [status] : [])).all()).results;
        const nc = (await db.prepare("SELECT COUNT(*) c FROM contacts WHERE status='new'").bind().first<{ c: number }>())?.c ?? 0;
        return json({ contacts: rows, new_count: nc });
      }
      const row = await db.prepare("SELECT id,created_at,name,email,company,kind,message,lang,status,notify_status,notify_error FROM contacts WHERE id=?").bind(cid).first();
      if (!row) throw new HttpError(404, "not found");
      if (!cm[2]) { if (method !== "GET") throw new HttpError(405, "method not allowed"); return json(row); }
      if (method !== "POST") throw new HttpError(405, "method not allowed");
      const st = ((await body(req)) as { status?: string })?.status;
      if (!st || !["new", "read", "spam"].includes(st)) throw new HttpError(400, "invalid status");
      await db.prepare("UPDATE contacts SET status=? WHERE id=?").bind(st, cid).run();
      return json({ ok: true });
    }
    const mm = path.match(/^\/media(?:\/(\d+))?$/);
    if (mm) {
      if (!ctx.media) throw new HttpError(503, "media storage is not configured");
      const id = mm[1] ? Number(mm[1]) : null;
      if (id === null) {
        if (method === "GET") return json({ media: await listMedia(db, { q: url.searchParams.get("q") ?? undefined, offset: Math.max(0, Number(url.searchParams.get("offset")) || 0) }) });
        if (method === "POST") {
          const declared = Number(req.headers.get("Content-Length"));
          if (declared > MAX_BYTES) throw new HttpError(413, "file too large (max 10MB)");
          const bytes = new Uint8Array(await req.arrayBuffer());
          const { type } = validateUpload(bytes, req.headers.get("Content-Type") ?? "");
          let name = "image";
          try { name = decodeURIComponent(req.headers.get("X-Filename") ?? "") || "image"; } catch { /* 不正なエンコードは既定名 */ }
          // D1(一意制約)で先にキーを確保してから R2 に書く。衝突しても既存オブジェクトには一切触れず、別のサフィックスで再試行する
          const nextRand = ctx.rand ?? rand6;
          for (let attempt = 0; attempt < 3; attempt++) {
            const key = makeKey(name, type, new Date(), nextRand());
            let newId: number;
            try { ({ id: newId } = await insertMedia(db, { key, content_type: type, size: bytes.length, uploaded_by: email, now: nowUtc })); }
            catch (e) { if (e instanceof HttpError && e.status === 409) continue; throw e; }
            try { await ctx.media.put(key, bytes, { httpMetadata: { contentType: type } }); }
            catch (e) { await deleteMediaRow(db, newId).catch(() => {}); throw e; }
            return json({ id: newId, key, url: `/media/${key}`, alt: "", content_type: type, size: bytes.length }, 201);
          }
          throw new HttpError(409, "could not allocate a unique media key");
        }
        throw new HttpError(405, "method not allowed");
      }
      const row = await getMedia(db, id);
      if (!row) throw new HttpError(404, "not found");
      if (method === "PUT") { await setAlt(db, id, String(((await body(req)) as { alt?: unknown })?.alt ?? "")); return json({ ok: true }); }
      if (method === "DELETE") {
        const usage = await findUsage(db, row.key);
        if (usage.length) return json({ error: "in use", usage }, 409);
        await ctx.media.delete(row.key);
        await deleteMediaRow(db, id);
        return new Response(null, { status: 204 });
      }
      throw new HttpError(405, "method not allowed");
    }
    if (path === "/posts") {
      if (method === "GET") return json({ posts: await listAdminPosts(db, { type: url.searchParams.get("type") ?? undefined, status: url.searchParams.get("status") ?? undefined, q: url.searchParams.get("q") ?? undefined }) });
      if (method === "POST") { const { id } = await createPost(db, cleanPostInput(await body(req)), email, nowUtc); return json({ id }, 201); }
      throw new HttpError(405, "method not allowed");
    }
    if (path === "/export") {
      if (method !== "GET") throw new HttpError(405, "method not allowed");
      const data = await buildBackup(db, nowUtc, { contacts: url.searchParams.get("contacts") === "1" });
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${backupFilename(nowUtc)}"`, "Cache-Control": "no-store" } });
    }
    if (path === "/settings") {
      if (method === "GET") return json(await readSettings(db));
      if (method === "PUT") { await saveSettings(db, cleanSettings(await body(req))); return json({ ok: true }); }
      throw new HttpError(405, "method not allowed");
    }
    if (path === "/profile") {
      if (method === "GET") return json(await readProfile(db));
      if (method === "PUT") { await saveProfile(db, cleanProfile(await body(req)), email, nowUtc); return json({ ok: true }); }
      throw new HttpError(405, "method not allowed");
    }
    const tm = path.match(/^\/terms(?:\/(\d+))?$/);
    if (tm) {
      if (!tm[1]) {
        if (method === "GET") return json({ terms: await listTerms(db) });
        if (method === "POST") return json(await createTerm(db, await body(req)), 201);
        throw new HttpError(405, "method not allowed");
      }
      const tid = Number(tm[1]);
      if (method === "PUT") { await renameTerm(db, tid, await body(req)); return json({ ok: true }); }
      if (method === "DELETE") {
        const r = await deleteTerm(db, tid);
        return "inUse" in r ? json({ error: "in use", count: r.inUse }, 409) : new Response(null, { status: 204 });
      }
      throw new HttpError(405, "method not allowed");
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
