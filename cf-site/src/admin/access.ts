export interface AccessConfig { teamDomain: string; aud: string; adminEmails?: string[] }
export interface Jwks { keys: (JsonWebKey & { kid: string })[] }
export interface AdminEnv { ACCESS_TEAM_DOMAIN?: string; ACCESS_AUD?: string; ADMIN_EMAILS?: string; DEV_ADMIN_EMAIL?: string }

const fail = (m: string): never => { throw new Error(`access: ${m}`); };
const dec = (s: string): Uint8Array => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const json = (s: string) => JSON.parse(new TextDecoder().decode(dec(s)));

export async function verifyAccessJwt(token: string, cfg: AccessConfig, getJwks: () => Promise<Jwks>, nowSec = Math.floor(Date.now() / 1000)): Promise<{ email: string }> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[2]) return fail("malformed");
  let header: any, payload: any;
  try { header = json(parts[0]); payload = json(parts[1]); } catch { return fail("malformed"); }
  if (header.alg !== "RS256") return fail("alg");
  const jwk = (await getJwks()).keys.find((k) => k.kid === header.kid);
  if (!jwk) return fail("kid");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, dec(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!ok) return fail("signature");
  if (payload.iss !== `https://${cfg.teamDomain}`) return fail("iss");
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(cfg.aud)) return fail("aud");
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) return fail("exp");
  if (typeof payload.nbf === "number" && payload.nbf > nowSec) return fail("nbf");
  if (typeof payload.email !== "string" || !payload.email) return fail("email");
  return { email: payload.email };
}

let cache: { domain: string; at: number; jwks: Jwks } | null = null;
export const fetchJwks = (teamDomain: string) => async (): Promise<Jwks> => {
  if (cache && cache.domain === teamDomain && Date.now() - cache.at < 600_000) return cache.jwks;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`access: jwks ${res.status}`);
  const jwks = (await res.json()) as Jwks;
  cache = { domain: teamDomain, at: Date.now(), jwks };
  return jwks;
};

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d+)?$/;
export async function authorize(
  req: Request, env: AdminEnv, getJwks?: () => Promise<Jwks>, nowSec?: number,
): Promise<{ ok: true; email: string } | { ok: false; status: 401 | 403 | 503; message: string }> {
  const host = new URL(req.url).host;
  if (LOCAL_HOST.test(host) && env.DEV_ADMIN_EMAIL) return { ok: true, email: env.DEV_ADMIN_EMAIL };
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.ACCESS_AUD?.trim();
  if (!teamDomain || !aud) return { ok: false, status: 503, message: "Admin is not configured" };
  const token = req.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return { ok: false, status: 401, message: "Unauthorized" };
  let email: string;
  try { ({ email } = await verifyAccessJwt(token, { teamDomain, aud }, getJwks ?? fetchJwks(teamDomain), nowSec)); }
  catch { return { ok: false, status: 401, message: "Unauthorized" }; }
  const allow = (env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(email.toLowerCase())) return { ok: false, status: 403, message: "Forbidden" };
  return { ok: true, email };
}
