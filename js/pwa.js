/** @file Gerencia instalação por gesto do usuário e registra cache estático somente em contexto seguro. */
let installPrompt = null;
let installed = matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; });
window.addEventListener('appinstalled', () => { installed = true; installPrompt = null; bindInstall(); });
/**
 * Vincula o botão do template atual ao prompt nativo; orienta instalação manual quando indisponível.
 * @returns {void} A recusa ou falha de instalação mantém a aplicação web utilizável.
 */
export function bindInstall() {
    const button = document.querySelector('[data-install]');
    if (!button) return;
    button.hidden = installed;
    const message = document.getElementById('installMessage');
    if (installed && message) message.textContent = 'Aplicativo instalado. Abra pelo ícone do dispositivo.';
    button.onclick = async () => {
        if (installed) return;
        if (installPrompt) {
            const prompt = installPrompt; installPrompt = null; button.disabled = true;
            try { await prompt.prompt(); await prompt.userChoice; }
            catch { if (message) message.textContent = 'Instalação não concluída. Use o menu do navegador.'; }
            finally { button.disabled = false; }
        } else if (message) {
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            message.textContent = ios
                ? 'No Safari, toque em Compartilhar → Adicionar à Tela de Início. Se a opção não aparecer neste navegador, abra esta página no Safari.'
                : 'Abra o menu do navegador e procure Instalar aplicativo ou Adicionar à tela inicial. Se não estiver disponível, continue usando a versão web.';
        }
    };
}
if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
        const message = document.getElementById('installMessage');
        if (message) message.textContent = 'Não foi possível preparar o aplicativo offline. Reabra com conexão.';
    });
}
