/** @file Testa contratos confirmados no código backend; respostas sintéticas nunca vão para produção. */
import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {adaptProduction,adaptEquipment,adaptLogin,productionDay} from '../js/adapters.js';
import {request,validate} from '../js/api.js';
import {backendProduction,backendEquipment,backendAlerts,tokenResponse} from './fixtures.mjs';
const original = globalThis.fetch;
afterEach(()=>{globalThis.fetch=original;});

test('produção usa saída, aceita variantes de material e agrupa pela data de início',()=>{
    const value = backendProduction();
    value.registros_producao[0].data_inicio='2026-10-10T23:00:00-03:00';
    value.registros_producao[1].data_inicio='2026-10-10T08:00:00';
    const result=adaptProduction(value);
    assert.equal(result.total_processado_kg,750);
    assert.equal(result.plastico_recuperado_kg,500);
    assert.equal(result.metal_recuperado_kg,250);
    assert.deepEqual(result.producao_diaria,[{data:'2026-10-10',plastico_kg:500,metal_kg:250,total_kg:750}]);
    assert.deepEqual(result.estoque,{plastico_kg:null,metal_kg:null});
});
test('produção vazia tem totais zero reais; material desconhecido e data ausente não são inventados',()=>{
    assert.equal(adaptProduction({registros_producao:[]}).total_processado_kg,0);
    const input=backendProduction();
    input.registros_producao[0].data_inicio=null;
    input.registros_producao[0].tipo_material=null;
    const result=adaptProduction(input);
    assert.equal(result.datas_completas,false);
    assert.equal(result.plastico_recuperado_kg,null);
    assert.equal(result.total_processado_kg,750);
    assert.equal(result.producao_diaria[0].total_kg,250);
});
test('produção rejeita massa textual, negativos, duplicidade, envelope e datas inválidas',()=>{
    for(const bad of ['10',-1,null,Infinity]){
        const input=backendProduction();input.registros_producao[0].quantidade_saida_kg=bad;
        assert.throws(()=>adaptProduction(input));
    }
    const input=backendProduction();input.registros_producao.push(input.registros_producao[0]);
    assert.throws(()=>adaptProduction(input));
    assert.throws(()=>adaptProduction({registros_producao:null}));
    for(const date of ['2026-02-30T08:00:00','invalid',1])assert.throws(()=>productionDay(date));
});
test('equipamento preserva estado original, zero e unidades sem fabricar horário ou conectividade',()=>{
    const value=adaptEquipment({...backendEquipment(),status_esteira:'ESTEIRA DESLIGADA',velocidade_esteira_kmh:0});
    assert.equal(value.estado,'DESLIGADA');assert.equal(value.estado_texto,'ESTEIRA DESLIGADA');
    assert.equal(value.velocidade,0);assert.equal(value.ultima_leitura,null);assert.equal(value.conectada,null);
    assert.throws(()=>adaptEquipment({...backendEquipment(),temperatura_esteira_c:'38.5'}));
});
test('alerta singleton sem ID, tipo, data ou gravidade continua apresentável',()=>{
    const [row]=validate('alerts',backendAlerts());
    assert.equal(row.id,null);assert.equal(row.tipo,null);assert.equal(row.prioridade,null);
    assert.equal(row.data_hora,null);assert.equal(row.resolvido,false);assert.equal(row.equipamento,'Esteira Principal');
    assert.deepEqual(validate('alerts',{alertas:[]}),[]);
    assert.throws(()=>validate('alerts',{alertas:null}));
});
test('data de alerta sem fuso não recebe Z artificial',()=>{
    const input=backendAlerts();input.alertas.datahora_alerta='2026-10-26T11:05:00';
    const [row]=validate('alerts',input);
    assert.equal(row.data_hora,null);assert.equal(row.data_hora_texto,'2026-10-26T11:05:00');
});
test('filtro ativos ocorre localmente; não envia query inexistente',async()=>{
    globalThis.fetch=async(url)=>{
        assert.ok(url.endsWith('/api/alertas'));assert.ok(!url.includes('?'));
        return Response.json({alertas:[{...backendAlerts().alertas,concluido:false},{...backendAlerts().alertas,concluido:true}]});
    };
    assert.equal((await request('alerts',{token:'fixture',active:true})).length,1);
    assert.equal((await request('alerts',{token:'fixture',active:false})).length,2);
});
test('JWT usa sub UTF-8 e rejeita perfis conflitantes',()=>{
    const response=tokenResponse();
    const claims={sub:'João',perfil:response.perfil,exp:Math.floor(Date.now()/1000)+100};
    response.access_token=`fixture.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.fixture`;
    assert.equal(adaptLogin(response,'outro').nome,'João');
    assert.throws(()=>adaptLogin({...response,perfil:'ADMINISTRADOR'},'outro'));
});
test('erro numa fonte do dashboard não vira sucesso parcial nem dispara chamadas seguintes',async()=>{
    const calls=[];
    globalThis.fetch=async(url)=>{calls.push(url);return url.endsWith('/producao')?Response.json(backendProduction()):new Response('',{status:403});};
    await assert.rejects(request('dashboard',{token:'fixture'}),error=>error.status===403);
    assert.equal(calls.length,2);
});
