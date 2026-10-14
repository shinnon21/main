import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(new URL("../../kobayashi-theme/functions.php", import.meta.url), "utf8");
const accounts = [...src.matchAll(/'(\w+)'\s*=>\s*array\(\s*'label'\s*=>\s*'([^']+)',\s*'url'\s*=>\s*'([^']+)'\s*\)/g)].map((m) => ({ key: m[1], label: m[2], url: m[3] }));
const svgs = Object.fromEntries([...src.matchAll(/'(linkedin|facebook|instagram|x|note)'\s*=>\s*'(<svg[\s\S]*?<\/svg>)',/g)].map((m) => [m[1], m[2]]));
if (accounts.length !== 5 || Object.keys(svgs).length !== 5) throw new Error(`parse failed: ${accounts.length} accounts, ${Object.keys(svgs).length} svgs`);
const out = accounts.map((a) => ({ ...a, svg: svgs[a.key] }));
writeFileSync(new URL("../src/lib/sns.ts", import.meta.url), `// 生成物: scripts/gen-sns.ts（kobayashi-theme/functions.php の kb_sns_accounts / kb_sns_links より）\nexport const SNS: { key: "linkedin" | "facebook" | "x" | "instagram" | "note"; label: string; url: string; svg: string }[] = ${JSON.stringify(out, null, 2)} as never;\n`);
