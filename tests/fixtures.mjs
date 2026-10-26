/** @file Define exemplos sintéticos restritos a testes; estes dados não são importados pela aplicação. */
// Somente testes: não importado pela aplicação publicada.
export const session = (perfil = 'CONSULTA') => ({ token: 'fixture-token', nome: 'Pessoa Teste', perfil, expira_em: new Date(Date.now() + 3600000).toISOString() });
export const dashboard = () => ({ total_processado_kg: 750, status_esteira: 'LIGADA', temperatura_c: 48,
    ultima_leitura: new Date().toISOString(), alertas_ativos: 1,
    estoque: [{ tipo_material: 'PLASTICO', saldo_kg: 500 }, { tipo_material: 'METAL', saldo_kg: 250 }],
    producao_diaria: [{ data: new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo'}).format(new Date()), plastico_kg: 500, metal_kg: 250, rejeito_kg: 0, total_kg: 750 }] });
export const alerts = () => [{ id_alerta: 2, codigo_equipamento: 'ESTEIRA01', tipo: 'TEMPERATURA_ALTA', data_hora: new Date().toISOString(), resolvido: false }];

/** Constrói TokenResponse sintético; JWT sem assinatura, restrito aos testes do cliente. */
export const tokenResponse = (value = session()) => ({
    access_token: `fixture.${Buffer.from(JSON.stringify({exp: Math.floor(Date.parse(value.expira_em) / 1000)})).toString('base64url')}.fixture`,
    token_type: 'bearer', acesso_liberado: true, perfil: value.perfil, mensagem: 'Teste'
});

/** Envelope GET /api/producao, com as duas variantes de material presentes no backend. */
export const backendProduction = () => ({registros_producao:[
    {id_producao:1,tipo_material:'Plástico PET',quantidade_saida_kg:500,quantidade_entrada_kg:650,
        data_inicio:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())+'T08:00:00'},
    {id_producao:2,id_material:'Metal',quantidade_saida_kg:250,quantidade_entrada_kg:300,
        data_inicio:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date())+'T09:00:00'}
]});
/** Objeto GET /api/equipamentos: não contém timestamp nem porcentagem de velocidade. */
export const backendEquipment = () => ({id_esteira:1,nome_esteira:'Esteira Principal',status_esteira:'LIGADA',
    temperatura_esteira_c:38.5,velocidade_esteira_kmh:4,peso_atual_kg:120,travada:false});
/** Envelope GET /api/alertas: o seed é um registro sem ID, gravidade, tipo ou data. */
export const backendAlerts = () => ({usuario_responsavel:'fixture',alertas:{...backendEquipment(),concluido:false}});
