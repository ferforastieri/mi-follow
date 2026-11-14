# Mi Follow

Quem realmente te segue no Instagram. Você sobe o ZIP do **export oficial** do
Instagram e recebe: quem você segue e não te segue de volta, quem te segue e você
não segue, os mútuos, as contagens — cada perfil com link. Somente leitura: o site
não segue, não deixa de seguir e não age na sua conta.

## Por que o ZIP, e não login

O Instagram não expõe a lista de seguidores por API (a Graph API dá contagem e
insights de contas Business/Creator, nunca a lista nominal; a Basic Display API foi
descontinuada). Login automatizado quebraria os termos e exigiria guardar sessão de
usuário. O caminho é o export que o próprio Instagram entrega:

1. `instagram.com/download/request` (ou _Conta → Suas atividades → Baixar suas informações_)
2. marcar só **Seguidores e seguindo**
3. formato **JSON** (HTML não traz a lista)
4. subir o ZIP aqui

## Stack

| Camada | Escolha |
| --- | --- |
| UI | React 19 + [faang-ui](https://www.npmjs.com/package/faang-ui) |
| Build | Vite (site estático em `dist/`) |
| Backend | um Worker: análise, contas e assets estáticos |
| Dados | Cloudflare D1 (só o que a pessoa manda salvar) |
| Deploy | `wrangler deploy` (Workers, sem Pages) |

Publicado em **https://mifollow.fer.tec.br**, com `workers_dev: false` — o Worker
não responde em `<worker>.workers.dev`, só no domínio próprio.

O Worker descompacta o ZIP em memória com `fflate`, cruza as listas e devolve o
relatório. Sem conta, nada é gravado: o corpo da requisição morre com ela.

## Guardar e comparar períodos

Depois da primeira análise, **Salvar análise** abre a criação de conta — e-mail e
senha, sem Instagram e sem confirmação por e-mail. Com conta, cada análise pode
ser guardada e o histórico compara duas datas:

- quem **passou a te seguir** e quem **deixou de te seguir**
- quem **você passou a seguir** e quem **você deixou de seguir**
- a variação das contagens

O que fica no banco é só a análise que você mandar salvar: `@`, link e data de
cada perfil, nunca o ZIP. Limite de 24 análises por conta, e **Apagar conta**
remove tudo na hora.

| Peça | Como |
| --- | --- |
| Senha | PBKDF2-SHA256, 100 mil iterações (teto do Workers), sal por conta |
| Sessão | token opaco de 32 bytes; o banco guarda só o SHA-256, em cookie `HttpOnly` `SameSite=Lax` por 30 dias |
| CSRF | `Origin` conferido em todo `POST`/`DELETE` |
| Força bruta | 12 tentativas por minuto por IP (`AUTH_LIMIT`) |
| Isolamento | toda consulta de análise filtra por `user_id` |

## PWA

O site instala: `manifest.webmanifest` (ícones 192/512 + maskable), service worker
e `theme-color` por tema. O service worker guarda o **shell** (página e assets com
hash) e nunca intercepta `/api/` — análise, login e histórico sempre vêm da rede.
Offline, a última análise já carregada continua na tela; o que depende de rede
(analisar outro ZIP, entrar, comparar) espera a conexão voltar.

## Rodando

```bash
npm install
npm run dev        # site em http://localhost:5173 (proxy de /api para :8787)
npm run dev:api    # Worker em http://127.0.0.1:8787, para o proxy acima
```

Para ver o site servido pelo próprio Worker (o que vai para produção):

```bash
npm run preview    # build + wrangler dev em http://127.0.0.1:8787
npm run deploy     # build + wrangler deploy
```

## Contrato da API

`POST /api/analyze` com o ZIP cru no corpo e `Content-Type: application/zip`.

- `200` — `Report` (veja `shared/types.ts`)
- `413` — acima de 25 MB
- `415` — não é ZIP
- `422` — ZIP válido, mas sem os arquivos esperados (com `hint` explicando)
- `429` — 20 análises por minuto por IP

Conta e histórico (cookie de sessão; `401` sem ele):

| Rota | O que faz |
| --- | --- |
| `POST /api/auth/register` | `{ email, password }` → cria conta e sessão |
| `POST /api/auth/login` | `{ email, password }` → sessão |
| `POST /api/auth/logout` | encerra a sessão |
| `GET /api/auth/me` | `{ user }` ou `{ user: null }` |
| `DELETE /api/auth/account` | apaga conta, sessões e análises |
| `GET /api/snapshots` | lista as análises salvas (sem as listas) |
| `POST /api/snapshots` | `{ report }` → guarda uma análise |
| `DELETE /api/snapshots/:id` | apaga uma análise |
| `GET /api/snapshots/compare?from=&to=` | diferença entre duas análises |

## Banco

O schema está em `db/schema.sql`. Para criar e aplicar:

```bash
npx wrangler d1 create mi-follow        # o database_id vai para o wrangler.jsonc
npx wrangler d1 execute mi-follow --remote --file db/schema.sql
```

## Arquivos que o parser entende

Por nome de base, em qualquer pasta do ZIP:

| Arquivo | Uso |
| --- | --- |
| `followers.json`, `followers_1.json`, `followers_2.json`… | seguidores (somados) |
| `following.json` | quem você segue |
| `pending_follow_requests.json` | pedidos enviados |
| `blocked.json` / `blocked_profiles.json` | bloqueados |
| `close_friends.json` | melhores amigos |
| `recently_unfollowed_profiles.json` | deixaram de te seguir |

Exports novos mudam nomes de tempos em tempos; o parser aceita tanto o formato de
array quanto o objeto com `relationships_*`.

## Limites conhecidos

- Conta desativada ou @ trocado não aparece de um dos lados — por isso as listas
  podem não fechar com as contagens.
- O export é um retrato: quem deixou de seguir depois do download continua na lista.
- O Instagram leva até 48h para liberar o download.
- A conta guarda dados de terceiros (os `@` das suas listas) enquanto você quiser:
  apague a análise ou a conta quando não precisar mais.
