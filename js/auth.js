/** @file Gerencia sessão volátil, expiração e descarte de respostas antigas; autorização efetiva pertence à API. */

import { request } from './api.js';

// Guarda os dados da sessão atual.
let session = null;
let expirationTimer;
let generation = 0;

// Retorna a sessão se ela ainda estiver válida.
/**
 * Consulta a sessão e encerra imediatamente uma sessão cujo prazo já venceu.
 * @returns {object|null} Sessão em memória ou null; nenhum dado é lido de armazenamento persistente.
 */
export function getSession() {
    if (session && Date.parse(session.expira_em) <= Date.now()) {
        logout('Sua sessão expirou. Entre novamente.');
    }

    return session;
}

// Envia o nome de usuário e a senha para a API.
/**
 * Autentica e impede que uma resposta tardia restaure sessão após logout ou outra tentativa.
 * @param {string} nome - Nome de usuário digitado.
 * @param {string} senha - Segredo enviado somente no corpo HTTPS.
 * @param {AbortSignal} [signal] - Cancelamento ao sair da tela.
 * @returns {Promise<boolean>} true se a sessão foi aceita; false se a tentativa ficou obsoleta.
 * @throws {Error} Falha da API ou sessão já expirada.
 */
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
/**
 * Descarta token e temporizador; invalida tentativas pendentes antes de avisar o roteador.
 * @param {string} [reason] - Mensagem pública para a próxima tela de login.
 * @param {boolean} [notify=true] - Controla o evento session-ended.
 * @returns {void}
 */
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
