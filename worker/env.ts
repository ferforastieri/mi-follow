/** The Worker's bindings, typed by hand so the project needs no extra package. */

export interface D1Result<T> {
  results: T[];
  success: boolean;
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1Database;
  /** Optional so `vite dev` against a bare `wrangler dev` still boots. */
  ANALYZE_LIMIT?: RateLimit;
  AUTH_LIMIT?: RateLimit;
  API_LIMIT?: RateLimit;
}
