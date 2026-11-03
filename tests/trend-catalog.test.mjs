import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTrendCatalog} from '../lib/trend-catalog.ts';
const item=i=>({item_id:String(i),report_id:'published-'+i,title:'공식 원제',original_title:'Official title',official_url:'https://example.test/a',source_name:'기관',published_date:null,editorial_status:'published',topics:[],jurisdictions:[],content_text:'비공개',draft_body:'검수 전 원고'});
test('catalog reads beyond 200 items and exposes metadata only, without exposing unreviewed draft bodies',async()=>{
 const offsets=[];const rows=await loadTrendCatalog(undefined,async offset=>{offsets.push(offset);return {data:offset===0?Array.from({length:200},(_,i)=>item(i)):[item(201)],error:null};});
 assert.deepEqual(offsets,[0,200]);assert.equal(rows.length,201);assert.equal(rows[0].id,'published-0');assert.equal(rows[0].date,'날짜 확인 중');assert.equal(rows[0].details,'');assert.equal(rows[0].content_text,undefined);assert.equal(rows[0].draft_body,undefined);
});
test('catalog read failure is visible instead of a false empty list',async()=>{await assert.rejects(loadTrendCatalog(undefined,async()=>({data:null,error:{code:'42501'}})),/42501/);});

test('raw-only records cannot be presented as completed Korean trends',async()=>{await assert.rejects(loadTrendCatalog(undefined,async()=>({data:[{...item(1),editorial_status:'collected'}],error:null})),/공개 승인되지/);});

test('unreviewed Korean drafts must never appear in public search',async()=>{await assert.rejects(loadTrendCatalog(undefined,async()=>({data:[{...item(2),report_id:null,editorial_status:'review_pending'}],error:null})),/공개 승인되지/);});
