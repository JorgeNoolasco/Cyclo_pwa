/** @file Exibe a última leitura disponível; idade, erro e falta de rede tornam o estado não confiável. */
import { CONFIG } from './config.js';
import { setText, setTime, number } from './ui.js';
import { monitor } from './monitor.js';

/**
 * Monta a tela no template atual. Exibe a última leitura disponível; idade, erro e falta de rede tornam o estado não confiável.
 * @returns {Function} Rotina de limpeza chamada pelo roteador ao sair da tela.
 */
export function mount() {

    const $ = id => document.getElementById(id);
    const campo = nome => document.querySelector(`[data-campo="${nome}"]`);
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

    const online = () => navigator.onLine;
    const dataAntiga = valor => !Number.isFinite(Date.parse(valor)) || Date.parse(valor) > Date.now() + 5000 || Date.now() - Date.parse(valor) > CONFIG.STALE_AFTER;

    /**
     * Rejeita leitura antiga, futura, desconectada ou com erro antes de selecionar um estado visual.
     * @returns {object} Rótulos e classes de estado.
     */
    function estadoAtual() {
        const belt = dataAtual?.esteira;
        if (monitorStale || !belt || !online() || erro || belt.conectada === false) return SEM_COMUNICACAO;
        if (!belt.ultima_leitura) return { ...SEM_COMUNICACAO, texto: belt.estado_texto || 'Estado não informado', rotulo: 'Sem horário de leitura' };
        if (dataAntiga(belt.ultima_leitura)) return SEM_COMUNICACAO;
        return ESTADOS[belt.estado] || SEM_COMUNICACAO;
    }

    /**
     * Atualiza medições e avisos; campos não fornecidos continuam indisponíveis e o horário não é inventado.
     * @returns {void}
     */
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
        const nome = belt?.nome || (belt?.codigo ? `Esteira ${belt.codigo}` : 'Esteira');
        setText('#nomeEsteira', nome);
        const nomeEquipamento = document.querySelector('.card-link__nome');
        if (nomeEquipamento) nomeEquipamento.textContent = nome;

        const temperatura = belt?.temperatura;
        setText('[data-campo="temperatura"]', temperatura == null ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(temperatura));
        // GET /api/equipamentos fornece km/h, não porcentagem; produção por equipamento não existe.
        setText('[data-campo="velocidade"]', number(belt?.velocidade));
        setText('[data-campo="producao"]', '—');

        const ultimaLeitura = belt?.ultima_leitura;
        if (ultimaLeitura) {
            const horario = new Date(ultimaLeitura);
            setText('[data-campo="horario"]', Number.isFinite(horario.getTime()) ? horario.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
        } else {
            setText('[data-campo="horario"]', '—');
        }

        if (dataAtual && consultedAt) setTime('#ultimaAtualizacao', dataAtual.atualizado_em || consultedAt);
        else {
            setText('#ultimaAtualizacao', 'Aguardando dados');
            $('ultimaAtualizacao')?.removeAttribute('datetime');
        }

        const stale = monitorStale || !online() || Boolean(erro) || !belt || belt.conectada === false || dataAntiga(belt?.ultima_leitura);
        $('avisoOffline')?.classList.toggle('is-visivel', !online());
        $('avisoAntigo')?.classList.toggle('is-visivel', online() && stale);
        if ($('avisoAntigo')) $('avisoAntigo').textContent = erro ? `${erro} Os dados podem não representar o estado atual.` : !belt?.ultima_leitura ? 'A API não informa o horário da leitura. A atualidade das medições não pode ser confirmada.' : 'Os dados podem estar desatualizados.';
        $('telaEsteira')?.classList.toggle('esteira--sem-comunicacao', stale);

        const botao = $('btnAtualizar');
        if (botao) {
            botao.disabled = consultando || !online();
            botao.setAttribute('aria-busy', String(consultando));
        }
    }


    let monitorStale = true, consultedAt = null;
    document.getElementById('selectPeriodo')?.addEventListener('change', atualizarEstado);
    return monitor('equipment', state => {
        dataAtual = state.data ? { esteira: state.data } : null; erro = state.error; consultando = state.busy;
        monitorStale = state.stale; consultedAt = state.consultedAt;
        atualizarEstado();
        const time = document.getElementById('ultimaAtualizacao');
        if (time) time.title = 'Horário da consulta. A última leitura do equipamento pode ser anterior.';
    });
}
