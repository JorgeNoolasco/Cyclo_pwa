> Registro histórico de 25/10/2026. Para configuração, contratos e resultados atuais, consulte [INTEGRACAO_ATUAL.md](INTEGRACAO_ATUAL.md) e [ENTREGA_VERCEL.md](ENTREGA_VERCEL.md). Afirmações sobre ausência de JWT, rotas ou URLs abaixo descrevem a auditoria antiga.

# Diagnóstico técnico — 25/10/2026

Auditoria antes da implementação. Branch de trabalho: `feature/ecocycle-api-pwa-security`.

| Funcionalidade | Situação encontrada | Alteração necessária / realizada | Arquivo responsável |
| --- | --- | --- | --- |
| Login | Formulário somente mostrava mensagem; não autenticava | Ligado ao cliente HTTP, erros e limpeza de senha | `login.html`, `js/login-page.js` |
| Sessão | Módulo em memória existia, mas HTMLs separados perdiam a sessão | Navegação interna por templates dos HTMLs existentes, descarte ao recarregar | `js/app.js`, `js/auth.js` |
| Modo real | `USE_MOCK: true`; consultas liberadas sem sessão em modo demo | Modo real padrão; nenhuma consulta operacional sem sessão | `js/config.js`, `js/api.js` |
| Dashboard | Mistura de mocks, nome Ana e gráfico mensal fixo | Cards e gráfico existentes recebem somente dados validados; produção diária substitui série mensal inexistente | `js/dashboard.js`, `dashboard.html` |
| Alertas | Cinco cartões demonstrativos fixos, sem API | Lista renderizada com as mesmas classes, filtros, vazio, erro, gravidade opcional | `js/alertas.js`, `alertas.html` |
| Estoque | Já vinha do dashboard; renderização aproveitável | Reutilizada; ciclo de requisições e erro 403 corrigidos | `js/estoque.js`, `producao.html` |
| Esteira | Estados já mapeados; falhas de ciclo e atualização por idade | Sem comunicação para falhas/leitura antiga, data e hora da leitura | `js/esteira.js` |
| Polling | Cada tela tinha ciclo próprio; alertas não consultavam | Um monitor desmontável por tela; 5 s, visibilidade, cancelamento e recuperação | `js/monitor.js` |
| PWA | Manifest existente; SW listava dois JS inexistentes, impedindo instalação do cache | Módulos criados, manifest vinculado às telas e cache v4 completo | `sw.js`, `manifest.json`, `js/pwa.js` |
| CSP/ícones | Script CDN `@latest` e scripts inline bloqueados pela própria CSP | Lucide existente fixado localmente em 0.468.0, licença incluída; scripts em módulos | `assets/vendor/`, HTMLs |
| Publicação | `node_modulos/` versionado, fora da exclusão `node_modules` | Excluído da publicação; conteúdo de outros colaboradores preservado | `.vercelignore` |
| Testes | 9/10 testes de lógica passavam; teste do cache falhava; navegador testava interface anterior | Suítes alinhadas às telas atuais e ao contrato v1.1 | `tests/` |
| Site principal | Vite multipágina, menu central em `src/shared/layout.js` | Patch discreto de menu + página, entrada no build | `docs/ecocycle-web-install.patch` |
| Backend | Login sem JWT, consultas sem autorização, dados em memória, rotas do contrato ausentes | Bloqueio da integração segura; correção depende da E2, backend não alterado | [INTEGRACAO_API.md](INTEGRACAO_API.md) |

## Fontes e revisões

- CYCLO local e remoto configurado: `JorgeNoolasco/Cyclo_pwa`, base `82c43fd9b47a9819aa2bb2c358b1eeefaf46a2fd`.
- Backend: `lorrainemontini-ai/EcoCycle_platform_backend`, revisão `4de534fa7ff8c5804c3b763c6a9863f642d19b99`.
- Web: `Livedriven/EcoCycle_platform_frontend`, revisão `1d3e9d1790c464b453cd731c72669ec03a68594a`; conexão GitHub indica `pull: true`, `push: false`.
- Contrato da API v1.1, plano MVP, levantamento de requisitos, atividade acadêmica, casos de uso e exemplos Postman fornecidos. Os documentos são referência; as instruções de implementação são as do pedido do usuário.
- ZIP de diagramas inspecionado quanto ao inventário; não foi usado para inferir rotas ou autorizações.

O código contradizia o README anterior em pontos fundamentais. As alegações antigas de testes e integração foram substituídas por resultados desta revisão. Não houve commit, push ou deploy.

