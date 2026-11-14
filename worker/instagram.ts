import { strFromU8, unzipSync } from "fflate";
import type { Person, Report } from "../shared/types";

/** The ZIP is JSON-only in the flow we ask for; anything far bigger is media. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 400;

/** A parse failure we can explain to the visitor. */
export class ExportError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "ExportError";
    this.hint = hint;
  }
}

type Json = unknown;
type Group = "followers" | "following" | "pending" | "blocked" | "closeFriends" | "recentlyUnfollowed";

/**
 * The export names changed over the years (`blocked.json` grew into
 * `blocked_profiles.json`); the browser download has no folder contract, so
 * matching is by base name alone.
 */
const RULES: [Group, RegExp][] = [
  ["followers", /^followers(?:_\d+)?\.json$/i],
  ["following", /^following\.json$/i],
  ["pending", /^pending_follow_requests\.json$/i],
  ["blocked", /^(?:blocked|blocked_profiles)\.json$/i],
  ["closeFriends", /^close_friends\.json$/i],
  ["recentlyUnfollowed", /^recently_unfollowed_profiles\.json$/i],
];

function groupOf(base: string): Group | null {
  for (const [group, pattern] of RULES) if (pattern.test(base)) return group;
  return null;
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** `followers_10.json` sorts after `followers_2.json`, and the order is the export's. */
function byExportOrder(a: string, b: string): number {
  const na = Number(a.match(/_(\d+)\.json$/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
  const nb = Number(b.match(/_(\d+)\.json$/i)?.[1] ?? Number.MAX_SAFE_INTEGER);
  return na - nb;
}

/** A relationship file is either a bare array or an object wrapping one (`relationships_following`). */
function arrayFrom(json: Json): Json[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const arrays = Object.values(json as Record<string, Json>).filter(Array.isArray) as Json[][];
    const biggest = arrays.sort((a, b) => b.length - a.length)[0];
    if (biggest) return biggest;
  }
  return [];
}

function isoFrom(seconds: number): string | undefined {
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function personFrom(entry: Json): Person | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, Json>;
  const list = Array.isArray(row.string_list_data) ? (row.string_list_data as Json[]) : [];
  const first = (list[0] && typeof list[0] === "object" ? list[0] : {}) as Record<string, Json>;
  const username = String(first.value ?? row.title ?? row.username ?? "")
    .trim()
    .replace(/^@/, "");
  if (!username) return null;
  const href =
    typeof first.href === "string" && first.href.length > 0
      ? first.href
      : `https://www.instagram.com/${encodeURIComponent(username)}`;
  const timestamp = Number(first.timestamp);
  const since = isoFrom(timestamp);
  return since ? { username, href, since } : { username, href };
}

interface Collected {
  people: Person[];
  skipped: number;
  duplicates: number;
}

/** Reads a relationship file, skipping malformed rows instead of failing the whole export. */
function collect(json: Json, into: Map<string, Person>, stats: Collected): void {
  for (const entry of arrayFrom(json)) {
    const person = personFrom(entry);
    if (!person) {
      stats.skipped += 1;
      continue;
    }
    const key = person.username.toLowerCase();
    const existing = into.get(key);
    if (existing) {
      stats.duplicates += 1;
      // Keep the earliest date: it's when the relationship started.
      if (person.since && (!existing.since || person.since < existing.since)) into.set(key, { ...existing, since: person.since });
      continue;
    }
    into.set(key, person);
  }
  stats.people = [...into.values()];
}

function sortPeople(people: Person[]): Person[] {
  return [...people].sort((a, b) => a.username.localeCompare(b.username, "pt-BR", { sensitivity: "base" }));
}

function readJson(entries: Record<string, Uint8Array>, path: string): Json {
  const bytes = entries[path];
  if (!bytes) return null;
  const text = strFromU8(bytes).replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text) as Json;
  } catch {
    throw new ExportError(
      `O arquivo ${baseName(path)} não parece um JSON válido.`,
      "Baixe o export de novo pelo Instagram; o ZIP pode ter sido corrompido no download.",
    );
  }
}

/**
 * Turns the Instagram "followers and following" export into one report. Pure:
 * takes the bytes, returns the numbers, keeps nothing.
 */
export function parseInstagramExport(bytes: Uint8Array): Report {
  let entries: Record<string, Uint8Array>;
  // Counted before decompressing: a ZIP that claims more than the budget stops
  // being read right there, instead of inflating first and being rejected after.
  let budget = 0;
  try {
    entries = unzipSync(bytes, {
      filter: (file) => {
        if (!/\.(json|html)$/i.test(file.name)) return false;
        if (file.originalSize > MAX_UNCOMPRESSED_BYTES) return false;
        budget += file.originalSize;
        return budget <= MAX_UNCOMPRESSED_BYTES;
      },
    });
  } catch {
    throw new ExportError(
      "Não consegui abrir esse ZIP.",
      "Confira se é o .zip baixado direto do Instagram, sem renomear nem repassar por outros apps.",
    );
  }

  const paths = Object.keys(entries);
  if (paths.length === 0) {
    throw new ExportError(
      "O ZIP não tem arquivos .json.",
      "No pedido de download, escolha o formato JSON (não HTML) e marque só “Seguidores e seguindo”.",
    );
  }
  if (paths.length > MAX_ENTRIES) {
    throw new ExportError("Esse ZIP tem arquivos demais.", "Envie só o export de seguidores e seguindo.");
  }
  const total = paths.reduce((sum, path) => sum + (entries[path]?.byteLength ?? 0), 0);
  if (budget > MAX_UNCOMPRESSED_BYTES || total > MAX_UNCOMPRESSED_BYTES) {
    throw new ExportError(
      "Esse export é grande demais para ler aqui.",
      "Refaça o download marcando só “Seguidores e seguindo” — sem fotos, vídeos nem outras categorias.",
    );
  }

  const found: Record<Group, string[]> = {
    followers: [],
    following: [],
    pending: [],
    blocked: [],
    closeFriends: [],
    recentlyUnfollowed: [],
  };
  let htmlOnly = false;
  for (const path of paths) {
    const base = baseName(path);
    const group = groupOf(base);
    if (group) found[group].push(path);
    else if (/^followers(?:_\d+)?\.html$|^following\.html$/i.test(base)) htmlOnly = true;
  }

  if (found.followers.length === 0 && found.following.length === 0) {
    if (htmlOnly) {
      throw new ExportError(
        "Esse export veio em HTML, não em JSON.",
        "No Instagram, peça o download de novo e escolha o formato JSON. O HTML não traz a lista de perfis.",
      );
    }
    throw new ExportError(
      "Não achei seus seguidores dentro do ZIP.",
      "Baixe em Conta → Suas atividades → Baixar suas informações, marcando só “Seguidores e seguindo”.",
    );
  }
  if (found.followers.length === 0) {
    throw new ExportError(
      "Achei quem você segue, mas não os seus seguidores.",
      "Marque “Seguidores e seguindo” (os dois) no pedido de download do Instagram.",
    );
  }

  const warnings: string[] = [];
  const files: string[] = [];

  const followers = new Map<string, Person>();
  const followerStats: Collected = { people: [], skipped: 0, duplicates: 0 };
  for (const path of [...found.followers].sort(byExportOrder)) {
    files.push(baseName(path));
    collect(readJson(entries, path), followers, followerStats);
  }

  const following = new Map<string, Person>();
  const followingStats: Collected = { people: [], skipped: 0, duplicates: 0 };
  for (const path of found.following) {
    files.push(baseName(path));
    collect(readJson(entries, path), following, followingStats);
  }
  if (found.following.length === 0) {
    warnings.push("O ZIP não tem o following.json: as listas de quem você segue saíram vazias.");
  }

  const extras = {
    blocked: new Map<string, Person>(),
    closeFriends: new Map<string, Person>(),
    pending: new Map<string, Person>(),
    recentlyUnfollowed: new Map<string, Person>(),
  };
  for (const group of ["blocked", "closeFriends", "pending", "recentlyUnfollowed"] as const) {
    const stats: Collected = { people: [], skipped: 0, duplicates: 0 };
    for (const path of found[group]) {
      files.push(baseName(path));
      collect(readJson(entries, path), extras[group], stats);
    }
  }

  const notFollowingBack: Person[] = [];
  for (const [key, person] of following) if (!followers.has(key)) notFollowingBack.push(person);

  const youDontFollowBack: Person[] = [];
  const mutuals: Person[] = [];
  for (const [key, person] of followers) {
    if (following.has(key)) mutuals.push(person);
    else youDontFollowBack.push(person);
  }

  const skipped = followerStats.skipped + followingStats.skipped;
  if (skipped > 0) {
    warnings.push(
      skipped === 1 ? "1 entrada sem @ foi ignorada." : `${skipped} entradas sem @ foram ignoradas.`,
    );
  }
  const duplicates = followerStats.duplicates + followingStats.duplicates;
  if (duplicates > 0) {
    warnings.push(
      duplicates === 1 ? "1 repetido foi contado uma vez só." : `${duplicates} repetidos foram contados uma vez só.`,
    );
  }

  return {
    counts: {
      followers: followers.size,
      following: following.size,
      notFollowingBack: notFollowingBack.length,
      youDontFollowBack: youDontFollowBack.length,
      mutuals: mutuals.length,
    },
    notFollowingBack: sortPeople(notFollowingBack),
    youDontFollowBack: sortPeople(youDontFollowBack),
    mutuals: sortPeople(mutuals),
    extras: {
      blocked: sortPeople([...extras.blocked.values()]),
      closeFriends: sortPeople([...extras.closeFriends.values()]),
      pending: sortPeople([...extras.pending.values()]),
      recentlyUnfollowed: sortPeople([...extras.recentlyUnfollowed.values()]),
    },
    files,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
