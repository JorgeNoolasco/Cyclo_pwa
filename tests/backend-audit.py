"""Auditoria isolada dos routers oficiais, sem banco, deploy ou alteração remota.

Requer fastapi e httpx no ambiente Python. Baixa somente fontes públicas de um
commit fixo para test-results; não baixa .env, credenciais ou código de banco.
"""
from pathlib import Path
from urllib.request import urlopen
import json
import sys

SHA = '4de534fa7ff8c5804c3b763c6a9863f642d19b99'
ROOT = Path(__file__).resolve().parents[1] / 'test-results' / 'backend-source'
MODULES = ['auth', 'lotes', 'producao', 'equipamentos', 'fornecedores']
for directory in ['routers', 'schemas']:
    (ROOT / directory).mkdir(parents=True, exist_ok=True)
    (ROOT / directory / '__init__.py').write_text('', encoding='utf-8')
    for module in MODULES:
        target = ROOT / directory / f'{module}.py'
        url = f'https://raw.githubusercontent.com/lorrainemontini-ai/EcoCycle_platform_backend/{SHA}/{directory}/{module}.py'
        with urlopen(url, timeout=20) as response:
            target.write_bytes(response.read())

sys.path.insert(0, str(ROOT))
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers import auth, lotes, producao, equipamentos, fornecedores

app = FastAPI()
for module in [auth, lotes, producao, equipamentos, fornecedores]:
    app.include_router(module.router)
client = TestClient(app)
results = []
for route, expected in [('/api/dashboard', 404), ('/api/alertas', 404),
    ('/api/lotes', 200), ('/api/producao', 200), ('/api/producao/dashboard-diario', 200),
    ('/api/equipamentos', 200), ('/api/fornecedores', 200)]:
    response = client.get(route)
    assert response.status_code == expected
    results.append({'method': 'GET', 'path': route, 'status': response.status_code,
        'without_token': True, 'keys': list(response.json())})
for route, body, expected in [('/api/auth/login', {'login': 'invalid', 'senha': 'invalid'}, 404),
    ('/api/login', {'login': 'invalid', 'senha': 'invalid'}, 422),
    ('/api/login', {'usuario': 'invalid', 'senha': 'invalid'}, 401),
    # Credenciais demonstrativas já presentes no código público, somente neste teste local.
    ('/api/login', {'usuario': 'admin', 'senha': '123456'}, 200)]:
    response = client.post(route, json=body)
    assert response.status_code == expected
    if expected == 200:
        assert 'token' not in response.json() and 'expira_em' not in response.json()
    results.append({'method': 'POST', 'path': route, 'status': response.status_code,
        'body_shape': list(body), 'response_keys': list(response.json())})
report = {'sha': SHA, 'scope': 'Routers oficiais isolados; armazenamento simulado original; sem banco/deploy', 'results': results}
(ROOT.parent / 'backend-audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(f'{len(results)} verificações executadas; bloqueios do backend confirmados. Não comprova integração de produção.')
