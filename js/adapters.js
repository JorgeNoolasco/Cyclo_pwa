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
    const bytes = Uint8Array.from(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '=')), char=>char.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if (!Number.isFinite(claims.exp) || claims.exp <= 0) throw new Error('Expiração ausente.');
    if (claims.perfil != null && claims.perfil !== value.perfil) throw new Error('Perfil inconsistente.');
    // sub é o nome de usuário autenticado, não nome completo nem e-mail.
    return { token: value.access_token, nome: claims.sub ?? username, perfil: value.perfil,
        expira_em: new Date(claims.exp * 1000).toISOString() };
}

/**
 * Converte nomes de campos v1.1 preservando prioridade ausente; outros formatos seguem para validação.
 * @param {unknown} value - Resposta da consulta de alertas.
 * @returns {unknown} Lista normalizada ou entrada original.
 */
export function adaptAlerts(value) {
    // GET /api/alertas retorna um envelope cujo campo alertas é um objeto único.
    // Não usar id_esteira como id_alerta nem horário da consulta como data do alerta.
    if (object(value) && Object.hasOwn(value, 'alertas')) {
        const rows = Array.isArray(value.alertas) ? value.alertas : object(value.alertas) ? [value.alertas] : null;
        if (!rows) throw new Error('Envelope de alertas inválido.');
        return rows.map(row => {
            if (!object(row) || typeof row.concluido !== 'boolean') throw new Error('Alerta inválido.');
            if (row.datahora_alerta != null) productionDay(row.datahora_alerta);
            const zoned = typeof row.datahora_alerta === 'string' && /(?:Z|[+-]\d\d:\d\d)$/.test(row.datahora_alerta);
            return { id: row.id_alerta ?? null, equipamento: row.nome_esteira ?? null,
                tipo: null, mensagem: row.mensagem ?? null, data_hora: zoned ? row.datahora_alerta : null,
                data_hora_texto: !zoned ? row.datahora_alerta ?? null : null,
                resolvido: row.concluido, prioridade: null };
        });
    }
    if (!Array.isArray(value)) return value;
    return value.map(row => Object.hasOwn(row ?? {}, 'id_alerta') ? {
        id: row.id_alerta, equipamento: row.codigo_equipamento,
        tipo: row.tipo, data_hora: row.data_hora, resolvido: row.resolvido,
        prioridade: row.prioridade ?? null
    } : row);
}

/**
 * Extrai o dia civil enviado pelo servidor sem atribuir fuso a datetime ingênuo.
 * O backend agrupa pela data de início; null permanece sem agrupamento temporal.
 * @param {string|null} value - data_inicio ISO do registro Python serializado.
 * @returns {string|null} Dia YYYY-MM-DD, sem conversão para o fuso do navegador.
 * @throws {Error} Para datas impossíveis ou tipos não contratuais.
 */
export function productionDay(value) {
    if (value == null) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)?$/.test(value)) throw new Error('Data de produção inválida.');
    const day = value.slice(0,10);
    if (!Number.isFinite(Date.parse(value)) || new Date(day).toISOString().slice(0,10) !== day) throw new Error('Data de produção inválida.');
    return day;
}

/**
 * Converte GET /api/producao ({registros_producao: []}) para indicadores e série.
 * Soma quantidade_saida_kg, nunca entrada bruta. tipo_material no seed e
 * id_material nos registros cadastrados contêm o nome textual do material.
 * Estoque não existe nessa resposta e permanece null. Não cria dias sem registros.
 * @param {object} value - Envelope retornado pela API.
 * @returns {object} Modelo de apresentação com massas em kg e dias de início.
 * @throws {Error} Para envelope, ID duplicado, massa ou data inválidos.
 */
export function adaptProduction(value) {
    if (!object(value) || !Array.isArray(value.registros_producao)) throw new Error('Produção inválida.');
    const days = new Map(), ids = new Set();
    let total = 0, plastic = 0, metal = 0, undated = false, unknownMaterial = false;
    for (const row of value.registros_producao) {
        if (!object(row) || !(typeof row.id_producao === 'string' || Number.isSafeInteger(row.id_producao)) ||
            ids.has(String(row.id_producao))) throw new Error('Identificação de produção inválida ou duplicada.');
        ids.add(String(row.id_producao));
        const mass = row.quantidade_saida_kg;
        if (!Number.isFinite(mass) || mass < 0) throw new Error('Massa de saída inválida.');
        const material = row.tipo_material ?? row.id_material;
        // Aceita nomes do backend, incluindo Plástico PET; não resolve IDs numéricos por suposição.
        const normalized = typeof material === 'string' ? material.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim() : '';
        const group = /^plastico(?:\s|$)/.test(normalized) ? 'plastico_kg' : /^metal(?:\s|$)/.test(normalized) ? 'metal_kg' : null;
        if (!normalized || /^\d+$/.test(normalized)) unknownMaterial = true;
        total += mass;
        if (group === 'plastico_kg') plastic += mass;
        if (group === 'metal_kg') metal += mass;
        const day = productionDay(row.data_inicio);
        if (!day) { undated = true; continue; }
        if (!days.has(day)) days.set(day,{data:day,plastico_kg:0,metal_kg:0,total_kg:0});
        days.get(day).total_kg += mass;
        if (group) days.get(day)[group] += mass;
    }
    return { total_processado_kg:total, plastico_recuperado_kg:unknownMaterial ? null : plastic,
        metal_recuperado_kg:unknownMaterial ? null : metal, atualizado_em:null,
        estoque:{plastico_kg:null,metal_kg:null}, esteira:null, alertas_ativos:null,
        producao_diaria:[...days.values()].sort((a,b)=>a.data.localeCompare(b.data)),
        datas_completas:!undated, materiais_completos:!unknownMaterial };
}

/**
 * Converte GET /api/equipamentos, objeto único sem timestamp de leitura.
 * O estado original permanece disponível; ausência de data não significa offline.
 * @param {object|null} value - Equipamento retornado pelo backend.
 * @returns {object|null} Esteira com temperatura em °C e velocidade em km/h.
 * @throws {Error} Se o objeto ou suas medições tiverem tipos incompatíveis.
 */
export function adaptEquipment(value) {
    if (value === null) return null;
    if (!object(value) || typeof value.status_esteira !== 'string' || !value.status_esteira.trim()) throw new Error('Equipamento inválido.');
    for (const key of ['temperatura_esteira_c','velocidade_esteira_kmh','peso_atual_kg']) {
        if (value[key] != null && !Number.isFinite(value[key])) throw new Error('Medição inválida.');
    }
    if (value.travada != null && typeof value.travada !== 'boolean') throw new Error('Travamento inválido.');
    const states = { LIGADA:'LIGADA', DESLIGADA:'DESLIGADA', 'ESTEIRA DESLIGADA':'DESLIGADA',
        TRAVADA:'PARADA', 'ESTEIRA TRAVADA':'PARADA', 'ESTEIRA DESLIGADA/TRAVADA':'PARADA' };
    return {codigo:value.id_esteira == null ? null : String(value.id_esteira), nome:value.nome_esteira ?? null,
        estado:states[value.status_esteira] ?? null, estado_texto:value.status_esteira,
        temperatura:value.temperatura_esteira_c ?? null, velocidade:value.velocidade_esteira_kmh ?? null,
        peso:value.peso_atual_kg ?? null, travada:value.travada ?? null,
        ultima_leitura:null, conectada:null, material:null};
}
