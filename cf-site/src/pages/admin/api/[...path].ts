import type { APIRoute } from "astro";
import { handleAdminApi } from "../../../admin/api.ts";
import { nowUtcMs } from "../../../admin/guard.ts";
import { getEnv } from "../../../lib/env.ts";

export const ALL: APIRoute = ({ request, locals }) =>
  handleAdminApi(request, { db: getEnv().DB, email: locals.adminEmail ?? "unknown", nowUtc: nowUtcMs() });
