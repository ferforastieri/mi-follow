import type { ApiError, Report } from "../../shared/types";

/** The Worker's own cap; checking here saves a round trip on the obvious mistake. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class AnalyzeError extends Error {
  readonly hint?: string;

  constructor(message: string, hint?: string) {
    super(message);
    this.name = "AnalyzeError";
    this.hint = hint;
  }
}

export async function analyzeZip(file: File): Promise<Report> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AnalyzeError(
      "Esse arquivo é grande demais.",
      "O export só com seguidores e seguindo tem poucos KB. Refaça o download marcando só essa opção.",
    );
  }

  let response: Response;
  try {
    response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/zip" },
      body: file,
    });
  } catch {
    throw new AnalyzeError("Não consegui falar com o servidor.", "Confira sua conexão e tente de novo.");
  }

  const payload = (await response.json().catch(() => null)) as Report | ApiError | null;
  if (!response.ok || !payload || "error" in payload) {
    const body = (payload ?? {}) as ApiError;
    throw new AnalyzeError(body.error ?? "Não consegui ler esse export.", body.hint);
  }
  return payload;
}
