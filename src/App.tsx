import { useState } from "react";
import type { UploadFile } from "faang-ui/components/FileUpload";
import type { Report } from "../shared/types";
import { AnalyzeError, analyzeZip } from "./lib/api";
import { ReportView } from "./components/ReportView";
import { ThemeToggle } from "./components/ThemeToggle";
import { UploadView } from "./components/UploadView";
import { Logo } from "./components/Logo";

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
      <div className="mf-top">
        <span aria-hidden="true" />
        <a
          className="mf__brand"
          href="/"
          onClick={(event) => {
            event.preventDefault();
            reset();
          }}
        >
          <Logo />
        </a>
        <div className="mf-top__end">
          <ThemeToggle />
        </div>
      </div>

      <main className="mf__main">
        {report ? (
          <div className="mf-report">
            <ReportView report={report} onReset={reset} />
          </div>
        ) : (
          <UploadView busy={busy} error={error} files={files} onFile={handleFile} />
        )}
      </main>

      <footer className="mf__foot">
        <div className="mf-foot__inner">
          <p className="mf-foot__credit">
            Feito por{" "}
            <a href="https://github.com/ferforastieri" target="_blank" rel="noreferrer">
              Fernando Forastieri
            </a>
          </p>
          <p className="mf-foot__credit">
            Ideia de{" "}
            <a href="https://www.instagram.com/mihforastieri/" target="_blank" rel="noreferrer">
              @mihforastieri
            </a>
          </p>
        </div>
        <p className="mf-foot__note">Somente leitura: não segue, não deixa de seguir, não guarda nada.</p>
      </footer>
    </div>
  );
}
