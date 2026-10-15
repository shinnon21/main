import xss from "xss";

const { FilterXSS, safeAttrValue: defaultSafeAttrValue } = xss as unknown as { FilterXSS: typeof import("xss").FilterXSS; safeAttrValue: typeof import("xss").safeAttrValue };

const TAGS = "h1 h2 h3 h4 h5 h6 p br hr ul ol li blockquote pre code strong em u s a img figure figcaption table thead tbody tr th td iframe".split(" ");
const COMMON = ["class", "style", "dir"];
const wl: Record<string, string[]> = {};
for (const t of TAGS) wl[t] = [...COMMON];
wl.a = ["href", "title", "target", "rel", ...COMMON];
wl.img = ["src", "alt", "title", "width", "height", ...COMMON];
wl.iframe = ["src", "title", "width", "height", "loading", "allow", "allowfullscreen", ...COMMON];
wl.td = ["colspan", "rowspan", ...COMMON];
wl.th = ["colspan", "rowspan", ...COMMON];

const URL_OK = /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i;
const EMBED_OK = /^https:\/\/(?:www\.youtube-nocookie\.com\/embed\/|open\.spotify\.com\/embed\/)/;
// 制御文字・各種空白を除いた形でスキームを判定する（"java\tscript:" 等の回避対策）
const squash = (v: string) => v.replace(new RegExp("[\\u0000-\\u0020\\u00a0\\u1680\\u180e\\u2000-\\u2029\\u205f\\u3000\\ufeff]", "g"), "");

const filter: FilterXSS = new FilterXSS({
  whiteList: wl,
  // style は見た目の寸法・揃えだけ許可（position/background/url() 等は cssfilter が除去）
  css: { whiteList: { width: true, height: true, "max-width": true, "text-align": true } },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
  allowCommentTag: false,
  onTag(tag, html, opts) {
    if (tag === "iframe" && !opts.isClosing) {
      const src = /\ssrc="([^"]*)"/i.exec(html)?.[1] ?? "";
      if (!EMBED_OK.test(src)) return "";
    }
    if (tag === "iframe" && opts.isClosing) return undefined;
    if (tag === "a" && !opts.isClosing && /\starget="_blank"/i.test(html) && !/\srel=/i.test(html)) {
      return html.replace(/\starget="_blank"/i, ' target="_blank" rel="noopener"');
    }
    return undefined;
  },
  safeAttrValue(tag, name, value, css) {
    if (name === "href" || name === "src") {
      const v = value.trim();
      if (!URL_OK.test(v) || /^(?:javascript|data|vbscript):/i.test(squash(v))) return "";
      return v.replace(/"/g, "&quot;");
    }
    return defaultSafeAttrValue(tag, name, value, css);
  },
});

// iframe は開始・終了タグを先に正規化する（許可した埋め込みだけ残し、孤立した </iframe> を作らない）
function normalizeIframes(html: string): string {
  return html
    .replace(/<\/iframe\s*>/gi, "")
    .replace(/<iframe\b[^>]*>/gi, (m) => (EMBED_OK.test(/\ssrc="([^"]*)"/i.exec(m)?.[1] ?? "") ? m + "</iframe>" : ""));
}

export function sanitizeHtml(html: string): string {
  return typeof html === "string" && html ? filter.process(normalizeIframes(html)) : "";
}
