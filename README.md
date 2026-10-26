# CYCLO PWA — EcoCycle Mobile

Aplicativo estático em HTML, CSS e JavaScript nativos para consulta operacional. A arquitetura e os estilos foram preservados.

**Estado em 26/10/2026:** cliente configurado para os serviços oficiais da Vercel. A integração operacional ainda depende de CORS no backend, de uma conta autorizada e de contratos compatíveis para os indicadores e alertas. Nenhum deploy foi realizado.

## Executar e testar

Requer Node.js 22 ou superior. O produto não precisa de bibliotecas em execução; Playwright é dependência de desenvolvimento.

```sh
npm ci
npm test
npm run build
npm run test:browser
node tests/production-audit.mjs
```

A suíte de navegador usa Edge; TEST_BROWSER=chrome seleciona Chrome. Git é opcional para comparar geometria com HEAD; sem ele, esse teste é explicitamente ignorado.

Para servir o artefato gerado:

```sh
python -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Abra http://127.0.0.1:8080/login.html. Esse servidor local não muda a API: as requisições continuam apontando para produção e dependem de CORS autorizando a origem de desenvolvimento, caso se queira autenticar localmente.

## Configuração pública e Vercel

O build lê **API_URL** e **WEB_URL** do ambiente. Os padrões estão em js/config.js:

| Variável | Valor |
| --- | --- |
| API_URL | https://eco-cycle-platform-backend.vercel.app |
| WEB_URL | https://eco-cycle-platform-frontend.vercel.app |

No projeto Vercel do **CYCLO PWA**, defina essas variáveis em Production e Preview. Use Framework Preset **Other**, Build Command **npm run build** e Output Directory **dist**, já definidos em vercel.json. O build usa apenas módulos nativos de Node; não precisa instalar Playwright na Vercel.

Para configurar localmente, copie .env.example para .env e execute `node --env-file=.env scripts/build.mjs`. O navegador não lê arquivos .env. O build incorpora somente os dois endereços públicos e força USE_MOCK=false. Não coloque credenciais nessas variáveis.

A CSP permite conexão com a origem oficial da API. Se mudar API_URL para outra origem HTTPS, atualize também connect-src em vercel.json; o build rejeita divergências. O cache do artefato recebe um identificador calculado a partir dos recursos públicos para atualizar URLs e código juntos. Não há rewrite que intercepte chamadas da API.

## Navegação e autenticação

O link **Voltar para o Sistema Web** está na tela de login, com a classe visual já existente login__esqueci. Abre https://eco-cycle-platform-frontend.vercel.app por navegação externa nativa, inclusive sem JavaScript. O endereço foi confirmado no campo homepage do [repositório do portal](https://github.com/Livedriven/EcoCycle_platform_frontend).

O PWA não compartilha sessão com o portal. O token permanece somente em memória; recarregar, sair ou encerrar o documento exige novo login. O payload JWT é lido apenas para expiração. A API é responsável pela assinatura, validade e autorização em cada requisição.

## Chamadas HTTP

| Operação | Contrato publicado |
| --- | --- |
| Login | POST /api/login, JSON {usuario, senha}; TokenResponse com access_token, token_type, perfil e acesso_liberado |
| Dashboard | GET /api/producao/dashboard-diario, com Authorization: Bearer |
| Alertas | GET /api/alertas, com Authorization: Bearer |

A API centraliza timeout de 10 segundos, cancelamento, erros HTTP, JSON e validação. Usa credentials=omit, cache=no-store e bloqueia redirects. 401 encerra a sessão; 403 remove dados da consulta negada. Não há PUT, PATCH ou DELETE no escopo funcional deste PWA.

**Limites dos dados:** o dashboard publicado apresenta balanço de massas, que não equivale ao contrato de total processado, saldo de estoque e séries por material do PWA. Esses campos permanecem indisponíveis; não há zeros fictícios, conversão arbitrária ou criação de datas. Os adaptadores v1.1 foram preservados para respostas compatíveis. O OpenAPI de alertas não especifica o esquema da resposta; sem amostra autorizada, formatos desconhecidos são rejeitados.

## Pendências do backend

A auditoria de 26/10/2026 encontrou raiz e OpenAPI com HTTP 200, consultas protegidas com 401 sem token, login vazio com 422 e preflight OPTIONS com **405 sem headers CORS**, inclusive para a origem oficial do portal.

A equipe do backend deve configurar CORS para https://eco-cycle-platform-frontend.vercel.app e para a **origem real do CYCLO PWA** (não informada nesta tarefa), aceitar GET/POST e preflight OPTIONS, permitir Authorization e Content-Type e aplicar esses headers também em respostas de erro. Não é necessário permitir cookies: este cliente usa Bearer e credentials=omit.

Também precisa fornecer campos operacionais compatíveis, formalizar o esquema de alertas e disponibilizar conta de homologação. O código backend não está no workspace; o endereço GitHub histórico retornou 404. Não foram alterados outros repositórios ou configurações remotas.

## Documentação e evidências

- [Relatório desta entrega, arquivos e resultados](docs/ENTREGA_VERCEL.md).
- [Contrato atual e configuração CORS sugerida](docs/INTEGRACAO_ATUAL.md).
- Os documentos DIAGNOSTICO.md, INTEGRACAO_API.md, SEGURANCA.md e TESTES.md contêm evidências históricas de 25/10/2026; seus avisos apontam para esta revisão.
- Código próprio comentado em português brasileiro; dependências, imagens binárias e artefatos gerados não foram comentados.
- Evidências locais em test-results/ são excluídas da publicação.

## Instalação e licença

Em uma origem HTTPS, abra instalar.html e use o botão de instalação. No Safari móvel, use Compartilhar → Adicionar à Tela de Início. Apenas o shell público funciona offline; sessão e dados reais exigem rede. Instalação física em dispositivos ainda requer validação manual.

Licença MIT: consulte LICENSE.

