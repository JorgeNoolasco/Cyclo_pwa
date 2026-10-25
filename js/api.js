
import { CONFIG } from './config.js';
import { adaptDashboard, adaptAlerts } from './adapters.js';

// Erros controlados: o usuário recebe uma mensagem conhecida.
export class ApiError extends Error {
    constructor(message, status = 0) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

const messages = {
    0: 'Sem conexão com a API. Verifique sua conexão e tente novamente.',
    400: 'Requisição inválida. Confira os dados informados.',
    401: 'Credenciais inválidas ou sessão expirada.',
    403: 'Seu perfil não tem permissão para esta consulta.',
    404: 'Recurso ainda não disponibilizado pela API. Contate a equipe responsável.',
    422: 'Os campos enviados não correspondem ao contrato da API.',
    429: 'Limite de consultas atingido. Aguarde e tente novamente.',
    500: 'A API está temporariamente indisponível.'
};

// Validadores simples. Os formatos operacionais são provisórios.
const object = value =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value);

const text = value =>
    typeof value === 'string' &&
    value.trim().length > 0;

const quantity = value =>
    Number.isFinite(value) &&
    value >= 0;

const time = value =>
    text(value) &&
    date(value.slice(0, 10)) &&
    /^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(value) &&
    Number.isFinite(Date.parse(value));

const date = value =>
    typeof value === 'string' &&
    /^\d{4}-\d\d-\d\d$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;

export function validate(kind, raw) {
    let value;
    try { value = kind === 'dashboard' ? adaptDashboard(raw) : kind === 'alerts' ? adaptAlerts(raw) : raw; }
    catch { throw new ApiError('A API retornou dados em formato inválido.'); }
    const optionalQuantity = n => n == null || quantity(n);
    const identifier = id => text(id) || (Number.isSafeInteger(id) && id >= 0);
    let valid = false;
    if (kind === 'login') valid = object(value) && text(value.token) && text(value.nome) &&
        ['ADMINISTRADOR', 'GERENTE', 'OPERADOR', 'CONSULTA'].includes(value.perfil) && time(value.expira_em);
    if (kind === 'dashboard') {
        const belt = value?.esteira;
        valid = value === null || (object(value) && quantity(value.total_processado_kg) &&
            (value.atualizado_em == null || time(value.atualizado_em)) &&
            ['plastico_recuperado_kg', 'metal_recuperado_kg'].every(k => optionalQuantity(value[k])) &&
            object(value.estoque) && optionalQuantity(value.estoque.plastico_kg) && optionalQuantity(value.estoque.metal_kg) &&
            (value.alertas_ativos == null || (Number.isSafeInteger(value.alertas_ativos) && value.alertas_ativos >= 0)) &&
            (belt === null || (object(belt) && (belt.codigo == null || text(belt.codigo)) &&
                ['LIGADA', 'DESLIGADA', 'PARADA', 'EMERGENCIA'].includes(belt.estado) &&
                (belt.temperatura == null || Number.isFinite(belt.temperatura)) && time(belt.ultima_leitura) &&
                (belt.material == null || text(belt.material)) && (belt.conectada == null || typeof belt.conectada === 'boolean'))) &&
            Array.isArray(value.producao_diaria) && value.producao_diaria.every(row => object(row) && date(row.data) &&
                quantity(row.plastico_kg) && quantity(row.metal_kg)) &&
            new Set(value.producao_diaria.map(row => row.data)).size === value.producao_diaria.length);
    }
    if (kind === 'alerts') valid = Array.isArray(value) && value.every(row => object(row) && identifier(row.id) &&
        ['TEMPERATURA_ALTA', 'PARADA', 'EMERGENCIA'].includes(row.tipo) && text(row.equipamento) &&
        time(row.data_hora) && typeof row.resolvido === 'boolean' &&
        (row.prioridade == null || ['ALTA', 'MEDIA', 'BAIXA'].includes(row.prioridade))) &&
        new Set(value.map(row => `${typeof row.id}:${row.id}`)).size === value.length;
    if (!valid) throw new ApiError('A API retornou dados em formato inválido.');
    return value;
}

// Apenas estas três operações estão autorizadas pelo módulo da Equipe 06.
export async function request(
    kind,
    { token, body, active = true, signal } = {}
) {
    const paths = {
        login: '/api/auth/login',
        dashboard: '/api/dashboard',
        alerts: `/api/alertas${active ? '?ativos=true' : ''}`
    };

    if (!Object.hasOwn(paths, kind)) {
        throw new ApiError('Operação não permitida.');
    }

    if (kind !== 'login' && !token) throw new ApiError(messages[401], 401);
    if (kind !== 'login' && body) throw new ApiError('Operação não permitida.');

    if (CONFIG.USE_MOCK && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
        const { mockRequest } = await import('./mocks.js');
        const response = await mockRequest(kind, {
            body,
            active,
            signal
        });

        if (response.status !== 200) {
            throw new ApiError(
                messages[response.status] ||
                'Falha de conexão demonstrativa.',
                response.status
            );
        }

        return validate(kind, response.data);
    }

    const controller = new AbortController();
    let timedOut = false;

    const cancel = () => controller.abort();

    if (signal?.aborted) {
        controller.abort();
    } else {
        signal?.addEventListener('abort', cancel, { once: true });
    }

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, CONFIG.REQUEST_TIMEOUT);

    try {
        const base = new URL(CONFIG.API_URL);

        const local = [
            'localhost',
            '127.0.0.1',
            '[::1]'
        ].includes(base.hostname);

        if (
            (
                base.protocol !== 'https:' &&
                !(
                    base.protocol === 'http:' &&
                    local &&
                    location.protocol === 'http:'
                )
            ) ||
            base.username ||
            base.password ||
            base.search ||
            base.hash
        ) {
            throw new ApiError(
                'Configure uma URL HTTPS válida para a API.'
            );
        }

        const baseUrl = base.href.replace(/\/+$/, '');
        const url = `${baseUrl}${paths[kind]}`;

        const response = await fetch(url, {
            method: kind === 'login' ? 'POST' : 'GET',

            headers: {
                Accept: 'application/json',
                ...(body
                    ? { 'Content-Type': 'application/json' }
                    : {}),
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {})
            },

            body: body ? JSON.stringify(body) : undefined,
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'omit',
            redirect: 'error'
        });

        if (!response.ok) {
            throw new ApiError(
                messages[response.status] ||
                'Não foi possível realizar a consulta.',
                response.status
            );
        }

        let data;

        try {
            data = await response.json();
        } catch (error) {
            if (controller.signal.aborted) throw error;
            throw new ApiError('A API retornou um JSON inválido.');
        }

        return validate(kind, data);
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }

        if (signal?.aborted) {
            throw new DOMException(
                'Consulta cancelada',
                'AbortError'
            );
        }

        if (timedOut) {
            throw new ApiError(
                'A API demorou demais para responder. Tente novamente.'
            );
        }

        throw new ApiError(
            'Não foi possível conectar à API. Tente novamente.'
        );
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', cancel);
    }
}
