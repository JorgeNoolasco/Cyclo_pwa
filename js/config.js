/** @file Define endereços públicos e intervalos em milissegundos; o build substitui URLs pelas variáveis de ambiente. */

// Configuração pública: nunca coloque senhas, tokens ou chaves privadas aqui.
export const CONFIG = Object.freeze({
    API_URL: 'https://eco-cycle-platform-backend.vercel.app',
    WEB_URL: 'https://eco-cycle-platform-frontend.vercel.app',
    USE_MOCK: false,
    REQUEST_TIMEOUT: 10000,
    POLL_INTERVAL: 5000,
    STALE_AFTER: 30000
});
