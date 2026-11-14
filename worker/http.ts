import type { ApiError } from "../shared/types";

export const NO_STORE = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...NO_STORE, ...headers },
  });
}

export function fail(status: number, error: string, hint?: string): Response {
  const body: ApiError = hint ? { error, hint } : { error };
  return json(body, status);
}

/**
 * A browser sends `Origin` on every POST/DELETE, cross-origin or not; a missing
 * one means a non-browser caller (curl, another Worker), which carries no cookie
 * to be abused. So: absent is fine, present must be us.
 */
export function crossOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== url.host;
  } catch {
    return true;
  }
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function requestIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "local";
}
