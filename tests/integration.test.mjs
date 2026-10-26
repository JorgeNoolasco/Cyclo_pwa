/** @file Regressões da integração publicada: JWT, endpoint real e configuração do artefato. */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { request } from '../js/api.js';
import { adaptLogin } from '../js/adapters.js';
import { tokenResponse, backendProduction, backendEquipment, backendAlerts } from './fixtures.mjs';
import { CONFIG } from '../js/config.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test('TokenResponse exige Bearer, acesso liberado e expiração; nunca inventa sessão', () => {
    const response = tokenResponse();
    assert.equal(adaptLogin(response, 'operador').nome, 'operador');
    for (const patch of [{access_token:'inválido'}, {token_type:'Basic'}, {acesso_liberado:false},
        {access_token:'header.e30.signature'}]) assert.throws(() => adaptLogin({...response,...patch}, 'operador'));
});
test('dashboard agrega endpoints publicados e preserva ausência de estoque e horário', async () => {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        calls.push(url);
        assert.equal(options.method, 'GET');
        assert.equal(options.headers.Authorization, 'Bearer teste');
        return Response.json(url.endsWith('/producao') ? backendProduction() : url.endsWith('/equipamentos') ? backendEquipment() : backendAlerts());
    };
    const result = await request('dashboard', {token:'teste'});
    assert.deepEqual(calls,['/api/producao','/api/equipamentos','/api/alertas'].map(path=>CONFIG.API_URL+path));
    assert.equal(result.total_processado_kg,750);
    assert.equal(result.estoque.plastico_kg,null);
    assert.equal(result.esteira.ultima_leitura,null);
    assert.equal(result.esteira.velocidade,4);
    assert.equal(result.producao_diaria[0].total_kg,750);
    assert.equal(result.alertas_ativos,1);
});
test('resposta de login incompatível produz erro de contrato, não falha de conexão', async () => {
    globalThis.fetch = async () => Response.json({acesso_liberado:true});
    await assert.rejects(request('login',{body:{login:'teste',senha:'teste'}}), /formato inválido/);
});
test('CSP permite API oficial e botão possui destino externo mesmo sem JavaScript', async () => {
    const config = JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));
    const csp = config.headers[0].headers.find(header=>header.key==='Content-Security-Policy').value;
    assert.ok(csp.includes(`connect-src 'self' ${CONFIG.API_URL};`));
    const html = await readFile(new URL('../login.html',import.meta.url),'utf8');
    assert.ok(html.includes(`id="voltarSistemaWeb" href="${CONFIG.WEB_URL}"`));
    assert.equal(config.outputDirectory,'dist');
});
