import { CONFIG } from './config.js';
import { request, ApiError } from './api.js';
import { getSession } from './auth.js';
import { setScenario } from './mocks.js';
import { setText, setTime, tonnes, number } from './ui.js';

const $ = id => document.getElementById(id);
const CENARIOS = ['normal', 'stale', 'emergency', 'stopped', 'off', 'disconnected', 'empty', '401', '403', '500', 'offline'];

let dataAtual = null;
let erro = '';
let consultando = false;
let controller = null;
let geracao = 0;

const online = () => navigator.onLine;

function atualizarGrafico(rows) {
    const svg = document.querySelector('.grafico .linha');
    if (!svg) return;

    const ns = 'http://www.w3.org/2000/svg';
    const criar = (tag, attrs = {}, texto = '') => {
        const node = document.createElementNS(ns, tag);
        for (const [chave, valor] of Object.entries(attrs)) node.setAttribute(chave, String(valor));
        if (texto) node.textContent = texto;
        return node;
    };

    const grade = svg.querySelector('.linha__grade');
    const eixoY = svg.querySelector('.linha__eixo-y');
    const areaAntiga = svg.querySelector('.linha__area');
    const linhaAntiga = svg.querySelector('.linha__traco');
    const pontosAntigos = svg.querySelector('.linha__pontos');
    const eixoX = svg.querySelector('.linha__eixo-x');
    if (!grade || !eixoY || !eixoX) return;

    grade.replaceChildren();
    eixoY.replaceChildren();
    eixoX.replaceChildren();
    areaAntiga?.remove();
    linhaAntiga?.remove();
    pontosAntigos?.remove();

    const valores = rows.map(row => (row.plastico_kg + row.metal_kg) / 1000);
    const maiorValor = Math.max(0, ...valores);
    const escala = maiorValor <= 5 ? 5 : Math.ceil(maiorValor / 4) * 4;
    const y = valor => 110 - (valor / escala) * 100;
    const x = indice => rows.length <= 1 ? 170 : 30 + indice * (280 / (rows.length - 1));

    for (let i = 0; i <= 4; i++) {
        const valor = escala * i / 4;
        const yy = 110 - i * 25;
        grade.append(criar('line', { x1: 30, y1: yy, x2: 320, y2: yy }));
        eixoY.append(criar('text', { x: 22, y: yy + 3, 'text-anchor': 'end' }, number(valor)));
    }

    if (!rows.length) {
        eixoX.append(criar('text', { x: 170, y: 130, 'text-anchor': 'middle' }, 'Sem dados'));
        const total = document.querySelector('.grafico__total');
        if (total) total.textContent = 'Sem dados';
        return;
    }

    const points = rows.map((row, index) => `${x(index)},${y(valores[index])}`);
    const polygonPoints = `${x(0)},110 ${points.join(' ')} ${x(rows.length - 1)},110`;
    const area = criar('polygon', { class: 'linha__area', points: polygonPoints });
    const linha = criar('polyline', { class: 'linha__traco', points: points.join(' ') });
    const grupoPontos = criar('g', { class: 'linha__pontos' });
    rows.forEach((row, index) => {
        grupoPontos.append(criar('circle', { cx: x(index), cy: y(valores[index]), r: 3.5 }));
        const date = new Date(`${row.data}T12:00:00`);
        const label = Number.isFinite(date.getTime())
            ? `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
            : '—';
        eixoX.append(criar('text', { x: x(index), y: 130, 'text-anchor': 'middle' }, label));
    });
    grade.parentNode.insertBefore(area, grade.nextSibling);
    area.after(linha, grupoPontos);

    const total = document.querySelector('.grafico__total');
    if (total) total.textContent = `${number(valores.reduce((soma, valor) => soma + valor, 0))} t`;
    svg.setAttribute('aria-label', `Produção dos últimos ${rows.length} dias, em toneladas.`);
}

function atualizarEstoque() {
    const estoque = dataAtual?.estoque;
    const plastico = estoque?.plastico_kg;
    const metal = estoque?.metal_kg;
    setText('[data-campo="estoquePlastico"]', tonnes(plastico));
    setText('[data-campo="estoqueMetal"]', tonnes(metal));

    const barras = document.querySelectorAll('.estoque-item');
    if (barras.length < 2) return;
    const total = Number.isFinite(plastico) && Number.isFinite(metal) ? plastico + metal : null;
    const valores = [plastico, metal];
    const labels = ['Plástico', 'Metal'];

    barras.forEach((item, indice) => {
        const barra = item.querySelector('.progresso__barra');
        const progresso = item.querySelector('[role="progressbar"]');
        const valor = valores[indice];
        const percentual = total > 0 && Number.isFinite(valor) ? Math.round((valor / total) * 100) : null;
        if (barra) barra.style.setProperty('--p', `${percentual ?? 0}%`);
        if (progresso) {
            progresso.hidden = percentual === null;
            progresso.setAttribute('aria-label', `${labels[indice]}: participação no estoque total`);
            progresso.setAttribute('aria-valuenow', String(percentual ?? 0));
        }
        item.classList.toggle('estoque-item--indisponivel', percentual === null);
    });
}

function atualizarTela() {
    const rows = Array.isArray(dataAtual?.producao_diaria) ? [...dataAtual.producao_diaria].sort((a, b) => a.data.localeCompare(b.data)) : [];
    const periodo = $('selectPeriodo')?.value || 'hoje';
    const hoje = new Date().toISOString().slice(0, 10);
    let selecionadas = [];
    let rotulo = 'Produção diária';

    if (periodo === 'hoje') {
        selecionadas = rows.filter(row => row.data === hoje);
        rotulo = 'Produção diária';
    } else if (periodo === '7d') {
        selecionadas = rows.slice(-7);
        rotulo = 'Produção nos últimos 7 dias';
    }

    const totalKg = selecionadas.reduce((soma, row) => soma + row.plastico_kg + row.metal_kg, 0);
    const plasticoKg = selecionadas.reduce((soma, row) => soma + row.plastico_kg, 0);
    const metalKg = selecionadas.reduce((soma, row) => soma + row.metal_kg, 0);
    const temDadosDoPeriodo = selecionadas.length > 0 && periodo !== 'mes';

    const rotuloProducao = document.querySelector('.grid-kpi .kpi__rotulo');
    if (rotuloProducao) rotuloProducao.textContent = rotulo;
    setText('[data-campo="producaoDiaria"]', temDadosDoPeriodo ? tonnes(totalKg) : '—');
    // O contrato atual não contém total mensal; não exibimos números fictícios.
    setText('[data-campo="producaoMensal"]', '—');
    setText('[data-campo="plastico"]', temDadosDoPeriodo ? tonnes(plasticoKg) : '—');
    setText('[data-campo="metal"]', temDadosDoPeriodo ? tonnes(metalKg) : '—');

    // Variações percentuais do HTML são demonstrativas, não fornecidas pela API.
    document.querySelectorAll('.kpi__variacao').forEach(item => { item.hidden = true; });

    atualizarEstoque();
    atualizarGrafico(rows.slice(-7));

    if (dataAtual?.atualizado_em) setTime('#ultimaAtualizacao', dataAtual.atualizado_em);
    else {
        setText('#ultimaAtualizacao', 'Aguardando dados');
        $('ultimaAtualizacao')?.removeAttribute('datetime');
    }

    const stale = !online() || Boolean(erro) || !dataAtual || Date.now() - Date.parse(dataAtual.atualizado_em) > CONFIG.STALE_AFTER;
    $('avisoOffline')?.classList.toggle('is-visivel', !online());
    $('avisoAntigo')?.classList.toggle('is-visivel', online() && stale);
    if ($('avisoAntigo')) $('avisoAntigo').textContent = erro ? `${erro} Os dados exibidos podem estar desatualizados.` : 'Os dados podem estar desatualizados.';
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
    if (!sessao && !CONFIG.USE_MOCK) { location.replace('login.html'); return; }
    if (!online()) { atualizarTela(); return; }

    const atual = ++geracao;
    controller = new AbortController();
    consultando = true;
    atualizarTela();

    try {
        const resultado = await request('dashboard', { token: sessao?.token, signal: controller.signal });
        if (atual !== geracao) return;
        dataAtual = resultado;
        erro = '';
    } catch (error) {
        if (atual !== geracao || error.name === 'AbortError') return;
        if (error instanceof ApiError && error.status === 401) { location.replace('login.html'); return; }
        erro = error instanceof ApiError ? error.message : 'Não foi possível consultar os dados.';
    } finally {
        if (atual === geracao) {
            consultando = false;
            controller = null;
            atualizarTela();
        }
    }
}

function iniciar() {
    const cenario = new URLSearchParams(location.search).get('cenario');
    if (CONFIG.USE_MOCK && CENARIOS.includes(cenario)) setScenario(cenario);
    $('btnAtualizar')?.addEventListener('click', atualizar);
    $('selectPeriodo')?.addEventListener('change', atualizarTela);
    window.addEventListener('online', atualizarTela);
    window.addEventListener('offline', () => { cancelarConsulta(); atualizarTela(); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') cancelarConsulta();
        else void atualizar();
    });
    window.addEventListener('session-ended', () => location.replace('login.html'));
    atualizarTela();
    void atualizar();
    setInterval(atualizar, CONFIG.POLL_INTERVAL);
}

iniciar();
