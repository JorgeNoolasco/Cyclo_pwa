/*
 * Filtros da tela de alertas.
 * Os cartões desta página são demonstrativos; não consultamos a API aqui.
 */
export function initAlertasPage() {
    const cartoes = [...document.querySelectorAll('.alerta')];
    const msgVazia = document.getElementById('mensagemVazia');
    const painelSituacao = document.getElementById('filtroSituacao');
    const btnFiltro = document.getElementById('btnFiltro');

    if (!cartoes.length || !msgVazia || !painelSituacao || !btnFiltro) return;

    let gravidade = 'todas';
    let situacao = 'todos';

    function aplicarFiltros() {
        let visiveis = 0;

        for (const cartao of cartoes) {
            const correspondeGravidade = gravidade === 'todas' || cartao.dataset.gravidade === gravidade;
            const correspondeSituacao = situacao === 'todos' || cartao.dataset.situacao === situacao;
            cartao.hidden = !(correspondeGravidade && correspondeSituacao);
            if (!cartao.hidden) visiveis++;
        }

        msgVazia.hidden = visiveis > 0;
    }

    document.querySelectorAll('[data-contador]').forEach(contador => {
        const valor = contador.dataset.contador;
        contador.textContent = valor === 'todas'
            ? String(cartoes.length)
            : String(cartoes.filter(cartao => cartao.dataset.gravidade === valor).length);
    });

    function ativarChip(seletor, botao) {
        document.querySelectorAll(seletor).forEach(item => item.classList.remove('is-ativo'));
        botao.classList.add('is-ativo');
    }

    document.querySelectorAll('[data-filtro-gravidade]').forEach(botao => {
        botao.addEventListener('click', () => {
            gravidade = botao.dataset.filtroGravidade;
            ativarChip('[data-filtro-gravidade]', botao);
            aplicarFiltros();
        });
    });

    document.querySelectorAll('[data-filtro-situacao]').forEach(botao => {
        botao.addEventListener('click', () => {
            situacao = botao.dataset.filtroSituacao;
            ativarChip('[data-filtro-situacao]', botao);
            aplicarFiltros();
        });
    });

    btnFiltro.addEventListener('click', () => {
        const abrir = painelSituacao.hidden;
        painelSituacao.hidden = !abrir;
        btnFiltro.setAttribute('aria-expanded', String(abrir));
    });

    // Os cartões são links apenas por causa do estilo; não abrem uma tela de detalhe.
    cartoes.forEach(cartao => cartao.addEventListener('click', event => event.preventDefault()));
    aplicarFiltros();
    window.lucide?.createIcons();
}

initAlertasPage();
