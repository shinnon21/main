import type { DatabaseSync } from "node:sqlite";
import type { D1Like } from "../../src/lib/d1.ts";
export function d1(db: DatabaseSync): D1Like {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return {
        bind: (...a) => ({
          all: async <T>() => ({ results: stmt.all(...(a as any[])) as T[] }),
          first: async <T>() => ((stmt.get(...(a as any[])) as T | undefined) ?? null),
        }),
      };
    },
  };
}
