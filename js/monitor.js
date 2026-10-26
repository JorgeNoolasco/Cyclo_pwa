/** @file Coordena polling, visibilidade, reconexão e descarte de dados privados ao desmontar uma tela. */
import { CONFIG } from './config.js';
import { request, ApiError } from './api.js';
import { getSession, logout } from './auth.js';

// Um monitor por tela. Nenhum dado privado sobrevive à desmontagem.
/**
 * Inicia consultas serializadas; pausa em aba oculta e encerra sessão em HTTP 401.
 * @param {string} kind - dashboard ou alerts.
 * @param {Function} render - Recebe data, error, busy, consultedAt e stale; 403 elimina dados anteriores.
 * @returns {Function} Limpeza que aborta rede, listeners, intervalos e referências privadas.
 */
export function monitor(kind, render) {
    const listeners = new AbortController();
    let controller, generation = 0, stopped = false;
    let state = { data: null, error: '', busy: false, consultedAt: null };
    /**
 * Calcula obsolescência pelo horário da consulta e publica cópia do estado; oculta contadores não confiáveis.
 * @returns {void}
 */
function paint() {
        if (!stopped) render({ ...state, stale: !navigator.onLine || Boolean(state.error) ||
            !state.consultedAt || Date.now() - Date.parse(state.consultedAt) > CONFIG.STALE_AFTER });
        if (!stopped && kind === 'dashboard') document.querySelectorAll('.badge-contador').forEach(node => {
            const count = state.data?.alertas_ativos;
            node.hidden = !Number.isSafeInteger(count) || Boolean(state.error) || !navigator.onLine;
            node.textContent = Number.isSafeInteger(count) ? String(count) : '';
        });
    }
    /**
 * Invalida respostas pendentes antes de abortar a rede, impedindo atualização após troca de tela.
 * @returns {void}
 */
function cancel() { generation++; controller?.abort(); controller = null; state.busy = false; }
    /**
 * Consulta somente com sessão, aba visível e sem outra requisição; diferencia expiração, proibição e falha transitória.
 * @returns {Promise<void>} Erros controlados são refletidos no estado da tela.
 */
async function refresh() {
        if (stopped || state.busy || document.visibilityState !== 'visible') return;
        const session = getSession();
        if (!session) return;
        if (!navigator.onLine) { paint(); return; }
        const current = ++generation;
        controller = new AbortController(); state.busy = true; paint();
        try {
            const data = await request(kind, { token: session.token, active: false, signal: controller.signal });
            if (stopped || current !== generation || !getSession()) return;
            state.data = data; state.error = ''; state.consultedAt = new Date().toISOString();
        } catch (error) {
            if (stopped || current !== generation || error.name === 'AbortError') return;
            if (error.status === 401) { logout('Sua sessão expirou. Entre novamente.'); return; }
            if (error.status === 403) { state.data = null; state.consultedAt = null; }
            state.error = error instanceof ApiError ? error.message : 'Não foi possível consultar os dados.';
        } finally {
            if (!stopped && current === generation) { state.busy = false; controller = null; paint(); }
        }
    }
    document.getElementById('btnAtualizar')?.addEventListener('click', refresh, { signal: listeners.signal });
    window.addEventListener('offline', () => { cancel(); paint(); }, { signal: listeners.signal });
    window.addEventListener('online', refresh, { signal: listeners.signal });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancel(); else { paint(); void refresh(); }
    }, { signal: listeners.signal });
    const polling = setInterval(refresh, CONFIG.POLL_INTERVAL);
    const freshness = setInterval(() => { if (!document.hidden) paint(); }, 1000);
    paint(); void refresh();
    return () => {
        stopped = true; cancel(); listeners.abort(); clearInterval(polling); clearInterval(freshness);
        state = { data: null, error: '', busy: false, consultedAt: null };
    };
}
