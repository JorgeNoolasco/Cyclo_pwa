/** @file Apresenta indicadores e situação da esteira, sem converter ausência de leitura em sucesso operacional. */
import { CONFIG } from './config.js';
import { setText, setTime, tonnes } from './ui.js';
import { monitor } from './monitor.js';

/**
 * Monta a tela no template atual. Apresenta indicadores e situação da esteira, sem converter ausência de leitura em sucesso operacional.
 * @returns {Function} Rotina de limpeza chamada pelo roteador ao sair da tela.
 */
export function mount() {

    /*
     * dashboard.js — preenche o dashboard.html com os dados da API.
     * O HTML continua sendo a estrutura da tela; aqui só atualizamos valores.
     */

    // As variações (12%, 15%, 8%, 50%) do HTML são demonstrativas: a API ainda
    // não fornece esse dado. Enquanto isso, ficam escondidas para não parecerem reais.
    const MOSTRAR_VARIACOES = false;

    // Cenários de teste do mock, escolhidos pela URL: dashboard.html?cenario=emergency

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

    const avisoAntigoPadrao = $('avisoAntigo').textContent.trim();

    /* ---------- Estado da conexão e dos dados ---------- */

    const isOnline = () => navigator.onLine;

    // Data inválida também conta como "antiga".
    const isOld = iso => !Number.isFinite(Date.parse(iso)) || Date.parse(iso) > Date.now() + 5000 || Date.now() - Date.parse(iso) > CONFIG.STALE_AFTER;

    const dashboardStale = () =>
        monitorStale ||
        !isOnline() ||
        Boolean(errorMessage) ||
        Boolean(dashboard?.atualizado_em && isOld(dashboard.atualizado_em));

    // Não afirmamos que a esteira está bem quando não temos leitura confiável.
    /**
     * Determina a apresentação da esteira somente quando conexão, consulta e leitura estão atuais.
     * @returns {object} Rótulos e classes do estado ou indicação de falta de comunicação.
     */
    function beltEstado() {
        const belt = dashboard?.esteira;

        if (!dashboard || dashboardStale()) {
            return { ...SEM_COMUNICACAO, texto: dashboard ? SEM_COMUNICACAO.texto : 'Aguardando dados' };
        }

        if (belt && !belt.ultima_leitura) return { ...SEM_COMUNICACAO, texto: belt.estado_texto || 'Estado não informado', rotulo: 'Sem horário de leitura' };
        if (!belt || belt.conectada === false || isOld(belt.ultima_leitura)) {
            return SEM_COMUNICACAO;
        }

        return ESTADOS[belt.estado] || SEM_COMUNICACAO;
    }

    /* ---------- Desenho da tela ---------- */

    /**
     * Converte kg em toneladas e mantém indicadores ausentes sem valor; esconde variações não fornecidas.
     * @returns {void}
     */
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

    /**
     * Aplica rótulos e classes derivados da leitura confiável, sem comandar equipamento.
     * @returns {void}
     */
    function renderEsteira() {
        const estado = beltEstado();

        $('pontoEsteira').className = `ponto ponto--${estado.ponto}`;
        $('badgeEsteira').className = `badge badge--${estado.badge}`;
        setText('#textoEsteira', estado.texto);
        setText('#badgeEsteira', estado.rotulo);
    }

    /**
     * Exibe horário disponível e bloqueia atualização concorrente ou offline.
     * @returns {void}
     */
    function renderAtualizacao() {
        if (dashboard) {
            setTime('#ultimaAtualizacao', dashboard.atualizado_em || consultedAt);
        } else {
            setText('#ultimaAtualizacao', 'Aguardando primeira atualização');
            $('ultimaAtualizacao').removeAttribute('datetime');
        }

        $('btnAtualizar').disabled = busy || !isOnline();
        $('btnAtualizar').setAttribute('aria-busy', String(busy));
    }

    /**
     * Distingue falta de rede de dados antigos e preserva mensagem de erro controlada.
     * @returns {void}
     */
    function renderAvisos() {
        const online = isOnline();
        const stale = dashboardStale();

        $('avisoOffline').classList.toggle('is-visivel', !online);
        $('avisoAntigo').classList.toggle('is-visivel', online && stale);

        $('avisoAntigo').textContent = errorMessage
            ? `${errorMessage} Os dados exibidos podem não representar o estado atual.`
            : avisoAntigoPadrao;
    }

    /**
     * Redesenha indicadores e barras proporcionais ao maior valor real da série em kg.
     * @returns {void}
     */
    function render() {
        renderKpis();
        const rows = dashboard?.producao_diaria ?? [];
        const bars = document.querySelector('.barras');
        const labels = document.querySelector('.rotulos');
        bars.replaceChildren(); labels.replaceChildren();
        const values = rows.map(row => row.total_kg ?? row.plastico_kg + row.metal_kg);
        const max = Math.max(1, ...values);
        rows.forEach((row, i) => {
            const bar = document.createElement('div'); bar.className = 'barra';
            bar.style.setProperty('--h', `${values[i] / max * 100}%`); bars.append(bar);
            const label = document.createElement('span'); label.textContent = row.data.slice(5); labels.append(label);
        });
        bars.setAttribute('aria-label', rows.length ? 'Massa produzida por data de início dos registros' : 'Informação indisponível');
        setText('.grafico__titulo', 'Produção diária');
        setText('.grafico__total', rows.length ? `${tonnes(values.reduce((a, b) => a + b, 0))} t` : 'Informação indisponível');
        renderEsteira();
        renderAtualizacao();
        renderAvisos();

    }


    let monitorStale = true, consultedAt = null;
    document.getElementById('selectPeriodo')?.addEventListener('change', render);
    return monitor('dashboard', state => {
        dashboard = state.data; errorMessage = state.error; busy = state.busy;
        monitorStale = state.stale; consultedAt = state.consultedAt;
        render();
        const time = document.getElementById('ultimaAtualizacao');
        if (time) time.title = 'Horário da consulta. A última leitura do equipamento pode ser anterior.';
    });
}
