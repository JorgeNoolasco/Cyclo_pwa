// Dados exclusivamente demonstrativos. O modo real nunca usa este retorno como fallback.
let scenario = 'normal';
export function setScenario(value) { scenario = value; }
export function getScenario() { return scenario; }

export function makeDashboard(mode = scenario) {
  const now = Date.now();
  const reading = new Date(now - (mode === 'stale' ? 90000 : 0)).toISOString();
  return {
    atualizado_em: reading, total_processado_kg: 2840, plastico_recuperado_kg: 1680,
    metal_recuperado_kg: 920, estoque: { plastico_kg: 4250, metal_kg: 2180 }, alertas_ativos: 2,
    esteira: { codigo: 'EST-001', estado: ({ emergency: 'EMERGENCIA', stopped: 'PARADA', off: 'DESLIGADA' })[mode] || 'LIGADA',
      temperatura: mode === 'emergency' ? 82.5 : 38.4, ultima_leitura: reading, material: 'Plástico PET', conectada: mode !== 'disconnected' },
    producao_diaria: Array.from({ length: 7 }, (_, i) => ({ data: new Date(now - (6 - i) * 86400000).toISOString().slice(0, 10),
      plastico_kg: [1100, 1320, 980, 1480, 1250, 1560, 1680][i], metal_kg: [560, 640, 420, 720, 600, 780, 920][i] }))
  };
}

export async function mockRequest(kind, { body, active, signal } = {}) {
  // Capturamos o cenário no início para que uma troca durante o carregamento não misture dados.
  const mode = scenario;
  await new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException('Cancelado', 'AbortError')); return; }
    const cancel = () => { clearTimeout(timer); reject(new DOMException('Cancelado', 'AbortError')); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, 350);
    signal?.addEventListener('abort', cancel, { once: true });
  });
  if (['401', '403', '500', 'offline'].includes(mode)) return { status: mode === 'offline' ? 0 : Number(mode) };
  if (kind === 'login') {
    // Identificadores públicos de demonstração; não correspondem a uma conta real.
    if (body.login !== 'demo' || body.senha !== 'ecocycle-demo') return { status: 401 };
    return { status: 200, data: { token: crypto.randomUUID(), nome: 'Maria Souza', perfil: 'GERENTE', expira_em: new Date(Date.now() + 3600000).toISOString() } };
  }
  if (kind === 'dashboard') return { status: 200, data: mode === 'empty' ? null : makeDashboard(mode) };
  const data = mode === 'empty' ? [] : [
    { id: 'A-104', tipo: 'TEMPERATURA_ALTA', equipamento: 'EST-002', data_hora: new Date(Date.now() - 720000).toISOString(), resolvido: false, prioridade: 'ALTA' },
    { id: 'A-103', tipo: 'PARADA', equipamento: 'EST-003', data_hora: new Date(Date.now() - 2400000).toISOString(), resolvido: false, prioridade: 'MEDIA' },
    { id: 'A-102', tipo: 'EMERGENCIA', equipamento: 'EST-002', data_hora: new Date(Date.now() - 86400000).toISOString(), resolvido: true, prioridade: 'ALTA' }
  ];
  return { status: 200, data: data.filter(row => !active || !row.resolvido) };
}
