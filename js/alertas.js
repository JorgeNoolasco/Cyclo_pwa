import { element, panel, icon, dateTime, empty } from './ui.js';

// A lista é somente de leitura. A resolução de alertas pertence à equipe de operação.
export function renderAlerts(alerts, active, onFilter, unavailable, updated) {
  const section = panel('ACOMPANHAMENTO OPERACIONAL', 'Eventos e alertas');
  const filter = element('div', 'segmented'); filter.setAttribute('aria-label', 'Filtrar alertas');
  for (const [label, value] of [['Ativos', true], ['Todos', false]]) {
    const button = element('button', '', label); button.type = 'button';
    button.setAttribute('aria-pressed', String(active === value));
    button.addEventListener('click', () => onFilter(value)); filter.append(button);
  }
  section.append(filter, element('p', 'muted', 'Mais recentes primeiro. Resolução realizada pela equipe responsável.'));
  if (updated) section.append(element('p', unavailable ? 'stale' : 'muted', `${unavailable ? 'Consulta anterior' : 'Consultado em'}: ${dateTime(updated)}`));
  if (alerts === null) { section.append(empty('Não foi possível consultar os alertas.')); return section; }
  if (!alerts.length) { section.append(empty(active ? 'Não há alertas ativos.' : 'Nenhum alerta foi disponibilizado.')); return section; }
  const labels = { TEMPERATURA_ALTA: 'Temperatura alta', PARADA: 'Parada da esteira', EMERGENCIA: 'Emergência' };
  const list = element('div', 'alerts-list');
  for (const row of [...alerts].sort((a, b) => Date.parse(b.data_hora) - Date.parse(a.data_hora))) {
    const article = element('article', 'alert-row');
    const symbol = element('span', `alert-icon ${row.prioridade === 'ALTA' ? 'danger' : 'warn'}`); symbol.append(icon('alert'));
    const description = element('div', 'alert-description');
    description.append(element('h3', '', labels[row.tipo]), element('p', 'muted', `${row.equipamento} · ${dateTime(row.data_hora)}`));
    article.append(symbol, description, element('span', 'priority', `Prioridade ${row.prioridade.toLowerCase()}`), element('span', `tag ${row.resolvido ? 'good' : 'warn'}`, row.resolvido ? 'Resolvido' : 'Pendente'));
    list.append(article);
  }
  section.append(list);
  return section;
}
