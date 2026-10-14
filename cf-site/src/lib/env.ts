// Cloudflareバインディング取得の唯一の依存点（Astro 6+ / adapter 13+ は cloudflare:workers の env を使う）
import { env } from "cloudflare:workers";
import type { D1Like } from "./d1.ts";

export interface KbEnv {
  DB: D1Like;
  MEDIA: { get(key: string): Promise<{ body: ReadableStream; httpEtag: string; httpMetadata?: { contentType?: string } } | null> };
  CACHE: unknown;
}
export const getEnv = (): KbEnv => env as unknown as KbEnv;
