/** @file Verifica contratos, erros HTTP, cancelamento e isolamento do cache com fetch controlado. */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { request, validate } from '../js/api.js';
import { dashboard, alerts, session, tokenResponse } from './fixtures.mjs';
const originalFetch = globalThis.fetch;
globalThis.location = { protocol: 'http:', hostname: '127.0.0.1' };
afterEach(() => { globalThis.fetch = originalFetch; });
test('login válido envia contrato, sem cookies, cache ou redirecionamento', async () => {
    globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://eco-cycle-platform-backend.vercel.app/api/login');
        assert.equal(options.method, 'POST'); assert.equal(options.cache, 'no-store');
        assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
        assert.deepEqual(JSON.parse(options.body), { usuario:'teste', senha:'teste' });
        return Response.json(tokenResponse());
    };
    assert.equal((await request('login', {body:{login:'teste',senha:'teste'}})).perfil, 'CONSULTA');
});
for (const status of [400,401,403,404,422,429,500]) test(`HTTP ${status} preservado`, async () => {
    globalThis.fetch = async () => new Response('', {status});
    await assert.rejects(request('dashboard', {token:'fixture'}), error => error.status === status);
});
test('sem token e escritas operacionais bloqueadas antes de fetch', async () => {
    globalThis.fetch = () => { throw new Error('Não deveria chamar rede'); };
    await assert.rejects(request('dashboard'), error => error.status === 401);
    for (const kind of ['producao','telemetria','estoque','equipamentos']) await assert.rejects(request(kind), /permitida/);
    await assert.rejects(request('dashboard', {token:'t',body:{}}), /permitida/);
});
test('Bearer e filtro dos alertas, array vazio', async () => {
    globalThis.fetch = async (url, options) => {
        assert.ok(url.endsWith('/api/alertas?ativos=true'));
        assert.equal(options.headers.Authorization,'Bearer fixture'); return Response.json([]);
    };
    assert.deepEqual(await request('alerts',{token:'fixture'}), []);
});
test('erro de rede e JSON inválido são distintos', async () => {
    globalThis.fetch = async () => { throw new TypeError('Network'); };
    await assert.rejects(request('dashboard',{token:'t'}), /conectar/);
    globalThis.fetch = async () => new Response('<html>');
    await assert.rejects(request('dashboard',{token:'t'}), /JSON inválido/);
});
test('cancelamento e timeout durante leitura do corpo', async () => {
    globalThis.fetch = async (_, options) => ({ok:true,json:() => new Promise((resolve,reject) => {
        options.signal.addEventListener('abort', () => reject(new DOMException('abort','AbortError')));
    })});
    const controller = new AbortController();
    const pending = request('dashboard',{token:'t',signal:controller.signal});
    setTimeout(() => controller.abort(), 10);
    await assert.rejects(pending, error => error.name === 'AbortError');
    // O timeout real configurado é exercitado, inclusive depois dos headers HTTP.
    await assert.rejects(request('dashboard',{token:'t'}), /demorou/);
});
test('adaptador v1.1 preserva kg, não inventa hora, recuperação, identidade ou gravidade', () => {
    const value = validate('dashboard',dashboard());
    assert.equal(value.total_processado_kg,750); assert.equal(value.estoque.plastico_kg,500);
    assert.equal(value.plastico_recuperado_kg,null); assert.equal(value.atualizado_em,null);
    assert.equal(value.esteira.codigo,null); assert.equal(value.esteira.conectada,null);
    const row = validate('alerts',alerts())[0]; assert.equal(row.id,2); assert.equal(row.prioridade,null);
});
test('campos opcionais e listas vazias não se tornam zeros', () => {
    const value=dashboard(); value.estoque=[]; delete value.producao_diaria; value.status_esteira=null;
    const result=validate('dashboard',value); assert.equal(result.estoque.metal_kg,null);
    assert.equal(result.esteira,null); assert.deepEqual(result.producao_diaria,[]);
    assert.equal(validate('dashboard',null),null);
});
test('tipos, datas, estados, duplicidades e payload legado incompatível são rejeitados', () => {
    for (const quantity of ['750',-1,NaN,Infinity]) assert.throws(() => validate('dashboard',{...dashboard(),total_processado_kg:quantity}));
    for (const time of ['2026-10-25T10:00:00','invalid']) assert.throws(() => validate('dashboard',{...dashboard(),ultima_leitura:time}));
    assert.throws(() => validate('dashboard',{...dashboard(),status_esteira:'ESTEIRA DESLIGADA'}));
    const duplicate=dashboard(); duplicate.estoque.push(duplicate.estoque[0]); assert.throws(() => validate('dashboard',duplicate));
    assert.throws(() => validate('alerts',[...alerts(),...alerts()]));
    assert.throws(() => validate('login',{perfil:'ADMINISTRADOR',acesso_liberado:true}));
    assert.throws(() => validate('login',session('ROOT')));
    assert.equal(validate('dashboard',{balanco_massas_kg:{total_material_entrada:450}}).total_processado_kg,null);
});
test('manifest, tamanhos PNG e arquivos de precache existem', async () => {
    const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url)));
    assert.equal(manifest.display,'standalone'); assert.equal(manifest.scope,'./');
    for(const icon of manifest.icons) {
        const bytes=await readFile(new URL('../'+icon.src,import.meta.url));
        assert.equal(bytes.readUInt32BE(16),Number(icon.sizes.split('x')[0]));
        assert.equal(bytes.readUInt32BE(20),Number(icon.sizes.split('x')[1]));
    }
    const sw=await readFile(new URL('../sw.js',import.meta.url),'utf8');
    for(const [,file] of sw.matchAll(/'\.\/([^']+)'/g)) await readFile(new URL('../'+file,import.meta.url));
});
test('service worker não intercepta API, POST, Authorization ou origem externa', async () => {
    const handlers={}; let responses=0;
    vm.runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{
        URL, self:{registration:{scope:'https://cyclo.test/'},addEventListener:(name,fn)=>handlers[name]=fn},
        caches:{open:async()=>({match:async()=>new Response('static')})},fetch:()=>new Response('network')
    });
    for(const [url,options] of [['https://cyclo.test/api/dashboard',{}],['https://cyclo.test/login.html',{method:'POST'}],
        ['https://cyclo.test/login.html',{headers:{Authorization:'Bearer secret'}}],['https://other.test/login.html',{}]]) {
        handlers.fetch({request:new Request(url,options),respondWith:()=>responses++});
    }
    assert.equal(responses,0);
    handlers.fetch({request:new Request('https://cyclo.test/login.html'),respondWith:()=>responses++});
    assert.equal(responses,1);
});
test('ativação remove somente caches antigos da aplicação', async () => {
    const handlers={}, deleted=[]; let promise;
    vm.runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{
        URL,self:{registration:{scope:'https://cyclo.test/'},clients:{claim:async()=>{}},addEventListener:(n,f)=>handlers[n]=f},
        caches:{keys:async()=>['ecocycle-static-v3','ecocycle-static-v5','other-app'],delete:async n=>deleted.push(n)}
    });
    handlers.activate({waitUntil:p=>promise=p}); await promise; assert.deepEqual(deleted,['ecocycle-static-v3']);
});
