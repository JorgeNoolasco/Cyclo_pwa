> Registro histórico de 25/10/2026. Para configuração, contratos e resultados atuais, consulte [INTEGRACAO_ATUAL.md](INTEGRACAO_ATUAL.md) e [ENTREGA_VERCEL.md](ENTREGA_VERCEL.md). Afirmações sobre ausência de JWT, rotas ou URLs abaixo descrevem a auditoria antiga.

# Integração com a API

## Estado da entrega

O CYCLO está preparado e testado contra o contrato v1.1. **Ainda não há integração operacional segura com o backend oficial auditado.** O aplicativo não aceita `acesso_liberado: true` como sessão, não fabrica JWT e não contorna rotas protegidas usando endpoints públicos.

Configuração pública central: `js/config.js`, `API_URL`. O cliente usa Fetch, timeout de 10 s incluindo leitura do corpo, AbortController, Bearer, `credentials: omit`, `cache: no-store` e `redirect: error`. Erros HTTP, conexão, JSON e formato são separados. Não exibe detalhes arbitrários do servidor.

## Contrato versus implementação oficial

Fonte imutável: [backend auditado](https://github.com/lorrainemontini-ai/EcoCycle_platform_backend/tree/4de534fa7ff8c5804c3b763c6a9863f642d19b99).

| Necessidade | Contrato v1.1 / cliente CYCLO | Backend auditado | Consequência |
| --- | --- | --- | --- |
| Login | POST `/api/auth/login`, `{login, senha}`; token, nome, perfil, expira_em | POST `/api/login`, `{usuario, senha}`; mensagem, perfil, acesso_liberado; duas credenciais fixas no servidor | Não é possível criar sessão JWT segura no cliente |
| Dashboard | GET `/api/dashboard` | GET `/api/producao/dashboard-diario` | Campos e semântica diferentes; não substituir silenciosamente |
| Indicadores | `total_processado_kg` inclui rejeito | `balanco_massas_kg.total_material_entrada`, `total_produzido_saida`, `total_rejeitos_perdas` | Entrada bruta não equivale ao total processado definido no contrato |
| Estoque | Array de PLASTICO/METAL com `saldo_kg` | Não há saldo disponível | Não calcular estoque a partir de produção bruta sem regra confirmada |
| Produção diária | Datas e quantidades por dia | Registros de turno sem data em `/api/producao` e dashboard-diario | Não é possível agrupar por dia com integridade |
| Esteira | `status_esteira`, `temperatura_c`, `ultima_leitura` | `/api/equipamentos`: status_operacional, temperatura, travada, peso_atual_kh no seed; sem timestamp | Sem evidência de leitura atual; nunca tratar LIGADA fixa como comunicação atual |
| Alertas | GET `/api/alertas`, array; filtro `ativos=true` | Rota de consulta ausente; POST `/api/equipamentos/status` retorna alertas de processamento | O PWA não chama POST industrial para obter alertas |
| Lotes | GET `/api/lotes`, array, peso_entrada_kg/status/data_entrada | Envelope `{lotes}`, peso_inicial_kg, observacao, tipo-material no seed e tipo_material nos novos registros | Consultado apenas na auditoria; não há tela de lotes no CYCLO atual |
| Autorização | JWT e perfil em cada consulta | Routers consultados não usam dependência de autenticação | Frontend não consegue corrigir autorização do servidor |
| CORS | Lista explícita de origens | `main.py` não instala CORSMiddleware | Requisições entre origens precisam de configuração pela E2 |
| Persistência | API como origem do banco corporativo | Listas/dicionários simulados em memória nos routers | Não apresentar esse seed como dado real da fábrica |

## Adaptadores implementados

`js/adapters.js` transforma somente o contrato v1.1 em modelo interno já utilizado pelas telas:

- Estoque: `[{tipo_material, saldo_kg}]` → `{plastico_kg, metal_kg}`; valores ausentes ficam `null`, nunca zero inventado; materiais desconhecidos e duplicados são rejeitados.
- Esteira: campos planos → `esteira.estado`, `temperatura`, `ultima_leitura`. Não inventa código do equipamento, material ou flag de conectividade. Uma leitura recente permite mostrar o estado informado; leitura com mais de 30 s, data futura acima da tolerância de 5 s ou falha de comunicação remove a confirmação do estado atual.
- Recuperação acumulada de plástico/metal não existe no contrato: `null`, exibido como “Informação indisponível”. Saldo não é convertido em recuperação acumulada.
- `atualizado_em` não existe no v1.1: não inventado. “Última consulta” é a hora local do recebimento e **não** a hora da medição. A esteira mostra separadamente a data e hora da última leitura.
- Alertas: `id_alerta` → `id`, preservando tipo/valor; `codigo_equipamento` → `equipamento`. Não infere gravidade pelo tipo. `prioridade` ausente aparece como “Gravidade indisponível”. Filtro por gravidade só inclui registros que a informam.
- Formato interno anterior ainda pode ser validado, sem coerção de strings numéricas. JSON incompatível é recusado. Datas precisam de fuso; datas impossíveis, IDs duplicados e produção diária duplicada são recusados.

## Exemplos Postman

Os screenshots representam outra revisão, não os schemas atuais:

| Entidade | Screenshot | Schema/retorno atual | Decisão |
| --- | --- | --- | --- |
| Lote | codigo_lote, peso_recebido_kg, status_lote, data_entrada | id_fornecedor, tipo_material, peso_inicial_kg, observacao | Não presumir equivalência entre entrada, recebido e produzido |
| Produção | id_lote, turno, quantidade_entrada_kg, quantidade_saida_kg, rejeito_kg, status_producao | turno, material_processado, quantidades e refugo_kg; seed usa material_processados | Sem lote/data/estoque suficientes para o dashboard contratual |
| Fornecedor | id_fornecedor, nome_fornecedor, telefone_fornecedor, email_fornecedor, endereco_fornecedor | nome, cnpj, contato | Fora das consultas exibidas no PWA; não enviar cadastro |

Não foram criados adaptadores especulativos para transformar esses dados em medições distintas. Nenhuma escrita de lote, fornecedor, produção, telemetria ou comando foi adicionada.

## Ações necessárias da Equipe 02

1. Implementar login do contrato com verificação segura de senha, JWT assinado, nome/perfil e expiração; confirmar os quatro perfis. Remover credenciais fixas do fluxo real.
2. Exigir token válido e autorização em todas as consultas e escritas. Testar 401 sem token/expirado e 403 sem permissão no servidor.
3. Disponibilizar dashboard e alertas com dados persistidos, unidades e timestamps reais; confirmar cálculo do estoque e total processado.
4. Configurar CORS com as origens exatas do CYCLO e Web, métodos/cabeçalhos necessários; não usar wildcard com credenciais.
5. Fornecer URL HTTPS e conta de teste autorizada para homologação. Não inserir chave industrial no PWA.
6. Se o contrato for alterado, comunicar E1/E4/E5/E6 e atualizar exemplos antes de mudar adaptadores.

Não há endpoint seguro de renovação/revogação implementado nesta revisão. Logout elimina a sessão local; revogação de JWT no servidor depende da API. A E2 não foi alterada.

## Site principal: patch

[ecocycle-web-install.patch](ecocycle-web-install.patch) foi preparado sobre `1d3e9d1…` e validado com `git apply --check` contra os arquivos dessa revisão. A conta conectada só tem leitura desse repositório.

No repositório Web, em branch própria e com árvore limpa:

```sh
git switch -c feature/cyclo-install
git apply --check /caminho/ecocycle-web-install.patch
git apply /caminho/ecocycle-web-install.patch
```

Definir `VITE_CYCLO_URL` no ambiente de build: URL raiz pública HTTPS do CYCLO, incluindo subdiretório se houver e sem `instalar.html`. Exemplo local: `http://127.0.0.1:8080`. É configuração pública, não segredo. Seguir os scripts existentes de teste/build do Web antes de publicar.

Arquivos do patch: `src/shared/layout.js`, `vite.config.js`, `src/features/install/install.html` e `install.js`. Reutiliza layout e classes existentes. A rota segue o Vite multipágina: `/src/features/install/install.html`.

Fluxo: menu Web → página EcoCycle Mobile → botão → origem CYCLO `/instalar.html` → instalação nativa ou instruções. O site Web não tenta disparar um prompt de outra origem. O patch não foi enviado, aplicado ao repositório remoto, publicado nem testado no build completo do Web. URL de produção não fornecida.

