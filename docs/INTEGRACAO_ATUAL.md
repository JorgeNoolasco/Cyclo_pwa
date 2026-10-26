# Integração publicada — 26/10/2026

Esta revisão substitui as instruções operacionais de INTEGRACAO_API.md, mantido como registro histórico.

## Evidências e contratos

Fonte: [OpenAPI do deployment](https://eco-cycle-platform-backend.vercel.app/openapi.json), consultado diretamente por HTTP. A raiz retorna 200, mas isso não comprova autenticação, CORS ou dados operacionais.

- `POST /api/login` recebe `{usuario, senha}`. O cliente mantém `login(nome, senha, signal)` e traduz o corpo na camada HTTP.
- A resposta especifica `access_token`, `token_type`, `perfil`, `acesso_liberado` e `mensagem`. O adaptador exige Bearer e expiração `exp` no JWT. Não fabrica token, assinatura ou duração de sessão. Sem `exp` válido, rejeita a resposta.
- O nome mostrado vem do usuário digitado, pois TokenResponse não contém nome completo. O backend continua responsável por verificar assinatura e permissões: decodificar JWT no browser não autentica uma requisição.
- `GET /api/producao/dashboard-diario` substitui o caminho inexistente `/api/dashboard`. Seu balanço de massas não comprova total processado, estoque, produção por material nem atualidade da esteira. A tela mantém ausência explícita desses campos.
- `GET /api/alertas` existe e exige Bearer, mas seu esquema JSON no OpenAPI é vazio. O cliente mantém validação dos formatos já conhecidos; uma amostra autorizada ou esquema completo é necessária para adaptar outro formato sem inventar severidade, identificação, resolução ou data.
- `?ativos=true` é compatibilidade legada da camada cliente. A tela usa a lista completa, sem esse parâmetro; o OpenAPI atual não documenta esse filtro.
- Não há fluxo de cadastro, edição ou exclusão no PWA. Não foram adicionadas chamadas PUT/PATCH/DELETE nem comandos industriais.

## CORS a aplicar no backend

O preflight para a origem oficial do portal retornou 405 sem `Access-Control-Allow-Origin`. A CSP do PWA foi corrigida, mas não pode conceder permissão em nome da API. Não usar `no-cors`: impediria ler JSON e não resolveria Bearer.

Exemplo para o projeto FastAPI que publica o OpenAPI atual, **a aplicar pela equipe desse repositório**:

```python
# Configure origens exatas pelo ambiente do backend, separadas por vírgula.
import os
from fastapi.middleware.cors import CORSMiddleware

origens = [origem.strip() for origem in os.environ["CORS_ORIGINS"].split(",") if origem.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origens,
    allow_credentials=False,  # O PWA usa Bearer; não envia cookies.
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
```

No projeto **backend**, `CORS_ORIGINS` deve conter `https://eco-cycle-platform-frontend.vercel.app` e a origem pública exata do CYCLO, sem caminho nem barra final. Esse nome de variável é proposto pelo exemplo; não foi identificado como variável já existente no backend. Middleware, handlers de erro e eventuais regras Vercel devem permitir OPTIONS e retornar headers CORS inclusive em 401/403/500. Manter métodos adicionais se outros consumidores legítimos já precisarem deles.

No projeto **CYCLO**, configurar `API_URL` e `WEB_URL` conforme README, executar o build e publicar `dist`. A configuração estática não cria cookies compartilhados ou SSO. Não houve alteração no painel ou publicação nesta tarefa.

## Homologação pendente

Após corrigir CORS, repetir `node tests/production-audit.mjs`, fornecendo `PWA_ORIGIN` para incluir a origem real. Em seguida, usar uma conta autorizada no navegador para validar login, expiração e as respostas autenticadas. Os testes automatizados locais usam fixtures explicitamente separadas e não atestam a existência de dados reais no backend. A própria descrição do OpenAPI declara dados simulados em memória; a fonte operacional deve ser confirmada pela equipe responsável.
