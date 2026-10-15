export interface D1Stmt {
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number; last_row_id: number } }>;
}
export interface D1Like {
  prepare(sql: string): { bind(...a: unknown[]): D1Stmt };
  batch(statements: D1Stmt[]): Promise<{ results: unknown[] }[]>;
}
