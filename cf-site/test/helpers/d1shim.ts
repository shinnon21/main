import type { DatabaseSync } from "node:sqlite";
import type { D1Like, D1Stmt } from "../../src/lib/d1.ts";

type Exec = { __exec: () => { changes: number; lastInsertRowid: number | bigint } };

export function d1(db: DatabaseSync): D1Like {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind: (...a) => {
          const args = a as any[];
          const s: D1Stmt & Exec = {
            all: async <T>() => ({ results: stmt.all(...args) as T[] }),
            first: async <T>() => ((stmt.get(...args) as T | undefined) ?? null),
            run: async () => { const r = stmt.run(...args); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }; },
            __exec: () => stmt.run(...args),
          };
          return s;
        },
      };
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const out = statements.map((s) => { (s as unknown as Exec).__exec(); return { results: [] as unknown[] }; });
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
