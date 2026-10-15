// usage: node scripts/check-sanitize.ts <export.json>  既存の本文を無害化しても内容が変わらないか全件点検する
import { readFileSync } from "node:fs";
import { rewriteUploads, stripBlockComments } from "./lib/transform.ts";
import { sanitizeHtml } from "../src/lib/sanitize.ts";
import type { WpExport } from "./lib/types.ts";

const exp: WpExport = JSON.parse(readFileSync(process.argv[2], "utf8"));
// 見た目に影響しない差（空白・空要素の閉じ方・altの直列化・貼り付け由来のdata-*属性・cssfilterの整形）は正規化して比較する
const norm = (s: string) => s.replace(/\sdata-[\w-]+="[^"]*"/g, "").replace(/\s*\/>/g, ">").replace(/\s+/g, " ").replace(/> </g, "><").replace(/ alt(="")?(?=[ >])/g, " alt").replace(/:\s+/g, ":").replace(/;\s*"/g, '"').replace(/;\s+/g, ";").trim();
let bad = 0, total = 0;
for (const p of exp.posts) {
  if (p.status !== "publish" || p.password_protected) continue;
  const fields: [string, unknown][] = [["content", p.content], ["content_en", p.meta.content_en]];
  for (const [name, raw] of fields) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    total++;
    const src = stripBlockComments(rewriteUploads(raw, exp.site_url));
    const out = sanitizeHtml(src);
    if (norm(src) !== norm(out)) {
      bad++;
      const a = norm(src), b = norm(out); let i = 0; while (i < a.length && a[i] === b[i]) i++;
      console.log(`DIFF ${p.type}/${p.id} ${name}\n  in : …${a.slice(Math.max(0, i - 40), i + 80)}\n  out: …${b.slice(Math.max(0, i - 40), i + 80)}`);
    }
  }
}
console.log(`checked=${total} changed=${bad}`);
process.exit(bad ? 1 : 0);
