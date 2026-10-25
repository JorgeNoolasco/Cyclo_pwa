// Somente testes: não importado pela aplicação publicada.
export const session = (perfil = 'CONSULTA') => ({ token: 'fixture-token', nome: 'Pessoa Teste', perfil, expira_em: new Date(Date.now() + 3600000).toISOString() });
export const dashboard = () => ({ total_processado_kg: 750, status_esteira: 'LIGADA', temperatura_c: 48,
    ultima_leitura: new Date().toISOString(), alertas_ativos: 1,
    estoque: [{ tipo_material: 'PLASTICO', saldo_kg: 500 }, { tipo_material: 'METAL', saldo_kg: 250 }],
    producao_diaria: [{ data: new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo'}).format(new Date()), plastico_kg: 500, metal_kg: 250, rejeito_kg: 0, total_kg: 750 }] });
export const alerts = () => [{ id_alerta: 2, codigo_equipamento: 'ESTEIRA01', tipo: 'TEMPERATURA_ALTA', data_hora: new Date().toISOString(), resolvido: false }];
