import { readFileSync } from "node:fs";
import { buildImportSql } from "./lib/import-sql.ts";
const force = process.argv.includes("--force");
const exp = JSON.parse(readFileSync(process.argv.slice(2).find((a) => !a.startsWith("--"))!, "utf8"));
const r = buildImportSql(exp, { force });
if (force) console.error("WARNING: --force omits the CMS guard; applying this SQL overwrites ALL content.");
process.stdout.write(r.statements.join("\n") + "\n");
console.error(`statements=${r.statements.length} skipped=${JSON.stringify(r.skipped)} artifacts=${JSON.stringify(r.artifacts)}`);
