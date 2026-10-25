import { monitor } from './monitor.js';
import { element, dateTime, setText, setTime } from './ui.js';
const titles = { TEMPERATURA_ALTA: 'Temperatura elevada na esteira', PARADA: 'Esteira parada', EMERGENCIA: 'Emergência na esteira' };
export function mount() {
    let severity = 'todas', situation = 'todos', latest;
    const list = document.getElementById('listaAlertas');
    function render(state) {
        latest = state;
        const rows = state.data;
        list.replaceChildren();
        const visible = (rows || []).filter(row => (severity === 'todas' || row.prioridade?.toLowerCase() === severity) &&
            (situation === 'todos' || row.resolvido === (situation === 'resolvido')));
        visible.sort((a,b) => Date.parse(b.data_hora) - Date.parse(a.data_hora)).forEach(row => {
            const level = row.prioridade?.toLowerCase() || 'indisponivel';
            const card = element('article', `card alerta alerta--${level}`); card.dataset.id = String(row.id);
            const icon = element('div', 'alerta__icone');
            const glyph = element('i', 'icon'); glyph.dataset.lucide = 'triangle-alert'; icon.append(glyph);
            const body = element('div', 'alerta__corpo');
            const meta = element('p', 'alerta__meta', `${row.equipamento} · `);
            const time = element('time', '', dateTime(row.data_hora)); time.dateTime = row.data_hora; meta.append(time);
            body.append(element('h2', 'alerta__titulo', titles[row.tipo]), meta);
            const badges = element('div', 'alerta__badges');
            badges.append(element('span', `badge badge--${level}`, row.prioridade || 'Gravidade indisponível'),
                element('span', `badge badge--${row.resolvido ? 'resolvido' : 'ativo'}`, row.resolvido ? 'Resolvido' : 'Ativo'));
            card.append(icon, body, badges); list.append(card);
        });
        const empty = document.getElementById('mensagemVazia'); empty.hidden = visible.length > 0;
        empty.textContent = rows === null ? (state.busy ? 'Carregando alertas…' : 'Informação indisponível') : 'Nenhum alerta encontrado com esses filtros.';
        document.querySelectorAll('[data-contador]').forEach(node => {
            node.textContent = rows === null ? '—' : String(rows.filter(row => node.dataset.contador === 'todas' || row.prioridade?.toLowerCase() === node.dataset.contador).length);
        });
        setText('.badge-contador', rows === null ? '—' : rows.filter(row => !row.resolvido).length);
        if (state.consultedAt) setTime('#ultimaAtualizacao', state.consultedAt);
        else setText('#ultimaAtualizacao', 'Aguardando dados');
        document.getElementById('avisoOffline').classList.toggle('is-visivel', !navigator.onLine);
        document.getElementById('avisoAntigo').classList.toggle('is-visivel', navigator.onLine && state.stale);
        setText('#avisoAntigo', state.error || 'Dados desatualizados ou ainda indisponíveis.');
        document.getElementById('btnAtualizar').disabled = state.busy || !navigator.onLine;
        window.lucide?.createIcons();
    }
    for (const type of ['gravidade', 'situacao']) document.querySelectorAll(`[data-filtro-${type}]`).forEach(button => {
        button.addEventListener('click', () => {
            if (type === 'gravidade') severity = button.dataset.filtroGravidade; else situation = button.dataset.filtroSituacao;
            document.querySelectorAll(`[data-filtro-${type}]`).forEach(node => { node.classList.toggle('is-ativo', node === button); node.setAttribute('aria-pressed', String(node === button)); });
            render(latest);
        });
    });
    document.getElementById('btnFiltro').addEventListener('click', event => {
        const panel = document.getElementById('filtroSituacao'); panel.hidden = !panel.hidden;
        event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    });
    return monitor('alerts', render);
}
