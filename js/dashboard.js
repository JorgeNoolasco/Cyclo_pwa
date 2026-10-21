import { element, icon, metrics, production, empty } from './ui.js';
import { conveyor } from './esteira.js';

// Os totais oficiais são exibidos sem inventar métricas ou alterar cálculos do backend.
export function renderDashboard(data, unavailable) {
  if (!data) return empty();
  const content = element('div', 'page-stack');
  const welcome = element('section', 'welcome-strip');
  const message = element('div');
  message.append(element('span', 'eyebrow', 'CADA MATERIAL, UM NOVO COMEÇO'), element('h2', '', 'O ciclo continua. Acompanhe a transformação.'), element('p', '', 'Uma visão conectada da sua operação de reciclagem.'));
  welcome.append(message, icon('recycle'));
  const grid = element('div', 'dashboard-grid');
  grid.append(production(data), conveyor(data, unavailable));
  const alerts = element('a', 'alert-summary'); alerts.href = 'alertas.html'; alerts.dataset.route = 'alertas';
  const description = element('div');
  description.append(element('strong', '', data.alertas_ativos ? 'Alertas precisam da sua atenção' : 'Nenhum alerta ativo informado'), element('p', '', 'Consulte os eventos e seus equipamentos.'));
  alerts.append(element('span', 'alert-count', String(data.alertas_ativos)), description, icon('arrow'));
  content.append(welcome, metrics(data), grid, alerts);
  return content;
}
