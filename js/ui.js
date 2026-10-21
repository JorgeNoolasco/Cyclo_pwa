// Utilitários de apresentação: dados externos entram sempre como texto, nunca como HTML.
export function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
export const number = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
export const dateTime = value => new Date(value).toLocaleString('pt-BR');
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `assets/icons/symbols.svg#${name}`);
  svg.append(use);
  return svg;
}
export function panel(kicker, title) {
  const section = element('section', 'panel');
  section.append(element('span', 'eyebrow', kicker), element('h2', '', title));
  return section;
}
export function empty(text = 'Nenhum dado disponível no momento.') {
  const box = element('div', 'empty');
  box.append(icon('box'), element('h2', '', 'Sem dados'), element('p', '', text));
  return box;
}
export function metrics(data) {
  const grid = element('div', 'metrics');
  const items = [
    ['Total processado', data.total_processado_kg, 'Volume informado pela operação', 'layers'],
    ['Plástico recuperado', data.plastico_recuperado_kg, 'Material reinserido no ciclo', 'recycle'],
    ['Metal recuperado', data.metal_recuperado_kg, 'Recuperação de matéria-prima', 'layers'],
    ['Estoque atual', data.estoque.plastico_kg + data.estoque.metal_kg, 'Plástico + metal · sem rejeitos', 'box']
  ];
  for (const [label, value, detail, name] of items) {
    const card = element('article', 'metric');
    const top = element('div', 'metric-top');
    top.append(element('h2', '', label), icon(name));
    const amount = element('p', 'metric-value', number(value));
    amount.append(element('small', '', ' kg'));
    card.append(top, amount, element('p', 'muted', detail));
    grid.append(card);
  }
  return grid;
}
export function production(data) {
  const section = panel('VISÃO DA PRODUÇÃO', 'Cada dia, um novo impacto');
  const rows = data.producao_diaria;
  if (!rows.length) { section.append(empty('A evolução diária ainda não foi disponibilizada.')); return section; }
  const chart = element('div', 'chart');
  chart.setAttribute('aria-hidden', 'true');
  const maximum = Math.max(1, ...rows.map(row => row.plastico_kg + row.metal_kg));
  for (const row of rows) {
    const column = element('div', 'chart-column');
    const track = element('div', 'bar-track');
    const stack = element('div', 'bar-stack');
    stack.style.height = `${(row.plastico_kg + row.metal_kg) / maximum * 100}%`;
    const metal = element('div', 'bar-metal');
    const plastic = element('div', 'bar-plastic');
    metal.style.flexGrow = row.metal_kg;
    plastic.style.flexGrow = row.plastico_kg;
    stack.append(metal, plastic); track.append(stack);
    column.append(element('span', 'chart-value', number(row.plastico_kg + row.metal_kg)), track,
      element('span', '', new Date(`${row.data}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })));
    chart.append(column);
  }
  const legend = element('div', 'legend');
  legend.append(element('span', 'plastic-label', 'Plástico'), element('span', 'metal-label', 'Metal'), element('span', 'muted', 'Volume em kg'));
  const details = element('details', 'chart-details');
  details.append(element('summary', '', 'Ver dados da produção'));
  const table = element('table');
  table.append(element('caption', '', 'Produção diária em kg'));
  const head = element('thead'); const header = element('tr');
  for (const label of ['Data', 'Plástico', 'Metal']) { const th = element('th', '', label); th.scope = 'col'; header.append(th); }
  head.append(header); table.append(head);
  const body = element('tbody');
  for (const row of rows) {
    const tr = element('tr');
    for (const value of [new Date(`${row.data}T12:00:00`).toLocaleDateString('pt-BR'), number(row.plastico_kg), number(row.metal_kg)]) tr.append(element('td', '', value));
    body.append(tr);
  }
  table.append(body); details.append(table);
  section.append(chart, legend, details);
  return section;
}
