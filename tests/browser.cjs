// Servidores de fixtures exclusivos de teste; nunca publicados nem usados pelo app.
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
let chromium;
try { ({chromium}=require('playwright')); } catch {
    process.env.NODE_PATH = [path.resolve(__dirname,'../node_modulos'),process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    require('node:module').Module._initPaths();
    ({chromium}=require('playwright'));
}
const root=path.resolve(__dirname,'..'), results=[], errors=[];
const ok=name=>{ results.push(name); console.log('OK:',name); };
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const mime={'.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
(async()=>{
    const {dashboard,alerts,session}=await import('./fixtures.mjs');
    let data=dashboard(), events=alerts(), status=200, loginStatus=200, loginPayload=null, delay=0, calls=0, active=0, peak=0;
    let origin;
    const api=http.createServer(async(req,res)=>{
        if(req.headers.origin===origin) res.setHeader('Access-Control-Allow-Origin',origin);
        res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
        res.setHeader('Cache-Control','no-store');
        if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
        if(req.url==='/api/auth/login'){
            let body='';for await(const part of req) body+=part;
            assert.deepEqual(Object.keys(JSON.parse(body)).sort(),['login','senha']);
            res.writeHead(loginStatus,{'Content-Type':'application/json'});res.end(JSON.stringify(loginPayload||session()));return;
        }
        assert.equal(req.headers.authorization,'Bearer fixture-token'); calls++;active++;peak=Math.max(peak,active);
        await new Promise(r=>setTimeout(r,delay)); active--;
        res.writeHead(status,{'Content-Type':'application/json'});
        res.end(JSON.stringify(req.url.startsWith('/api/alertas')?events:data));
    });
    await listen(api);const apiOrigin=`http://127.0.0.1:${api.address().port}`;
    const headers=JSON.parse(await fs.readFile(path.join(root,'vercel.json'))).headers[0].headers;
    const server=http.createServer(async(req,res)=>{
        try {
            let pathname=new URL(req.url,'http://localhost').pathname;
            const baseline=pathname.startsWith('/baseline/');if(baseline) pathname=pathname.slice('/baseline'.length);
            if(pathname==='/') pathname='/index.html';
            if(!/^\/(?:[\w-]+\.html|manifest\.json|sw\.js|js\/[\w-]+\.js|css\/[\w-]+\.css|assets\/(?:icons|vendor)\/[\w.-]+)$/.test(pathname)) throw new Error('Not public');
            let content;
            if(baseline && !pathname.includes('/vendor/')) content=execFileSync('git',['show',`HEAD:${pathname.slice(1)}`],{cwd:root,encoding:'utf8'});
            else content=await fs.readFile(path.join(root,pathname));
            if(baseline && pathname.endsWith('.html')) content=content.replace('https://unpkg.com/lucide@latest','/assets/vendor/lucide.min.js');
            if(pathname==='/js/config.js' && !baseline) content=content.toString().replace('http://127.0.0.1:8000',apiOrigin);
            for(const header of headers) {
                let value=header.value;
                if(header.key==='Content-Security-Policy') value=value.replace("connect-src 'self'",`connect-src 'self' ${apiOrigin}`).replace('; upgrade-insecure-requests','');
                if(!baseline) res.setHeader(header.key,value);
            }
            res.setHeader('Content-Type',mime[path.extname(pathname)]||'text/plain');res.end(content);
        } catch {res.writeHead(404);res.end('Not found');}
    });
    await listen(server);origin=`http://127.0.0.1:${server.address().port}`;
    const browser=await chromium.launch({channel:process.env.TEST_BROWSER||'msedge',headless:true});
    try {
        await fs.mkdir(path.join(root,'test-results'),{recursive:true});
        const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Sao_Paulo'});
        const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
        page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to/.test(m.text()))errors.push(m.text());});
        const text=async(selector,expected)=>page.waitForFunction(({selector,expected})=>document.querySelector(selector)?.textContent.includes(expected),{selector,expected});
        const signIn=async()=>{await page.locator('#nome').fill('fixture');await page.locator('#senha').fill('fixture');await page.locator('[type=submit]').click();await text('[data-campo="toneladas"]','0,8');};
        const go=async name=>{await page.evaluate(name=>import('./js/app.js').then(m=>m.navigate(name)),name);await page.waitForFunction(()=>document.body.dataset.ready==='true');};
        await page.goto(origin+'/dashboard.html');await page.locator('#nome').waitFor();assert.ok(page.url().endsWith('login.html'));ok('URL protegida sem sessão volta ao login');
        loginStatus=401;await page.locator('#nome').fill('invalid');await page.locator('#senha').fill('invalid');await page.locator('[type=submit]').click();await text('#mensagemLogin','inválidas');assert.equal(await page.locator('#senha').inputValue(),'');ok('login inválido e senha removida');
        loginStatus=200;await signIn();await text('#nomeUsuario','Pessoa');ok('login HTTP e dashboard v1.1, Bearer e CORS da fixture');
        assert.match(await page.locator('[data-campo="plastico"]').innerText(),/indisponível/);
        await page.locator('a[href="esteira.html"]').first().click();await text('#textoEsteira','Ligada');
        for(const [state,label] of [['PARADA','Parada'],['EMERGENCIA','Emergência'],['DESLIGADA','Desligada']]){
            data.status_esteira=state;await page.locator('#btnAtualizar').click();await text('#textoEsteira',label);
        }
        data.ultima_leitura=new Date(Date.now()-60000).toISOString();await page.locator('#btnAtualizar').click();await text('#textoEsteira','Sem comunicação');
        data=dashboard();await page.locator('#btnAtualizar').click();await text('#textoEsteira','Ligada');
        await page.clock.install();await page.clock.fastForward(31000);await text('#textoEsteira','Sem comunicação');await page.clock.setSystemTime(new Date());await page.clock.resume();
        data=dashboard();await page.locator('#btnAtualizar').click();await text('#textoEsteira','Ligada');ok('navegação mantém sessão; estados e envelhecimento da leitura');
        await context.setOffline(true);await text('#textoEsteira','Sem comunicação');assert.ok(await page.locator('#avisoOffline').evaluate(n=>n.classList.contains('is-visivel')));
        await context.setOffline(false);await text('#textoEsteira','Ligada');ok('offline e reconexão automática');
        status=403;await page.locator('#btnAtualizar').click();await text('#avisoAntigo','permissão');await text('[data-campo="temperatura"]','indisponível');ok('403 remove dados privados da consulta negada');
        status=200;await go('alertas');await page.locator('.alerta').waitFor();await text('.alerta','Gravidade indisponível');
        events=[{...alerts()[0],codigo_equipamento:'<img src=x onerror=alert(1)>'}];await page.locator('#btnAtualizar').click();await text('.alerta__meta','<img');assert.equal(await page.locator('.alerta img').count(),0);
        events=[{...alerts()[0],prioridade:'ALTA'},{...alerts()[0],id_alerta:3,resolvido:true,prioridade:'BAIXA'}];
        await page.locator('#btnAtualizar').click();await page.waitForFunction(()=>document.querySelectorAll('.alerta').length===2);
        await page.locator('[data-filtro-gravidade="alta"]').click();assert.equal(await page.locator('.alerta').count(),1);
        await page.locator('[data-filtro-gravidade="todas"]').click();await page.locator('#btnFiltro').click();
        await page.locator('[data-filtro-situacao="resolvido"]').click();assert.equal(await page.locator('.alerta').count(),1);
        await page.locator('[data-filtro-situacao="todos"]').click();
        events=[];await page.locator('#btnAtualizar').click();await text('#mensagemVazia','Nenhum alerta');ok('alertas reais ao cliente: vazio, campos opcionais e XSS como texto');
        await go('producao');await text('[data-campo="estoquePlastico"]','0,5');ok('estoque do dashboard e produção diária sem endpoint inventado');
        await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller);
        const cached=await page.evaluate(async()=> (await Promise.all((await caches.keys()).map(async k=>(await(await caches.open(k)).keys()).map(r=>r.url)))).flat());
        assert.ok(cached.length>25);assert.ok(cached.every(u=>!u.includes('/api/')));
        assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});ok('service worker registrado, cache somente estático e nenhum token persistido');
        await go('dashboard');await page.locator('a[href="menu.html"]').click();await page.locator('#btnSair').click();await page.locator('#nome').waitFor();assert.ok(!(await page.locator('body').innerText()).includes('Pessoa Teste'));
        await page.goBack();await page.locator('#nome').waitFor();ok('logout e histórico não restauram dados');
        await context.setOffline(true);await page.reload();await page.locator('#nome').waitFor();await page.locator('#nome').fill('fixture');await page.locator('#senha').fill('fixture');await page.locator('[type=submit]').click();await text('#mensagemLogin','Sem conexão');
        await context.setOffline(false);await signIn();status=401;await page.locator('#btnAtualizar').click();await text('#mensagemLogin','expirou');status=200;ok('shell offline sem sessão e HTTP 401 encerra sessão');
        loginPayload={...session(),expira_em:new Date(Date.now()-1000).toISOString()};await page.locator('#nome').fill('fixture');await page.locator('#senha').fill('fixture');await page.locator('[type=submit]').click();await text('#mensagemLogin','expirou');loginPayload=null;
        await signIn();status=500;await page.locator('#btnAtualizar').click();await text('#avisoAntigo','temporariamente');await text('#textoEsteira','Sem comunicação');status=200;ok('token expirado recusado e erro 500 sinaliza estado desatualizado');
        await page.locator('#btnAtualizar').click();await page.waitForFunction(()=>!document.getElementById('btnAtualizar').disabled);
        await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
        const count=calls;await new Promise(r=>setTimeout(r,5200));assert.equal(calls,count);
        await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
        await page.waitForFunction(()=>!document.getElementById('btnAtualizar').disabled);assert.equal(peak,1);ok('polling suspenso em aba oculta e sem sobreposição');
        // Regressão geométrica dos elementos estruturais, usando HTML/CSS do HEAD.
        const baselineContext=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
        const baseline=await baselineContext.newPage();await baseline.goto(origin+'/baseline/dashboard.html');
        const selectors=['.app-header','.nav-inferior','.grid-kpi'];
        for(const selector of selectors){const before=await baseline.locator(selector).boundingBox(),after=await page.locator(selector).boundingBox();assert.ok(Math.abs(before.x-after.x)<1&&Math.abs(before.width-after.width)<1,selector);}
        await baseline.screenshot({path:path.join(root,'test-results/baseline-dashboard.png'),fullPage:true});await baselineContext.close();ok('regressão visual: posição/largura de cabeçalho, navegação e grade preservadas');
        for(const width of [320,390,768,1440]){
            await page.setViewportSize({width,height:900});
            for(const name of ['dashboard','esteira','alertas','producao','menu']){
                await go(name);await page.waitForTimeout(120);
                assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${name} ${width}`);
                if(width===390||width===1440)await page.screenshot({path:path.join(root,`test-results/${name}-${width}.png`),fullPage:true});
            }
        }ok('responsividade de cinco telas em 320/390/768/1440 px e capturas visuais');
        await go('instalar');await page.locator('[data-install]').click();await text('#installMessage','menu do navegador');
        await page.evaluate(()=>{let e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=async()=>{window.prompted=true;};e.userChoice=Promise.resolve({outcome:'dismissed'});window.dispatchEvent(e);});
        assert.equal(await page.evaluate(()=>Boolean(window.prompted)),false);await page.locator('[data-install]').click();assert.equal(await page.evaluate(()=>window.prompted),true);
        await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));assert.equal(await page.locator('[data-install]').isHidden(),true);ok('fallback de instalação, prompt por gesto e supressão após appinstalled (eventos simulados)');
        const profile=await fs.mkdtemp(path.join(root,'test-results/install-profile-'));
        const installedContext=await chromium.launchPersistentContext(profile,{channel:process.env.TEST_BROWSER||'msedge',headless:true});
        let installability;
        try {
            const installPage=await installedContext.newPage();await installPage.goto(origin+'/instalar.html');
            await installPage.evaluate(()=>navigator.serviceWorker.ready);
            const cdp=await installedContext.newCDPSession(installPage);installability=await cdp.send('Page.getInstallabilityErrors');
            assert.deepEqual(installability.installabilityErrors,[]);
        } finally {await installedContext.close();}
        ok('Chromium com perfil comum não reporta erros de instalabilidade');
        await page.screenshot({path:path.join(root,'test-results/instalar.png'),fullPage:true});
        assert.deepEqual(errors,[]);ok('sem erros JavaScript nem violações CSP');
        await fs.writeFile(path.join(root,'test-results/browser.json'),JSON.stringify({results,errors,installability,api:'fixture HTTP; não é backend oficial'},null,2));
        await context.close();
    } finally {await browser.close();await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>api.close(r))]);}
})().catch(error=>{console.error(error);process.exitCode=1;});
