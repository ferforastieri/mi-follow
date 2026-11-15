import { handleAuth, handleSnapshots } from "./account";
import type { Env } from "./env";
import { harden } from "./headers";
import { crossOrigin, fail, json, requestIp } from "./http";
import { ExportError, MAX_UPLOAD_BYTES, parseInstagramExport } from "./instagram";

function isZip(bytes: Uint8Array): boolean {
  // "PK" - a local file header (03 04), or the end-of-central-directory of an empty zip (05 06).
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function analyze(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") return fail(405, "Use POST para enviar o ZIP.");

  const type = request.headers.get("content-type") ?? "";
  if (!/^(application\/zip|application\/x-zip-compressed|application\/octet-stream)\b/i.test(type)) {
    return fail(415, "Envie o arquivo .zip como corpo da requisição.");
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_UPLOAD_BYTES) {
    return fail(
      413,
      "Arquivo grande demais.",
      "Um export só de seguidores e seguindo tem poucos KB. Você provavelmente marcou fotos, vídeos ou outras categorias.",
    );
  }

  const ip = requestIp(request);
  if (env.ANALYZE_LIMIT) {
    const { success } = await env.ANALYZE_LIMIT.limit({ key: ip });
    if (!success) return fail(429, "Muitos envios em pouco tempo.", "Espere um minuto e tente de novo.");
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return fail(400, "O arquivo chegou vazio.");
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return fail(413, "Arquivo grande demais.");
  if (!isZip(bytes)) {
    return fail(415, "Isso não é um ZIP.", "Envie o .zip baixado do Instagram, sem descompactar antes.");
  }

  try {
    // Nothing is written: the bytes live for this request and are dropped with it.
    return json(parseInstagramExport(bytes));
  } catch (error) {
    if (error instanceof ExportError) return fail(422, error.message, error.hint);
    console.error("analyze failed", error);
    return fail(500, "Não consegui ler esse export.", "Tente de novo; se persistir, baixe o ZIP novamente do Instagram.");
  }
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  // A blanket budget per IP, before any handler sees the request.
  if (url.pathname.startsWith("/api/") && env.API_LIMIT) {
    const { success } = await env.API_LIMIT.limit({ key: requestIp(request) });
    if (!success) return fail(429, "Muitas requisições.", "Espere um minuto e tente de novo.");
  }

  if (url.pathname.startsWith("/api/") && request.method !== "GET" && crossOrigin(request, url)) {
    return fail(403, "Origem não permitida.");
  }

  if (url.pathname === "/api/analyze") return analyze(request, env);
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname.startsWith("/api/auth/")) return handleAuth(request, env, url);
  if (url.pathname === "/api/snapshots" || url.pathname.startsWith("/api/snapshots/")) {
    return handleSnapshots(request, env, url);
  }
  if (url.pathname.startsWith("/api/")) return fail(404, "Rota não encontrada.");

  // Long-lived cache for the hashed assets; the HTML always revalidates.
  const response = await env.ASSETS.fetch(request);
  // The SPA owns every non-asset path; a refresh on one still gets the app.
  if (
    response.status === 404 &&
    request.method === "GET" &&
    (request.headers.get("accept") ?? "").includes("text/html")
  ) {
    return env.ASSETS.fetch(new Request(new URL("/index.html", url).toString(), { headers: request.headers }));
  }
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    return harden(await route(request, env, url), url.protocol === "https:");
  },
};
