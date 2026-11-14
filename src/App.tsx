import { useEffect, useState } from "react";
import type { UploadFile } from "faang-ui/components/FileUpload";
import type { Report } from "../shared/types";
import { AnalyzeError, analyzeZip } from "./lib/api";
import { ReportView } from "./components/ReportView";
import { ThemeToggle, type Theme } from "./components/ThemeToggle";
import { UploadView } from "./components/UploadView";
import { Logo, LogoMark } from "./components/Logo";

interface Failure {
  message: string;
  hint?: string;
}

function initialTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("mifollow:theme", theme);
    } catch {
      // Private mode: the choice just doesn't survive the tab.
    }
  }, [theme]);

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
          <Logo />
        </a>
        <ThemeToggle theme={theme} onChange={setTheme} />
      </header>

      <main className="mf__main">
        {report ? (
          <div className="mf-report">
            <ReportView report={report} onReset={reset} />
          </div>
        ) : (
          <UploadView
            busy={busy}
            error={error}
            files={files}
            onFile={handleFile}
          />
        )}
      </main>

      <footer className="mf__foot">
        <div className="mf-foot__inner">
          <div className="mf-foot__brand">
            <LogoMark size={26} />
            <p>
              <strong>mi follow</strong> — quem te segue de verdade.
            </p>
          </div>
          <nav className="mf-foot__links" aria-label="Links">
            <a href="https://www.instagram.com/download/request" target="_blank" rel="noreferrer">
              Baixar seu export
            </a>
            <a href="https://www.npmjs.com/package/faang-ui" target="_blank" rel="noreferrer">
              faang-ui
            </a>
            <a href="https://github.com/ferforastieri" target="_blank" rel="noreferrer">
              quem fez
            </a>
          </nav>
        </div>
        <div className="mf-foot__base">
          <span>Somente leitura: não segue, não deixa de seguir, não guarda.</span>
          <span>2026 · feito no Brasil</span>
        </div>
      </footer>
    </div>
  );
}
