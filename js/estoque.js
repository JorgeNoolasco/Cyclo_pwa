import { CONFIG } from './config.js';
import { setText, setTime, tonnes, number } from './ui.js';
import { monitor } from './monitor.js';

export function mount() {

const $ = id => document.getElementById(id);

let dataAtual = null;
let erro = '';
let consultando = false;

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
    const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
    let selecionadas = [];
    let rotulo = 'Produção diária';

    if (periodo === 'hoje') {
        selecionadas = rows.filter(row => row.data === hoje);
        rotulo = 'Produção diária';
    } else if (periodo === '7d') {
        const end = new Date(`${hoje}T12:00:00Z`); end.setUTCDate(end.getUTCDate() - 6);
        selecionadas = rows.filter(row => row.data >= end.toISOString().slice(0,10) && row.data <= hoje);
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

    if (dataAtual && consultedAt) setTime('#ultimaAtualizacao', dataAtual.atualizado_em || consultedAt);
    else {
        setText('#ultimaAtualizacao', 'Aguardando dados');
        $('ultimaAtualizacao')?.removeAttribute('datetime');
    }

    const stale = monitorStale || !online() || Boolean(erro) || !dataAtual || (dataAtual.atualizado_em && Date.now() - Date.parse(dataAtual.atualizado_em) > CONFIG.STALE_AFTER);
    $('avisoOffline')?.classList.toggle('is-visivel', !online());
    $('avisoAntigo')?.classList.toggle('is-visivel', online() && stale);
    if ($('avisoAntigo')) $('avisoAntigo').textContent = erro ? `${erro} Os dados exibidos podem estar desatualizados.` : 'Os dados podem estar desatualizados.';
    const botao = $('btnAtualizar');
    if (botao) {
        botao.disabled = consultando || !online();
        botao.setAttribute('aria-busy', String(consultando));
    }
}


    let monitorStale = true, consultedAt = null;
    document.getElementById('selectPeriodo')?.addEventListener('change', atualizarTela);
    return monitor('dashboard', state => {
        dataAtual = state.data; erro = state.error; consultando = state.busy;
        monitorStale = state.stale; consultedAt = state.consultedAt;
        atualizarTela();
        const time = document.getElementById('ultimaAtualizacao');
        if (time) time.title = 'Horário da consulta. A última leitura do equipamento pode ser anterior.';
    });
}
