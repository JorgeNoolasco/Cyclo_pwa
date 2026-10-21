# EcoCycle — Equipe 06

PWA de consulta para o projeto integrador **EcoCycle — Reciclagem Inteligente**. Desenvolvida com **HTML5, CSS3 e JavaScript puro**, sem framework, build ou dependências de execução. A aplicação funciona com dados demonstrativos enquanto a API da Equipe 02 não está disponível.

## Executar localmente

Na pasta do projeto, execute um servidor de arquivos estáticos. Exemplo com Python instalado:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Abra **http://127.0.0.1:8080**. Também é possível usar a extensão Live Server do VS Code. Não é necessário executar `npm install`, compilar arquivos ou instalar Node.js para usar a PWA. Python/Live Server apenas entregam os arquivos; não implementam uma API ou backend do projeto.

Não abra os HTMLs diretamente com `file://`: módulos JavaScript e Service Worker precisam de HTTP local ou HTTPS. Em smartphones, use uma hospedagem HTTPS; um endereço HTTP da rede local não oferece todas as funcionalidades da PWA.

**Acesso demonstrativo:** usuário `demo`, senha `ecocycle-demo`. Esses identificadores são públicos, fictícios e não correspondem a uma conta real. O botão “Preencher acesso demonstrativo” preenche o formulário; “Acessar monitoramento” inicia a sessão.

## Escopo

A Equipe 06 entrega a interface mobile, autenticação, consultas remotas, estados de conexão, PWA e integração. Não existe cadastro, alteração de estoque, resolução de alertas, controle industrial ou backend próprio.

A aplicação **consome a API da Equipe 02**. Não acessa diretamente o banco da Equipe 03, Supabase, sensores ou equipamentos da Equipe 04. Todos os perfis — ADMINISTRADOR, GERENTE, OPERADOR e CONSULTA — recebem uma interface exclusivamente de consulta. A autorização efetiva pertence à API.

## Estrutura e responsabilidades

```text
index.html             Entrada da aplicação
login.html             Formulário de autenticação
dashboard.html         Indicadores e produção diária
esteira.html           Estado e comunicação da esteira
alertas.html           Alertas ativos ou todos
estoque.html           Estoque, recuperação e evolução da produção
css/
  style.css            Tipografia, layout e tela de login
  components.css       Cards, gráficos, estados e componentes
  mobile.css           Responsividade e navegação inferior
js/
  config.js            Configuração pública e intervalos
  api.js               Fetch, timeout, códigos HTTP e validação JSON
  auth.js              Sessão em memória, expiração e logout
  mocks.js             Dados e cenários fictícios
  app.js               Navegação, consultas, cache da sessão e PWA
  ui.js                Elementos DOM seguros e gráficos compartilhados
  dashboard.js         Apresentação dos indicadores
  esteira.js           Apresentação da esteira
  alertas.js           Apresentação e filtro de alertas
  estoque.js           Apresentação de estoque e materiais
assets/icons/          SVGs próprios e ícones PNG normais/maskable
manifest.json          Identidade e instalação da PWA
sw.js                  Cache exclusivo dos arquivos estáticos
vercel.json            Hospedagem estática e cabeçalhos de segurança
tests/
  core.test.mjs        Testes com recursos nativos do Node.js
  browser.cjs          Verificação opcional por automação de navegador
```

Os seis HTMLs compartilham a mesma estrutura, deliberadamente duplicada para dispensar templates e ferramentas de build. Ao alterar essa estrutura, mantenha os seis arquivos sincronizados. Cada URL seleciona sua página em `app.js`.

Os links internos usam a History API para atualizar a URL e a área principal **sem recarregar o documento**. Isso preserva o token somente em memória durante a navegação. Botões Voltar/Avançar funcionam. Abrir uma nova aba, recarregar ou reabrir o aplicativo exige novo login. Um acesso direto a qualquer página protegida é redirecionado para `login.html`.

## Páginas

| Página | Informações |
| --- | --- |
| Login | Formulário, indicação de demonstração, carregamento, erro e expiração |
| Visão geral | Processado, plástico, metal, estoque, produção diária, esteira, temperatura e alertas ativos |
| Esteira | Código, estado, temperatura, material, comunicação e última leitura |
| Alertas | Tipo, equipamento, data/hora, prioridade e situação; filtros Ativos/Todos |
| Estoque e produção | Plástico, metal, total recuperado, composição e evolução diária |

O estoque soma exclusivamente plástico e metal; rejeitos não compõem o saldo. Os totais processados e recuperados retornados pela API são preservados. A soma de plástico e metal recuperados pode diferir do total processado, por exemplo por rejeitos; não se corrige o backend no frontend.

Gráficos são feitos com HTML/CSS, com tabela acessível dos mesmos valores. Há foco de teclado visível, labels, mensagens de status, links de acesso ao conteúdo, redução de animação quando solicitada pelo sistema e navegação inferior em telas menores.

## Modos de integração

Edite **`js/config.js`**:

```js
export const CONFIG = Object.freeze({
  API_URL: 'http://localhost:8000',
  USE_MOCK: true,
  REQUEST_TIMEOUT: 10000,
  POLL_INTERVAL: 5000,
  STALE_AFTER: 30000
});
```

Em demonstração, o seletor “Cenário” permite testar operação normal, emergência, parada, desligada, comunicação perdida, leitura antiga, resposta vazia, HTTP 401/403/500 e falha de conexão. O carregamento simulado dura aproximadamente 350 ms. A opção “Falha de conexão” simula indisponibilidade da API; para testar o dispositivo realmente offline, use o modo Offline das ferramentas do navegador.

Para integrar a API oficial:

1. Configure `API_URL` com a origem/base HTTPS oficial, **sem acrescentar `/api`** se ela já expuser os caminhos abaixo.
2. Defina `USE_MOCK: false`. Não existe fallback de produção para mocks.
3. Em `vercel.json`, substitua `https://api.ecocycle.example` no `connect-src` da CSP pela origem oficial. O domínio `.example` é um marcador, não uma API em funcionamento.
4. Confirme os formatos JSON com a Equipe 02. Se forem iguais aos formatos abaixo, nenhuma tela precisa ser alterada. Se diferirem, ajuste a validação e a normalização exclusivamente na camada `api.js`.
5. Solicite à Equipe 02 o CORS para a origem HTTPS da PWA, métodos GET/POST e cabeçalhos `Authorization`/`Content-Type`. A API também deve atender o preflight OPTIONS e validar permissões. Não use `mode: no-cors` para tentar contornar isso.
6. Incremente a versão do cache em `sw.js`, publique os arquivos e feche as abas antigas para ativar a nova versão.

`config.js` é público. Nunca coloque senhas reais, API keys ou chaves dos dispositivos industriais nele. As variáveis do painel da Vercel não substituem automaticamente esse arquivo: não há build.

### Endpoints utilizados

| Operação | Método e rota | Uso |
| --- | --- | --- |
| Login | `POST /api/auth/login` | Corpo `{ "login": "...", "senha": "..." }` |
| Dashboard | `GET /api/dashboard` | Dashboard, esteira e estoque |
| Alertas ativos | `GET /api/alertas?ativos=true` | Filtro inicial |
| Todos os alertas | `GET /api/alertas` | Histórico fornecido pela API |

Consultas enviam `Authorization: Bearer <token>`. Não há `/api/estoque`, rotas de escrita operacional, refresh token ou logout remoto inventados.

### Formatos esperados e dependência do contrato

O anexo define o formato do login, mas **não fornece o JSON oficial do dashboard e dos alertas**. Os exemplos operacionais abaixo são um contrato provisório usado pelos mocks e pelo validador, a confirmar com a Equipe 02. Os testes do modo real interceptam respostas HTTP; não comprovam compatibilidade com uma API ainda indisponível.

Login:

```json
{
  "token": "jwt_recebido_da_api",
  "nome": "Maria Souza",
  "perfil": "GERENTE",
  "expira_em": "2026-10-21T16:30:00Z"
}
```

Dashboard (ou `null` quando não houver dados):

```json
{
  "atualizado_em": "2026-10-21T15:30:00Z",
  "total_processado_kg": 2840,
  "plastico_recuperado_kg": 1680,
  "metal_recuperado_kg": 920,
  "estoque": { "plastico_kg": 4250, "metal_kg": 2180 },
  "alertas_ativos": 2,
  "esteira": {
    "codigo": "EST-001",
    "estado": "LIGADA",
    "temperatura": 38.4,
    "ultima_leitura": "2026-10-21T15:30:00Z",
    "material": "Plástico PET",
    "conectada": true
  },
  "producao_diaria": [
    { "data": "2026-10-21", "plastico_kg": 1680, "metal_kg": 920 }
  ]
}
```

`esteira` pode ser `null`; `temperatura` e `material` também podem ser `null`. `producao_diaria` pode ser `[]`. Quantidades devem ser números finitos não negativos; contagem de alertas, inteira. Campos obrigatórios ausentes geram erro de formato, nunca zeros inventados. Estados aceitos: LIGADA, DESLIGADA, PARADA e EMERGENCIA. Datas/horas precisam incluir fuso (`Z` ou deslocamento).

Alertas (ou `[]`):

```json
[
  {
    "id": "A-104",
    "tipo": "TEMPERATURA_ALTA",
    "equipamento": "EST-002",
    "data_hora": "2026-10-21T15:18:00Z",
    "resolvido": false,
    "prioridade": "ALTA"
  }
]
```

Tipos aceitos: TEMPERATURA_ALTA, PARADA e EMERGENCIA. Prioridades: ALTA, MEDIA e BAIXA. IDs são strings. A tela ordena os eventos pela data, do mais recente para o mais antigo. O horário de consulta dos alertas é identificado separadamente da data do evento.

## Atualização, conexão e offline

Há um agendador de 5 segundos e uma trava para impedir consultas sobrepostas. A tela de alertas consulta somente alertas; as demais consultam o dashboard compartilhado. Quando a aba fica oculta, a consulta em andamento é cancelada e o polling não faz novas requisições. Ao voltar à aba ou recuperar a rede, uma consulta é iniciada. O botão Atualizar permite consulta manual e fica desabilitado durante a requisição.

| Estado | Comportamento |
| --- | --- |
| Online com dados atuais | Indicadores e horário de atualização |
| Online com API indisponível | Mensagem de erro; dados anteriores identificados, se disponíveis |
| Offline com dados da sessão | Última consulta em memória, horário visível e aviso de dados anteriores |
| Offline sem dados | Aviso explícito de indisponibilidade; nenhum indicador inventado |
| Leitura acima de 30 segundos | Esteira sem confirmação do estado atual |
| Equipamento desconectado | “Sem comunicação atual”, mesmo se o último estado era LIGADA |
| HTTP 403 | Remove os dados da consulta negada e exibe falta de permissão |
| HTTP 401 / expiração | Cancela requisições, apaga dados e retorna ao login |

O Service Worker armazena **somente uma lista fechada de arquivos estáticos**. Não intercepta API, login, pedidos com Authorization ou origens externas. O cache operacional é apenas uma variável privada em memória, isolada por sessão/aba; é apagado no logout, na expiração e ao sair do documento. Respostas antigas não podem repovoar a tela depois de um logout.

**Limitação intencional:** recarregar offline abre a interface, mas exige autenticação e conexão para consultar dados protegidos. Não existe sessão persistida ou mecanismo seguro de renovação definido pelo contrato. Em um dispositivo recém-aberto sem conexão e sem cache estático, nem a interface pode ser carregada. O navegador pode remover arquivos em cache quando precisar de espaço.

## Instalar a PWA

1. Abra o site por HTTPS (ou localhost para desenvolvimento) com conexão.
2. Use “Instalar aplicativo” na tela de login, na lateral do desktop ou o ícone de download do cabeçalho mobile.
3. Se o navegador oferecer `beforeinstallprompt`, será aberto o diálogo nativo. Caso contrário, a aplicação mostra instruções do menu do navegador.
4. No Safari/iPhone: Compartilhar → Adicionar à Tela de Início.

Os ícones 192/512 e maskable 512 estão incluídos; o ícone maskable mantém o desenho na área segura. O modo é `standalone`.

Atualizações do Service Worker aguardam o fechamento das abas da versão anterior. Aumente `ecocycle-static-v1` em `sw.js` a cada publicação que altere qualquer recurso, inclusive `config.js`, para não conservar uma configuração antiga. Não se força atualização no meio de uma sessão autenticada.

## Segurança implementada

- JWT e dados consultados apenas em memória, sem localStorage/sessionStorage/IndexedDB; senhas não são persistidas e o campo é limpo após envio.
- Expiração verificada antes da consulta, a cada segundo e no retorno à aba. A API é responsável pela assinatura do JWT e autorização real de cada chamada.
- Proteção das telas e limpeza do DOM no logout, expiração e saída do documento, incluindo restauração pelo histórico do navegador.
- Chamadas somente aos endpoints permitidos, timeout por AbortController, cancelamento, `cache: no-store`, `credentials: omit` e bloqueio de redirecionamentos HTTP.
- HTTPS para API em produção. HTTP permitido somente em localhost/127.0.0.1/IPv6 local durante desenvolvimento HTTP.
- Validação dos dados antes de renderizar. Dados externos entram por `textContent`, sem `innerHTML`, eval ou scripts externos.
- CSP restringindo scripts, estilos, imagens e workers à própria origem, API explicitamente permitida e bloqueio de frames/objetos; também Referrer-Policy, nosniff, Permissions-Policy e HSTS na hospedagem.
- Nenhuma biblioteca, fonte remota, serviço de analytics ou CDN na aplicação publicada.

A CSP é um cabeçalho do servidor: o servidor HTTP simples local não o aplica. O teste de navegador reproduz os cabeçalhos configurados na Vercel. A origem `.example` precisa ser substituída antes de usar a API oficial. Não há proteção contra XSS equivalente a uma garantia absoluta; toda mudança que renderize dados deve preservar o uso seguro do DOM. O frontend não substitui segurança, rate limiting, logs de auditoria e autorização no backend.

## Publicar na Vercel

O projeto está **preparado**, mas não foi publicado automaticamente.

1. Versione os arquivos e importe o repositório na Vercel.
2. Selecione **Other** no framework, raiz do projeto como Root Directory e `.` como Output Directory.
3. Deixe comandos de instalação e build vazios. `vercel.json` já expressa essas opções. Não adicione funções serverless.
4. Para demonstração, mantenha `USE_MOCK: true`. Para integração real, ajuste URL, modo, CSP e CORS conforme descrito acima.
5. Publique e verifique HTTPS, manifest, Service Worker, cabeçalhos e login. Faça também o teste em smartphone físico.

Não são necessárias regras de reescrita: todas as páginas `.html` existem. `.vercelignore` exclui ferramentas locais, relatórios e arquivos não destinados ao site. `.gitignore` exclui dependências, arquivos `.env`, arquivos locais e relatórios. Se existir `node_modules` da base anterior no computador, ele não é necessário para executar ou publicar esta aplicação.

Documentação de referência: [sites estáticos na Vercel](https://vercel.com/docs/builds), [configuração de cabeçalhos](https://vercel.com/docs/project-configuration/vercel-json) e [Service Workers na MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

## Testes e resultados

Executados em **21/10/2026**. O frontend não precisa de Node.js; ele é opcional para executar os testes abaixo.

Testes de lógica e contrato com Node.js 22+ (sem instalar pacotes):

```sh
node --test tests/core.test.mjs
```

Resultado: **10 testes aprovados**, incluindo login válido/inválido, dashboard, filtros, estados, JSON inválido, campos ausentes, HTTP 400/401/403/500, erro de rede, timeout, cancelamento, modo real sem fallback e arquivos do manifest/cache.

Verificação de sintaxe dos arquivos, em PowerShell:

```powershell
Get-ChildItem js -Filter *.js | ForEach-Object { node --check $_.FullName }
node --check sw.js
```

Teste opcional de navegador, usando o Playwright já disponível no ambiente de desenvolvimento e Edge instalado:

```sh
node tests/browser.cjs
```

Ele pressupõe o servidor em `http://127.0.0.1:8080`. `TEST_URL` muda a origem e `TEST_BROWSER` muda o canal (por exemplo `chrome`). Se o Playwright não estiver disponível, use o roteiro manual abaixo; **não é necessário instalar ferramentas de teste para utilizar a aplicação**. O script é JavaScript com `assert` nativo; o Playwright apenas dirige o navegador e não integra o site publicado.

| Verificação executada | Resultado |
| --- | --- |
| Login demonstrativo e inválido, proteção de URL direta | Aprovado no Edge automatizado |
| Dashboard, esteira, alertas e estoque | Aprovado |
| Estados LIGADA/DESLIGADA/PARADA/EMERGENCIA, leitura antiga e desconexão | Aprovado |
| Resposta vazia, falha de conexão, HTTP 401/403/500 | Aprovado |
| Offline com dados, offline sem dados e retomada da rede | Aprovado |
| Logout, histórico, limpeza do DOM e resposta atrasada após logout | Aprovado |
| Expiração temporal da sessão de uma hora | Aprovado com avanço do relógio de teste |
| Cache estático excluindo respostas da API | Aprovado |
| Modo real, Bearer, JSON de login, CSP e conteúdo externo como texto | Aprovado com HTTP interceptado |
| Polling suspenso em segundo plano e consultas sem sobreposição | Aprovado |
| Larguras 320/390/768/1440 px sem overflow horizontal | Aprovado |
| Inspeção visual de capturas desktop/mobile | Realizada |
| Critérios de instalação no Chromium/Edge com perfil comum | Nenhum erro de instalabilidade reportado |
| Instalação efetiva em Android/iPhone físico | Pendente de teste no dispositivo |
| Comunicação com a API oficial e CORS de produção | Pendente: API não disponível |
| Publicação e validação no domínio Vercel | Pendente: somente configuração preparada |

As capturas e o relatório JSON são gerados em `test-results/`, fora da publicação e do versionamento. Não há build, verificação TypeScript ou auditoria npm aplicáveis à aplicação atual: ela não possui pacotes de execução nem package.json. Nenhum resultado de instalação em aparelho físico ou de API oficial é presumido pelos testes locais.

### Roteiro manual para a equipe

1. Abra diretamente `estoque.html`: deve pedir login. Tente credenciais erradas e depois o acesso demonstrativo.
2. Navegue pelas quatro consultas. Confira valores de estoque, tabela de produção e filtro Todos/Ativos.
3. Troque todos os cenários de esteira. Dados antigos ou desconexão nunca devem aparecer como “Em operação”.
4. Simule erro 500, 403, 401 e resposta vazia. Um 403 remove os dados negados; 401 retorna ao login.
5. Aguarde o registro do Service Worker. Ative Offline no navegador: veja o aviso e os dados da sessão. Desative Offline: a consulta deve se recuperar.
6. Saia da conta, tente Voltar e recarregue offline: nenhum dado protegido deve reaparecer.
7. Use teclado e emulação de 320/390 px; depois confira em aparelho físico por HTTPS e teste a instalação real.
8. Quando a API existir, execute o modo real com um usuário de teste autorizado; confira contrato, permissões, CORS e timeout.

## Entrega em cinco dias

| Dia | Foco |
| --- | --- |
| 1 | Estrutura estática, identidade visual, navegação e responsividade |
| 2 | Login, sessão e dashboard com mocks |
| 3 | Esteira, alertas, estoque e camada de comunicação |
| 4 | Manifest, cache estático, segurança e preparação da hospedagem |
| 5 | Testes, validação em dispositivos, contrato com Equipe 02 e demonstração |

## Migração da base anterior

A base inicial em React/TypeScript foi substituída conforme o pedido atualizado. Foram preservados o escopo de consulta, as cinco telas, os mocks, os estados, a validação, a sessão temporária e as regras de segurança. Os arquivos antigos foram retirados da raiz publicada. Uma cópia de segurança da base original foi salva fora desta pasta, em `../EcoCycle_pwa-react-backup-20261021.zip`.
