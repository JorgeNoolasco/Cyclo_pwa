// Contrato v1.1 -> modelo de apresentação. Não cria medições nem timestamps.
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function adaptDashboard(value) {
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

export function adaptAlerts(value) {
    if (!Array.isArray(value)) return value;
    return value.map(row => Object.hasOwn(row ?? {}, 'id_alerta') ? {
        id: row.id_alerta, equipamento: row.codigo_equipamento,
        tipo: row.tipo, data_hora: row.data_hora, resolvido: row.resolvido,
        prioridade: row.prioridade ?? null
    } : row);
}
