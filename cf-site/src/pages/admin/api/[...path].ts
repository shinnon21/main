import type { APIRoute } from "astro";
import { handleAdminApi } from "../../../admin/api.ts";
import { nowUtcMs } from "../../../admin/guard.ts";
import { getEnv } from "../../../lib/env.ts";

export const ALL: APIRoute = ({ request, locals }) => {
  // 多重防御: ミドルウェアが認証していないリクエスト（adminEmail 未設定）は必ず拒否する
  if (!locals.adminEmail) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const env = getEnv();
  return handleAdminApi(request, { db: env.DB, media: env.MEDIA, email: locals.adminEmail, nowUtc: nowUtcMs() });
};
