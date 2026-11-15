# Mi Follow

Quem realmente te segue no Instagram.

Você sobe o arquivo que o próprio Instagram entrega e vê, em segundos, quem não te
segue de volta, quem te segue e você não segue, e os mútuos - cada perfil com link.
Somente leitura: o Mi Follow não segue, não deixa de seguir e nunca pede sua senha
do Instagram.

**[mifollow.fer.tec.br](https://mifollow.fer.tec.br)**

![A página inicial do Mi Follow: o coração em pixel, a frase “Quem realmente te segue” e a área para soltar o ZIP](docs/landing.png)

## O que ele faz

- **Quem não te segue de volta**, com o @ e o link de cada perfil.
- **Quem te segue e você não segue** - às vezes a surpresa é do outro lado.
- **Os mútuos** e a proporção de cada lado, para entender o tamanho real da conta.
- **Busca, cópia e CSV** para levar a lista para onde quiser.
- **Histórico**: com uma conta, cada análise fica guardada e dá para comparar dois
  períodos - quem chegou, quem saiu, quem você passou a seguir.
- **Extras** quando vêm no arquivo: bloqueados, melhores amigos, pedidos pendentes.

![O relatório: contagens no topo, abas de listas e a tabela de perfis com link](docs/report.png)

## Como funciona

1. No Instagram, peça o download das suas informações em _Conta → Suas atividades_,
   marcando só **Seguidores e seguindo**, no formato **JSON**.
2. O Instagram avisa por e-mail quando fica pronto (até 48h). Baixe o ZIP.
3. Solte o ZIP no site. A análise aparece na hora - e o arquivo é descartado junto
   com a requisição.

**Por que assim?** O Instagram não oferece a lista de seguidores por API, e entrar
com a sua senha quebraria os termos e exigiria guardar a sua sessão. O arquivo
oficial resolve isso sem que o site encoste na sua conta.

## Arquitetura

```
src/                  o site (React)
├── components/       telas, logo, troca de tema, diálogo de conta
├── lib/              conversa com o Worker
└── app.css           a identidade visual sobre os tokens do faang-ui
worker/               o Worker da Cloudflare
├── index.ts          rotas da API e do site
├── instagram.ts      leitor do ZIP do Instagram
├── account.ts        contas e análises guardadas
├── auth.ts           senha e sessão
└── headers.ts        cabeçalhos de segurança
shared/types.ts       contrato entre o site e o Worker
public/               PWA: manifest, ícones, service worker, OG, robots
db/schema.sql         o banco (D1)
```

Um Worker só: ele serve o site compilado e responde a API. Não há servidor
separado, fila nem armazenamento de arquivos.

## Tecnologias

| Camada | Escolha |
| --- | --- |
| Interface | React 19 + [faang-ui](https://www.npmjs.com/package/faang-ui) |
| Build | Vite (site estático) |
| Hospedagem | Cloudflare Workers |
| Dados | Cloudflare D1 (só o que você manda salvar) |
| Deploy | Cloudflare Workers Builds, a partir do GitHub |
| PWA | manifest + service worker, instalável no celular |

## Onde está publicado

| O quê | Onde |
| --- | --- |
| Site | **https://mifollow.fer.tec.br** |
| Worker | `mifollow`, só no domínio próprio (sem `workers.dev`) |
| Banco | D1 `mi-follow`, região ENAM |
| Código | [github.com/ferforastieri/mi-follow](https://github.com/ferforastieri/mi-follow) |
| Deploy | Workers Builds, branch `main` |

## Instalar no celular

O site é um PWA: abra no navegador do celular, use **Adicionar à tela de início**
(Android/Chrome) ou **Compartilhar → Adicionar à Tela de Início** (iPhone/Safari).
Abre em tela cheia, com ícone próprio, e a última tela continua disponível offline.

## Rodando na sua máquina

```bash
npm install
npm run dev        # site em http://localhost:5173
npm run dev:api    # Worker em http://127.0.0.1:8787 (o site acima usa este)
```

Para ver exatamente o que vai para produção:

```bash
npm run preview    # build + Worker local em http://127.0.0.1:8787
```

## Publicando

Um push na `main` faz o Workers Builds compilar e publicar.

- Build: `npm ci --include=dev && npm run build`
- Deploy: `npx wrangler deploy`

Para publicar da sua máquina, `npm run deploy` faz o mesmo. O `wrangler.jsonc`
carrega as bindings (banco, assets, limites) e o domínio - não há nada para
configurar no painel.

## O que fica guardado

- **O ZIP, nunca.** Ele é lido em memória para gerar o relatório e descartado na
  mesma requisição; nada do arquivo vai para o banco.
- **A análise, só se você pedir.** Ao salvar, ficam o @, o link e a data de cada
  perfil. Sem conta, o Mi Follow não guarda nada.
- **Sua conta** é opcional e usa só e-mail e senha. Dá para apagar uma análise ou a
  conta inteira quando quiser, e tudo some na hora.
- A senha é guardada com hash, a sessão fica em um cookie que o JavaScript da página
  não consegue ler, e as rotas têm limite de uso contra abuso.

## Limites conhecidos

- Conta desativada ou com @ trocado não aparece de um dos lados - por isso as listas
  podem não fechar exatamente com as contagens.
- O arquivo é um retrato: quem deixou de seguir depois do download continua na lista.
- O Instagram leva até 48 horas para liberar o download.
- Não há recuperação de senha (seria preciso enviar e-mail, e o Mi Follow ainda não
  envia).

## Créditos

Feito por <img src="https://cdn.simpleicons.org/github/7d8590" width="15" height="15" alt="GitHub" align="absmiddle" /> [Fernando Forastieri](https://github.com/ferforastieri).

Ideia de <img src="https://cdn.simpleicons.org/instagram/c95b83" width="15" height="15" alt="Instagram" align="absmiddle" /> [@mihforastieri](https://www.instagram.com/mihforastieri/).
