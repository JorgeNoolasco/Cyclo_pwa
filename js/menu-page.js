/** @file Preenche a identificação da sessão e conecta ações de sair e abrir informações do aplicativo. */
import { getSession, logout } from './auth.js';
/**
 * Monta a tela no template atual. Preenche a identificação da sessão e conecta ações de sair e abrir informações do aplicativo.
 * @returns {void} Ações vinculadas aos elementos da tela.
 */
export function mount() {
    const session = getSession();
    document.querySelectorAll('.badge-contador').forEach(node => { node.hidden = true; });
    document.getElementById('nomeCompleto').textContent = session?.nome || '';
    document.getElementById('cargoUsuario').textContent = session?.perfil || '';
    document.getElementById('emailUsuario').textContent = 'Acesso de consulta';
    const dialog = document.getElementById('dialogoSobre');
    document.getElementById('btnSobre').addEventListener('click', () => dialog.showModal());
    document.getElementById('btnFecharSobre').addEventListener('click', () => dialog.close());
    document.getElementById('btnSair').addEventListener('click', () => logout());
}
