import { CONFIG } from './config.js';
import { mockRequest } from './mocks.js';

// Erros controlados: o usuário recebe uma mensagem conhecida, nunca um stack trace.
export class ApiError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
const messages = {
  400: 'Requisição inválida. Confira os dados informados.',
  401: 'Credenciais inválidas ou sessão expirada.',
  403: 'Seu perfil não tem permissão para esta consulta.',
  500: 'A API está temporariamente indisponível.'
};

// Validadores simples substituem bibliotecas. Os formatos operacionais são provisórios.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const quantity = value => Number.isFinite(value) && value >= 0;
const time = value => text(value) && /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const date = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function validate(kind, value) {
  let valid = false;
  if (kind === 'login') valid = object(value) && text(value.token) && text(value.nome) &&
    ['ADMINISTRADOR', 'GERENTE', 'OPERADOR', 'CONSULTA'].includes(value.perfil) && time(value.expira_em);
  if (kind === 'dashboard') {
    const belt = value?.esteira;
    valid = value === null || (object(value) && time(value.atualizado_em) &&
      ['total_processado_kg', 'plastico_recuperado_kg', 'metal_recuperado_kg'].every(key => quantity(value[key])) &&
      object(value.estoque) && quantity(value.estoque.plastico_kg) && quantity(value.estoque.metal_kg) &&
      Number.isInteger(value.alertas_ativos) && value.alertas_ativos >= 0 &&
      (belt === null || (object(belt) && text(belt.codigo) && ['LIGADA', 'DESLIGADA', 'PARADA', 'EMERGENCIA'].includes(belt.estado) &&
        (belt.temperatura === null || Number.isFinite(belt.temperatura)) && time(belt.ultima_leitura) &&
        (belt.material === null || text(belt.material)) && typeof belt.conectada === 'boolean')) &&
      Array.isArray(value.producao_diaria) && value.producao_diaria.every(row => object(row) && date(row.data) && quantity(row.plastico_kg) && quantity(row.metal_kg)));
  }
  if (kind === 'alerts') valid = Array.isArray(value) && value.every(row => object(row) && text(row.id) &&
    ['TEMPERATURA_ALTA', 'PARADA', 'EMERGENCIA'].includes(row.tipo) && text(row.equipamento) && time(row.data_hora) &&
    typeof row.resolvido === 'boolean' && ['ALTA', 'MEDIA', 'BAIXA'].includes(row.prioridade));
  if (!valid) throw new ApiError('A API retornou dados em formato inválido.');
  return value;
}

// Apenas estas três operações estão autorizadas pelo módulo da Equipe 06.
export async function request(kind, { token, body, active = true, signal } = {}) {
  const paths = { login: '/api/auth/login', dashboard: '/api/dashboard', alerts: `/api/alertas${active ? '?ativos=true' : ''}` };
  if (!Object.hasOwn(paths, kind)) throw new ApiError('Operação não permitida.');
  if (CONFIG.USE_MOCK) {
    const response = await mockRequest(kind, { body, active, signal });
    if (response.status !== 200) throw new ApiError(messages[response.status] || 'Falha de conexão demonstrativa.', response.status);
    return validate(kind, response.data);
  }
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, CONFIG.REQUEST_TIMEOUT);
  try {
    const base = new URL(CONFIG.API_URL);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
    if ((base.protocol !== 'https:' && !(base.protocol === 'http:' && local && location.protocol === 'http:')) || base.username || base.password || base.search || base.hash) {
      throw new ApiError('Configure uma URL HTTPS válida para a API.');
    }
    const response = await fetch(`${base.href.replace(/\/$/, '')}${paths[kind]}`, {
      method: kind === 'login' ? 'POST' : 'GET',
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error'
    });
    if (!response.ok) throw new ApiError(messages[response.status] || 'Não foi possível realizar a consulta.', response.status);
    let data;
    try { data = await response.json(); } catch { throw new ApiError('A API retornou um JSON inválido.'); }
    return validate(kind, data);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
    throw new ApiError(controller.signal.aborted ? 'A API demorou demais para responder. Tente novamente.' : 'Não foi possível conectar à API. Tente novamente.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}
