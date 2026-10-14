import { readFileSync } from "node:fs";
import { buildImportSql } from "./lib/import-sql.ts";
const exp = JSON.parse(readFileSync(process.argv[2], "utf8"));
const r = buildImportSql(exp);
process.stdout.write(r.statements.join("\n") + "\n");
console.error(`statements=${r.statements.length} skipped=${JSON.stringify(r.skipped)} artifacts=${JSON.stringify(r.artifacts)}`);
