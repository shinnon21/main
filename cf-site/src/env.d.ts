/// <reference types="astro/client" />
declare namespace App {
  interface Locals { lang?: "ja" | "en"; path?: string; adminEmail?: string; cfContext?: { waitUntil(p: Promise<unknown>): void } }
}
