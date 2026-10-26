/**
 * Auditoria não destrutiva do deployment real: disponibilidade, proteção e CORS.
 * Não envia credenciais nem cria registros. A origem auditada é o portal web;
 * PWA_ORIGIN permite verificar também a origem efetiva do PWA, quando conhecida.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { CONFIG } from '../js/config.js';
const results = [];
/**
 * Registra status e headers CORS sem persistir corpos potencialmente privados.
 * @param {string} path - Caminho na API oficial.
 * @param {object} [options] - Método e headers de uma consulta sem autenticação.
 * @returns {Promise<void>} Falhas de transporte são registradas no relatório.
 */
async function inspect(path, options = {}) {
    try {
        const response = await fetch(CONFIG.API_URL+path,{...options,signal:AbortSignal.timeout(15000)});
        results.push({path,method:options.method||'GET',origin:options.headers?.Origin,
            status:response.status,cors:{origin:response.headers.get('access-control-allow-origin'),
                methods:response.headers.get('access-control-allow-methods'),headers:response.headers.get('access-control-allow-headers')}});
    } catch(error) { results.push({path,error:error.message}); }
}
await inspect('/');
await inspect('/openapi.json');
await inspect('/api/producao');
await inspect('/api/equipamentos');
await inspect('/api/alertas');
// A investigação atual usa somente GET/OPTIONS, sem tentativa de login em produção.
for (const origin of new Set([CONFIG.WEB_URL,process.env.PWA_ORIGIN].filter(Boolean))) {
    for (const [path,method] of [['/api/login','POST'],['/api/producao','GET'],['/api/equipamentos','GET'],['/api/alertas','GET']]) {
        await inspect(path,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':method,
            'Access-Control-Request-Headers':'authorization,content-type'}});
    }
}
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
await writeFile(new URL('../test-results/production-audit.json',import.meta.url),JSON.stringify({date:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results,null,2));
