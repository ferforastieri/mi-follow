import type { CSSProperties } from "react";
import { Alert, Card, CardFooter, CardHeader } from "faang-ui/components/Surfaces";
import { FileUpload, type UploadFile } from "faang-ui/components/FileUpload";
import { Spinner } from "faang-ui/components/Skeleton";
import { Icon } from "faang-ui/icons/Icon";
import { MAX_UPLOAD_BYTES } from "../lib/api";

const FAQ = [
  {
    q: "O Mi Follow pede minha senha do Instagram?",
    a: "Não. A análise usa o arquivo ZIP que o próprio Instagram entrega. O site nunca vê sua senha nem sua sessão.",
  },
  {
    q: "O Mi Follow deixa de seguir alguém automaticamente?",
    a: "Não. É só leitura: o site mostra as listas, com o link de cada perfil, e você decide o que fazer.",
  },
  {
    q: "Como pego o ZIP do Instagram?",
    a: "Em Conta, Suas atividades, Baixar suas informações, marque só “Seguidores e seguindo” no formato JSON. O Instagram avisa por e-mail quando o download fica pronto, em até 48 horas.",
  },
  {
    q: "O que acontece com o meu ZIP?",
    a: "Ele é lido em memória para gerar o relatório e descartado na mesma requisição. Nada do arquivo é gravado.",
  },
  {
    q: "Para que serve a conta?",
    a: "Para guardar uma análise e comparar com outra depois, vendo quem passou a te seguir e quem deixou de seguir. É opcional e usa só e-mail e senha.",
  },
];

const STEPS = [
  {
    title: "Peça o download",
    body: (
      <>
        Abra{" "}
        <a className="ac-link" href="https://www.instagram.com/download/request" target="_blank" rel="noreferrer">
          instagram.com/download/request
        </a>{" "}
        ou vá em <em>Conta → Suas atividades</em>.
      </>
    ),
  },
  {
    title: "Marque só seguidores e seguindo",
    body: (
      <>
        No formato <strong>JSON</strong>. Fotos e vídeos só engordam o arquivo; HTML não traz a lista.
      </>
    ),
  },
  {
    title: "Suba o ZIP",
    body: <>Espere o e-mail do Instagram (até 48h) e jogue o arquivo aqui em cima.</>,
  },
];

export function UploadView({
  busy,
  error,
  files,
  onFile,
}: {
  busy: boolean;
  error: { message: string; hint?: string } | null;
  files: UploadFile[];
  onFile: (file: File) => void;
}) {
  return (
    <>
      <section className="mf-hero">
        <div className="mf-hero__text">
          <p className="mf-kicker">
            <span className="mf-kicker__dot" aria-hidden="true" />
            análise do seu export
          </p>
          <h1 className="mf-hero__title">
            Quem realmente <span className="mf-hero__accent">te segue</span>.
          </h1>
          <p className="mf-lead">
            Solte o ZIP que o próprio Instagram entrega e veja quem não te segue de volta, quem você não segue e os
            mútuos. Sem senha, sem scraping e <strong>sem unfollow automático</strong>.
          </p>
        </div>

        <div className="mf-dock">
          <FileUpload
            label="Solte o ZIP do Instagram"
            hint={`até ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`}
            accept=".zip,application/zip,application/x-zip-compressed"
            onFiles={(picked) => picked[0] && onFile(picked[0])}
            files={files}
          />
          {busy ? (
            <p className="mf-status" role="status">
              <Spinner size={14} /> Descompactando e cruzando as listas…
            </p>
          ) : null}
          {error ? (
            <Alert tone="danger">
              <strong>{error.message}</strong>
              {error.hint ? <span className="mf-alert-hint">{error.hint}</span> : null}
            </Alert>
          ) : null}
          <ul className="mf-trust">
            <li>
              <Icon name="shield" size={14} /> Somente leitura
            </li>
            <li>
              <Icon name="lock" size={14} /> Só guarda se você pedir
            </li>
            <li>
              <Icon name="archive" size={14} /> O ZIP, não a senha
            </li>
          </ul>
        </div>
      </section>

      <section className="mf-section" aria-labelledby="mf-steps-title">
        <h2 className="mf-h2" id="mf-steps-title">
          Como o ZIP chega até aqui
        </h2>
        <ol className="mf-steps">
          {STEPS.map((step, index) => (
            <li className="mf-step" key={step.title} style={{ "--i": index } as CSSProperties}>
              <span className="mf-step__n" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <p className="mf-step__title">{step.title}</p>
                <p className="mf-step__body">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="mf-cols">
        <Card padded>
          <CardHeader icon="list" title="O que você recebe" />
          <ul className="mf-checks">
            <li>Quem você segue e não te segue de volta, com link</li>
            <li>Quem te segue e você não segue de volta</li>
            <li>Os mútuos, e as contagens de cada lado</li>
            <li>Bloqueados, melhores amigos e pedidos, se vierem no export</li>
            <li>CSV e lista para copiar</li>
          </ul>
        </Card>

        <Card padded>
          <CardHeader icon="lock" title="Por que não pedimos sua senha" />
          <p className="mf-prose">
            O Instagram não expõe a lista de seguidores por API. Login automatizado quebraria os termos e exigiria
            guardar sua sessão. O export oficial é seu, foi feito para isso — e o Mi Follow só lê.
          </p>
          <CardFooter>
            Quem deixou de seguir depois do seu export continua na lista: o ZIP é um retrato, não um feed.
          </CardFooter>
        </Card>
      </div>

      <section className="mf-section" aria-labelledby="mf-faq-title">
        <h2 className="mf-h2" id="mf-faq-title">
          Perguntas frequentes
        </h2>
        <div className="mf-faq">
          {FAQ.map((item) => (
            <details className="mf-faq__item" key={item.q}>
              <summary className="mf-faq__q">{item.q}</summary>
              <p className="mf-faq__a">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
