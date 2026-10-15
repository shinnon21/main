import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

export function buildSeedSql(en: Record<string, string>): string[] {
  const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
  return Object.entries(en).map(
    ([k, v]) => `INSERT OR REPLACE INTO post_meta(post_id,key,value) VALUES((SELECT id FROM posts WHERE type='page' AND slug='profile'),${q(k + "_en")},${q(JSON.stringify(v))});`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = readFileSync(new URL("../../kobayashi-theme/functions.php", import.meta.url), "utf8");
  const fn = src.match(/function kb_profile_defaults_en\(\)[\s\S]*?\n\}\n/)?.[0];
  if (!fn) throw new Error("kb_profile_defaults_en not found");
  const json = execFileSync("php", ["-r", `${fn} echo json_encode(kb_profile_defaults_en(), JSON_UNESCAPED_UNICODE);`], { encoding: "utf8" });
  const en = JSON.parse(json) as Record<string, string>;
  if (!en.profile_bio || !en.profile_career) throw new Error("unexpected PHP output");
  process.stdout.write(buildSeedSql(en).join("\n") + "\n");
}
