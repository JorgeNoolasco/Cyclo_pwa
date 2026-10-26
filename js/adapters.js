/** @file Traduz os contratos HTTP para o modelo das telas, preservando ausência de dados e unidades. */
// Contrato v1.1 -> modelo de apresentação. Não cria medições nem timestamps.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
/**
 * Adapta o consolidado publicado ou contrato v1.1 sem inferir estoque a partir de produção.
 * @param {unknown} value - JSON do dashboard.
 * @returns {unknown} Modelo de apresentação; formato desconhecido segue para rejeição pelo validador.
 * @throws {Error} Se o estoque v1.1 contiver material inválido ou duplicado.
 */
export function adaptDashboard(value) {
    // O consolidado publicado não fornece estoque, série por material nem telemetria.
    // Entrada bruta não comprova processamento: nenhum KPI é inferido dessa massa.
    if (object(value) && Object.hasOwn(value, 'balanco_massas_kg')) {
        if (!object(value.balanco_massas_kg) || !Number.isFinite(value.balanco_massas_kg.total_material_entrada) ||
            value.balanco_massas_kg.total_material_entrada < 0) throw new Error('Balanço de massas inválido.');
        return {
        total_processado_kg: null,
        plastico_recuperado_kg: null, metal_recuperado_kg: null, atualizado_em: null,
        estoque: { plastico_kg: null, metal_kg: null }, alertas_ativos: null,
        producao_diaria: [], esteira: null
        };
    }
    if (!object(value) || !Object.hasOwn(value, 'status_esteira')) return value;
    if (!Array.isArray(value.estoque)) throw new Error('Estoque inválido');
    const stock = {};
    for (const row of value.estoque) {
        if (!object(row) || !['PLASTICO', 'METAL'].includes(row.tipo_material) ||
            Object.hasOwn(stock, row.tipo_material)) throw new Error('Material inválido ou duplicado');
        stock[row.tipo_material] = row.saldo_kg;
    }
    return {
        total_processado_kg: value.total_processado_kg,
        // O contrato não fornece estes indicadores; saldo não é recuperação acumulada.
        plastico_recuperado_kg: null,
        metal_recuperado_kg: null,
        atualizado_em: null,
        estoque: { plastico_kg: stock.PLASTICO ?? null, metal_kg: stock.METAL ?? null },
        alertas_ativos: value.alertas_ativos ?? null,
        producao_diaria: value.producao_diaria ?? [],
        esteira: value.status_esteira === null ? null : {
            codigo: null,
            estado: value.status_esteira,
            temperatura: value.temperatura_c ?? null,
            ultima_leitura: value.ultima_leitura,
            material: null,
            conectada: null
        }
    };
}

/**
 * Converte TokenResponse publicado para a sessão em memória do PWA.
 * O payload JWT serve somente para ler a expiração; a assinatura e as permissões
 * devem ser verificadas pelo backend em cada consulta protegida.
 * @param {object} value - Resposta de POST /api/login.
 * @param {string} username - Identificação digitada, pois a API não retorna nome.
 * @returns {object} Sessão com token, identificação, perfil e expiração ISO.
 * @throws {Error} Se faltar Bearer, autorização ou expiração válida no JWT.
 */
export function adaptLogin(value, username) {
    if (!object(value) || value.acesso_liberado !== true ||
        value.token_type?.toLowerCase() !== 'bearer' || typeof value.access_token !== 'string') {
        throw new Error('Resposta de autenticação incompatível.');
    }
    const parts = value.access_token.split('.');
    if (parts.length !== 3) throw new Error('Token inválido.');
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')));
    if (!Number.isFinite(claims.exp) || claims.exp <= 0) throw new Error('Expiração ausente.');
    return { token: value.access_token, nome: username, perfil: value.perfil,
        expira_em: new Date(claims.exp * 1000).toISOString() };
}

/**
 * Converte nomes de campos v1.1 preservando prioridade ausente; outros formatos seguem para validação.
 * @param {unknown} value - Resposta da consulta de alertas.
 * @returns {unknown} Lista normalizada ou entrada original.
 */
export function adaptAlerts(value) {
    if (!Array.isArray(value)) return value;
    return value.map(row => Object.hasOwn(row ?? {}, 'id_alerta') ? {
        id: row.id_alerta, equipamento: row.codigo_equipamento,
        tipo: row.tipo, data_hora: row.data_hora, resolvido: row.resolvido,
        prioridade: row.prioridade ?? null
    } : row);
}
