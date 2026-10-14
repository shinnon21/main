export interface D1Like {
  prepare(sql: string): {
    bind(...a: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
    };
  };
}
