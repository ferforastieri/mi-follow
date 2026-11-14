import { useState } from "react";
import type { UploadFile } from "faang-ui/components/FileUpload";
import type { Report } from "../shared/types";
import { AnalyzeError, analyzeZip } from "./lib/api";
import { ReportView } from "./components/ReportView";
import { ThemeToggle } from "./components/ThemeToggle";
import { UploadView } from "./components/UploadView";

interface Failure {
  message: string;
  hint?: string;
}

export function App() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setFiles([{ name: file.name, size: file.size, status: "uploading" }]);
    try {
      const result = await analyzeZip(file);
      setFiles([]);
      setReport(result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (thrown) {
      setFiles([{ name: file.name, size: file.size, status: "failed" }]);
      setError(
        thrown instanceof AnalyzeError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Algo deu errado ao ler o arquivo.", hint: "Tente de novo com o ZIP original." },
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setReport(null);
    setError(null);
    setFiles([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="mf">
      <header className="mf__bar">
        <a
          className="mf__brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            reset();
          }}
        >
          <span className="mf__mark" aria-hidden="true">
            MF
          </span>
          <span>Mi Follow</span>
        </a>
        <ThemeToggle />
      </header>

      <main className="mf__main">
        {report ? (
          <ReportView report={report} onReset={reset} />
        ) : (
          <UploadView busy={busy} error={error} files={files} onFile={handleFile} />
        )}
      </main>

      <footer className="mf__foot">
        <span>Somente leitura: nada de seguir, deixar de seguir ou guardar seus dados.</span>
        <span>Feito com faang-ui · Cloudflare Workers</span>
      </footer>
    </div>
  );
}
