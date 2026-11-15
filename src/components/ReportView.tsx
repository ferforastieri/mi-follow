import { useMemo, useState } from "react";
import type { Person, Report } from "../../shared/types";
import { Button } from "faang-ui/components/Button";
import { Card, CardHeader, Alert } from "faang-ui/components/Surfaces";
import { PageHeader } from "faang-ui/components/PageHeader";
import { Pagination } from "faang-ui/components/Pagination";
import { StatCard } from "faang-ui/components/StatCard";
import { TabPanel, Tabs, type TabItem } from "faang-ui/components/Tabs";
import { Chip } from "faang-ui/components/Chip";
import { SearchField } from "faang-ui/components/Toolbar";
import { Table, type TableColumn } from "faang-ui/components/Table";
import { Icon } from "faang-ui/icons/Icon";
import { HistoryIcon } from "./icons";
import { formatDate, percent, plural } from "../lib/format";

type TabKey = "not-following" | "not-followed" | "mutual" | "extra";

function downloadCsv(filename: string, people: Person[]): void {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = ["username,perfil,desde", ...people.map((person) => [person.username, person.href, person.since ?? ""].map(escape).join(","))];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyList(people: Person[]): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(people.map((person) => person.username).join("\n"));
    return true;
  } catch {
    return false;
  }
}

function UserLink({ person }: { person: Person }) {
  return (
    <a className="mf-user" href={person.href} target="_blank" rel="noreferrer noopener">
      <span className="mf-user__at" aria-hidden="true">
        @
      </span>
      {person.username}
    </a>
  );
}

function PeopleTable({
  people,
  sinceLabel,
  filename,
  emptyLabel,
}: {
  people: Person[];
  sinceLabel: string;
  filename: string;
  emptyLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<"idle" | "yes" | "no">("idle");

  const columns = useMemo<TableColumn<Person>[]>(
    () => [
      {
        key: "username",
        title: "Perfil",
        sortable: true,
        value: (person) => person.username.toLowerCase(),
        render: (person) => <UserLink person={person} />,
      },
      {
        key: "since",
        title: sinceLabel,
        sortable: true,
        value: (person) => person.since ?? "",
        render: (person) => <span className="mf-date">{formatDate(person.since)}</span>,
      },
      {
        key: "open",
        title: "Instagram",
        align: "end",
        render: (person) => (
          <a
            className="mf-ext"
            href={person.href}
            target="_blank"
            rel="noreferrer noopener"
            aria-label={`Abrir @${person.username} no Instagram`}
            title="Abrir no Instagram"
          >
            <Icon name="external" size={16} />
          </a>
        ),
      },
    ],
    [sinceLabel],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? people.filter((person) => person.username.toLowerCase().includes(term)) : people;
  }, [people, query]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * pageSize, current * pageSize);

  function search(value: string) {
    setQuery(value);
    setPage(1);
  }

  return (
    <div className="ac-dtable">
      <div className="ac-dtable__bar">
        <SearchField
          size="sm"
          value={query}
          onChange={(event) => search(event.target.value)}
          onClear={() => search("")}
          clearLabel="Limpar busca"
          aria-label="Buscar perfil"
          placeholder="Filtrar por @…"
        />
        <Chip>{filtered.length}</Chip>
        <div className="ac-dtable__tools">
          <Button
            size="sm"
            variant="ghost"
            icon="copy"
            onClick={async () => {
              setCopied((await copyList(people)) ? "yes" : "no");
              setTimeout(() => setCopied("idle"), 2000);
            }}
          >
            {copied === "yes" ? "Copiado" : copied === "no" ? "Falhou" : "Copiar"}
          </Button>
          <Button size="sm" variant="ghost" icon="download" onClick={() => downloadCsv(filename, people)}>
            CSV
          </Button>
        </div>
      </div>

      <Table
        label={`Perfis · ${sinceLabel}`}
        rows={visible}
        getKey={(person) => person.username.toLowerCase()}
        empty={emptyLabel}
        columns={columns}
      />

      <div className="ac-dtable__foot">
        <span className="ac-dtable__count">{filtered.length === 1 ? "1 linha" : `${filtered.length} linhas`}</span>
        <Pagination page={current} pageCount={pageCount} onPageChange={setPage} />
      </div>
    </div>
  );
}

function ExtraGroup({ title, icon, people }: { title: string; icon: "block" | "sticker" | "clock" | "archiveBox"; people: Person[] }) {
  if (people.length === 0) return null;
  return (
    <Card padded>
      <CardHeader icon={icon} title={title} action={<Chip>{people.length}</Chip>} />
      <ul className="mf-chips">
        {people.map((person) => (
          <li key={person.username.toLowerCase()}>
            <a className="mf-chiplink" href={person.href} target="_blank" rel="noreferrer noopener">
              @{person.username}
            </a>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ReportView({
  report,
  onReset,
  onSave,
  onHistory,
  saveState,
  saveError,
  signedIn,
}: {
  report: Report;
  onReset: () => void;
  onSave: () => void;
  onHistory: () => void;
  saveState: "idle" | "saving" | "saved";
  saveError: { message: string; hint?: string } | null;
  signedIn: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("not-following");
  const { counts, extras } = report;

  const extrasTotal =
    extras.blocked.length + extras.closeFriends.length + extras.pending.length + extras.recentlyUnfollowed.length;

  const tabs: TabItem<TabKey>[] = [
    { value: "not-following", label: "Não te seguem", count: counts.notFollowingBack },
    { value: "not-followed", label: "Você não segue", count: counts.youDontFollowBack },
    { value: "mutual", label: "Mútuos", count: counts.mutuals },
    ...(extrasTotal > 0 ? [{ value: "extra" as const, label: "Outros", count: extrasTotal }] : []),
  ];

  return (
    <>
      <PageHeader
        className="mf-report__head"
        title={
          <>
            Sua <span className="mf-accent-text">audiência</span>
          </>
        }
        meta={`Analisado em ${new Date(report.generatedAt).toLocaleString("pt-BR")} · ${report.files.length} ${report.files.length === 1 ? "arquivo lido" : "arquivos lidos"}`}
        actions={
          <div className="mf-report__actions">
            <Button variant="ghost" onClick={onHistory}>
              <span className="mf-withicon">
                <HistoryIcon size={17} /> Histórico
              </span>
            </Button>
            <Button
              variant="primary"
              icon={saveState === "saved" ? "check" : "archive"}
              loading={saveState === "saving"}
              disabled={saveState === "saved"}
              onClick={onSave}
            >
              {saveState === "saved" ? "Análise salva" : signedIn ? "Salvar análise" : "Criar conta e salvar"}
            </Button>
            <Button variant="ghost" icon="refresh" onClick={onReset}>
              Outro ZIP
            </Button>
          </div>
        }
      />

      {saveError ? (
        <Alert tone="danger">
          <strong>{saveError.message}</strong>
          {saveError.hint ? <span className="mf-alert-hint">{saveError.hint}</span> : null}
        </Alert>
      ) : null}

      <div className="mf-stats">
        <StatCard label="Seguidores" value={counts.followers.toLocaleString("pt-BR")} icon="person" footer="contas que te seguem hoje" />
        <StatCard label="Seguindo" value={counts.following.toLocaleString("pt-BR")} icon="audiencePeople" footer="contas que você segue" />
        <StatCard
          label="Não te seguem de volta"
          value={counts.notFollowingBack.toLocaleString("pt-BR")}
          icon="alert"
          tone="wait"
          footer={`${percent(counts.notFollowingBack, counts.following)} de quem você segue`}
        />
        <StatCard
          label="Você não segue de volta"
          value={counts.youDontFollowBack.toLocaleString("pt-BR")}
          icon="personAdd"
          tone="neutral"
          footer={`${percent(counts.youDontFollowBack, counts.followers)} dos seus seguidores`}
        />
      </div>

      {report.warnings.length > 0 ? (
        <Alert tone="neutral">
          <ul className="mf-warnings">
            {report.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card padded>
        <CardHeader
          icon="list"
          title="As listas"
          subtitle="Contas desativadas ou com @ trocado não aparecem de um dos lados - por isso a diferença entre as contagens."
        />
        <Tabs<TabKey> value={tab} onValueChange={setTab} items={tabs} label="Listas de perfis">
          <TabPanel value="not-following">
            <PeopleTable
              people={report.notFollowingBack}
              sinceLabel="Você segue desde"
              filename="mi-follow-nao-te-seguem.csv"
              emptyLabel="Todo mundo que você segue te segue de volta."
            />
          </TabPanel>
          <TabPanel value="not-followed">
            <PeopleTable
              people={report.youDontFollowBack}
              sinceLabel="Segue você desde"
              filename="mi-follow-voce-nao-segue.csv"
              emptyLabel="Você segue todo mundo que te segue."
            />
          </TabPanel>
          <TabPanel value="mutual">
            <PeopleTable
              people={report.mutuals}
              sinceLabel="Segue você desde"
              filename="mi-follow-mutuos.csv"
              emptyLabel="Nenhum perfil aparece dos dois lados."
            />
          </TabPanel>
          {extrasTotal > 0 ? (
            <TabPanel value="extra">
              <div className="mf-grid mf-grid--tight">
                <ExtraGroup title="Bloqueados" icon="block" people={extras.blocked} />
                <ExtraGroup title="Melhores amigos" icon="sticker" people={extras.closeFriends} />
                <ExtraGroup title="Pedidos pendentes" icon="clock" people={extras.pending} />
                <ExtraGroup title="Deixaram de te seguir" icon="archiveBox" people={extras.recentlyUnfollowed} />
              </div>
              {extrasTotal === 0 ? <p className="mf-note">O export não trouxe nenhuma dessas listas.</p> : null}
            </TabPanel>
          ) : null}
        </Tabs>
      </Card>

      <p className="mf-note">
        {plural(counts.mutuals, "mútuo", "mútuos")} no total. Análise somente leitura: o Mi Follow não segue, não deixa
        de seguir e não age na sua conta.
      </p>
    </>
  );
}
