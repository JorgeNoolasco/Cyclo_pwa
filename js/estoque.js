import { element, panel, number, metrics, production, empty } from './ui.js';

// O estoque inclui somente plástico e metal; rejeitos nunca entram neste saldo.
export function renderStock(data) {
  if (!data) return empty();
  const content = element('div', 'page-stack');
  const grid = element('div', 'dashboard-grid');
  const section = panel('MATERIAIS RECUPERADOS', 'Composição do estoque');
  const total = data.estoque.plastico_kg + data.estoque.metal_kg;
  section.append(element('p', 'stock-total', `${number(total)} kg`), element('p', 'muted', 'disponíveis em estoque'));
  for (const [label, quantity] of [['Plástico', data.estoque.plastico_kg], ['Metal', data.estoque.metal_kg]]) {
    const row = element('div', 'stock-row');
    row.append(element('span', '', label), element('strong', '', `${number(quantity)} kg`));
    const progress = element('progress'); progress.max = total || 1; progress.value = quantity;
    progress.setAttribute('aria-label', `${label}: ${number(quantity)} kg`);
    section.append(row, progress);
  }
  section.append(element('p', 'panel-footnote', `Total recuperado informado: ${number(data.plastico_recuperado_kg + data.metal_recuperado_kg)} kg. O rejeito não compõe o saldo.`));
  grid.append(production(data), section); content.append(metrics(data), grid);
  return content;
}
