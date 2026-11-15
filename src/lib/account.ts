import type { PublicUser, Report, SnapshotDiff, SnapshotMeta } from "../../shared/types";

export class AccountError extends Error {
  readonly hint?: string;
  readonly status: number;

  constructor(message: string, hint: string | undefined, status: number) {
    super(message);
    this.name = "AccountError";
    this.hint = hint;
    this.status = status;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...init });
  } catch {
    throw new AccountError("Não consegui falar com o servidor.", "Confira sua conexão e tente de novo.", 0);
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const body = (payload ?? {}) as { error?: string; hint?: string };
    throw new AccountError(body.error ?? "Algo deu errado.", body.hint, response.status);
  }
  return payload as T;
}

const postJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const getMe = () => call<{ user: PublicUser | null }>("/api/auth/me").then((result) => result.user);

export const register = (email: string, password: string) =>
  call<{ user: PublicUser }>("/api/auth/register", postJson({ email, password })).then((result) => result.user);

export const login = (email: string, password: string) =>
  call<{ user: PublicUser }>("/api/auth/login", postJson({ email, password })).then((result) => result.user);

export const logout = () => call<{ ok: true }>("/api/auth/logout", { method: "POST" });

export const deleteAccount = () => call<{ ok: true }>("/api/auth/account", { method: "DELETE" });

export const getSnapshot = (id: string) =>
  call<{ snapshot: SnapshotMeta; report: Report }>(`/api/snapshots/${encodeURIComponent(id)}`).then(
    (result) => result.report,
  );

export const listSnapshots = () =>
  call<{ snapshots: SnapshotMeta[] }>("/api/snapshots").then((result) => result.snapshots);

export const saveSnapshot = (report: Report) =>
  call<{ snapshot: SnapshotMeta }>("/api/snapshots", postJson({ report })).then((result) => result.snapshot);

export const deleteSnapshot = (id: string) =>
  call<{ ok: true }>(`/api/snapshots/${encodeURIComponent(id)}`, { method: "DELETE" });

export const compareSnapshots = (from: string, to: string) =>
  call<SnapshotDiff>(`/api/snapshots/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
