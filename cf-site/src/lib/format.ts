export const SITE_URL = "https://shinnosuke-kobayashi.jp";

export function toJst(utc: string): Date {
  const iso = utc.includes("T") ? utc : utc.replace(" ", "T");
  const d = new Date(/(Z|[+-]\d\d:?\d\d)$/.test(iso) ? iso : iso + "Z");
  return new Date(d.getTime() + 9 * 3600_000);
}
export function formatDate(utc: string): string {
  const d = toJst(utc);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())}`;
}

const CONTAINERS = "h[1-6]|ul|ol|table|blockquote|figure|figcaption|div|pre|dl|iframe|script|style|p|section|article|aside|details|nav|header|footer|main";
const BLOCK_START = new RegExp(`^\\s*<(?:hr|${CONTAINERS})\\b`, "i");
const delta = (line: string): number => {
  const open = (line.match(new RegExp(`<(?:${CONTAINERS})\\b[^>]*[^/]>|<(?:${CONTAINERS})>`, "gi")) ?? []).length;
  const close = (line.match(new RegExp(`</(?:${CONTAINERS})>`, "gi")) ?? []).length;
  return open - close;
};
const ENDS_WITH_BR = /<br\s*\/?>$/i;
export function autop(html: string): string {
  // 開始タグが改行で分割されている行（"<div" / ' class="x">'）は1つの論理行にまとめる
  const lines: string[] = [];
  for (const l of html.replace(/\r\n?/g, "\n").split("\n")) {
    const prev = lines[lines.length - 1];
    if (prev !== undefined && /<[a-z][^>]*$/i.test(prev)) lines[lines.length - 1] = prev + "\n" + l;
    else lines.push(l);
  }
  const out: string[] = [];
  let buf: string[] = [];
  let depth = 0;
  const flush = () => {
    if (!buf.length) return;
    out.push("<p>" + buf.map((l, i) => (i === 0 ? l : (ENDS_WITH_BR.test(buf[i - 1]) ? "\n" : "<br>\n") + l)).join("") + "</p>");
    buf = [];
  };
  for (const raw of lines) {
    if (depth > 0) { out.push(raw); depth += delta(raw); continue; }
    if (raw.trim() === "") { flush(); continue; }
    if (BLOCK_START.test(raw)) { flush(); out.push(raw); depth = Math.max(0, delta(raw)); continue; }
    buf.push(raw.trim());
  }
  flush();
  return out.join("\n");
}

export function hrefFor(...segments: string[]): string {
  return "/" + segments.map((s) => encodeURIComponent(s) + "/").join("");
}
export function mediaSrc(thumbnail: string | null): string | null {
  return thumbnail ? "/media/" + thumbnail.split("/").map(encodeURIComponent).join("/") : null;
}
export function docTitle(title: string | null, lang: "ja" | "en" = "ja"): string {
  if (lang === "en") return title ? `${title} | Shinnosuke Kobayashi Official Website` : "Shinnosuke Kobayashi Official Website";
  return title ? `${title} | 小林慎之助` : "小林慎之助 | 構想を、社会に実装する。";
}
export const gradientClass = (wpId: number): string => `g${(wpId % 6) + 1}`;

export interface PageItem { kind: "prev" | "next" | "page" | "current" | "dots"; n?: number }
export function paginationModel(current: number, total: number, mid = 1): PageItem[] {
  if (total <= 1) return [];
  const items: PageItem[] = [];
  if (current > 1) items.push({ kind: "prev", n: current - 1 });
  let dots = false;
  for (let n = 1; n <= total; n++) {
    if (n === current) { items.push({ kind: "current", n }); dots = true; }
    else if (n <= 1 || (n >= current - mid && n <= current + mid) || n > total - 1) { items.push({ kind: "page", n }); dots = true; }
    else if (dots) { items.push({ kind: "dots" }); dots = false; }
  }
  if (current < total) items.push({ kind: "next", n: current + 1 });
  return items;
}

const YT = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|watch\?(?:[^\s"']*&)?v=))([A-Za-z0-9_-]{11})/;
const SP = /open\.spotify\.com\/(?:embed\/)?episode\/([A-Za-z0-9]{22})/;
export function mediaEmbedIds(youtube: unknown, spotify: unknown): { yt: string; sp: string } {
  const y = typeof youtube === "string" ? youtube.trim() : "";
  const s = typeof spotify === "string" ? spotify.trim() : "";
  const yt = y.match(YT)?.[1] ?? (/^[A-Za-z0-9_-]{11}$/.test(y) ? y : "");
  const sp = s.match(SP)?.[1] ?? (/^[A-Za-z0-9]{22}$/.test(s) ? s : "");
  return { yt, sp };
}
