import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { compareCounts, expectedCounts, type Counts } from "./lib/verify.ts";

const [file, flag] = [process.argv[2], process.argv[3] ?? "--local"];
if (!file || !["--local", "--remote"].includes(flag)) {
  console.error("usage: node scripts/verify.ts <export.json> --local|--remote");
  process.exit(2);
}
const exp = JSON.parse(readFileSync(file, "utf8"));

function query<T>(sql: string): T[] {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "DB", flag, "--json", "--command", sql], { encoding: "utf8" });
  return JSON.parse(out)[0].results as T[];
}

const posts: Record<string, number> = {};
for (const r of query<{ type: string; c: number }>("SELECT type, COUNT(*) c FROM posts GROUP BY type")) posts[r.type] = r.c;
const actual: Counts = {
  posts,
  postTerms: query<{ c: number }>("SELECT COUNT(*) c FROM post_terms")[0].c,
  attachmentsReferenced: query<{ c: number }>("SELECT COUNT(DISTINCT thumbnail) c FROM posts WHERE thumbnail IS NOT NULL")[0].c,
};
const diffs = compareCounts(expectedCounts(exp), actual);
if (diffs.length) { console.error(diffs.join("\n")); process.exit(1); }
console.log("verify: OK", JSON.stringify(actual));
