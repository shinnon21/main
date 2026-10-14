import { readFileSync } from "node:fs";
import { urlsFor, extractHead, diffPage } from "./lib/urls.ts";

// usage: node scripts/compare-urls.ts <export.json> <oldBase> <newBase>
const [file, oldBase, newBase] = process.argv.slice(2);
if (!file || !oldBase || !newBase) {
  console.error("usage: node scripts/compare-urls.ts <export.json> <oldBase> <newBase>");
  process.exit(2);
}
const urls = urlsFor(JSON.parse(readFileSync(file, "utf8")));

async function snap(base: string, path: string) {
  const res = await fetch(base.replace(/\/$/, "") + path, { redirect: "manual", signal: AbortSignal.timeout(30_000) });
  const head = res.status === 200 ? extractHead(await res.text()) : { title: null, canonical: null };
  return { status: res.status, ...head };
}

let bad = 0, next = 0;
async function worker() {
  while (next < urls.length) {
    const u = urls[next++];
    const [a, b] = await Promise.all([snap(oldBase, u), snap(newBase, u)]);
    const d = diffPage(a, b);
    if (d.length) { bad++; console.log(`${u}\n  ${d.join("\n  ")}`); }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
console.log(`compared=${urls.length} differing=${bad}`);
process.exit(bad ? 1 : 0);
