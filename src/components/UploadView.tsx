import { Alert, Card, CardFooter, CardHeader, EmptyState } from "faang-ui/components/Surfaces";
import { FileUpload, type UploadFile } from "faang-ui/components/FileUpload";
import { Spinner } from "faang-ui/components/Skeleton";
import { MAX_UPLOAD_BYTES } from "../lib/api";

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
        <p className="mf-kicker">Análise do seu export</p>
        <h1 className="mf-title">
          Quem realmente
          <br />
          te segue.
        </h1>
        <p className="mf-lead">
          Suba o ZIP que o próprio Instagram entrega e veja quem não te segue de volta, quem você não segue e os
          mútuos — com o perfil de cada um a um clique. Sem senha, sem scraping e{" "}
          <strong>sem unfollow automático</strong>.
        </p>
      </section>

      <div className="mf-cols">
        <div className="mf-col">
          <Card padded>
            <CardHeader
              icon="upload"
              title="Seu arquivo"
              subtitle="O ZIP do export, com seguidores e seguindo em JSON."
            />
            <FileUpload
              label="Arraste o .zip aqui"
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
            <CardFooter icon="lock">
              O arquivo é lido no Worker e descartado na mesma requisição. Nada é gravado — nem o ZIP, nem as listas.
            </CardFooter>
          </Card>

          <Card padded>
            <CardHeader icon="check" title="O que você recebe" />
            <ul className="mf-checks">
              <li>Quem você segue e não te segue de volta, com link</li>
              <li>Quem te segue e você não segue de volta</li>
              <li>Os mútuos, e as contagens de cada lado</li>
              <li>Bloqueados, melhores amigos, pedidos pendentes: se vierem no export</li>
              <li>CSV e lista para copiar, se você quiser levar para outro lugar</li>
            </ul>
          </Card>
        </div>

        <div className="mf-col">
          <Card padded>
            <CardHeader
              icon="question"
              title="Como pegar o ZIP"
              subtitle="Pelo site ou pelo app, em quatro passos."
            />
            <ol className="mf-steps">
              <li>
                <span>
                  Abra{" "}
                  <a
                    className="ac-link"
                    href="https://www.instagram.com/download/request"
                    target="_blank"
                    rel="noreferrer"
                  >
                    instagram.com/download/request
                  </a>{" "}
                  (ou <em>Conta → Suas atividades → Baixar suas informações</em>).
                </span>
              </li>
              <li>
                <span>
                  Em <em>Escolher tipo de informação</em>, marque só <strong>Seguidores e seguindo</strong>. Fotos e
                  vídeos só engordam o arquivo.
                </span>
              </li>
              <li>
                <span>
                  Em <strong>Formato</strong>, escolha <strong>JSON</strong>. Em HTML o Instagram não entrega a lista.
                </span>
              </li>
              <li>
                <span>Espere o e-mail com o link (pode levar até 48h), baixe o ZIP e suba aqui do lado.</span>
              </li>
            </ol>
            <CardFooter>
              A análise não deixa de seguir ninguém: ela só lê. Quem deixou de seguir depois do seu export não aparece.
            </CardFooter>
          </Card>

          <Card padded>
            <EmptyState
              icon="shield"
              size="panel"
              title="Por que não pedimos sua senha"
              actions={
                <a
                  className="ac-link"
                  href="https://help.instagram.com/181231772500920"
                  target="_blank"
                  rel="noreferrer"
                >
                  Sobre o download das suas informações
                </a>
              }
            >
              O Instagram não expõe a lista de seguidores por API. Login automatizado quebraria os termos e exigiria
              guardar sua sessão — então o caminho é o export oficial, que é seu e foi feito para isso.
            </EmptyState>
          </Card>
        </div>
      </div>
    </>
  );
}
