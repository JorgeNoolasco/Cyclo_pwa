/**
 * Empacota somente recursos públicos, sem dependências de execução ou segredos.
 * API_URL e WEB_URL são variáveis públicas lidas do processo durante o build.
 * Para carregar um arquivo local: node --env-file=.env scripts/build.mjs.
 */
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { CONFIG } from '../js/config.js';
import { createHash } from 'node:crypto';

/**
 * Aceita somente uma origem HTTPS sem credenciais, parâmetros ou caminhos.
 * @param {string} value - Endereço público fornecido pelo ambiente.
 * @returns {string} Origem normalizada sem barra final.
 * @throws {Error} Quando a configuração não é segura para publicação.
 */
function origin(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
        url.pathname !== '/' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error('Configure uma origem HTTPS pública, sem caminho ou credenciais.');
    }
    return url.origin;
}

const config = { ...CONFIG, API_URL: origin(process.env.API_URL || CONFIG.API_URL),
    WEB_URL: origin(process.env.WEB_URL || CONFIG.WEB_URL), USE_MOCK: false };
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)));
const csp = vercel.headers[0].headers.find(header => header.key === 'Content-Security-Policy').value;
if (!csp.split(';').find(rule => rule.trim().startsWith('connect-src ')).split(/\s+/).includes(config.API_URL)) {
    throw new Error('Inclua a origem API_URL no connect-src de vercel.json antes do build.');
}
const root = new URL('../', import.meta.url);
const output = new URL('../dist/', import.meta.url);
await mkdir(output, { recursive: true });
// Lista explícita impede publicar testes, .env, documentação e metadados Git.
const files = (await readdir(root)).filter(name => name.endsWith('.html'));
for (const name of [...files, 'css', 'js', 'assets', 'manifest.json', 'sw.js']) {
    await cp(new URL(name, root), new URL(name, output), { recursive: true });
}
await writeFile(new URL('js/config.js', output),
    `// Configuração pública gerada no build; não editar.\nexport const CONFIG = Object.freeze(${JSON.stringify(config, null, 4)});\n`);
const login = await readFile(new URL('login.html', output), 'utf8');
await writeFile(new URL('login.html', output), login.replace(CONFIG.WEB_URL, config.WEB_URL));
/**
 * Calcula a identidade do shell para que mudanças de configuração renovem o cache.
 * @param {URL} directory - Diretório público do artefato.
 * @returns {Promise<void>} Alimenta o hash em ordem determinística.
 */
async function hashFiles(directory) {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a,b)=>a.name.localeCompare(b.name))) {
        const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
        if (entry.isDirectory()) await hashFiles(url);
        else { hash.update(url.pathname.slice(output.pathname.length)); hash.update(await readFile(url)); }
    }
}
const hash = createHash('sha256');
await hashFiles(output);
const worker = await readFile(new URL('sw.js', output), 'utf8');
await writeFile(new URL('sw.js', output), worker.replace('ecocycle-static-v5', `ecocycle-static-${hash.digest('hex').slice(0,16)}`));
console.log('Build estático concluído em dist; configuração pública e CSP verificadas.');
