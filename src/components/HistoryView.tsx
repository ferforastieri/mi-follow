import { useEffect, useMemo, useState } from "react";
import type { Person, PublicUser, Report, SnapshotDiff, SnapshotMeta } from "../../shared/types";
import { Button } from "faang-ui/components/Button";
import { Dialog, DialogBody, DialogFooter } from "faang-ui/components/Dialog";
import { Alert, Card, CardHeader, EmptyState } from "faang-ui/components/Surfaces";
import { PageHeader } from "faang-ui/components/PageHeader";
import { Table, type TableColumn } from "faang-ui/components/Table";
import { SkeletonList } from "faang-ui/components/Skeleton";
import { Checkbox } from "faang-ui/components/Checkbox";
import { Avatar } from "faang-ui/components/Avatar";
import {
  AccountError,
  compareSnapshots,
  deleteAccount,
  deleteSnapshot,
  getSnapshot,
  listSnapshots,
  logout,
} from "../lib/account";
import { formatDate } from "../lib/format";

function dateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function DiffGroup({ title, people }: { title: string; people: Person[] }) {
  return (
    <div className="mf-diff__group">
      <p className="mf-diff__title">
        {title} <span className="mf-diff__count">{people.length}</span>
      </p>
      {people.length === 0 ? (
        <p className="mf-note">Ninguém.</p>
      ) : (
        <ul className="mf-chips">
          {people.map((person) => (
            <li key={person.username.toLowerCase()}>
              <a className="mf-chiplink" href={person.href} target="_blank" rel="noreferrer noopener">
                @{person.username}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function HistoryView({
  user,
  onBack,
  onLogout,
  onOpen,
}: {
  user: PublicUser;
  onBack: () => void;
  onLogout: () => void;
  /** Opens a saved analysis in the report screen. */
  onOpen: (report: Report) => void;
}) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[] | null>(null);
  const [error, setError] = useState<{ message: string; hint?: string } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [diff, setDiff] = useState<SnapshotDiff | null>(null);
  const [comparing, setComparing] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listSnapshots()
      .then((list) => alive && setSnapshots(list))
      .catch((thrown) => {
        if (!alive) return;
        setSnapshots([]);
        setError(
          thrown instanceof AccountError
            ? { message: thrown.message, hint: thrown.hint }
            : { message: "Não consegui carregar o histórico." },
        );
      });
    return () => {
      alive = false;
    };
  }, []);

  const columns = useMemo<TableColumn<SnapshotMeta>[]>(
    () => [
      {
        key: "createdAt",
        title: "Análise",
        sortable: true,
        value: (row) => row.createdAt,
        render: (row) => <span className="mf-date">{dateTime(row.createdAt)}</span>,
      },
      {
        key: "followers",
        title: "Seguidores",
        align: "end",
        sortable: true,
        value: (row) => row.counts.followers,
        render: (row) => row.counts.followers.toLocaleString("pt-BR"),
      },
      {
        key: "following",
        title: "Seguindo",
        align: "end",
        sortable: true,
        value: (row) => row.counts.following,
        render: (row) => row.counts.following.toLocaleString("pt-BR"),
      },
      {
        key: "notFollowingBack",
        title: "Não te seguem",
        align: "end",
        sortable: true,
        value: (row) => row.counts.notFollowingBack,
        render: (row) => row.counts.notFollowingBack.toLocaleString("pt-BR"),
      },
      {
        key: "actions",
        title: "",
        align: "end",
        render: (row) => (
          <span className="mf-rowactions">
            <Button
              variant="ghost"
              size="sm"
              icon="eye"
              iconOnly
              aria-label={`Abrir a análise de ${dateTime(row.createdAt)}`}
              loading={openingId === row.id}
              onClick={() => open(row)}
            />
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              iconOnly
              aria-label={`Apagar a análise de ${dateTime(row.createdAt)}`}
              onClick={() => remove(row)}
            />
          </span>
        ),
      },
    ],
    [],
  );

  async function open(row: SnapshotMeta) {
    setOpeningId(row.id);
    setError(null);
    try {
      onOpen(await getSnapshot(row.id));
    } catch (thrown) {
      setError(
        thrown instanceof AccountError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Não consegui abrir a análise." },
      );
    } finally {
      setOpeningId(null);
    }
  }

  async function remove(row: SnapshotMeta) {
    try {
      await deleteSnapshot(row.id);
      setSnapshots((list) => (list ?? []).filter((item) => item.id !== row.id));
      setSelected((keys) => keys.filter((key) => key !== row.id));
      setDiff(null);
    } catch (thrown) {
      setError(
        thrown instanceof AccountError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Não consegui apagar." },
      );
    }
  }

  async function compare() {
    if (!snapshots || selected.length !== 2) return;
    const pair = snapshots
      .filter((row) => selected.includes(row.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const [older, newer] = pair;
    if (!older || !newer) return;

    setComparing(true);
    setError(null);
    try {
      setDiff(await compareSnapshots(older.id, newer.id));
    } catch (thrown) {
      setError(
        thrown instanceof AccountError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Não consegui comparar." },
      );
    } finally {
      setComparing(false);
    }
  }

  async function removeAccount() {
    setDeletingAccount(true);
    try {
      await deleteAccount();
      setConfirmAccount(false);
      onLogout();
    } catch (thrown) {
      setError(
        thrown instanceof AccountError
          ? { message: thrown.message, hint: thrown.hint }
          : { message: "Não consegui apagar a conta." },
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  const total = snapshots?.length ?? 0;

  function toggle(id: string) {
    setSelected((keys) => (keys.includes(id) ? keys.filter((key) => key !== id) : [...keys, id].slice(-2)));
  }

  async function logoutSafely() {
    try {
      await logout();
    } catch {
      // The cookie may already be gone; leaving the screen is what matters.
    }
    onLogout();
  }

  return (
    <>
      <PageHeader
        title={
          <>
            Seu <span className="mf-accent-text">histórico</span>
          </>
        }
        meta={
          snapshots === null
            ? "Carregando…"
            : `${user.email} · ${total === 1 ? "1 análise guardada" : `${total} análises guardadas`}`
        }
        actions={
          <>
            <Button variant="ghost" icon="chevronLeft" onClick={onBack}>
              Voltar
            </Button>
          </>
        }
      />

      {error ? (
        <Alert tone="danger">
          <strong>{error.message}</strong>
          {error.hint ? <span className="mf-alert-hint">{error.hint}</span> : null}
        </Alert>
      ) : null}

      {snapshots === null ? (
        <Card padded>
          <SkeletonList label="Carregando análises" count={3} />
        </Card>
      ) : snapshots.length === 0 ? (
        <Card padded>
          <EmptyState
            icon="archiveBox"
            title="Nada guardado ainda"
            actions={
              <Button variant="primary" onClick={onBack}>
                Analisar meu export
              </Button>
            }
          >
            Cada análise que você salvar aparece aqui. Com duas, dá para comparar quem chegou e quem saiu entre os
            períodos.
          </EmptyState>
        </Card>
      ) : (
        <Card padded>
          <CardHeader
            icon="clock"
            title="Análises salvas"
            subtitle="Marque duas para comparar os períodos."
            action={
              <Button
                variant="primary"
                size="sm"
                icon="swap"
                loading={comparing}
                disabled={selected.length !== 2}
                onClick={compare}
              >
                Comparar
              </Button>
            }
          />
          <div className="mf-hide-sm">
            <Table
              label="Análises guardadas"
              rows={snapshots}
              getKey={(row) => row.id}
              selected={selected}
              onSelectedChange={(keys) => setSelected(keys.slice(-2))}
              columns={columns}
            />
          </div>

          {/* On phones the table would scroll sideways: the same rows, read as lines. */}
          <ul className="mf-saves">
            {snapshots.map((row) => (
              <li className="mf-save" key={row.id}>
                <Checkbox
                  checked={selected.includes(row.id)}
                  onCheckedChange={() => toggle(row.id)}
                  aria-label={`Selecionar a análise de ${dateTime(row.createdAt)}`}
                />
                <div className="mf-save__body">
                  <p className="mf-save__date">{dateTime(row.createdAt)}</p>
                  <p className="mf-save__counts">
                    {row.counts.followers} seguidores · {row.counts.following} seguindo · {row.counts.notFollowingBack} não
                    te seguem
                  </p>
                </div>
                <span className="mf-rowactions">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="eye"
                    iconOnly
                    aria-label={`Abrir a análise de ${dateTime(row.createdAt)}`}
                    loading={openingId === row.id}
                    onClick={() => open(row)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    iconOnly
                    aria-label={`Apagar a análise de ${dateTime(row.createdAt)}`}
                    onClick={() => remove(row)}
                  />
                </span>
              </li>
            ))}
          </ul>
          {selected.length === 1 ? <p className="mf-note">Escolha mais uma análise para comparar.</p> : null}
        </Card>
      )}

      {diff ? (
        <Card padded>
          <CardHeader
            icon="chart"
            title={`De ${formatDate(diff.from.createdAt)} a ${formatDate(diff.to.createdAt)}`}
            subtitle={`Seguidores: ${diff.from.counts.followers} → ${diff.to.counts.followers} · Seguindo: ${diff.from.counts.following} → ${diff.to.counts.following}`}
          />
          <div className="mf-diff">
            <DiffGroup title="Passaram a te seguir" people={diff.newFollowers} />
            <DiffGroup title="Deixaram de te seguir" people={diff.lostFollowers} />
            <DiffGroup title="Você passou a seguir" people={diff.newFollowing} />
            <DiffGroup title="Você deixou de seguir" people={diff.unfollowed} />
          </div>
        </Card>
      ) : null}

      <Card padded>
        <div className="mf-account">
          <Avatar name={user.email} initials={user.email.slice(0, 1).toUpperCase()} size="md" labelled />
          <div className="mf-account__text">
            <p className="mf-account__title">Sua conta</p>
            <p className="mf-account__mail">{user.email}</p>
          </div>
          <span className="mf-actions">
            <Button variant="ghost" size="sm" icon="power" onClick={logoutSafely}>
              Sair
            </Button>
            <Button variant="ghost" size="sm" icon="trash" onClick={() => setConfirmAccount(true)}>
              Apagar conta
            </Button>
          </span>
        </div>
        <p className="mf-prose">
          O Mi Follow guarda apenas as listas da análise que você mandar salvar - nunca o ZIP. Apagar a conta remove
          tudo, na hora.
        </p>
      </Card>

      <Dialog
        open={confirmAccount}
        onOpenChange={setConfirmAccount}
        title="Apagar a conta?"
        description="Suas análises guardadas somem junto. Não dá para desfazer."
        closeLabel="Fechar"
        width={440}
      >
        <DialogBody>
          <p className="mf-prose">
            As <strong>{total}</strong> {total === 1 ? "análise salva" : "análises salvas"} de <strong>{user.email}</strong>{" "}
            serão apagadas, junto com a conta.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setConfirmAccount(false)}>
            Cancelar
          </Button>
          <Button variant="danger" loading={deletingAccount} onClick={removeAccount}>
            Apagar tudo
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}
