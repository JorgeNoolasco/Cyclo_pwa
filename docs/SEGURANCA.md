> Registro histórico de 25/10/2026. Para configuração, contratos e resultados atuais, consulte [INTEGRACAO_ATUAL.md](INTEGRACAO_ATUAL.md) e [ENTREGA_VERCEL.md](ENTREGA_VERCEL.md). Afirmações sobre ausência de JWT, rotas ou URLs abaixo descrevem a auditoria antiga.

# Segurança da informação — evidências CID

## Confidencialidade

- JWT e sessão somente em variável de módulo; nenhum uso de localStorage, sessionStorage, IndexedDB, URL ou cache para autenticação. Campo de senha limpo ao enviar; fetch cancelado quando a tela de login é abandonada.
- Quatro perfis reconhecidos: ADMINISTRADOR, GERENTE, OPERADOR, CONSULTA. Todos são perfis de consulta no CYCLO; perfil desconhecido é recusado. Não há funções administrativas ou de escrita para esconder/liberar.
- Navegação interna carrega os HTMLs públicos no mesmo documento. Acesso direto e reload exigem login. Logout, expiração, pagehide e histórico descartam sessão e DOM privado; respostas atrasadas são invalidadas por geração e AbortController.
- 401 encerra sessão; 403 remove os dados da consulta negada. O servidor precisa validar assinatura, expiração e perfil: o JavaScript não é barreira de autorização.
- Fetch usa `credentials: omit`, `cache: no-store`, Bearer e bloqueio de redirects. HTTPS obrigatório fora do desenvolvimento HTTP local. Sem chave industrial ou credencial real embutida.
- SW possui lista fechada de URLs públicas. API, POST, Authorization, query strings fora da lista e origens externas não são interceptados. Apenas o shell estático funciona offline.

**Bloqueio:** o backend auditado não emite JWT e permite GET sem token. Nenhuma garantia de confidencialidade ponta a ponta é alegada. O cliente falha fechado, em vez de aceitar a autenticação demonstrativa desse servidor.

## Integridade

- JSON e esquema são verificados antes da renderização. Quilogramas precisam ser números finitos não negativos; datas incluem fuso e calendário válido; enums e IDs são validados.
- Adaptadores explícitos não confundem massa de entrada com produção, nem estoque com recuperação. Ausência fica indisponível. Não atribuímos gravidade arbitrária a alertas.
- IDs mantêm tipo/valor. Duplicidade de alerta ou dia de produção é recusada; não há reenvio/escrita industrial no cliente.
- Dados de API entram por `textContent`/DOM. O parser HTML da navegação recebe exclusivamente templates estáticos da própria origem em lista fechada, remove scripts, e nunca recebe payload de API. Não há execução de HTML de erro do servidor.
- Os testes inserem `<img ... onerror=...>` como nome de equipamento e confirmam que permanece texto.
- A validação de operações de escrita e sua idempotência continuam sob responsabilidade da API/middleware/ERP.

## Disponibilidade

- Timeout de 10 segundos, cancelamento, uma consulta por tela, polling a cada 5 segundos. Ocultar aba suspende/cancela; retornar ou recuperar rede atualiza.
- Botão Atualizar é bloqueado durante a requisição; sem duplicação por cliques.
- Erro de conexão é distinto de JSON inválido e HTTP 400/401/403/404/422/429/500. Indisponibilidade não é “esteira desligada” nem “normal”.
- Dados anteriores existem somente na tela/sessão atual e recebem aviso; ao sair da tela são descartados. Leitura envelhece mesmo sem nova resposta, verificada a cada segundo.
- `indisponivel.html` e fallback de navegação explicam indisponibilidade. Sem rede, novo login e dados operacionais não são possíveis.
- Cache `ecocycle-static-v4`; ativação remove versões anteriores apenas com o prefixo do projeto. Atualização aguarda as abas antigas fecharem; não força reload de sessão autenticada.

## Cabeçalhos e dependências

`vercel.json`: CSP com scripts/estilos/fontes/imagens/worker/manifest próprios, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, nosniff, X-Frame-Options DENY, Referrer-Policy no-referrer, Permissions-Policy mínima e HSTS. Ao configurar API de produção, adicionar somente sua origem HTTPS ao `connect-src`.

Lucide, já usado nas telas, foi fixado em 0.468.0 e incluído localmente com licença ISC. Não há CDN `latest` nem nova dependência de execução. Não foi realizada auditoria de vulnerabilidades do diretório legado `node_modulos`; ele fica fora da publicação e não é usado pelo produto. Playwright é somente ferramenta de teste.

O servidor simples Python não aplica cabeçalhos Vercel. O teste de navegador aplica os cabeçalhos, adaptando apenas a origem da API de fixture e HTTPS para localhost. Isso não comprova headers/CORS de um deploy real.

## Limites

Não se alega conformidade integral LGPD/OWASP ou segurança absoluta contra XSS. CORS, hash de senhas, RBAC, assinatura/revogação de JWT, logs seguros, rate limiting, banco, backups e disponibilidade do serviço devem ser garantidos e homologados pela equipe backend. Nenhum log do aplicativo inclui token, senha ou conteúdo de resposta privada.

