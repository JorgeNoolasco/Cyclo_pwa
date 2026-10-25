
import { request } from './api.js';

// Guarda os dados da sessão atual.
let session = null;
let expirationTimer;
let generation = 0;

// Retorna a sessão se ela ainda estiver válida.
export function getSession() {
    if (session && Date.parse(session.expira_em) <= Date.now()) {
        logout('Sua sessão expirou. Entre novamente.');
    }

    return session;
}

// Envia o nome de usuário e a senha para a API.
export async function login(nome, senha, signal) {
    const current = ++generation;

    const next = await request('login', {
        signal,
        body: {
            login: nome,
            senha: senha
        }
    });

    // Impede que uma tentativa antiga substitua a mais recente.
    if (current !== generation) {
        return false;
    }

    if (Date.parse(next.expira_em) <= Date.now()) {
        throw new Error('A sessão recebida já expirou.');
    }

    session = next;

    clearInterval(expirationTimer);

    // Verifica periodicamente se a sessão expirou.
    expirationTimer = setInterval(getSession, 1000);

    return true;
}

// Encerra a sessão atual.
export function logout(reason = '', notify = true) {
    generation++;
    session = null;

    clearInterval(expirationTimer);

    if (notify) window.dispatchEvent(
        new CustomEvent('session-ended', {
            detail: reason
        })
    );
}

// Verifica a sessão quando a visibilidade da página muda.
document.addEventListener('visibilitychange', getSession);
