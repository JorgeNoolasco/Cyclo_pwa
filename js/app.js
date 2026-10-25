import { getSession, logout } from './auth.js';
import { CONFIG } from './config.js';
import { bindInstall } from './pwa.js';
import { mount as dashboard } from './dashboard.js';
import { mount as esteira } from './esteira.js';
import { mount as producao } from './estoque.js';
import { mount as alertas } from './alertas.js';
import { mount as login } from './login-page.js';
import { mount as menu } from './menu-page.js';

// HTMLs existentes são templates públicos; JWT e dados ficam no mesmo documento.
const mounts = { login, dashboard, esteira, producao, alertas, menu, instalar: () => {}, indisponivel: () => {} };
const publicPages = new Set(['login', 'instalar', 'indisponivel']);
const templates = new Map();
let dispose = () => {}, routeGeneration = 0, routeController, reason = '';
const pageName = () => location.pathname.split('/').pop().replace('.html', '') || 'login';
function remember(name, doc) {
    const body = doc.body.cloneNode(true);
    body.querySelectorAll('script').forEach(node => node.remove());
    templates.set(name, { body, title: doc.title,
        styles: [...doc.querySelectorAll('link[rel="stylesheet"]')].map(node => node.getAttribute('href')) });
}
remember(pageName(), document);
export async function navigate(name, replace = false) {
    if (!Object.hasOwn(mounts, name)) return;
    if (!publicPages.has(name) && !getSession()) name = 'login';
    const generation = ++routeGeneration;
    routeController?.abort(); routeController = new AbortController();
    const controller = routeController;
    dispose(); dispose = () => {};
    // Limpa antes de qualquer await: logout não deixa informação no DOM.
    document.body.replaceChildren(); document.body.dataset.ready = 'false';
    let timer;
    try {
        if (!templates.has(name)) {
            timer = setTimeout(() => controller.abort(), 10000);
            const response = await fetch(`${name}.html`, { signal: controller.signal, credentials: 'omit' });
            if (!response.ok) throw new Error('Página indisponível');
            const html = await response.text();
            if (generation !== routeGeneration) return;
            remember(name, new DOMParser().parseFromString(html, 'text/html'));
        }
        if (generation !== routeGeneration) return;
        if (!publicPages.has(name) && !getSession()) { void navigate('login', true); return; }
        const template = templates.get(name);
        for (const href of template.styles) {
            if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.getAttribute('href') === href)) {
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
                document.head.append(link);
            }
        }
        document.body.className = template.body.className;
        document.body.replaceChildren(...[...template.body.childNodes].map(node => node.cloneNode(true)));
        document.title = template.title;
        const greeting = document.getElementById('nomeUsuario');
        if (greeting) greeting.textContent = getSession()?.nome?.split(' ')[0] || 'usuário';
        history[replace ? 'replaceState' : 'pushState']({}, '', `${name}.html`);
        dispose = mounts[name]({ navigate, reason }) || (() => {});
        if (CONFIG.USE_MOCK && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) {
            const notice = document.createElement('p');
            notice.className = 'aviso-conexao is-visivel'; notice.setAttribute('role', 'status');
            notice.textContent = 'Demonstração local: dados fictícios, sem integração operacional.';
            document.querySelector('main')?.prepend(notice);
        }
        reason = '';
        bindInstall(); window.lucide?.createIcons();
        document.body.dataset.ready = 'true';
        document.querySelector('h1')?.setAttribute('tabindex', '-1');
        document.querySelector('h1')?.focus();
    } catch {
        if (generation !== routeGeneration) return;
        const main = document.createElement('main'); main.className = 'app';
        const p = document.createElement('p'); p.textContent = 'Página indisponível. Conecte-se e tente novamente.';
        const a = document.createElement('a'); a.href = 'login.html'; a.textContent = 'Voltar ao login';
        main.append(p, a); document.body.replaceChildren(main); document.body.dataset.ready = 'true';
    } finally { clearTimeout(timer); }
}
document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    const name = url.pathname.split('/').pop().replace('.html', '');
    if (url.origin !== location.origin || url.search || url.hash || !Object.hasOwn(mounts, name)) return;
    event.preventDefault(); void navigate(name);
});
window.addEventListener('popstate', () => void navigate(pageName(), true));
window.addEventListener('session-ended', event => { reason = event.detail; void navigate('login', true); });
window.addEventListener('pagehide', () => {
    routeGeneration++; routeController?.abort(); dispose(); document.body.replaceChildren(); logout('', false);
});
window.addEventListener('pageshow', event => { if (event.persisted) void navigate('login', true); });
void navigate(pageName() === 'index' ? 'login' : pageName(), true);
