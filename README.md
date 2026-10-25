# CYCLO PWA — EcoCycle Mobile

Aplicativo da Equipe 06 para consultar produção, estoque, esteira e alertas da EcoCycle. HTML5, CSS3 e JavaScript nativos; sem framework, backend ou banco próprios. As interfaces existentes foram preservadas.

**Estado em 25/10/2026:** cliente integrado ao contrato v1.1 e validado com fixtures HTTP; integração operacional com a API oficial **bloqueada** por ausência de JWT, autorização e endpoints contratuais. Não há dados demonstrativos exibidos por padrão. Não houve deploy, push ou commit. Trabalho na branch `feature/ecocycle-api-pwa-security`.

## Executar localmente

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Abra `http://127.0.0.1:8080/login.html` ou `http://127.0.0.1:8080/instalar.html`. Não abra por `file://`. Não é necessário npm install/build para o produto.

`js/config.js` centraliza `API_URL` (padrão local `http://127.0.0.1:8000`), `USE_MOCK: false`, timeout de 10000 ms, polling de 5000 ms e limite de leitura antiga de 30000 ms. Não há processamento de `.env` em um site estático: valores secretos jamais devem ser colocados nesse arquivo. O modo demonstrativo legado só pode ser acionado explicitamente em localhost; não é fallback de falha da API nem método de homologação.

O backend atual não permite login seguro neste cliente. Não use as credenciais demonstrativas do backend como prova de integração. A Equipe 02 precisa concluir os itens de [integração](docs/INTEGRACAO_API.md). Os testes abaixo demonstram o funcionamento do cliente sem alterar o modo real do projeto.

## Arquitetura e repositórios

```text
HTMLs e estilos existentes → app.js (navegação e proteção)
login-page.js → auth.js (sessão em memória) → api.js
dashboard/esteira/estoque/alertas → monitor.js → api.js → API oficial
                                                   ↓
                                          adapters.js + validação
sw.js → somente shell estático público
```

- [CYCLO](https://github.com/JorgeNoolasco/Cyclo_pwa): este projeto.
- [API oficial](https://github.com/lorrainemontini-ai/EcoCycle_platform_backend): fonte operacional e responsável pela autorização; não modificada.
- [Web principal](https://github.com/Livedriven/EcoCycle_platform_frontend): integração de instalação entregue em patch, pois o acesso conectado é somente leitura.

`js/app.js` reutiliza cada HTML como template e preserva a sessão enquanto o usuário navega internamente. O logotipo EcoCycle no cabeçalho abre o menu da conta, com Sair e Instalar aplicativo. Ao recarregar, abrir outra aba ou encerrar o documento é necessário autenticar novamente. Não existe cookie/refresh seguro disponível no contrato para persistir a sessão. `producao.html` é a tela atual de produção **e estoque**; não foi criada uma segunda tela `estoque.html`.

## Endpoints do cliente

| Método | Endpoint | Uso |
| --- | --- | --- |
| POST | `/api/auth/login` | `{login, senha}` → token, nome, perfil, expira_em |
| GET | `/api/dashboard` | Indicadores, estoque, produção diária e última leitura |
| GET | `/api/alertas` | Lista de alertas; filtros locais de gravidade/situação |

O cliente suporta `?ativos=true` quando solicitado à camada API. A tela carrega a lista completa para os filtros existentes. Nenhum endpoint de estoque foi inventado. Lotes, fornecedores e produção foram auditados no backend, mas não há novas operações de escrita/consulta desses cadastros no PWA. Não há comando industrial, POST de telemetria ou de produção.

## Produção e variáveis públicas

Antes de publicar, a equipe responsável deve:

1. Disponibilizar API HTTPS com login/JWT, autorização, dashboard, alertas e CORS correto.
2. Definir sua URL raiz em `CONFIG.API_URL`; manter `USE_MOCK: false`.
3. Adicionar a origem exata da API ao `connect-src` de `vercel.json`. O arquivo atual permite apenas a própria origem e não contém domínio fictício liberado.
4. Autorizar o domínio exato do PWA no CORS do backend; não liberar wildcard com credenciais.
5. Incrementar a versão do cache em `sw.js` ao mudar recursos/configuração.
6. Homologar o fluxo contra dados e conta autorizados, depois publicar somente com autorização.

A configuração Vercel permanece estática, framework Other, output `.`, sem instalação/build/serverless. `.vercelignore` exclui testes, documentação, `.env*`, Git e ambos `node_modules`/`node_modulos`. Este último já era versionado: não foi removido do trabalho dos colaboradores.

No Web principal, `VITE_CYCLO_URL` é a URL pública raiz do CYCLO. O patch valida HTTPS (HTTP local só em desenvolvimento), adiciona uma página ao build multipágina e uma entrada discreta ao menu. Veja [instruções de aplicação](docs/INTEGRACAO_API.md#site-principal-patch).

## Instalar

Na origem HTTPS do CYCLO, abra `instalar.html` e clique em **Instalar aplicativo**. Em Chromium compatível, o prompt nativo é usado após o clique quando disponível. Em iPhone/iPad, use Safari → Compartilhar → Adicionar à Tela de Início. Sem suporte, continue pela versão web. Não há APK/ZIP executável.

O manifest define `standalone`, ícones 192/512 e maskable, start URL e scope relativos. Quando aberto como aplicativo ou após `appinstalled`, a solicitação é ocultada. O navegador pode não informar uma instalação já feita quando a página é aberta em uma aba comum; nesse caso há instruções, sem alegar instalação detectada.

Somente recursos públicos ficam offline. Autenticação e medições precisam de rede. Novas versões do SW aguardam o fechamento das abas da versão anterior. Instalação física em Android/iOS/desktop ainda requer teste manual; o teste Chromium verificou critérios de instalabilidade, não instalação no sistema operacional.

## Segurança e testes

Sessão só em memória; limpeza em logout/expiração/saída; fetch sem persistência; timeouts e cancelamento; 401/403; DOM seguro; nenhuma chave industrial; API fora do cache; CSP e demais cabeçalhos preparados. A autorização real continua sendo responsabilidade do backend e está pendente na revisão auditada.

```sh
node --test tests/core.test.mjs tests/auth.test.mjs
node tests/browser.cjs
python tests/backend-audit.py
```

- Lógica: 19 testes aprovados, incluindo timeout real de 10 segundos.
- Navegador: suíte Edge/Chromium com servidores locais de fixture, proteção, sessão, erros, offline, cache, responsividade, CSP e instalação. Playwright já disponível em `node_modulos`; em outro ambiente, forneça Playwright como ferramenta de desenvolvimento. `TEST_BROWSER=chrome` seleciona Chrome se instalado.
- Auditoria backend: Python com FastAPI/httpx, cópias públicas de routers de commit fixo, sem banco ou alteração remota. Confirma as incompatibilidades, não valida produção.
- Evidências detalhadas e limites: [TESTES.md](docs/TESTES.md). Relatórios/capturas ficam em `test-results/` e não são publicados.

## Arquivos entregues

Criados: `js/adapters.js`, `js/monitor.js`, `js/login-page.js`, `js/menu-page.js`, `instalar.html`, `indisponivel.html`, `assets/vendor/` (Lucide e licença), testes de autenticação/fixtures/auditoria backend e os documentos abaixo.

Modificados: HTMLs de login/dashboard/esteira/alertas/produção/menu; módulos app/API/auth/config/dashboard/esteira/estoque/alertas/PWA/UI; estilos base e login apenas nos ajustes necessários; manifest, SW, configuração de publicação/exclusões e testes existentes.

- [Diagnóstico antes da implementação](docs/DIAGNOSTICO.md)
- [Contrato, diferenças e dependências da E2](docs/INTEGRACAO_API.md)
- [Segurança e tríade CID](docs/SEGURANCA.md)
- [Testes executados e reprodução](docs/TESTES.md)
- [Patch de instalação para o Web](docs/ecocycle-web-install.patch)

## Limitações restantes

Sem URL de produção nem API com contrato e autorização completos, não é possível afirmar que o CYCLO está integrado à operação real. Também faltam aplicação/publicação do patch pela equipe Web e instalação em dispositivos físicos. A interface trata essas ausências sem inventar valores ou simular sucesso. Não se alega conformidade completa com LGPD, OWASP ou normas técnicas.

## Licença

Este projeto é distribuído sob a Licença MIT. Consulte o arquivo LICENSE para mais informações.
