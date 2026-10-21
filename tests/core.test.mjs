// Testes sem bibliotecas: execute com Node.js 22+ usando node --test tests/core.test.mjs.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeDashboard, mockRequest, setScenario } from '../js/mocks.js';
import { request, validate } from '../js/api.js';

afterEach(() => setScenario('normal'));
test('login demonstrativo válido e inválido', async () => {
  const session = await request('login', { body: { login: 'demo', senha: 'ecocycle-demo' } });
  assert.equal(session.perfil, 'GERENTE');
  assert.ok(Date.parse(session.expira_em) > Date.now());
  await assert.rejects(request('login', { body: { login: 'incorreto', senha: 'incorreta' } }), error => error.status === 401);
});
test('dashboard, totais e filtro de alertas', async () => {
  const data = await request('dashboard');
  assert.equal(data.estoque.plastico_kg + data.estoque.metal_kg, 6430);
  assert.equal(data.producao_diaria.length, 7);
  assert.equal((await request('alerts', { active: true })).length, 2);
  assert.equal((await request('alerts', { active: false })).length, 3);
});
test('todos os estados da esteira e leitura anterior', () => {
  for (const [mode, state] of [['normal', 'LIGADA'], ['off', 'DESLIGADA'], ['stopped', 'PARADA'], ['emergency', 'EMERGENCIA']]) assert.equal(makeDashboard(mode).esteira.estado, state);
  assert.ok(Date.now() - Date.parse(makeDashboard('stale').esteira.ultima_leitura) > 30000);
  assert.equal(makeDashboard('disconnected').esteira.conectada, false);
});
test('dados vazios, erros HTTP e falha de comunicação', async () => {
  setScenario('empty');
  assert.equal(await request('dashboard'), null);
  assert.deepEqual(await request('alerts'), []);
  for (const mode of ['401', '403', '500', 'offline']) {
    setScenario(mode);
    await assert.rejects(request('dashboard'), error => error.status === (mode === 'offline' ? 0 : Number(mode)));
  }
});
test('validação rejeita campos ausentes, quantidades inválidas e enumeração desconhecida', () => {
  assert.throws(() => validate('dashboard', {}));
  for (const value of [-1, NaN, Infinity, '2840']) assert.throws(() => validate('dashboard', { ...makeDashboard(), total_processado_kg: value }));
  const value = makeDashboard(); value.esteira.estado = 'QUALQUER';
  assert.throws(() => validate('dashboard', value));
  assert.throws(() => validate('alerts', [{ tipo: 'PARADA' }]));
  assert.throws(() => validate('login', { token: 'x', nome: 'A', perfil: 'ROOT', expira_em: new Date().toISOString() }));
  assert.equal(validate('dashboard', null), null);
});
test('cancelamento impede conclusão de consulta mock', async () => {
  const controller = new AbortController();
  const pending = mockRequest('dashboard', { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});

// Carregamos uma cópia em memória com o modo real, sem alterar a configuração do projeto.
async function realClient() {
  let source = await readFile(new URL('../js/api.js', import.meta.url), 'utf8');
  source = source.replace("import { CONFIG } from './config.js';", "const CONFIG = {USE_MOCK:false, API_URL:'https://api.example.test', REQUEST_TIMEOUT:20};");
  source = source.replace("import { mockRequest } from './mocks.js';", "const mockRequest = () => { throw new Error('Fallback proibido'); };");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
test('modo real usa exclusivamente os endpoints aprovados e Bearer no cabeçalho', async () => {
  const api = await realClient(); const previous = globalThis.fetch; const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({url, options}); return Response.json(url.includes('alertas') ? [] : makeDashboard()); };
  try {
    await api.request('dashboard', { token: 'token-de-teste' });
    await api.request('alerts', { token: 'token-de-teste', active: true });
    assert.equal(calls[0].url, 'https://api.example.test/api/dashboard');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer token-de-teste');
    assert.equal(calls[0].options.cache, 'no-store');
    assert.equal(calls[1].url, 'https://api.example.test/api/alertas?ativos=true');
    await assert.rejects(api.request('estoque'));
  } finally { globalThis.fetch = previous; }
});
test('modo real envia contrato de login e trata 400/401/403/500 sem mocks', async () => {
  const api = await realClient(); const previous = globalThis.fetch;
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://api.example.test/api/auth/login'); assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { login: 'teste', senha: 'ficticia' });
      return Response.json({ token: 't', nome: 'Teste', perfil: 'CONSULTA', expira_em: new Date(Date.now()+3600000).toISOString() });
    };
    await api.request('login', { body: { login: 'teste', senha: 'ficticia' } });
    for (const status of [400, 401, 403, 500]) {
      globalThis.fetch = async () => new Response('', { status });
      await assert.rejects(api.request('dashboard'), error => error.status === status);
    }
    globalThis.fetch = async () => { throw new TypeError('Falha de rede'); };
    await assert.rejects(api.request('dashboard'), /conectar/);
  } finally { globalThis.fetch = previous; }
});
test('modo real trata timeout, JSON inválido e resposta fora do contrato', async () => {
  const api = await realClient(); const previous = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('não é JSON');
    await assert.rejects(api.request('dashboard'), /JSON inválido/);
    globalThis.fetch = async () => Response.json({});
    await assert.rejects(api.request('dashboard'), /formato inválido/);
    globalThis.fetch = (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError'))));
    await assert.rejects(api.request('dashboard'), /demorou/);
  } finally { globalThis.fetch = previous; }
});
test('manifest e lista de cache referenciam arquivos existentes', async () => {
  const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url)));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const buffer = await readFile(new URL(`../${icon.src}`, import.meta.url));
    assert.equal(buffer.toString('ascii', 1, 4), 'PNG');
    assert.equal(buffer.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
  }
  const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  for (const [, file] of sw.matchAll(/'\.\/([^']+)'/g)) await readFile(new URL(`../${file}`, import.meta.url));
  assert.ok(sw.includes("request.headers.has('Authorization')"));
});
