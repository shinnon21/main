import { z } from "zod";
import type { D1Like } from "../lib/d1.ts";
import type { KvLike } from "../lib/ratelimit.ts";
import type { R2Like } from "../admin/media.ts";
import { HttpError } from "../admin/types.ts";
import { type ToolCtx, createPostTool, createTermTool, getPostTool, listPostsTool, listTermsTool, updatePostTool } from "./tools.ts";
import { uploadMediaFromUrl } from "./fetch-image.ts";
import { mcpAllowed, recordAudit } from "./audit.ts";

export interface McpDeps { db: D1Like; media: R2Like; kv: KvLike; email: string; client: string; now: () => string; fetcher?: typeof fetch }
export interface ToolDef { name: string; description: string; write: boolean; schema: z.ZodObject; run: (ctx: ToolCtx, args: any, deps: McpDeps) => Promise<unknown> }

const TYPE = z.enum(["works", "column", "news", "page"]);
const TAX = z.enum(["works_type", "industry", "skill", "news_type"]);
const str = (max: number) => z.string().max(max);
const termRef = z.object({ taxonomy: TAX, slug: str(200) }).strict();
const fields = {
  title_en: str(500).optional(), slug: str(400).optional(), excerpt: str(2000).optional(), excerpt_en: str(2000).optional(),
  content: str(2_000_000).optional(), content_en: str(2_000_000).optional(), thumbnail: str(500).nullable().optional(),
  meta: z.record(z.string(), z.unknown()).optional(), terms: z.array(termRef).max(50).optional(),
};
const PUBLISH_NOTE = "公開・非公開の切替や削除はできません（管理画面で行います）。";

export const TOOL_DEFS: ToolDef[] = [
  { name: "list_posts", write: false, description: "記事・実績・お知らせ・固定ページの一覧（最大50件）。type/status/タイトル検索で絞り込めます。",
    schema: z.object({ type: TYPE.optional(), status: z.enum(["draft", "publish", "trash"]).optional(), q: str(100).optional() }).strict(),
    run: (c, a) => listPostsTool(c, a) },
  { name: "get_post", write: false, description: "1件の全項目（本文・英語版・メタ・分類・modified_at）を返します。更新前に読み、modified_at を update_post に渡してください。",
    schema: z.object({ id: z.number().int().positive() }).strict(), run: (c, a) => getPostTool(c, a) },
  { name: "create_post", write: true, description: `新規作成します。必ず下書きになります。${PUBLISH_NOTE} 本文はHTML（見出し・段落・リスト・画像など）。`,
    schema: z.object({ type: TYPE, title: z.string().min(1).max(500), ...fields }).strict(), run: (c, a) => createPostTool(c, a) },
  { name: "update_post", write: true, description: `渡した項目だけ更新します（status・種別は変更不可）。注意: 公開済みの記事を更新すると、その内容は公開サイトに即時反映されます（改版から復元可）。expected_modified_at 必須。${PUBLISH_NOTE}`,
    schema: z.object({ id: z.number().int().positive(), expected_modified_at: str(40), title: z.string().min(1).max(500).optional(), ...fields }).strict(),
    run: (c, a) => updatePostTool(c, a) },
  { name: "list_terms", write: false, description: "分類（タグ・種別・業界）の一覧と使用数。", schema: z.object({ taxonomy: TAX.optional() }).strict(), run: (c, a) => listTermsTool(c, a) },
  { name: "create_term", write: true, description: "分類を追加します（既存と同じスラッグは409）。", schema: z.object({ taxonomy: TAX, name: z.string().min(1).max(100) }).strict(), run: (c, a) => createTermTool(c, a) },
  { name: "upload_media_from_url", write: true, description: "公開されている https の画像URL（JPEG/PNG/GIF/WebP、10MBまで）をメディアに登録し、/media/... のパスを返します。",
    schema: z.object({ url: str(2000), alt: str(500).optional() }).strict(),
    run: (c, a, d) => uploadMediaFromUrl({ ...c, media: d.media, fetcher: d.fetcher }, a) },
];

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 3 * 1024 * 1024;
const INSTRUCTIONS = "小林慎之助の公式サイトのCMS。記事は下書きで作成され、公開は管理画面で行います。更新前に get_post で最新の modified_at を取得してください。";

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const toolText = (v: unknown, isError = false) => ({ content: [{ type: "text", text: typeof v === "string" ? v : JSON.stringify(v) }], ...(isError ? { isError: true } : {}) });

const targetOf = (a: any) => (a && typeof a === "object" ? (a.id !== undefined ? `post:${a.id}` : a.type ?? a.taxonomy ?? a.url ?? "") : "");

async function callTool(deps: McpDeps, name: string, args: unknown) {
  const def = TOOL_DEFS.find((t) => t.name === name);
  if (!def) return null;
  const audit = (ok: boolean) => recordAudit(deps.db, { at: deps.now(), email: deps.email, client: deps.client, tool: name, target: String(targetOf(args)), ok });
  if (!(await mcpAllowed(deps.kv, deps.email, def.write))) { await audit(false); return toolText("rate limit exceeded; try again later", true); }
  const parsed = def.schema.safeParse(args ?? {});
  if (!parsed.success) { await audit(false); return toolText(`invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")}`, true); }
  try {
    const out = await def.run({ db: deps.db, email: deps.email, nowUtc: deps.now() }, parsed.data, deps);
    await audit(true);
    return toolText(out);
  } catch (e) {
    await audit(false);
    if (e instanceof HttpError) return toolText(`${e.status}: ${e.message}`, true);
    console.error("mcp tool failed", name, e instanceof Error ? e.message : String(e));
    return toolText("500: internal error", true);
  }
}

/** ステートレスな Streamable HTTP（POSTのみ・JSON応答）の最小MCPサーバー。認証は呼び出し側（OAuth）で済んでいること */
export async function mcpHttp(req: Request, deps: McpDeps): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
  if (!/^application\/json(\s*;|$)/i.test(req.headers.get("Content-Type") ?? "")) return new Response("Unsupported Media Type", { status: 415 });
  const declared = Number(req.headers.get("Content-Length"));
  if (declared > MAX_BODY) return new Response("Payload Too Large", { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response("Payload Too Large", { status: 413 });
  let msg: any;
  try { msg = JSON.parse(raw); } catch { return reply(rpcError(null, -32700, "parse error")); }
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return reply(rpcError(null, -32600, "invalid request"), 400);
  const isNotification = msg.id === undefined;
  if (isNotification) return new Response(null, { status: 202 });
  const p = msg.params && typeof msg.params === "object" ? msg.params : {};
  switch (msg.method) {
    case "initialize": {
      const v = VERSIONS.includes(p.protocolVersion) ? p.protocolVersion : VERSIONS[0];
      return reply(rpcResult(msg.id, { protocolVersion: v, capabilities: { tools: {} }, serverInfo: { name: "kobayashi-hp", version: "1.0.0" }, instructions: INSTRUCTIONS }));
    }
    case "ping": return reply(rpcResult(msg.id, {}));
    case "tools/list":
      return reply(rpcResult(msg.id, { tools: TOOL_DEFS.map((t) => ({ name: t.name, description: t.description, inputSchema: z.toJSONSchema(t.schema) })) }));
    case "tools/call": {
      if (typeof p.name !== "string") return reply(rpcError(msg.id, -32602, "invalid params"));
      const out = await callTool(deps, p.name, p.arguments);
      return out ? reply(rpcResult(msg.id, out)) : reply(rpcError(msg.id, -32602, `unknown tool: ${p.name}`));
    }
    default: return reply(rpcError(msg.id, -32601, `method not found: ${msg.method}`));
  }
}
