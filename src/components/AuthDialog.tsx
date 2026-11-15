import { useState, type FormEvent } from "react";
import { Button } from "faang-ui/components/Button";
import { Dialog, DialogBody, DialogFooter } from "faang-ui/components/Dialog";
import { Field, Input } from "faang-ui/components/Field";
import { Alert } from "faang-ui/components/Surfaces";
import type { PublicUser } from "../../shared/types";
import { AccountError, login, register } from "../lib/account";

type Mode = "register" | "login";

/**
 * Only the receipt: an e-mail and a password, no Instagram, no confirmation
 * mail. The dialog is where the choice to keep analyses is actually made.
 */
export function AuthDialog({
  open,
  onOpenChange,
  onAuthenticated,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated: (user: PublicUser) => void;
  /** What the person was doing when they asked to sign in. */
  reason?: string;
}) {
  const [mode, setMode] = useState<Mode>("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);

  const creating = mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = creating ? await register(email, password) : await login(email, password);
      setPassword("");
      onAuthenticated(user);
      onOpenChange(false);
    } catch (thrown) {
      setError(
        thrown instanceof AccountError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Algo deu errado.", hint: "Tente de novo." },
      );
    } finally {
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(creating ? "login" : "register");
    setError(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={creating ? "Criar conta" : "Entrar"}
      description={
        reason ??
        "Uma conta guarda suas análises para comparar os períodos. É só e-mail e senha - nada do Instagram."
      }
      closeLabel="Fechar"
      width={440}
      className="mf-auth"
    >
      <form onSubmit={submit} noValidate>
        <DialogBody>
          <Field label="E-mail">
            <Input
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          <Field label="Senha" example={creating ? "pelo menos 8 caracteres" : undefined}>
            <Input
              type="password"
              name="password"
              autoComplete={creating ? "new-password" : "current-password"}
              placeholder={creating ? "mínimo 8 caracteres" : "sua senha"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          {error ? (
            <Alert tone="danger">
              <strong>{error.message}</strong>
              {error.hint ? <span className="mf-alert-hint">{error.hint}</span> : null}
            </Alert>
          ) : null}

          <p className="mf-note">
            Sem confirmação por e-mail: a conta existe no mesmo instante. Você pode apagar tudo quando quiser, na tela
            de histórico.
          </p>
        </DialogBody>

        <DialogFooter
          note={
            <button type="button" className="ac-link ac-link--action" onClick={switchMode}>
              {creating ? "Já tenho conta" : "Quero criar uma conta"}
            </button>
          }
        >
          <Button type="submit" variant="primary" loading={busy}>
            {creating ? "Criar conta" : "Entrar"}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}
