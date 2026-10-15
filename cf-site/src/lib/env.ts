// Cloudflareバインディング取得の唯一の依存点（Astro 6+ / adapter 13+ は cloudflare:workers の env を使う）
import { env } from "cloudflare:workers";
import type { D1Like } from "./d1.ts";

export interface KbEnv {
  DB: D1Like;
  MEDIA: {
    get(key: string): Promise<{ body: ReadableStream; httpEtag: string; httpMetadata?: { contentType?: string } } | null>;
    put(key: string, body: ArrayBuffer | Uint8Array, opts: { httpMetadata: { contentType: string } }): Promise<unknown>;
    delete(key: string): Promise<void>;
  };
  CACHE: { get(key: string): Promise<string | null>; put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void> };
  EMAIL?: { send(m: { to: string; from: string; subject: string; text: string; html: string; replyTo?: string }): Promise<{ messageId: string }> };
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  CONTACT_TO?: string;
  CONTACT_FROM?: string;
  IP_SALT?: string;
  FORCE_VIEW_COUNT?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  DEV_ADMIN_EMAIL?: string;
}
export const getEnv = (): KbEnv => env as unknown as KbEnv;
