import { login, logout } from './auth.js';
import { ApiError } from './api.js';
export function mount({ navigate, reason }) {
    const form = document.getElementById('formLogin');
    const password = document.getElementById('senha');
    const message = document.getElementById('mensagemLogin');
    const button = form.querySelector('[type="submit"]');
    let disposed = false, completed = false;
    const controller = new AbortController();
    message.textContent = reason || '';
    document.getElementById('mostrarSenha').addEventListener('click', event => {
        const show = password.type === 'password'; password.type = show ? 'text' : 'password';
        const toggle = event.currentTarget;
        toggle.setAttribute('aria-label', show ? 'Ocultar senha' : 'Mostrar senha');
        toggle.setAttribute('aria-pressed', String(show));
        const icon = document.createElement('i'); icon.dataset.lucide = show ? 'eye-off' : 'eye';
        toggle.replaceChildren(icon); window.lucide?.createIcons();
    });
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (button.disabled) return;
        button.disabled = true; message.textContent = 'Entrando…';
        const secret = password.value; password.value = '';
        try {
            if (!navigator.onLine) throw new Error('Sem conexão. Conecte-se para entrar.');
            const success = await login(document.getElementById('nome').value.trim(), secret, controller.signal);
            if (!disposed && success) { completed = true; void navigate('dashboard', true); }
        } catch (error) {
            if (!disposed) message.textContent = error instanceof ApiError || error.message.startsWith('Sem conexão') || error.message.startsWith('A sessão') ? error.message : 'Não foi possível entrar. Tente novamente.';
        } finally { if (!disposed) button.disabled = false; }
    });
    document.getElementById('linkEsqueci').addEventListener('click', event => {
        event.preventDefault(); message.textContent = 'Solicite a recuperação de acesso ao administrador da EcoCycle.';
    });
    return () => { disposed = true; controller.abort(); password.value = ''; if (!completed) logout('', false); };
}
