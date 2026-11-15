import test from 'node:test';
import assert from 'node:assert/strict';
import {reconnectQueueError,reconnectIsPending} from '../lib/podcast-reconnect.ts';
test('queue errors retain safe stage and fixed codes without raw DB messages',()=>{
 assert.equal(reconnectQueueError({message:'reconnection busy',code:'P0001'}).diagnostics.code,'RECONNECT_BUSY');
 const unknown=reconnectQueueError({message:'secret-must-not-leak',code:'P0001'});
 assert.equal(unknown.status,500);
 assert.equal(JSON.stringify(unknown).includes('secret-must-not-leak'),false);
 assert.equal(unknown.diagnostics.sqlState,'P0001');
});
test('only a recent pending request is reused',()=>{
 assert.equal(reconnectIsPending({result:'pending',requestedAt:new Date().toISOString()}),true);
 assert.equal(reconnectIsPending({result:'pending',requestedAt:new Date(Date.now()-16*60*1000).toISOString()}),false);
 assert.equal(reconnectIsPending({result:'failed',requestedAt:new Date().toISOString()}),false);
 assert.equal(reconnectIsPending(null),false);
});