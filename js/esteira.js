import { CONFIG } from './config.js';
import { request, ApiError } from './api.js';
import { getSession } from './auth.js';
import { setScenario } from './mocks.js';
import { setText, setTime } from './ui.js';

const $ = id => document.getElementById(id);
const campo = nome => document.querySelector(`[data-campo="${nome}"]`);
const CENARIOS = ['normal', 'stale', 'emergency', 'stopped', 'off', 'disconnected', 'empty', '401', '403', '500', 'offline'];
const ESTADOS = {
    LIGADA: { ponto: 'ligada', texto: 'Ligada', badge: 'normal', rotulo: 'Normal' },
    DESLIGADA: { ponto: 'parada', texto: 'Desligada', badge: 'atencao', rotulo: 'Atenção' },
    PARADA: { ponto: 'parada', texto: 'Parada', badge: 'atencao', rotulo: 'Atenção' },
    EMERGENCIA: { ponto: 'falha', texto: 'Emergência', badge: 'critico', rotulo: 'Crítico' }
};
const SEM_COMUNICACAO = { ponto: 'sem-comunicacao', texto: 'Sem comunicação', badge: 'sem-comunicacao', rotulo: 'Sem dados' };

let dataAtual = null;
let erro = '';
let consultando = false;
let controller = null;
let geracao = 0;

const online = () => navigator.onLine;
const dataAntiga = valor => !Number.isFinite(Date.parse(valor)) || Date.now() - Date.parse(valor) > CONFIG.STALE_AFTER;

function estadoAtual() {
    const belt = dataAtual?.esteira;
    if (!belt || !online() || erro || !belt.conectada || dataAntiga(belt.ultima_leitura)) return SEM_COMUNICACAO;
    return ESTADOS[belt.estado] || SEM_COMUNICACAO;
}

function atualizarEstado() {
    const estado = estadoAtual();
    const ponto = $('pontoEsteira');
    const texto = $('textoEsteira');
    const badge = $('badgeEsteira');

    if (ponto) ponto.className = `ponto ponto--${estado.ponto}`;
    if (texto) {
        texto.className = `estado-texto estado-texto--${estado.ponto}`;
        texto.textContent = estado.texto;
    }
    if (badge) {
        badge.className = `badge badge--${estado.badge}`;
        badge.textContent = estado.rotulo;
    }

    const belt = dataAtual?.esteira;
    const nome = belt?.codigo ? `Esteira ${belt.codigo}` : 'Esteira';
    setText('#nomeEsteira', nome);
    const nomeEquipamento = document.querySelector('.card-link__nome');
    if (nomeEquipamento) nomeEquipamento.textContent = nome;

    const temperatura = belt?.temperatura;
    setText('[data-campo="temperatura"]', temperatura == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(temperatura));
    // A API atual não define velocidade nem produção específica da esteira.
    setText('[data-campo="velocidade"]', '—');
    setText('[data-campo="producao"]', '—');

    const ultimaLeitura = belt?.ultima_leitura;
    if (ultimaLeitura) {
        const horario = new Date(ultimaLeitura);
        setText('[data-campo="horario"]', Number.isFinite(horario.getTime()) ? horario.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
    } else {
        setText('[data-campo="horario"]', '—');
    }

    if (dataAtual?.atualizado_em) setTime('#ultimaAtualizacao', dataAtual.atualizado_em);
    else {
        setText('#ultimaAtualizacao', 'Aguardando dados');
        $('ultimaAtualizacao')?.removeAttribute('datetime');
    }

    const stale = !online() || Boolean(erro) || !belt || !belt.conectada || dataAntiga(belt?.ultima_leitura);
    $('avisoOffline')?.classList.toggle('is-visivel', !online());
    $('avisoAntigo')?.classList.toggle('is-visivel', online() && stale);
    if ($('avisoAntigo')) $('avisoAntigo').textContent = erro ? `${erro} Os dados podem não representar o estado atual.` : 'Os dados podem estar desatualizados.';
    $('telaEsteira')?.classList.toggle('esteira--sem-comunicacao', stale);

    const botao = $('btnAtualizar');
    if (botao) {
        botao.disabled = consultando || !online();
        botao.setAttribute('aria-busy', String(consultando));
    }
}

function cancelarConsulta() {
    geracao++;
    controller?.abort();
    controller = null;
    consultando = false;
}

async function atualizar() {
    if (consultando || document.visibilityState !== 'visible') return;
    const sessao = getSession();
    if (!sessao && !CONFIG.USE_MOCK) {
        location.replace('login.html');
        return;
    }
    if (!online()) { atualizarEstado(); return; }

    const atual = ++geracao;
    controller = new AbortController();
    consultando = true;
    atualizarEstado();

    try {
        const resultado = await request('dashboard', { token: sessao?.token, signal: controller.signal });
        if (atual !== geracao) return;
        dataAtual = resultado;
        erro = '';
    } catch (error) {
        if (atual !== geracao || error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401) { location.replace('login.html'); return; }
        dataAtual = dataAtual;
        erro = error instanceof ApiError ? error.message : 'Não foi possível consultar os dados.';
    } finally {
        if (atual === geracao) {
            consultando = false;
            controller = null;
            atualizarEstado();
        }
    }
}

function iniciar() {
    const cenario = new URLSearchParams(location.search).get('cenario');
    if (CONFIG.USE_MOCK && CENARIOS.includes(cenario)) setScenario(cenario);
    $('btnAtualizar')?.addEventListener('click', atualizar);
    window.addEventListener('online', atualizarEstado);
    window.addEventListener('offline', () => { cancelarConsulta(); atualizarEstado(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') cancelarConsulta();
        else void atualizar();
    });
    window.addEventListener('session-ended', () => location.replace('login.html'));
    setText('[data-campo="velocidade"]', '—');
    setText('[data-campo="producao"]', '—');
    atualizarEstado();
    void atualizar();
    setInterval(atualizar, CONFIG.POLL_INTERVAL);
}

iniciar();
