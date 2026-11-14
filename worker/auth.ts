import type { Env } from "./env";

/**
 * Passwords and sessions without a dependency: PBKDF2-SHA256 from the platform
 * crypto, and opaque session tokens whose SHA-256 (never the token) is stored.
 */

/**
 * 100k is Cloudflare's ceiling for PBKDF2 in production (above it the platform
 * throws `NotSupportedError`; local workerd doesn't). Kept in each row so it can
 * grow if the limit ever does.
 */
export const PASSWORD_ITERATIONS = 100_000;
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const COOKIE = "mf_session";
/** Over https the cookie takes the `__Host-` prefix: the browser then refuses a
 * same-named cookie set for a parent domain or another path. */
const SECURE_COOKIE = "__Host-mf_session";

const encoder = new TextEncoder();

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  salt: string;
  iterations: number;
  created_at: string;
}

export function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function randomToken(bytes = 32): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return base64Url(new Uint8Array(digest));
}

async function derive(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromBase64Url(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return base64Url(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = randomToken(16);
  return { hash: await derive(password, salt, PASSWORD_ITERATIONS), salt, iterations: PASSWORD_ITERATIONS };
}

export async function verifyPassword(
  password: string,
  salt: string,
  iterations: number,
  expected: string,
): Promise<boolean> {
  const hash = await derive(password, salt, iterations);
  // Same length always; compare every character anyway so a wrong password and a
  // wrong account cost the same.
  let diff = hash.length === expected.length ? 0 : 1;
  const length = Math.min(hash.length, expected.length);
  for (let i = 0; i < length; i += 1) diff |= hash.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** One PBKDF2 round for an e-mail that doesn't exist, so timing doesn't tell. */
export async function burnPasswordCheck(password: string): Promise<void> {
  await derive(password, "AAAAAAAAAAAAAAAAAAAAAA", PASSWORD_ITERATIONS);
}

export function sessionCookie(token: string, secure: boolean): string {
  const name = secure ? SECURE_COOKIE : COOKIE;
  const base = `${name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}`;
  return secure ? `${base}; Secure` : base;
}

export function clearCookie(secure: boolean): string {
  const name = secure ? SECURE_COOKIE : COOKIE;
  const base = `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  return secure ? `${base}; Secure` : base;
}

export function readSessionToken(request: Request): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE || name === SECURE_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export async function createSession(env: Env, userId: string): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken();
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_SECONDS * 1000);
  await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, userId, now.toISOString(), expires.toISOString())
    .run();
  return { token, expiresAt: expires.toISOString() };
}

export async function sessionUser(request: Request, env: Env): Promise<UserRow | null> {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token);
  return env.DB.prepare(
    "SELECT u.id, u.email, u.password_hash, u.salt, u.iterations, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
  )
    .bind(tokenHash, new Date().toISOString())
    .first<UserRow>();
}

export async function destroySession(request: Request, env: Env): Promise<void> {
  const token = readSessionToken(request);
  if (!token) return;
  const tokenHash = await sha256(token);
  await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}
