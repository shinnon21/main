import xss from "xss";

const { FilterXSS, safeAttrValue: defaultSafeAttrValue } = xss as unknown as { FilterXSS: typeof import("xss").FilterXSS; safeAttrValue: typeof import("xss").safeAttrValue };

const TAGS = "h1 h2 h3 h4 h5 h6 p br hr ul ol li blockquote pre code strong em u s a img figure figcaption table thead tbody tr th td iframe".split(" ");
const COMMON = ["class", "style", "dir"];
const wl: Record<string, string[]> = {};
for (const t of TAGS) wl[t] = [...COMMON];
wl.a = ["href", "title", "target", "rel", ...COMMON];
wl.img = ["src", "alt", "title", "width", "height", ...COMMON];
wl.iframe = ["src", "title", "width", "height", "loading", "allowfullscreen", ...COMMON];
wl.td = ["colspan", "rowspan", ...COMMON];
wl.th = ["colspan", "rowspan", ...COMMON];

const URL_OK = /^(?:https?:\/\/|mailto:|\/(?!\/)|#)/i;
const EMBED_OK = /^https:\/\/(?:www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}|open\.spotify\.com\/embed\/(?:episode|show|track)\/[A-Za-z0-9]{22})(?:\?[A-Za-z0-9_=&%.-]*)?$/;
// 制御文字・各種空白を除いた形でスキームを判定する（"java\tscript:" 等の回避対策）
const squash = (v: string) => v.replace(new RegExp("[\\u0000-\\u0020\\u00a0\\u1680\\u180e\\u2000-\\u2029\\u205f\\u3000\\ufeff]", "g"), "");

const filter: FilterXSS = new FilterXSS({
  whiteList: wl,
  // style は見た目の寸法・揃えだけ許可（position/background/url() 等は cssfilter が除去）
  css: { whiteList: { width: true, height: true, "max-width": true, "text-align": true } },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style"],
  allowCommentTag: false,
  safeAttrValue(tag, name, value, css) {
    if (name === "href" || name === "src") {
      const v = value.trim();
      if (!URL_OK.test(v) || /^(?:javascript|data|vbscript):/i.test(squash(v))) return "";
      return v.replace(/"/g, "&quot;");
    }
    return defaultSafeAttrValue(tag, name, value, css);
  },
});

// iframe は属性を自前で解析して再構築する（許可した埋め込みだけ残し、重複 src・引用符の入れ子・srcdoc・allow を持ち込ませない）
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const escAttr = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function normalizeIframes(html: string): string {
  return html
    .replace(/<\/iframe\s*>/gi, "")
    .replace(/<iframe\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi, (_m, attrs: string) => {
      const seen = new Map<string, string>();
      let dupSrc = false;
      for (const m of attrs.matchAll(ATTR_RE)) {
        const name = m[1].toLowerCase();
        const v = m[2] ?? m[3] ?? m[4] ?? "";
        if (seen.has(name)) { if (name === "src") dupSrc = true; } else seen.set(name, v);
      }
      const src = seen.get("src") ?? "";
      if (dupSrc || !EMBED_OK.test(src)) return "";
      let out = `<iframe src="${escAttr(src)}"`;
      const title = seen.get("title"); if (title) out += ` title="${escAttr(title.slice(0, 200))}"`;
      for (const k of ["width", "height"]) { const v = seen.get(k); if (v && /^\d{1,4}$/.test(v)) out += ` ${k}="${v}"`; }
      const loading = seen.get("loading"); if (loading === "lazy" || loading === "eager") out += ` loading="${loading}"`;
      if (seen.has("allowfullscreen")) out += " allowfullscreen";
      return out + "></iframe>";
    });
}

// target=_blank には必ず rel="noopener" を付ける（無害化後の出力に対して行うため、属性は既にホワイトリスト済み）
function enforceNoopener(html: string): string {
  return html.replace(/<a\b[^>]*>/gi, (tag) => {
    if (!/\starget="_blank"/i.test(tag)) return tag;
    const m = /\srel="([^"]*)"/i.exec(tag);
    if (!m) return tag.replace(/\starget="_blank"/i, ' target="_blank" rel="noopener"');
    const tokens = m[1].split(/\s+/).map((t) => t.toLowerCase()).filter((t) => /^(?:noopener|noreferrer|nofollow|ugc|sponsored)$/.test(t));
    if (!tokens.includes("noopener")) tokens.push("noopener");
    return tag.replace(/\srel="[^"]*"/i, ` rel="${[...new Set(tokens)].join(" ")}"`);
  });
}

export function sanitizeHtml(html: string): string {
  return typeof html === "string" && html ? enforceNoopener(filter.process(normalizeIframes(html))) : "";
}
