import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { mediaKey, originalsOnly, sniffContentType } from "./lib/media.ts";
import type { WpExport } from "./lib/types.ts";

// usage: node scripts/sync-media.ts <export.json> --local|--remote [uploadsDir] [bucket]
const [file, flag, dir = "data/uploads", bucket = "kb-media"] = process.argv.slice(2);
if (!file || !["--local", "--remote"].includes(flag)) {
  console.error("usage: node scripts/sync-media.ts <export.json> --local|--remote [uploadsDir] [bucket]");
  process.exit(2);
}
const exp: WpExport = JSON.parse(readFileSync(file, "utf8"));
const wanted = originalsOnly(exp.attachments.map((a) => a.path).filter(Boolean));
const mimeOf = new Map(exp.attachments.map((a) => [a.path, a.mime]));
const missing: string[] = [];
let uploaded = 0;
for (const p of wanted) {
  const key = mediaKey(p);
  const src = join(dir, key);
  if (!existsSync(src)) { missing.push(key); continue; }
  const ct = sniffContentType(readFileSync(src), key);
  if (ct !== mimeOf.get(p)) console.warn(`content-type: ${key} WP=${mimeOf.get(p)} sniffed=${ct}`);
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${bucket}/${key}`, "--file", src, "--content-type", ct, flag], { stdio: "inherit" });
  uploaded++;
}
console.log(`uploaded=${uploaded} expected=${wanted.length} missing=${missing.length}`);
if (missing.length) { console.error(missing.join("\n")); process.exit(1); }
