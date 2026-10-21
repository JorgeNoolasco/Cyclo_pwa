import { CONFIG } from './config.js';
import { request, ApiError } from './api.js';
import { login, logout, getSession } from './auth.js';
import { getScenario, setScenario } from './mocks.js';
import { renderDashboard } from './dashboard.js';
import { renderConveyor } from './esteira.js';
import { renderAlerts } from './alertas.js';
import { renderStock } from './estoque.js';
import { element, dateTime } from './ui.js';

const $ = id => document.getElementById(id);
const pages = {
  dashboard: ['Visão geral', 'Tudo o que importa para acompanhar um novo ciclo.'],
  esteira: ['Esteira', 'Acompanhe o estado e a conectividade do equipamento.'],
  alertas: ['Alertas', 'Atenção ao que acontece na operação.'],
  estoque: ['Estoque e produção', 'Da recuperação ao estoque, cada material conta.']
};
let page = 'login';
// Cache limitado à sessão atual. Nada operacional é gravado no localStorage ou Cache Storage.
let dashboard = null;
let alerts = null;
let alertsUpdated = null;
let active = true;
let dashboardError = '';
let alertsError = '';
let busy = false;
let controller = null;
let generation = 0;
let lastFreshness = '';
let installPrompt = null;
let loginGeneration = 0;
const online = () => navigator.onLine;
const dashboardStale = () => !online() || Boolean(dashboardError) || Boolean(dashboard && Date.now() - Date.parse(dashboard.atualizado_em) > CONFIG.STALE_AFTER);
const alertsStale = () => !online() || Boolean(alertsError) || Boolean(alertsUpdated && Date.now() - Date.parse(alertsUpdated) > CONFIG.STALE_AFTER);
const freshness = () => [dashboardStale(), Boolean(dashboard?.esteira && Date.now() - Date.parse(dashboard.esteira.ultima_leitura) > CONFIG.STALE_AFTER), alertsStale()].join('|');

// Cancelar também invalida respostas antigas, impedindo que reapareçam após logout.
function cancelRequest() {
  generation++;
  controller?.abort();
  controller = null;
  busy = false;
}
function clearProtectedData() {
  cancelRequest();
  dashboard = null; alerts = null; alertsUpdated = null;
  dashboardError = ''; alertsError = ''; active = true;
  $('content').replaceChildren();
  $('user-name').textContent = '';
  $('user-role').textContent = '';
  $('last-updated').textContent = '';
  $('messages').replaceChildren();
}
function routeFromURL() {
  const name = location.pathname.split('/').pop().replace('.html', '');
  return Object.hasOwn(pages, name) ? name : 'login';
}
function navigate(next, replace = false) {
  if (next !== 'login' && !getSession()) next = 'login';
  if (next === 'login' && getSession()) next = 'dashboard';
  if (page !== next) cancelRequest();
  page = next;
  const target = new URL(`${page}.html`, location.href);
  if (location.pathname !== target.pathname) history[replace ? 'replaceState' : 'pushState']({}, '', target);
  $('login-view').hidden = page !== 'login';
  $('workspace').hidden = page === 'login';
  document.querySelector('.skip-link').href = page === 'login' ? '#login-form' : '#main-content';
  document.title = `EcoCycle | ${pages[page]?.[0] || 'Entrar'}`;
  if (page === 'login') { $('login-user').focus(); return; }
  const session = getSession();
  if (!session) return;
  $('user-name').textContent = session.nome;
  $('user-role').textContent = `${session.perfil.toLowerCase()} · consulta`;
  $('page-title').textContent = pages[page][0];
  $('page-subtitle').textContent = pages[page][1];
  $('breadcrumb').textContent = pages[page][0];
  for (const link of document.querySelectorAll('nav [data-route]')) {
    if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  render();
  $('page-title').focus();
  void refresh();
}

function render() {
  if (page === 'login') return;
  const isAlerts = page === 'alertas';
  const error = isAlerts ? alertsError : dashboardError;
  const stale = isAlerts ? alertsStale() : dashboardStale();
  const hasData = isAlerts ? alerts !== null : dashboard !== null;
  const updated = isAlerts ? alertsUpdated : dashboard?.atualizado_em;
  $('connection').textContent = !online() ? 'Offline' : error ? 'Consulta indisponível' : !hasData ? 'Aguardando dados' : stale ? 'Dados desatualizados' : 'Dados atualizados';
  $('connection').className = `connection ${stale || !hasData ? 'connection-warn' : ''}`;
  $('last-updated').textContent = updated ? `${stale ? 'Dados anteriores' : 'Atualizado em'} · ${dateTime(updated)}` : 'Aguardando primeira atualização';
  $('last-updated').className = stale ? 'stale' : 'muted';
  $('refresh').disabled = busy || !online();
  $('refresh-label').textContent = busy ? 'Atualizando…' : 'Atualizar';
  const messages = $('messages'); messages.replaceChildren();
  if (!online()) messages.append(element('p', 'banner warning', hasData ? 'Você está offline. Exibindo dados anteriores autorizados desta sessão.' : 'Você está offline e não há dados disponíveis nesta sessão.'));
  if (error) messages.append(element('p', 'banner error', `${error} ${hasData ? 'Os dados anteriores não representam o estado atual.' : ''}`));
  if (busy && !hasData && !error && online()) {
    const loading = element('div', 'loading-state', 'Carregando informações…'); loading.setAttribute('role', 'status');
    const grid = element('div', 'metrics');
    for (let i = 0; i < 4; i++) grid.append(element('div', 'skeleton'));
    loading.append(grid); $('content').replaceChildren(loading); return;
  }
  const renderers = {
    dashboard: () => renderDashboard(dashboard, stale), esteira: () => renderConveyor(dashboard, stale),
    estoque: () => renderStock(dashboard),
    alertas: () => renderAlerts(alerts, active, value => {
      if (active === value) return;
      cancelRequest(); active = value; alerts = null; alertsUpdated = null; alertsError = ''; void refresh();
    }, stale, alertsUpdated)
  };
  // Preservar foco do filtro após uma atualização automática evita atrapalhar o teclado.
  const filterFocused = document.activeElement?.closest('.segmented');
  $('content').replaceChildren(renderers[page]());
  if (filterFocused) document.querySelector('.segmented [aria-pressed="true"]')?.focus();
  lastFreshness = freshness();
}

async function refresh() {
  if (page === 'login' || busy || document.visibilityState !== 'visible') return;
  const session = getSession();
  if (!session) return;
  if (!online()) { render(); return; }
  const kind = page === 'alertas' ? 'alerts' : 'dashboard';
  const current = generation;
  controller = new AbortController(); busy = true; render();
  try {
    const data = await request(kind, { token: session.token, active, signal: controller.signal });
    if (current !== generation || !getSession()) return;
    if (kind === 'dashboard') { dashboard = data; dashboardError = ''; }
    else { alerts = data; alertsUpdated = new Date().toISOString(); alertsError = ''; }
  } catch (error) {
    if (current !== generation || error.name === 'AbortError') return;
    if (error instanceof ApiError && error.status === 401) { logout('Sua sessão expirou. Entre novamente.'); return; }
    if (error instanceof ApiError && error.status === 403) {
      if (kind === 'dashboard') dashboard = null;
      else { alerts = null; alertsUpdated = null; }
    }
    const message = error instanceof ApiError ? error.message : 'Não foi possível consultar os dados.';
    if (kind === 'dashboard') dashboardError = message;
    else alertsError = message;
  } finally {
    if (current === generation) { busy = false; controller = null; render(); }
  }
}

// Interceptamos somente links internos conhecidos. Ctrl/Cmd+clique continua sendo uma nova aba.
document.addEventListener('click', event => {
  const link = event.target.closest('a[data-route]');
  if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); navigate(link.dataset.route);
});
window.addEventListener('popstate', () => navigate(routeFromURL(), true));
window.addEventListener('session-ended', event => {
  loginGeneration++;
  clearProtectedData(); setScenario('normal'); $('scenario').value = 'normal';
  $('login-form').reset(); $('login-submit').disabled = false; $('login-submit').textContent = 'Acessar monitoramento';
  $('login-password').type = 'password'; $('show-password').textContent = 'Mostrar';
  $('login-error').textContent = '';
  $('session-message').textContent = event.detail;
  $('session-message').hidden = !event.detail;
  navigate('login', true);
});
$('logout').addEventListener('click', () => logout());
$('refresh').addEventListener('click', refresh);
$('login-form').addEventListener('submit', async event => {
  event.preventDefault();
  if ($('login-submit').disabled) return;
  const current = ++loginGeneration;
  $('login-submit').disabled = true; $('login-submit').textContent = 'Entrando…';
  $('login-error').textContent = '';
  try {
    if (!online()) throw new Error('Sem conexão. Conecte-se para iniciar uma nova sessão.');
    const success = await login($('login-user').value.trim(), $('login-password').value);
    if (success && current === loginGeneration) navigate('dashboard', true);
  } catch (error) {
    if (current === loginGeneration) $('login-error').textContent = error instanceof ApiError || error.message.startsWith('Sem conexão') || error.message.startsWith('A sessão') ? error.message : 'Não foi possível entrar. Tente novamente.';
  } finally {
    $('login-password').value = '';
    $('login-submit').disabled = false; $('login-submit').textContent = 'Acessar monitoramento';
  }
});
$('fill-demo').addEventListener('click', () => {
  $('login-user').value = 'demo'; $('login-password').value = 'ecocycle-demo'; $('login-submit').focus();
});
$('show-password').addEventListener('click', () => {
  const show = $('login-password').type === 'password';
  $('login-password').type = show ? 'text' : 'password';
  $('show-password').textContent = show ? 'Ocultar' : 'Mostrar';
});
for (const node of document.querySelectorAll('[data-demo]')) node.hidden = !CONFIG.USE_MOCK;
$('scenario').value = getScenario();
$('scenario').addEventListener('change', event => {
  cancelRequest(); setScenario(event.target.value); void refresh();
});
for (const type of ['online', 'offline']) window.addEventListener(type, () => {
  if (!online()) cancelRequest();
  render(); if (online()) void refresh();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') cancelRequest();
  else { getSession(); render(); void refresh(); }
});
// Um único agendador; a trava busy impede sobreposição mesmo com conexão lenta.
setInterval(refresh, CONFIG.POLL_INTERVAL);
setInterval(() => {
  if (page === 'login' || document.visibilityState !== 'visible') return;
  if (freshness() !== lastFreshness) render();
}, 1000);

// O navegador decide se a instalação está disponível. Não simulamos instalação bem-sucedida.
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault(); installPrompt = event;
});
for (const button of document.querySelectorAll('[data-install]')) button.addEventListener('click', async () => {
  if (installPrompt) {
    try { await installPrompt.prompt(); await installPrompt.userChoice; } catch { /* O navegador pode cancelar o diálogo. */ }
    installPrompt = null;
  } else {
    $('install-dialog').showModal();
  }
});
$('close-install').addEventListener('click', () => $('install-dialog').close());
function markInstalled() { for (const button of document.querySelectorAll('[data-install]')) button.hidden = true; }
window.addEventListener('appinstalled', markInstalled);
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) markInstalled();
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {
    $('pwa-status').textContent = 'Não foi possível preparar o modo offline. Reabra o aplicativo com conexão.';
  });
}
// O histórico de navegação (bfcache) não deve restaurar uma tela autenticada antiga.
window.addEventListener('pagehide', () => logout());
window.addEventListener('pageshow', event => { if (event.persisted) logout('Entre novamente para continuar.'); });
navigate(routeFromURL(), true);
