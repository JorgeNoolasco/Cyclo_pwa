# Adaptação aos endpoints reais — 26/10/2026

Esta revisão substitui as conclusões anteriores de que não era possível mapear produção, equipamento e alertas. O código backend fornecido permitiu confirmar os envelopes e as regras. As alterações são somente no Cyclo PWA; nenhum backend foi modificado e nenhum deploy foi executado.

## Fontes consultadas

- Pasta local `C:/Users/Aluno_Manha/Documents/GitHub/EcoCycle_platform_backend`: main.py e routers/auth.py, producao.py, equipamentos.py, alertas.py e telemetria.py, apenas para leitura. O ZIP inicialmente listado não estava disponível na segunda leitura; a pasta extraída foi localizada e usada como fonte.
- [OpenAPI de produção](https://eco-cycle-platform-backend.vercel.app/openapi.json): rotas, métodos, parâmetros e Bearer conferidos por HTTP.
- [Frontend oficial](https://github.com/Livedriven/EcoCycle_platform_frontend), revisão `390263dd21eef4f7e08a428d389518f06258ed8c`: src/shared/api.js, session.js, features/dashboard/dashboard.js e features/production/production.js.

O portal usa Bearer, mas espera listas diretas, `/esteiras`, campos como peso_kg/data_hora e JWT com nome. O backend fornecido usa `/api/equipamentos`, envelopes, quantidade_saida_kg/data_inicio e JWT com sub. Portanto, essas expectativas do portal **não foram copiadas** para o PWA. O contrato do backend prevalece.

## Mapeamento de todas as funcionalidades do PWA

| Tela/fluxo | Endpoint anterior do PWA | Endpoint real utilizado ou disponível | Método e parâmetros | Autenticação | Resposta e adaptação |
| --- | --- | --- | --- | --- | --- |
| Login | /api/login (antes da primeira revisão: /api/auth/login) | /api/login | POST JSON {usuario, senha} | Não exige token prévio | TokenResponse: access_token, token_type, perfil, acesso_liberado; sub/exp do JWT para identificação e expiração |
| Dashboard | /api/producao/dashboard-diario, com indicadores descartados | /api/producao + /api/equipamentos + /api/alertas | Três GET, sem query | Bearer em todas | Combina produção normalizada, equipamento e contagem de concluido=false; falha em qualquer fonte não simula consulta completa |
| Produção, gráfico e filtros | Mesmo dashboard genérico | /api/producao | GET; dia, 7 dias e mês filtrados localmente | Bearer | {registros_producao: []}; soma de quantidade_saida_kg e agrupamento por data_inicio |
| Esteira | Mesmo dashboard genérico | /api/equipamentos | GET sem parâmetros | Bearer | Objeto único: nome_esteira, status_esteira, temperatura_esteira_c, velocidade_esteira_kmh, peso_atual_kg, travada |
| Alertas e filtros | /api/alertas; camada HTTP podia enviar ?ativos=true | /api/alertas | GET sem query; filtros e ordenação locais | Bearer | {usuario_responsavel, alertas: objeto}; também aceita coleção no envelope; concluido → resolvido |
| Estoque | Campos esperados no dashboard | Não existe endpoint de estoque/saldo | Nenhuma chamada inventada | — | Informação indisponível; produção não é saldo de estoque |
| Menu/perfil | Sessão em memória | Não existe GET /me ou perfil completo | Sem requisição adicional | Sessão local | sub para nome de usuário e perfil retornado no login; não inventa nome completo/e-mail |
| Cadastro | Não existe formulário no PWA | POST /api/usuarios existe no backend | {usuario, senha, perfil}; não chamado pelo PWA | OpenAPI não declara autenticação nessa rota | Não foi adicionada uma funcionalidade administrativa nova; regras do servidor não foram alteradas |
| Recuperação de senha | Orientação para procurar administrador | Nenhuma rota correspondente encontrada | Sem requisição | — | Orientação existente preservada |
| Logout/expiração | Limpeza em memória | Não há rota de logout/refresh | Sem requisição | Sessão descartada | Limpa token, timer, DOM e tentativas pendentes; não alega revogação no servidor |
| Instalar, Sobre e retorno ao portal | Ações locais e link externo | Sem API operacional | Navegação nativa | Independente | Retorno permanece https://eco-cycle-platform-frontend.vercel.app |

Não existem formulários de lotes, fornecedores, materiais, produção ou telemetria no PWA. As rotas POST desses módulos não são chamadas. O OpenAPI não oferece PUT/PATCH/DELETE para os fluxos inspecionados; não foram criados métodos ou endpoints fictícios. Não há paginação no GET /api/producao ou /api/alertas.

Outros endpoints confirmados, não necessários às telas atuais: GET /api/producao/dashboard-diario (`data` opcional DD/MM/AAAA), dashboard-mensal (`mes`, `ano`), dashboard-trimestral (`trimestre`, `ano`) e /api/telemetria/historico. O histórico persiste a cada 40 minutos e usa timestamp sem fuso; não foi tratado como leitura em tempo real. O filtro mensal do fonte contém `dt.month -- mes`, que não compara igualdade; o PWA usa a lista completa e filtra localmente, sem modificar o servidor.

## Campos e regras implementados

### Produção

`registros_producao` deve ser array. Cada quantidade_saida_kg deve ser número finito não negativo; números enviados como texto são rejeitados. IDs duplicados não são somados duas vezes. A soma de saída alimenta o campo interno legado total_processado_kg, cujo rótulo foi corrigido para **Toneladas produzidas**. Entrada bruta, rejeito e estoque não são confundidos com esse valor.

O seed usa tipo_material e o cadastro devolve id_material com o texto do material. O adaptador trata ambas as variantes, normaliza caixa/acentos e reconhece Plástico (inclusive Plástico PET) e Metal. Outros materiais entram no total, sem serem atribuídos a essas categorias. Material ausente ou ID numérico não é resolvido por adivinhação: os totais por categoria ficam indisponíveis.

Os dias usam data_inicio, assim como o filtro diário do backend. Datetimes sem fuso não recebem Z nem conversão automática para o fuso do navegador. Datas ausentes não geram um dia artificial; o total geral é preservado, mas indicadores por período ficam indisponíveis quando a série não é completa. A lista vazia retorna totais zero e gráfico vazio, porque há resposta válida sem registros. Dias sem registros não são preenchidos artificialmente.

O seletor Hoje/7 dias/Este mês agora altera também o gráfico. O mês é calculado a partir dos registros recebidos; estoques continuam null. Os gráficos e indicadores exibem toneladas dividindo kg por mil.

### Equipamento

Preserva nome, temperatura, velocidade em km/h, peso e travamento. Normaliza estados conhecidos para classes visuais, mantendo também o texto original. Como GET /api/equipamentos não fornece timestamp, o estado aparece com **Sem horário de leitura**, em apresentação neutra; o horário da consulta não é usado como horário do sensor. A velocidade antes marcada em % foi corrigida para km/h. Produção específica da esteira não é inventada.

### Alertas

O objeto único dentro de alertas vira um item da lista. concluido vira resolvido. O registro atual não fornece id_alerta, tipo, data ou prioridade: o cartão mostra Registro de alerta, Data indisponível e Gravidade indisponível. Não usa id_esteira como ID do alerta nem deduz gravidade pela temperatura. Datas sem fuso, se recebidas, são exibidas como texto com essa limitação explícita. O filtro de ativos ocorre localmente, sem enviar query não suportada ao servidor.

### Autenticação e falhas

POST /api/login mantém {usuario, senha}. O JWT é decodificado como UTF-8 para ler sub, perfil e exp. Perfil conflitante, Bearer ausente, acesso_liberado diferente de true ou expiração inválida são rejeitados. A assinatura continua sendo responsabilidade do backend em cada GET protegido. A sessão permanece somente em memória, sem compartilhamento com o portal ou gravação em localStorage/sessionStorage.

Mantidos: timeout de 10 segundos por requisição, cancelamento, bloqueio de redirects, credentials=omit, cache=no-store, 401 encerrando sessão e 403 removendo dados. Dashboard agrega sequencialmente suas três fontes; erro interrompe a sequência e a tela sinaliza falha, preservando a política existente de dados antigos. Produção e esteira consultam apenas suas próprias fontes. Modo demonstrativo permanece restrito a habilitação explícita em loopback; nunca é fallback de produção.

## Arquivos modificados nesta revisão

- Integração e telas: js/adapters.js, js/api.js, js/monitor.js, js/dashboard.js, js/esteira.js, js/estoque.js, js/alertas.js.
- Correções de rótulo/unidade, sem mudança de estilos: dashboard.html e esteira.html.
- Testes: tests/fixtures.mjs, tests/core.test.mjs, tests/integration.test.mjs, tests/browser.cjs, tests/production-audit.mjs e o novo tests/backend-contract.test.mjs.
- Documentação: README.md, docs/ENDPOINTS_REAIS.md e avisos de revisão nos relatórios anteriores.

Comentários em português preservados e complementados. CSS, manifesto, navegação, sessão em memória e mecanismo de service worker preservados. O build existente recalcula o hash do cache do artefato automaticamente.

## Testes e pendências

- 32 testes Node aprovados: contratos reais, erros HTTP, autenticação, Unicode no JWT, campos ausentes, datas, massas, duplicidades, cancelamento e cache.
- 18 verificações de navegador aprovadas com **fixtures HTTP locais**, incluindo login, envelopes reais, km/h, ausência de timestamp/estoque, filtros, responsividade, retorno ao portal, offline e instalação. Essas respostas são testes, não dados de produção.
- Build de produção e verificação de sintaxe JavaScript aprovados. Não há TypeScript nem comando de lint configurado.
- Comparação geométrica com HEAD ignorada explicitamente porque Git não está disponível neste ambiente.
- Auditoria **real**, apenas GET/OPTIONS: raiz/OpenAPI 200; produção, equipamentos e alertas 401 sem token; preflight 405 sem CORS. Isso confirma proteção e o bloqueio de navegador, não um erro de endpoint.
- Sem credenciais de homologação autorizadas: nenhum login autenticado foi executado em produção. Credenciais demonstrativas encontradas no fonte não foram usadas nem copiadas para o PWA.

CORS será corrigido separadamente no backend, conforme solicitado. A API usa dados em memória segundo o código fornecido; o PWA mostra o que ela retorna, sem criar seus próprios registros operacionais. Ainda não existem saldo de estoque, perfil completo, recuperação de senha, logout remoto ou timestamp de equipamento. A pasta backend não foi alterada. Nenhum deploy foi realizado.
