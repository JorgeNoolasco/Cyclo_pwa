import { CONFIG } from './config.js';
import { element, panel, empty, dateTime } from './ui.js';

// Comunicação perdida invalida a aparência de operação normal, mesmo que o último estado fosse LIGADA.
export function conveyor(data, unavailable = false, full = false) {
  const section = panel('MONITORAMENTO', data.esteira ? `Esteira ${data.esteira.codigo}` : 'Monitoramento da esteira');
  const belt = data.esteira;
  if (!belt) { section.append(empty()); return section; }
  const unknown = unavailable || !belt.conectada || Date.now() - Date.parse(belt.ultima_leitura) > CONFIG.STALE_AFTER;
  const labels = { LIGADA: 'Em operação', DESLIGADA: 'Desligada', PARADA: 'Parada', EMERGENCIA: 'Emergência' };
  const status = unknown ? 'Sem comunicação atual' : labels[belt.estado];
  const color = unknown ? 'neutral' : belt.estado === 'LIGADA' ? 'good' : belt.estado === 'EMERGENCIA' ? 'danger' : 'warn';
  section.append(element('span', `status-pill ${color}`, status));
  const drawing = element('div', `belt-illustration ${!unknown && belt.estado === 'LIGADA' ? 'running' : ''}`);
  drawing.setAttribute('aria-hidden', 'true');
  for (const name of ['one', 'two', 'three']) drawing.append(element('div', `material-block block-${name}`));
  const line = element('div', 'belt-line');
  for (let i = 0; i < 8; i++) line.append(element('i'));
  drawing.append(line, element('div', 'belt-legs')); section.append(drawing);
  const grid = element('dl', 'belt-metrics');
  const pairs = [[`Temperatura${unknown ? ' anterior' : ''}`, belt.temperatura === null ? 'Sem dados' : `${belt.temperatura.toLocaleString('pt-BR')} °C`],
    ['Comunicação', unknown ? 'Indisponível' : 'Conectada']];
  if (full) pairs.push(['Material identificado', belt.material || 'Sem dados'], ['Última leitura', dateTime(belt.ultima_leitura)]);
  for (const [label, value] of pairs) { const group = element('div'); group.append(element('dt', '', label), element('dd', '', value)); grid.append(group); }
  section.append(grid);
  if (unknown) section.append(element('p', 'stale', `Leitura anterior: ${dateTime(belt.ultima_leitura)}. Não é possível confirmar o estado atual.`));
  section.append(element('p', 'panel-footnote', 'Somente monitoramento · sem controle do equipamento'));
  return section;
}
export function renderConveyor(data, unavailable) {
  if (!data) return empty();
  const content = element('div', 'page-stack');
  const note = panel('CONSULTA REMOTA', 'Informação para decisões conscientes');
  note.append(element('p', 'muted', 'Leituras com mais de 30 segundos são sinalizadas como desatualizadas. Esta aplicação não envia comandos para equipamentos industriais.'));
  content.append(conveyor(data, unavailable, true), note);
  return content;
}
