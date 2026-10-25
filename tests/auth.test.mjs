import { test } from 'node:test';
import assert from 'node:assert/strict';
import { session } from './fixtures.mjs';
globalThis.location = {protocol:'http:',hostname:'127.0.0.1'};
globalThis.window = new EventTarget(); globalThis.document = new EventTarget();
const {login,getSession,logout}=await import('../js/auth.js');
test('login, expiração, logout e resposta tardia não restauram sessão', async () => {
    const original=globalThis.fetch;
    let ended=0; window.addEventListener('session-ended',()=>ended++);
    try {
        globalThis.fetch=async()=>Response.json(session());
        assert.equal(await login('fixture','fixture'),true); assert.ok(getSession());
        logout(); assert.equal(getSession(),null); assert.equal(ended,1);
        globalThis.fetch=async()=>Response.json({...session(),expira_em:new Date(Date.now()-1000).toISOString()});
        await assert.rejects(login('fixture','fixture'), /expirou/); assert.equal(getSession(),null);
        let resolve;
        globalThis.fetch=()=>new Promise(done=>resolve=done);
        const pending=login('fixture','fixture'); logout(); resolve(Response.json(session()));
        assert.equal(await pending,false); assert.equal(getSession(),null);
        globalThis.fetch=async()=>Response.json({...session(),expira_em:new Date(Date.now()+50).toISOString()});
        await login('fixture','fixture'); await new Promise(r=>setTimeout(r,70)); assert.equal(getSession(),null);
        globalThis.fetch=async()=>Response.json(session('ROOT'));
        await assert.rejects(login('fixture','fixture'), /formato inválido/); assert.equal(getSession(),null);
    } finally { logout('',false); globalThis.fetch=original; }
});
