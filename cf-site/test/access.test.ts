import { expect, test } from "vitest";
import { verifyAccessJwt, authorize } from "../src/admin/access.ts";

const b64 = (b: ArrayBuffer | string) => Buffer.from(typeof b === "string" ? b : new Uint8Array(b)).toString("base64url");
async function keypair() { return crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]); }
async function sign(priv: CryptoKey, payload: object, header: object = { alg: "RS256", kid: "k1", typ: "JWT" }) {
  const h = b64(JSON.stringify(header)), p = b64(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", priv, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64(sig)}`;
}
const cfg = { teamDomain: "team.cloudflareaccess.com", aud: "AUD1" };
const now = 1_800_000_000;
const good = { iss: "https://team.cloudflareaccess.com", aud: ["AUD1"], email: "me@example.com", exp: now + 600, nbf: now - 10, iat: now - 10 };

async function setup() { const kp = await keypair(); const jwk = { ...(await crypto.subtle.exportKey("jwk", kp.publicKey)), kid: "k1" }; return { kp, jwks: async () => ({ keys: [jwk] as never }) }; }

test("accepts a valid token", async () => {
  const { kp, jwks } = await setup();
  expect(await verifyAccessJwt(await sign(kp.privateKey, good), cfg, jwks, now)).toEqual({ email: "me@example.com" });
});
test.each([
  ["expired", { ...good, exp: now - 1 }],
  ["not yet valid", { ...good, nbf: now + 100 }],
  ["wrong aud", { ...good, aud: ["OTHER"] }],
  ["wrong iss", { ...good, iss: "https://evil.cloudflareaccess.com" }],
  ["no email", { ...good, email: undefined }],
])("rejects %s", async (_n, payload) => {
  const { kp, jwks } = await setup();
  await expect(verifyAccessJwt(await sign(kp.privateKey, payload), cfg, jwks, now)).rejects.toThrow(/access:/);
});
test("rejects unknown kid, tampered payload, alg none and HS256 swap", async () => {
  const { kp, jwks } = await setup();
  const t = await sign(kp.privateKey, good);
  await expect(verifyAccessJwt(await sign(kp.privateKey, good, { alg: "RS256", kid: "zzz" }), cfg, jwks, now)).rejects.toThrow(/access:/);
  const [h, , sig] = t.split("."); const tampered = `${h}.${b64(JSON.stringify({ ...good, email: "evil@example.com" }))}.${sig}`;
  await expect(verifyAccessJwt(tampered, cfg, jwks, now)).rejects.toThrow(/access:/);
  await expect(verifyAccessJwt(`${b64(JSON.stringify({ alg: "none", kid: "k1" }))}.${b64(JSON.stringify(good))}.`, cfg, jwks, now)).rejects.toThrow(/access:/);
  await expect(verifyAccessJwt(`${b64(JSON.stringify({ alg: "HS256", kid: "k1" }))}.${b64(JSON.stringify(good))}.${b64("x")}`, cfg, jwks, now)).rejects.toThrow(/access:/);
});
test("authorize: fail closed, dev bypass only on localhost, header and allowlist checks", async () => {
  const { kp, jwks } = await setup();
  const env = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "AUD1" };
  const req = (host: string, token?: string) => new Request(`https://${host}/admin/`, { headers: token ? { "Cf-Access-Jwt-Assertion": token } : {} });
  expect(await authorize(req("kb.workers.dev"), {}, jwks, now)).toMatchObject({ ok: false, status: 503 });
  expect(await authorize(req("kb.workers.dev"), { DEV_ADMIN_EMAIL: "dev@x" }, jwks, now)).toMatchObject({ ok: false, status: 503 });
  expect(await authorize(req("localhost:8787"), { DEV_ADMIN_EMAIL: "dev@x" }, jwks, now)).toEqual({ ok: true, email: "dev@x" });
  expect(await authorize(req("kb.workers.dev"), env, jwks, now)).toMatchObject({ ok: false, status: 401 });
  const tok = await sign(kp.privateKey, good);
  expect(await authorize(req("kb.workers.dev", tok), env, jwks, now)).toEqual({ ok: true, email: "me@example.com" });
  expect(await authorize(req("kb.workers.dev", tok), { ...env, ADMIN_EMAILS: "other@example.com" }, jwks, now)).toMatchObject({ ok: false, status: 403 });
  expect(await authorize(req("kb.workers.dev", "garbage"), env, jwks, now)).toMatchObject({ ok: false, status: 401 });
});
