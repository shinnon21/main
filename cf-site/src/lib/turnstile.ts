const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(i: { token: string; secret: string; ip?: string; fetcher?: typeof fetch }): Promise<boolean> {
  if (!i.token || i.token.length > 2048 || !i.secret) return false;
  try {
    const body = new URLSearchParams({ secret: i.secret, response: i.token });
    if (i.ip) body.set("remoteip", i.ip);
    const res = await (i.fetcher ?? fetch)(VERIFY_URL, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    if (!res.ok) return false;
    return ((await res.json()) as { success?: boolean }).success === true;
  } catch {
    return false;
  }
}
