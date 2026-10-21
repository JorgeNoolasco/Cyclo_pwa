// Verificação opcional em navegador. Playwright é ferramenta de teste, não dependência da PWA.
// Requer servidor HTTP local e Playwright disponível no ambiente de desenvolvimento.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const base = process.env.TEST_URL || 'http://127.0.0.1:8080';
const results = [];
const ok = name => { results.push(name); console.log(`OK: ${name}`); };
async function waitText(page, selector, text) {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent.includes(text), { selector, text });
}
async function signIn(page) {
  await page.locator('#fill-demo').click(); await page.locator('#login-submit').click();
  await page.locator('.metric').first().waitFor();
}
(async () => {
  const browser = await chromium.launch({ channel: process.env.TEST_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Sao_Paulo' });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/estoque.html`);
    await page.locator('#login-user').waitFor(); assert.ok(page.url().endsWith('login.html'));
    ok('página protegida exige login');
    await page.locator('#login-user').fill('errado'); await page.locator('#login-password').fill('errado');
    await page.locator('#login-submit').click(); await waitText(page, '#login-error', 'inválidas');
    assert.equal(await page.locator('#login-password').inputValue(), ''); ok('login inválido e limpeza da senha');
    await signIn(page); assert.equal(await page.locator('.metric-value').last().innerText(), '6.430 kg');
    ok('login demonstrativo, dashboard e estoque sem rejeitos');
    await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
    await page.locator('nav [data-route="esteira"]').click(); await waitText(page, '#content', 'Material identificado');
    for (const [value, label] of [['emergency', 'Emergência'], ['stopped', 'Parada'], ['off', 'Desligada'], ['stale', 'Sem comunicação atual'], ['disconnected', 'Sem comunicação atual']]) {
      await page.locator('#scenario').selectOption(value); await waitText(page, '.status-pill', label);
    }
    ok('esteira: emergência, parada, desligada, leitura antiga e desconectada');
    await page.locator('#scenario').selectOption('normal'); await waitText(page, '.status-pill', 'Em operação');
    await page.locator('nav [data-route="alertas"]').click(); await page.locator('.alert-row').first().waitFor();
    assert.equal(await page.locator('.alert-row').count(), 2);
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('.alert-row').length === 3); ok('alertas ativos e todos');
    await page.locator('nav [data-route="estoque"]').click(); await waitText(page, '#content', 'Composição do estoque');
    assert.equal(await page.locator('progress').count(), 2); ok('estoque e evolução diária');
    await page.locator('#scenario').selectOption('500'); await waitText(page, '#messages', 'temporariamente');
    assert.equal(await page.locator('.metric').count(), 4); await waitText(page, '#last-updated', 'Dados anteriores');
    await page.locator('#scenario').selectOption('403'); await waitText(page, '#messages', 'permissão');
    assert.equal(await page.locator('.metric').count(), 0);
    await page.locator('#scenario').selectOption('empty'); await waitText(page, '#content', 'Sem dados');
    await page.locator('#scenario').selectOption('normal'); await page.locator('.metric').first().waitFor();
    await page.locator('#scenario').selectOption('offline'); await waitText(page, '#messages', 'conexão');
    await page.locator('#scenario').selectOption('normal'); await waitText(page, '#connection', 'Dados atualizados');
    ok('erros 500/403, resposta vazia e indisponibilidade da API');
    await page.locator('nav [data-route="dashboard"]').click();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const cached = await page.evaluate(async () => (await Promise.all((await caches.keys()).map(async name => (await (await caches.open(name)).keys()).map(r => r.url)))).flat());
    assert.ok(cached.length >= 20); assert.ok(cached.every(url => !url.includes('/api/')));
    await context.setOffline(true); await waitText(page, '#messages', 'offline');
    assert.equal(await page.locator('.metric').count(), 4); await waitText(page, '.status-pill', 'Sem comunicação atual');
    ok('cache estático sem API e dashboard anterior offline');
    await context.setOffline(false); await waitText(page, '#connection', 'Dados atualizados');
    await waitText(page, '.status-pill', 'Em operação');
    ok('conexão restaurada atualiza dados automaticamente');
    await page.locator('#scenario').selectOption('empty'); await waitText(page, '#content', 'Sem dados');
    await context.setOffline(true); await waitText(page, '#messages', 'não há dados');
    ok('estado offline sem dados anteriores');
    await page.locator('#logout').click(); assert.equal(await page.locator('#content').innerText(), '');
    await page.goBack(); await page.locator('#login-user').waitFor();
    assert.equal(await page.locator('#workspace').isVisible(), false);
    await page.reload(); await page.locator('#login-user').waitFor();
    await page.locator('#fill-demo').click(); await page.locator('#login-submit').click();
    await waitText(page, '#login-error', 'Sem conexão');
    ok('logout apaga dados, voltar não restaura sessão e interface abre offline');
    await context.setOffline(false); await signIn(page);
    await page.locator('#scenario').selectOption('401'); await waitText(page, '#session-message', 'expirou');
    assert.equal(await page.locator('#content').innerText(), ''); ok('HTTP 401 encerra sessão e limpa tela');
    await signIn(page);
    // Avançar somente o relógio evita esperar uma hora para verificar a expiração real.
    await page.evaluate(() => { const original = Date.now; Date.now = () => original() + 3601000; });
    await waitText(page, '#session-message', 'expirou'); ok('expiração temporal de uma hora');
    await page.reload(); await signIn(page);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow em ${width}px`);
      if (width === 390) await page.screenshot({ path: 'test-results/dashboard-mobile.png', fullPage: true });
    }
    ok('layout sem overflow em 320/390/768/1440 px');
    await page.locator('#logout').click(); await page.screenshot({ path: 'test-results/login-desktop.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
    await page.locator('#login-view [data-install]').click(); await page.locator('#install-dialog').waitFor();
    await page.locator('#close-install').click();
    const cdp = await context.newCDPSession(page);
    const incognitoCheck = await cdp.send('Page.getInstallabilityErrors');
    assert.deepEqual(incognitoCheck.installabilityErrors.filter(error => error.errorId !== 'in-incognito'), []);
    // Contextos isolados são anônimos; um perfil temporário comum permite testar os critérios técnicos.
    const installedContext = await chromium.launchPersistentContext('', { channel: process.env.TEST_BROWSER || 'msedge', headless: true });
    let installability;
    try {
      const installedPage = await installedContext.newPage(); await installedPage.goto(base);
      await installedPage.evaluate(() => navigator.serviceWorker.ready);
      const installedCDP = await installedContext.newCDPSession(installedPage);
      installability = await installedCDP.send('Page.getInstallabilityErrors');
      assert.deepEqual(installability.installabilityErrors, []);
    } finally { await installedContext.close(); }
    ok('manifest/SW elegíveis segundo Chromium em perfil comum e instruções de instalação');
    assert.deepEqual(errors, []); ok('nenhum erro JavaScript no fluxo demonstrativo');
    await context.close();

    // Modo real com respostas HTTP interceptadas: verifica integração, sem alegar acesso à API oficial.
    const real = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    const config = await fs.readFile('js/config.js', 'utf8');
    await real.route('**/js/config.js', route => route.fulfill({ contentType: 'text/javascript', body: config.replace('USE_MOCK: true', 'USE_MOCK: false').replace('http://localhost:8000', 'https://api.ecocycle.example') }));
    const { makeDashboard } = await import('../js/mocks.js');
    let count = 0; let concurrent = 0; let maxConcurrent = 0; let status = 200;
    await real.route('https://api.ecocycle.example/**', async route => {
      const req = route.request();
      if (req.url().endsWith('/auth/login')) {
        assert.equal(req.method(), 'POST'); assert.deepEqual(req.postDataJSON(), { login: 'consulta', senha: 'teste' });
        return route.fulfill({ json: { token: 'teste-real', nome: '<img src=x onerror=alert(1)>', perfil: 'CONSULTA', expira_em: new Date(Date.now()+3600000).toISOString() } });
      }
      assert.equal(req.headers().authorization, 'Bearer teste-real');
      count++; concurrent++; maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 450));
      concurrent--;
      await route.fulfill({ status, json: status === 200 ? makeDashboard() : {} });
    });
    // Reproduzimos os cabeçalhos do deploy para verificar compatibilidade com a CSP.
    const deployment = JSON.parse(await fs.readFile('vercel.json', 'utf8'));
    const headers = Object.fromEntries(deployment.headers[0].headers.filter(h => h.key !== 'Strict-Transport-Security').map(h => [h.key, h.value.replace('; upgrade-insecure-requests','')]));
    await real.route('**/*.html', async route => { const response = await route.fetch(); await route.fulfill({ response, headers: { ...response.headers(), ...headers } }); });
    const rp = await real.newPage(); const realErrors = []; rp.on('pageerror', e => realErrors.push(e.message));
    await rp.goto(`${base}/login.html`);
    assert.equal(await rp.locator('[data-demo]').first().isVisible(), false);
    await rp.locator('#login-user').fill('consulta'); await rp.locator('#login-password').fill('teste'); await rp.locator('#login-submit').click();
    await rp.locator('.metric').first().waitFor();
    assert.equal(await rp.locator('#user-name img').count(), 0);
    assert.match(await rp.locator('#user-name').innerText(), /<img/);
    ok('modo real usa Fetch/Bearer e renderiza conteúdo externo como texto, com CSP');
    await rp.evaluate(() => { for (let i=0;i<5;i++) document.getElementById('refresh').click(); });
    await rp.waitForTimeout(600); assert.equal(maxConcurrent, 1); ok('atualização manual sem consultas simultâneas');
    await rp.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const before = count; await rp.waitForTimeout(5500); assert.equal(count, before);
    await rp.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await rp.waitForTimeout(600); assert.ok(count > before); ok('polling suspenso em segundo plano e retomado ao voltar');
    status = 500; await rp.locator('#refresh').click(); await waitText(rp, '#messages', 'temporariamente');
    assert.equal(await rp.locator('.metric').count(), 4);
    status = 403; await rp.locator('#refresh').click(); await waitText(rp, '#messages', 'permissão'); assert.equal(await rp.locator('.metric').count(), 0);
    status = 200; await rp.locator('#refresh').click(); await rp.locator('.metric').first().waitFor();
    await rp.locator('#refresh').click(); await rp.locator('#logout').click(); await rp.waitForTimeout(700);
    assert.equal(await rp.locator('#content').innerText(), '');
    ok('resposta em andamento não repõe dados após logout');
    await rp.locator('#login-user').fill('consulta'); await rp.locator('#login-password').fill('teste'); await rp.locator('#login-submit').click();
    await rp.locator('.metric').first().waitFor();
    status = 401; await rp.locator('#refresh').click(); await rp.locator('#login-user').waitFor();
    assert.deepEqual(realErrors, []); ok('HTTP real interceptado: 500 preserva histórico, 403 remove dados, 401 encerra sessão');
    await real.close();
    await fs.writeFile('test-results/browser-results.json', JSON.stringify({ results, installability, officialAPI: 'Não disponível; integração validada com interceptação HTTP.' }, null, 2));
    console.log(`${results.length} verificações concluídas.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
