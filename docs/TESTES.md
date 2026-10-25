# Testes — 25/10/2026

Ambiente: Windows, Node.js v24.22.0, Python 3.13, Playwright existente e Microsoft Edge headless. A data do relatório usa America/Sao_Paulo.

## Resultado e alcance

| Verificação | Resultado executado | Limite |
| --- | --- | --- |
| `node --test tests/core.test.mjs tests/auth.test.mjs` | 19 aprovados, 0 falhas | HTTP substituído por fixtures nos testes unitários |
| `node tests/browser.cjs` | Suíte aprovada, sem erros JS/CSP | Servidor HTTP de fixture; não é API oficial |
| `python tests/backend-audit.py` | Routers oficiais exercitados localmente; incompatibilidades confirmadas | Sem `main.py`, banco, infraestrutura ou deploy; routers importados sem alterações |
| `git apply --check` do patch Web | Aprovado contra arquivos do commit de referência | Não equivale a build/teste completo do Web |
| Sintaxe JS e `git diff --check` | Verificados | Sem compilação necessária no site estático |
| Manifest, SW, PNGs e instalabilidade | Arquivos íntegros, SW pronto, Chromium com perfil comum sem erro de instalabilidade | Não instala no SO nem valida aparelho físico |
| Regressão visual | Geometria de cabeçalho/navegação/grade; inspeção de capturas antes/depois | Conteúdo de fixtures e remoção de valores falsos alteram texto/altura de cards |

O teste inicial da base falhou em 1 de 10 casos: `ENOENT js/login-page.js` no precache. O teste antigo de navegador apontava para IDs de uma interface anterior. Foram substituídos por verificações das telas existentes.

## Cenários de lógica

- Login válido envia exatamente `{login, senha}`; logout, expiração temporal e resposta de login após logout não recriam sessão.
- Perfil desconhecido e login sem token/expiração recusados.
- GET sem token e operações não autorizadas são bloqueados antes de fetch.
- HTTP 400/401/403/404/422/429/500; rede indisponível; JSON inválido; cancelamento; timeout de 10 s durante a leitura do corpo.
- Bearer, `no-store`, `credentials: omit`, redirecionamento bloqueado e filtro de alertas.
- Conversão do dashboard v1.1; IDs numéricos preservados; dados ausentes não viram zero/hora atual/gravidade inventada.
- Tipos numéricos, datas sem fuso, enums desconhecidos e IDs/materiais/dias duplicados recusados.
- Manifest, dimensões dos PNGs e existência de cada recurso do cache.
- Worker não intercepta API, POST, Authorization ou origem externa; ativação remove somente caches antigos do projeto.

## Cenários de navegador

O script cria dois servidores locais em portas aleatórias: shell com CSP baseada no `vercel.json` e API de fixture com CORS restrito à origem do shell. Não cria banco nem servidor alternativo para uso pelo produto. Fecha ambos ao terminar. As rotas da fixture são `/api/auth/login`, `/api/dashboard` e `/api/alertas`; o cliente real executa fetch e valida/renderiza as respostas.

- Acesso direto protegido retorna ao login; credenciais inválidas e limpeza da senha.
- Login, nome real da resposta e navegação entre documentos sem persistir JWT.
- LIGADA, PARADA, EMERGENCIA, DESLIGADA; leitura com mais de 30 s e envelhecimento por relógio controlado.
- Offline nunca aparece como operação normal; reconexão atualiza automaticamente.
- 403 remove dados; 401 encerra sessão; 500 identifica indisponibilidade; token já expirado não entra.
- Alertas vazios, gravidade ausente, filtros e payload de XSS permanece texto.
- Estoque e produção diária vêm do dashboard.
- SW registrado, precache preenchido sem API, localStorage/sessionStorage vazios.
- Logout e histórico não restauram dados; reload offline abre o shell, mas exige rede para login.
- Aba oculta não faz polling; concorrência máxima observada de uma consulta.
- Larguras 320, 390, 768 e 1440 px em dashboard, esteira, alertas, produção e menu, sem overflow horizontal.
- Comparação com HTML/CSS da base Git: posição horizontal e largura de cabeçalho, navegação e grade preservadas.
- Prompt de instalação apenas após clique; evento `appinstalled` esconde ação; fallback sem prompt. Eventos de instalação são simulados nesse teste, sem alegar instalação real.
- `Page.getInstallabilityErrors` em perfil persistente comum retorna `[]`. Contexto anônimo inicialmente informou `in-incognito`; o teste foi corrigido para o contexto apropriado, sem ignorar falhas da aplicação.

Capturas e resultados são gerados em `test-results/browser.json`, `dashboard-390.png`, `dashboard-1440.png`, equivalentes das demais telas, `baseline-dashboard.png` e `instalar.png`. São artefatos locais de fixture, não registros operacionais.

## Evidência do backend oficial

Commit: `4de534fa7ff8c5804c3b763c6a9863f642d19b99`. `tests/backend-audit.py` baixa somente os routers/schemas públicos desse commit e usa FastAPI TestClient isolado. Não copia `.env`, não conecta banco e não executa escrita industrial.

| Chamada local aos routers oficiais | Resultado |
| --- | --- |
| POST `/api/auth/login` | 404 |
| POST `/api/login` com `login,senha` | 422 |
| POST `/api/login` com `usuario,senha` inválidos | 401 |
| POST `/api/login` com credencial demonstrativa do próprio router | 200, sem token/expiração |
| GET `/api/dashboard` | 404 |
| GET `/api/alertas` | 404 |
| GET `/api/lotes` | 200 sem token, envelope `lotes` |
| GET `/api/producao` | 200 sem token, envelope `registros_producao` |
| GET `/api/producao/dashboard-diario` | 200 sem token, balanço/turnos sem contrato v1.1 |
| GET `/api/equipamentos` | 200 sem token e sem timestamp da leitura |
| GET `/api/fornecedores` | 200 sem token |

Relatório local: `test-results/backend-audit.json`. O resultado confirma bloqueios; **não** é uma aprovação da segurança do backend.

## Reproduzir

```sh
node --test tests/core.test.mjs tests/auth.test.mjs
node tests/browser.cjs
python tests/backend-audit.py
```

O navegador cria seus próprios servidores; não precisa que a API ou o servidor 8080 estejam rodando. A auditoria Python requer FastAPI/httpx disponíveis e internet para baixar as fontes públicas fixadas. As dependências de teste não são dependências do PWA.

## Pendências de homologação

1. API oficial com JWT, RBAC, CORS e dados persistidos; login e consultas ponta a ponta com conta autorizada.
2. 401/403 e permissão por perfil efetivamente impostos pelo backend em ambiente integrado.
3. Domínios HTTPS reais, headers do deploy e latência/limites reais.
4. Aplicação do patch e build completo do Web, `VITE_CYCLO_URL` real e navegação entre origens.
5. Instalação e abertura standalone em Android, iPhone/iPad e desktop físico; fallback Safari; atualização do SW após publicação de nova versão.

Nenhuma dessas pendências é considerada aprovada pelos testes de fixture.
