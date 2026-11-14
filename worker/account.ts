import type { Person, PublicUser, Report, SnapshotDiff, SnapshotMeta } from "../shared/types";
import {
  burnPasswordCheck,
  clearCookie,
  createSession,
  destroySession,
  hashPassword,
  PASSWORD_ITERATIONS,
  sessionCookie,
  sessionUser,
  verifyPassword,
  type UserRow,
} from "./auth";
import type { Env } from "./env";
import { fail, json, readJson, requestIp } from "./http";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_SNAPSHOTS = 24;
const MAX_PAYLOAD = 4_000_000;

interface SnapshotRow {
  id: string;
  created_at: string;
  followers: number;
  following: number;
  not_following_back: number;
  you_dont_follow: number;
  mutuals: number;
  payload: string;
}

function publicUser(row: UserRow): PublicUser {
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

function secureRequest(url: URL): boolean {
  return url.protocol === "https:";
}

/** A per-IP budget for anything that touches a password. */
async function authLimited(request: Request, env: Env): Promise<Response | null> {
  if (!env.AUTH_LIMIT) return null;
  const { success } = await env.AUTH_LIMIT.limit({ key: requestIp(request) });
  return success ? null : fail(429, "Muitas tentativas em pouco tempo.", "Espere um minuto e tente de novo.");
}

/* ---------- account ---------- */

async function handleAuth(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/api/auth/me" && request.method === "GET") {
    const user = await sessionUser(request, env);
    return json({ user: user ? publicUser(user) : null });
  }

  if (path === "/api/auth/register" && request.method === "POST") {
    const limited = await authLimited(request, env);
    if (limited) return limited;

    const body = await readJson<{ email?: unknown; password?: unknown }>(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!EMAIL.test(email) || email.length > 254) return fail(422, "E-mail inválido.");
    if (password.length < 8) return fail(422, "A senha precisa de pelo menos 8 caracteres.");
    if (password.length > 200) return fail(422, "Senha longa demais.");

    const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (existing) return fail(409, "Esse e-mail já tem conta.", "Use “Entrar” ou outro e-mail.");

    const { hash, salt, iterations } = await hashPassword(password);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, email, password_hash, salt, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(id, email, hash, salt, iterations, createdAt)
        .run();
    } catch {
      return fail(409, "Esse e-mail já tem conta.", "Use “Entrar” ou outro e-mail.");
    }

    const session = await createSession(env, id);
    return json(
      { user: { id, email, createdAt } },
      201,
      { "set-cookie": sessionCookie(session.token, secureRequest(url)) },
    );
  }

  if (path === "/api/auth/login" && request.method === "POST") {
    const limited = await authLimited(request, env);
    if (limited) return limited;

    const body = await readJson<{ email?: unknown; password?: unknown }>(request);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !password) return fail(422, "Informe e-mail e senha.");

    const row = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
    if (!row) {
      await burnPasswordCheck(password);
      return fail(401, "E-mail ou senha não conferem.");
    }
    const ok = await verifyPassword(password, row.salt, row.iterations || PASSWORD_ITERATIONS, row.password_hash);
    if (!ok) return fail(401, "E-mail ou senha não conferem.");

    // Housekeeping, cheap and only on a successful login.
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(new Date().toISOString()).run();

    const session = await createSession(env, row.id);
    return json({ user: publicUser(row) }, 200, { "set-cookie": sessionCookie(session.token, secureRequest(url)) });
  }

  if (path === "/api/auth/logout" && request.method === "POST") {
    await destroySession(request, env);
    return json({ ok: true }, 200, { "set-cookie": clearCookie(secureRequest(url)) });
  }

  if (path === "/api/auth/account" && request.method === "DELETE") {
    const user = await sessionUser(request, env);
    if (!user) return fail(401, "Entre para apagar a conta.");
    await env.DB.batch([
      env.DB.prepare("DELETE FROM snapshots WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
      env.DB.prepare("DELETE FROM users WHERE id = ?").bind(user.id),
    ]);
    return json({ ok: true }, 200, { "set-cookie": clearCookie(secureRequest(url)) });
  }

  return fail(404, "Rota não encontrada.");
}

/* ---------- snapshots ---------- */

function sanitizePerson(value: unknown): Person | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const username = typeof row.username === "string" ? row.username.trim().slice(0, 64) : "";
  if (!username) return null;
  const href =
    typeof row.href === "string" && row.href.startsWith("https://")
      ? row.href.slice(0, 300)
      : `https://www.instagram.com/${encodeURIComponent(username)}`;
  const since =
    typeof row.since === "string" && !Number.isNaN(Date.parse(row.since)) ? row.since : undefined;
  return since ? { username, href, since } : { username, href };
}

function sanitizePeople(value: unknown, max = 300_000): Person[] | null {
  if (!Array.isArray(value) || value.length > max) return null;
  const people: Person[] = [];
  for (const item of value) {
    const person = sanitizePerson(item);
    if (person) people.push(person);
  }
  return people;
}

function sanitizeReport(value: unknown): Report | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const rawCounts = raw.counts as Record<string, unknown> | undefined;
  if (!rawCounts) return null;

  const number = (name: string) => {
    const n = rawCounts[name];
    return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 5_000_000 ? n : null;
  };
  const counts = {
    followers: number("followers"),
    following: number("following"),
    notFollowingBack: number("notFollowingBack"),
    youDontFollowBack: number("youDontFollowBack"),
    mutuals: number("mutuals"),
  };
  if (Object.values(counts).some((n) => n === null)) return null;

  const notFollowingBack = sanitizePeople(raw.notFollowingBack);
  const youDontFollowBack = sanitizePeople(raw.youDontFollowBack);
  const mutuals = sanitizePeople(raw.mutuals);
  if (!notFollowingBack || !youDontFollowBack || !mutuals) return null;

  const rawExtras = (raw.extras ?? {}) as Record<string, unknown>;
  const extras = {
    blocked: sanitizePeople(rawExtras.blocked, 50_000) ?? [],
    closeFriends: sanitizePeople(rawExtras.closeFriends, 50_000) ?? [],
    pending: sanitizePeople(rawExtras.pending, 50_000) ?? [],
    recentlyUnfollowed: sanitizePeople(rawExtras.recentlyUnfollowed, 50_000) ?? [],
  };

  return {
    counts: counts as Report["counts"],
    notFollowingBack,
    youDontFollowBack,
    mutuals,
    extras,
    files: Array.isArray(raw.files) ? raw.files.filter((f): f is string => typeof f === "string").slice(0, 20) : [],
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w): w is string => typeof w === "string").slice(0, 20)
      : [],
    generatedAt:
      typeof raw.generatedAt === "string" && !Number.isNaN(Date.parse(raw.generatedAt))
        ? raw.generatedAt
        : new Date().toISOString(),
  };
}

function metaFromRow(row: SnapshotRow): SnapshotMeta {
  return {
    id: row.id,
    createdAt: row.created_at,
    counts: {
      followers: row.followers,
      following: row.following,
      notFollowingBack: row.not_following_back,
      youDontFollowBack: row.you_dont_follow,
      mutuals: row.mutuals,
    },
  };
}

function peopleMaps(report: Report) {
  const followers = new Map<string, Person>();
  const following = new Map<string, Person>();
  for (const person of report.mutuals) {
    followers.set(person.username.toLowerCase(), person);
    following.set(person.username.toLowerCase(), person);
  }
  for (const person of report.youDontFollowBack) followers.set(person.username.toLowerCase(), person);
  for (const person of report.notFollowingBack) following.set(person.username.toLowerCase(), person);
  return { followers, following };
}

function diffOf(fromReport: Report, toReport: Report): Omit<SnapshotDiff, "from" | "to"> {
  const from = peopleMaps(fromReport);
  const to = peopleMaps(toReport);
  const sort = (people: Person[]) =>
    people.sort((a, b) => a.username.localeCompare(b.username, "pt-BR", { sensitivity: "base" }));

  const newFollowers: Person[] = [];
  for (const [key, person] of to.followers) if (!from.followers.has(key)) newFollowers.push(person);

  const lostFollowers: Person[] = [];
  for (const [key, person] of from.followers) if (!to.followers.has(key)) lostFollowers.push(person);

  const newFollowing: Person[] = [];
  for (const [key, person] of to.following) if (!from.following.has(key)) newFollowing.push(person);

  const unfollowed: Person[] = [];
  for (const [key, person] of from.following) if (!to.following.has(key)) unfollowed.push(person);

  return {
    newFollowers: sort(newFollowers),
    lostFollowers: sort(lostFollowers),
    newFollowing: sort(newFollowing),
    unfollowed: sort(unfollowed),
  };
}

async function handleSnapshots(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await sessionUser(request, env);
  if (!user) return fail(401, "Entre para guardar e comparar análises.", "Crie uma conta com e-mail e senha.");

  // /api/snapshots/compare?from=…&to=…
  if (url.pathname === "/api/snapshots/compare" && request.method === "GET") {
    const fromId = url.searchParams.get("from");
    const toId = url.searchParams.get("to");
    if (!fromId || !toId || fromId === toId) return fail(400, "Escolha duas análises diferentes.");

    const rows = await env.DB.prepare("SELECT * FROM snapshots WHERE user_id = ? AND id IN (?, ?)")
      .bind(user.id, fromId, toId)
      .all<SnapshotRow>();
    if (rows.results.length !== 2) return fail(404, "Análise não encontrada.");

    const fromRow = rows.results.find((row) => row.id === fromId);
    const toRow = rows.results.find((row) => row.id === toId);
    if (!fromRow || !toRow) return fail(404, "Análise não encontrada.");

    const fromReport = JSON.parse(fromRow.payload) as Report;
    const toReport = JSON.parse(toRow.payload) as Report;
    const diff: SnapshotDiff = {
      from: metaFromRow(fromRow),
      to: metaFromRow(toRow),
      ...diffOf(fromReport, toReport),
    };
    return json(diff);
  }

  if (url.pathname === "/api/snapshots" && request.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT id, created_at, followers, following, not_following_back, you_dont_follow, mutuals, payload FROM snapshots WHERE user_id = ? ORDER BY created_at DESC LIMIT 60",
    )
      .bind(user.id)
      .all<SnapshotRow>();
    return json({ snapshots: rows.results.map(metaFromRow) });
  }

  if (url.pathname === "/api/snapshots" && request.method === "POST") {
    const body = await readJson<{ report?: unknown }>(request);
    const report = sanitizeReport(body?.report);
    if (!report) return fail(422, "Análise inválida.");

    const payload = JSON.stringify(report);
    if (payload.length > MAX_PAYLOAD) {
      return fail(413, "Análise grande demais para guardar.", "Export com muitos milhares de perfis não cabe.");
    }

    const counted = await env.DB.prepare("SELECT COUNT(*) AS total FROM snapshots WHERE user_id = ?")
      .bind(user.id)
      .first<{ total: number }>();
    if ((counted?.total ?? 0) >= MAX_SNAPSHOTS) {
      return fail(409, `Você já guardou ${MAX_SNAPSHOTS} análises.`, "Apague uma antiga para guardar esta.");
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await env.DB.prepare(
      "INSERT INTO snapshots (id, user_id, created_at, followers, following, not_following_back, you_dont_follow, mutuals, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        user.id,
        createdAt,
        report.counts.followers,
        report.counts.following,
        report.counts.notFollowingBack,
        report.counts.youDontFollowBack,
        report.counts.mutuals,
        payload,
      )
      .run();

    const row: SnapshotRow = {
      id,
      created_at: createdAt,
      followers: report.counts.followers,
      following: report.counts.following,
      not_following_back: report.counts.notFollowingBack,
      you_dont_follow: report.counts.youDontFollowBack,
      mutuals: report.counts.mutuals,
      payload,
    };
    return json({ snapshot: metaFromRow(row) }, 201);
  }

  const match = /^\/api\/snapshots\/([A-Za-z0-9-]{8,64})$/.exec(url.pathname);
  if (match) {
    const id = match[1];
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT * FROM snapshots WHERE id = ? AND user_id = ?")
        .bind(id, user.id)
        .first<SnapshotRow>();
      if (!row) return fail(404, "Análise não encontrada.");
      return json({ snapshot: metaFromRow(row), report: JSON.parse(row.payload) as Report });
    }
    if (request.method === "DELETE") {
      await env.DB.prepare("DELETE FROM snapshots WHERE id = ? AND user_id = ?").bind(id, user.id).run();
      return json({ ok: true });
    }
  }

  return fail(404, "Rota não encontrada.");
}

export { handleAuth, handleSnapshots };
