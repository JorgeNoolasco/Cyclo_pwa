/** @file Reúne formatação brasileira e criação segura de elementos, incluindo componentes legados. */

/*
 * Funções auxiliares da interface.
 * Os dados externos são inseridos como texto, nunca como HTML.
 */

// Cria um elemento HTML.
/**
 * @param {string} tag - Tag HTML.
 * @param {string} [className] - Classes visuais.
 * @param {string} [text] - Texto tratado como texto, não HTML.
 * @returns {HTMLElement} Elemento pronto para inserção no DOM.
 */
export function element(tag, className = '', text = '') {
    const node = document.createElement(tag);

    node.className = className;
    node.textContent = text;

    return node;
}

// Formata números no padrão brasileiro.
/** @param {unknown} value - Quantidade a formatar. @returns {string} Número pt-BR ou travessão se ausente/inválido. */
export const number = value => {
    const numericValue = Number(value);

    if (value === null || value === undefined || value === '' ||
        !Number.isFinite(numericValue)) {
        return '—';
    }

    return new Intl.NumberFormat('pt-BR', {
        maximumFractionDigits: 1
    }).format(numericValue);
};

// Converte quilogramas para toneladas.
/** @param {unknown} value - Massa em kg. @returns {string} Massa dividida por mil, sem transformar ausência em zero. */
export const tonnes = value => {
    const numericValue = Number(value);

    if (value === null || value === undefined || value === '' ||
        !Number.isFinite(numericValue)) {
        return '—';
    }

    return number(numericValue / 1000);
};

// Formata uma data e hora no padrão brasileiro.
/** @param {string} value - Data ISO. @returns {string} Data no fuso do dispositivo ou mensagem de indisponibilidade. */
export const dateTime = value => {
    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        return 'Data indisponível';
    }

    return new Date(timestamp).toLocaleString('pt-BR');
};

// Atualiza o texto de um elemento existente.
/**
 * @param {string} selector - Seletor CSS.
 * @param {unknown} value - Valor exibido; ausência recebe tratamento visual.
 * @param {Document|Element} [root] - Raiz da busca.
 * @returns {boolean} Indica se foi possível atualizar o elemento.
 */
export function setText(selector, value, root = document) {
    const node = root.querySelector(selector);

    if (!node) {
        return false;
    }

    const unavailable = node.hasAttribute('data-campo') && (value == null || value === '—');
    node.textContent = unavailable ? 'Informação indisponível' : (value ?? '—');
    node.classList.toggle('valor-indisponivel', unavailable);
    if (node.nextElementSibling?.tagName === 'SMALL') node.nextElementSibling.hidden = unavailable;

    return true;
}

// Mostra ou esconde um elemento existente.
/**
 * @param {string} selector - Seletor CSS.
 * @param {boolean} visible - Visibilidade desejada.
 * @param {Document|Element} [root] - Raiz da busca.
 * @returns {boolean} Indica se foi possível atualizar o elemento.
 */
export function setVisible(selector, visible, root = document) {
    const node = root.querySelector(selector);

    if (!node) {
        return false;
    }

    node.hidden = !visible;

    return true;
}

// Atualiza o texto e o atributo datetime de um elemento <time>.
/**
 * @param {string} selector - Seletor do elemento time.
 * @param {string} value - Data ISO recebida.
 * @param {Document|Element} [root] - Raiz da busca.
 * @returns {boolean} Indica se foi possível atualizar o elemento.
 */
export function setTime(selector, value, root = document) {
    const node = root.querySelector(selector);

    if (!node) {
        return false;
    }

    const timestamp = Date.parse(value);

    if (!Number.isFinite(timestamp)) {
        node.textContent = 'Data indisponível';
        node.removeAttribute('datetime');

        return false;
    }

    const date = new Date(timestamp);

    node.textContent = date.toLocaleString('pt-BR');
    node.dateTime = date.toISOString();

    return true;
}

/*
 * Funções antigas de montagem de interface.
 * Mantidas até confirmarmos que os outros arquivos
 * não dependem mais delas.
 */

// Cria um ícone usando o arquivo SVG de símbolos.
/**
 * @param {string} name - Identificador no sprite SVG local.
 * @returns {SVGElement} Elemento pronto para inserção no DOM.
 */
export function icon(name) {
    const svg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
    );

    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');

    const use = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use'
    );

    use.setAttribute('href', `assets/icons/symbols.svg#${name}`);

    svg.append(use);

    return svg;
}

// Cria um painel com identificação e título.
/**
 * @param {string} kicker - Identificação secundária.
 * @param {string} title - Título textual.
 * @returns {HTMLElement} Elemento pronto para inserção no DOM.
 */
export function panel(kicker, title) {
    const section = element('section', 'panel');

    section.append(
        element('span', 'eyebrow', kicker),
        element('h2', '', title)
    );

    return section;
}

// Cria uma mensagem para situações sem dados.
/**
 * @param {string} [text] - Orientação quando não há dados.
 * @returns {HTMLElement} Elemento pronto para inserção no DOM.
 */
export function empty(text = 'Nenhum dado disponível no momento.') {
    const box = element('div', 'empty');

    box.append(
        icon('box'),
        element('h2', '', 'Sem dados'),
        element('p', '', text)
    );

    return box;
}

// Cria os cartões de indicadores da estrutura antiga.
/**
 * @param {object} [data] - Indicadores do componente legado, em kg.
 * @returns {HTMLElement} Elemento pronto para inserção no DOM.
 */
export function metrics(data = {}) {
    const grid = element('div', 'metrics');
    const estoque = data.estoque ?? {};

    const plasticoEstoque = Number(estoque.plastico_kg) || 0;
    const metalEstoque = Number(estoque.metal_kg) || 0;

    const items = [
        [
            'Total processado',
            data.total_processado_kg,
            'Volume informado pela operação',
            'layers'
        ],
        [
            'Plástico recuperado',
            data.plastico_recuperado_kg,
            'Material reinserido no ciclo',
            'recycle'
        ],
        [
            'Metal recuperado',
            data.metal_recuperado_kg,
            'Recuperação de matéria-prima',
            'layers'
        ],
        [
            'Estoque atual',
            plasticoEstoque + metalEstoque,
            'Plástico + metal · sem rejeitos',
            'box'
        ]
    ];

    for (const [label, value, detail, name] of items) {
        const card = element('article', 'metric');
        const top = element('div', 'metric-top');

        top.append(
            element('h2', '', label),
            icon(name)
        );

        const amount = element('p', 'metric-value', number(value));
        amount.append(element('small', '', ' kg'));

        card.append(
            top,
            amount,
            element('p', 'muted', detail)
        );

        grid.append(card);
    }

    return grid;
}

// Cria o gráfico e a tabela da estrutura antiga.
/**
 * @param {object} [data] - Série diária do componente legado, em kg.
 * @returns {HTMLElement} Elemento pronto para inserção no DOM.
 */
export function production(data = {}) {
    const section = panel(
        'VISÃO DA PRODUÇÃO',
        'Cada dia, um novo impacto'
    );

    const rows = Array.isArray(data.producao_diaria)
        ? data.producao_diaria
        : [];

    if (!rows.length) {
        section.append(
            empty('A evolução diária ainda não foi disponibilizada.')
        );

        return section;
    }

    const chart = element('div', 'chart');
    chart.setAttribute('aria-hidden', 'true');

    const totals = rows.map(row =>
        (Number(row.plastico_kg) || 0) +
        (Number(row.metal_kg) || 0)
    );

    const maximum = Math.max(1, ...totals);

    rows.forEach((row, index) => {
        const column = element('div', 'chart-column');
        const track = element('div', 'bar-track');
        const stack = element('div', 'bar-stack');

        const plastico = Number(row.plastico_kg) || 0;
        const metal = Number(row.metal_kg) || 0;
        const total = totals[index];

        stack.style.height = `${total / maximum * 100}%`;

        const metalBar = element('div', 'bar-metal');
        const plasticBar = element('div', 'bar-plastic');

        metalBar.style.flexGrow = metal;
        plasticBar.style.flexGrow = plastico;

        stack.append(metalBar, plasticBar);
        track.append(stack);

        const timestamp = Date.parse(`${row.data}T12:00:00`);
        const day = Number.isFinite(timestamp)
            ? new Date(timestamp).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit'
            })
            : '—';

        column.append(
            element('span', 'chart-value', number(total)),
            track,
            element('span', '', day)
        );

        chart.append(column);
    });

    const legend = element('div', 'legend');

    legend.append(
        element('span', 'plastic-label', 'Plástico'),
        element('span', 'metal-label', 'Metal'),
        element('span', 'muted', 'Volume em kg')
    );

    const details = element('details', 'chart-details');
    details.append(
        element('summary', '', 'Ver dados da produção')
    );

    const table = element('table');
    table.append(element('caption', '', 'Produção diária em kg'));

    const head = element('thead');
    const header = element('tr');

    for (const label of ['Data', 'Plástico', 'Metal']) {
        const th = element('th', '', label);
        th.scope = 'col';
        header.append(th);
    }

    head.append(header);
    table.append(head);

    const body = element('tbody');

    for (const row of rows) {
        const tr = element('tr');
        const timestamp = Date.parse(`${row.data}T12:00:00`);

        const day = Number.isFinite(timestamp)
            ? new Date(timestamp).toLocaleDateString('pt-BR')
            : '—';

        for (const value of [
            day,
            number(row.plastico_kg),
            number(row.metal_kg)
        ]) {
            tr.append(element('td', '', value));
        }

        body.append(tr);
    }

    table.append(body);
    details.append(table);
    section.append(chart, legend, details);

    return section;
}
