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
| Backend | um Worker: `/api/analyze` + assets estáticos |
| Deploy | `wrangler deploy` (Workers, sem Pages) |

O Worker descompacta o ZIP em memória com `fflate`, cruza as listas e devolve o
relatório. Nada é gravado: o corpo da requisição morre com ela.

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
