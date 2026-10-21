import { request } from './api.js';

// Sessão privada ao documento atual. Recarregar ou abrir outra aba exige novo login.
let session = null;
let expirationTimer;
let generation = 0;
export function getSession() {
  if (session && Date.parse(session.expira_em) <= Date.now()) logout('Sua sessão expirou. Entre novamente.');
  return session;
}
export async function login(loginName, password) {
  const current = ++generation;
  const next = await request('login', { body: { login: loginName, senha: password } });
  if (current !== generation) return false;
  if (Date.parse(next.expira_em) <= Date.now()) throw new Error('A sessão recebida já expirou.');
  session = next;
  clearTimeout(expirationTimer);
  // Conferir periodicamente também protege contra alteração do relógio e suspensão da aba.
  expirationTimer = setInterval(getSession, 1000);
  return true;
}
export function logout(reason = '') {
  generation++;
  session = null;
  clearInterval(expirationTimer);
  window.dispatchEvent(new CustomEvent('session-ended', { detail: reason }));
}
document.addEventListener('visibilitychange', getSession);
