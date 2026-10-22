import { CONFIG } from './config.js';
import { request, ApiError } from './api.js';
import { getSession } from './auth.js';
import { setScenario } from './mocks.js';
import { setText, setTime, tonnes } from './ui.js';

/*
 * dashboard.js — preenche o dashboard.html com os dados da API.
 * O HTML continua sendo a estrutura da tela; aqui só atualizamos valores.
 */

// As variações (12%, 15%, 8%, 50%) do HTML são demonstrativas: a API ainda
// não fornece esse dado. Enquanto isso, ficam escondidas para não parecerem reais.
const MOSTRAR_VARIACOES = false;

// Cenários de teste do mock, escolhidos pela URL: dashboard.html?cenario=emergency
const CENARIOS = [
    'normal', 'stale', 'emergency', 'stopped', 'off',
    'disconnected', 'empty', '401', '403', '500', 'offline'
];

// Como cada estado da API aparece nas classes CSS do HTML.
const ESTADOS = {
    LIGADA: { ponto: 'ligada', badge: 'normal', texto: 'Ligada', rotulo: 'Normal' },
    DESLIGADA: { ponto: 'parada', badge: 'atencao', texto: 'Desligada', rotulo: 'Atenção' },
    PARADA: { ponto: 'parada', badge: 'atencao', texto: 'Parada', rotulo: 'Atenção' },
    EMERGENCIA: { ponto: 'falha', badge: 'critico', texto: 'Emergência', rotulo: 'Crítico' }
};

const SEM_COMUNICACAO = {
    ponto: 'sem-comunicacao',
    badge: 'sem-comunicacao',
    texto: 'Sem comunicação',
    rotulo: 'Sem dados'
};

const $ = id => document.getElementById(id);

let dashboard = null;       // últimos dados recebidos (ou null)
let errorMessage = '';      // erro da última consulta, se houver
let busy = false;           // impede duas consultas ao mesmo tempo
let controller = null;      // permite cancelar a consulta em andamento
let generation = 0;         // descarta respostas de consultas canceladas
let lastKey = '';           // evita redesenhar a cada segundo sem necessidade

const avisoAntigoPadrao = $('avisoAntigo').textContent.trim();

/* ---------- Estado da conexão e dos dados ---------- */

const isOnline = () => navigator.onLine;

// Data inválida também conta como "antiga".
const isOld = iso => !(Date.now() - Date.parse(iso) <= CONFIG.STALE_AFTER);

const dashboardStale = () =>
    !isOnline() ||
    Boolean(errorMessage) ||
    Boolean(dashboard && isOld(dashboard.atualizado_em));

// Não afirmamos que a esteira está bem quando não temos leitura confiável.
function beltEstado() {
    const belt = dashboard?.esteira;

    if (!dashboard || dashboardStale()) {
        return { ...SEM_COMUNICACAO, texto: dashboard ? SEM_COMUNICACAO.texto : 'Aguardando dados' };
    }

    if (!belt || !belt.conectada || isOld(belt.ultima_leitura)) {
        return SEM_COMUNICACAO;
    }

    return ESTADOS[belt.estado] || SEM_COMUNICACAO;
}

/* ---------- Sessão ---------- */

// No modo demonstração a tela abre sem login. Com a API real, exige sessão.
function currentSession() {
    const session = getSession();

    if (!session && !CONFIG.USE_MOCK) {
        location.replace('login.html');
    }

    return session;
}

/* ---------- Desenho da tela ---------- */

function renderKpis() {
  
    const data = dashboard;
    const alertas = data?.alertas_ativos ?? '—';

    // API em quilos; a tela mostra toneladas.
    setText('[data-campo="toneladas"]', data ? tonnes(data.total_processado_kg) : '—');
    setText('[data-campo="plastico"]', data ? tonnes(data.plastico_recuperado_kg) : '—');
    setText('[data-campo="metal"]', data ? tonnes(data.metal_recuperado_kg) : '—');
    setText('[data-campo="alertas"]', alertas);

    // Contador do sino (cabeçalho) e do menu inferior.
    setText('#contadorSino', alertas);
    setText('.nav-item[href="alertas.html"] .badge-contador', alertas);

    document.querySelector('.btn-sino')?.setAttribute(
        'aria-label',
        data ? `Alertas: ${alertas} ativos` : 'Alertas'
    );

    for (const node of document.querySelectorAll('.kpi__variacao')) {
        node.hidden = !MOSTRAR_VARIACOES;
    }
}

function renderEsteira() {
    const estado = beltEstado();

    $('pontoEsteira').className = `ponto ponto--${estado.ponto}`;
    $('badgeEsteira').className = `badge badge--${estado.badge}`;
    setText('#textoEsteira', estado.texto);
    setText('#badgeEsteira', estado.rotulo);
}

function renderAtualizacao() {
    if (dashboard) {
        setTime('#ultimaAtualizacao', dashboard.atualizado_em);
    } else {
        setText('#ultimaAtualizacao', 'Aguardando primeira atualização');
        $('ultimaAtualizacao').removeAttribute('datetime');
    }

    $('btnAtualizar').disabled = busy || !isOnline();
    $('btnAtualizar').setAttribute('aria-busy', String(busy));
}

function renderAvisos() {
    const online = isOnline();
    const stale = dashboardStale();

    $('avisoOffline').classList.toggle('is-visivel', !online);
    $('avisoAntigo').classList.toggle('is-visivel', online && stale);

    $('avisoAntigo').textContent = errorMessage
        ? `${errorMessage} Os dados exibidos podem não representar o estado atual.`
        : avisoAntigoPadrao;
}

function render() {
    renderKpis();
    renderEsteira();
    renderAtualizacao();
    renderAvisos();

    lastKey = [dashboardStale(), beltEstado().ponto].join('|');
}

/* ---------- Consulta à API ---------- */

function cancelRequest() {
    generation++;
    controller?.abort();
    controller = null;
    busy = false;
}

async function refresh() {
    if (busy || document.visibilityState !== 'visible') return;

    const session = currentSession();
    if (!session && !CONFIG.USE_MOCK) return;

    if (!isOnline()) {
        render();
        return;
    }

    const current = generation;

    controller = new AbortController();
    busy = true;
    render();

    try {
        const data = await request('dashboard', {
            token: session?.token,
            signal: controller.signal
        });

        if (current !== generation) return;

        dashboard = data;
        errorMessage = '';
    } catch (error) {
        if (current !== generation || error.name === 'AbortError') return;

        if (error instanceof ApiError && error.status === 401) {
            // Sessão inválida: volta para o login.
            location.replace('login.html');
            return;
        }

        if (error instanceof ApiError && error.status === 403) {
            dashboard = null;
        }

        errorMessage = error instanceof ApiError
            ? error.message
            : 'Não foi possível consultar os dados.';
    } finally {
        if (current === generation) {
            busy = false;
            controller = null;
            render();
        }
    }
}

/* ---------- Inicialização ---------- */

function start() {
    // Cenário de teste do mock, só em modo demonstração.
    const cenario = new URLSearchParams(location.search).get('cenario');
    if (CONFIG.USE_MOCK && CENARIOS.includes(cenario)) {
        setScenario(cenario);
    }

    // Aviso de que os dados são simulados (modo demonstração).
    $('avisoDemo').classList.toggle('is-visivel', CONFIG.USE_MOCK);

    // Saudação com o nome da sessão, quando houver.
    const nome = getSession()?.nome?.split(' ')[0];
    setText('#nomeUsuario', nome || 'usuário');

    $('btnAtualizar').addEventListener('click', refresh);

    window.addEventListener('session-ended', () => {
        location.replace('login.html');
    });

    for (const type of ['online', 'offline']) {
        window.addEventListener(type, () => {
            if (!isOnline()) cancelRequest();
            render();
            if (isOnline()) void refresh();
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            cancelRequest();
        } else {
            render();
            void refresh();
        }
    });

    // Atualização automática; a trava "busy" evita consultas sobrepostas.
    setInterval(refresh, CONFIG.POLL_INTERVAL);

    // A cada segundo, só redesenha se o estado de "dados antigos" mudou.
    setInterval(() => {
        if (document.visibilityState !== 'visible') return;

        const key = [dashboardStale(), beltEstado().ponto].join('|');
        if (key !== lastKey) render();
    }, 1000);

    render();
    void refresh();
}

start();