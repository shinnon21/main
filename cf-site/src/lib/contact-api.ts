import type { D1Like } from "./d1.ts";
import { buildAutoReply, buildNotification, hashIp, validateContact, type ContactClean } from "./contact.ts";
import { rateLimit, type KvLike } from "./ratelimit.ts";
import { verifyTurnstile } from "./turnstile.ts";

export interface MailMessage { to: string; from: string; subject: string; text: string; html: string; replyTo?: string }
export interface MailBinding { send(m: MailMessage): Promise<{ messageId: string }> }
export interface ContactDeps {
  db: D1Like; kv: KvLike; mail?: MailBinding;
  verify?: typeof verifyTurnstile;
  cfg: { turnstileSecret?: string; to: string; from: string; ipSalt: string; siteUrl: string };
  nowUtc: string;
  waitUntil: (p: Promise<unknown>) => void;
}

const MAX_BODY = 20_000;
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function handleContactSubmit(req: Request, deps: ContactDeps): Promise<Response> {
  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    const url = new URL(req.url);
    if (req.headers.get("Origin") !== url.origin) return json({ error: "bad_origin" }, 403);
    if (!/^application\/json(\s*;|$)/i.test(req.headers.get("Content-Type") ?? "")) return json({ error: "unsupported_media_type" }, 415);
    if (Number(req.headers.get("Content-Length")) > MAX_BODY) return json({ error: "too_large" }, 413);
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ error: "too_large" }, 413);
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { return json({ error: "invalid_json" }, 400); }

    const secret = deps.cfg.turnstileSecret?.trim();
    if (!secret) return json({ error: "not_configured" }, 503);

    const ip = req.headers.get("CF-Connecting-IP") ?? "";
    const ipKey = (await hashIp(ip, deps.cfg.ipSalt)) || "unknown";
    const [h, d, g] = await Promise.all([rateLimit(deps.kv, `contact:h:${ipKey}`, 5, 3600), rateLimit(deps.kv, `contact:d:${ipKey}`, 20, 86400), rateLimit(deps.kv, "contact:global", 200, 3600)]);
    if (!h.allowed || !d.allowed || !g.allowed) return json({ error: "rate_limited" }, 429);

    const v = validateContact(raw);
    if (!v.ok) return json({ errors: v.errors }, 400);
    if (v.value.bot) return json({ ok: true }); // ハニーポット: ボットには成功に見せて何も保存・送信しない

    const token = typeof (raw as Record<string, unknown>).turnstile === "string" ? ((raw as Record<string, unknown>).turnstile as string) : "";
    if (!(await (deps.verify ?? verifyTurnstile)({ token, secret, ip }))) return json({ error: "challenge_failed" }, 400);

    const c = v.value;
    const ua = (req.headers.get("User-Agent") ?? "").slice(0, 300);
    const ins = await deps.db.prepare("INSERT INTO contacts(created_at,name,email,company,kind,message,lang,ip_hash,user_agent) VALUES(?,?,?,?,?,?,?,?,?)")
      .bind(deps.nowUtc, c.name, c.email, c.company, c.kind, c.message, c.lang, ipKey === "unknown" ? "" : ipKey, ua).run();
    const id = ins.meta.last_row_id;
    deps.waitUntil(notify(deps, id, c));
    return json({ ok: true });
  } catch (e) {
    console.error("contact submit error", e);
    return json({ error: "internal_error" }, 500);
  }
}

async function notify(deps: ContactDeps, id: number, c: ContactClean): Promise<void> {
  const set = (status: string, err = "") => deps.db.prepare("UPDATE contacts SET notify_status=?, notify_error=? WHERE id=?").bind(status, err.slice(0, 200), id).run().catch(() => {});
  if (!deps.mail) { await set("disabled"); return; }
  try {
    const n = buildNotification(c, id, deps.cfg.siteUrl);
    await deps.mail.send({ to: deps.cfg.to, from: deps.cfg.from, replyTo: c.email, ...n });
    // 自動返信は同一アドレスに1日1通まで（フォームを使った第三者へのメール爆撃を防ぐ）
    if ((await rateLimit(deps.kv, `autoreply:${c.email}`, 1, 86400)).allowed) {
      try { await deps.mail.send({ to: c.email, from: deps.cfg.from, ...buildAutoReply(c) }); } catch (e) { await set("sent", `autoreply: ${errText(e)}`); return; }
    }
    await set("sent");
  } catch (e) {
    await set("error", errText(e));
  }
}
const errText = (e: unknown) => { const x = e as { code?: string; message?: string }; return `${x?.code ?? "ERR"}: ${x?.message ?? String(e)}`; };
