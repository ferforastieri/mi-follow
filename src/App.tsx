import { useEffect, useState } from "react";
import type { UploadFile } from "faang-ui/components/FileUpload";
import { Button } from "faang-ui/components/Button";
import type { PublicUser, Report } from "../shared/types";
import { AnalyzeError, analyzeZip } from "./lib/api";
import { AccountError, getMe, saveSnapshot } from "./lib/account";
import { AuthDialog } from "./components/AuthDialog";
import { HistoryView } from "./components/HistoryView";
import { ReportView } from "./components/ReportView";
import { ThemeToggle } from "./components/ThemeToggle";
import { UploadView } from "./components/UploadView";
import { Logo } from "./components/Logo";

interface Failure {
  message: string;
  hint?: string;
}

type SaveState = "idle" | "saving" | "saved";
type View = "main" | "history";

export function App() {
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);

  const [user, setUser] = useState<PublicUser | null>(null);
  const [view, setView] = useState<View>("main");
  const [authOpen, setAuthOpen] = useState(false);
  const [authIntent, setAuthIntent] = useState<"save" | "history">("save");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<Failure | null>(null);

  useEffect(() => {
    let alive = true;
    getMe()
      .then((found) => alive && setUser(found))
      .catch(() => {
        // Signed out (or the API is down): the tool works without an account.
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setSaveError(null);
    setSaveState("idle");
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
    setSaveError(null);
    setSaveState("idle");
    setView("main");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function persist(current: Report) {
    setSaveState("saving");
    setSaveError(null);
    try {
      await saveSnapshot(current);
      setSaveState("saved");
    } catch (thrown) {
      setSaveState("idle");
      setSaveError(
        thrown instanceof AccountError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Não consegui guardar a análise.", hint: "Tente de novo em instantes." },
      );
    }
  }

  function saveCurrent() {
    if (!report) return;
    if (!user) {
      setAuthIntent("save");
      setAuthOpen(true);
      return;
    }
    void persist(report);
  }

  function openHistory() {
    if (!user) {
      setAuthIntent("history");
      setAuthOpen(true);
      return;
    }
    setView("history");
  }

  async function onAuthenticated(found: PublicUser) {
    setUser(found);
    setAuthOpen(false);
    if (authIntent === "history") {
      setView("history");
      return;
    }
    if (report && saveState !== "saved") await persist(report);
  }

  function onLogout() {
    setUser(null);
    setView("main");
    // The analysis stays on screen, but nobody is holding it anymore.
    setSaveState("idle");
    setSaveError(null);
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
          {user ? (
            <Button
              variant="ghost"
              size="sm"
              icon="clock"
              iconOnly
              aria-label="Histórico"
              title="Histórico"
              onClick={openHistory}
            />
          ) : null}
          <ThemeToggle />
        </div>
      </div>

      <main className="mf__main">
        {view === "history" && user ? (
          <div className="mf-report">
            <HistoryView user={user} onBack={() => setView("main")} onLogout={onLogout} />
          </div>
        ) : report ? (
          <div className="mf-report">
            <ReportView
              report={report}
              onReset={reset}
              onSave={saveCurrent}
              onHistory={openHistory}
              saveState={saveState}
              saveError={saveError}
              signedIn={Boolean(user)}
            />
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
        <p className="mf-foot__note">Somente leitura: não segue, não deixa de seguir e só guarda o que você salvar.</p>
      </footer>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        onAuthenticated={onAuthenticated}
        reason={
          authIntent === "history"
            ? "Entre para ver as análises que você guardou e comparar os períodos."
            : "Crie uma conta para guardar esta análise e comparar com as próximas. É só e-mail e senha — nada do Instagram."
        }
      />
    </div>
  );
}
