import test from 'node:test';
import assert from 'node:assert/strict';
import {trendCountryGroup, selectedTrendCountries, trendCountryOptions} from '../lib/trend-country-filters.ts';
import {searchTrendPage} from '../lib/trend-search-page.ts';

const story=(id,jurisdictions)=>({id,jurisdictions,country:jurisdictions[0]??'',title:'자료',summary:'요약',originalTitle:'Source',institution:'기관',tags:[],date:'2026.11.01'});
test('major filters stay compact and normalize country aliases and US subdivisions',()=>{
 assert.equal(trendCountryOptions.length,8);
 for(const [value,expected] of [['US-CA','US'],['US-NY','US'],['미국 뉴멕시코주','US'],['United States','US'],['UK','GB'],['United Kingdom','GB'],['대한민국','KR'],['유럽연합','EU'],['JP','JP'],['CN','CN'],['SG','SG'],['FR','OTHER'],['international:OECD','OTHER'],['새 국가','OTHER'],['','OTHER']]) assert.equal(trendCountryGroup(value),expected,value);
 assert.deepEqual(selectedTrendCountries('UK,GB,US-CA,US-NY,FR,BR'),['GB','US','OTHER']);
});
test('saved other filter includes newly arriving regions without an allowlist update',()=>{
 const stories=[story('jp',['JP']),story('us',['US-CA']),story('fr',['FR']),story('mixed',['JP','BR'])];
 assert.deepEqual(searchTrendPage(stories,{country:'OTHER'}).stories.map(x=>x.id),['fr','mixed']);
 stories.push(story('new',['new-jurisdiction']),story('unknown',[]));
 const result=searchTrendPage(stories,{country:'OTHER'});
 assert.equal(result.total,4);assert.equal(result.countryOptions.length,8);
 assert.equal(searchTrendPage(stories,{country:'US'}).total,1);
 assert.equal(searchTrendPage(stories,{country:'JP,OTHER'}).total,5);
 assert.equal(searchTrendPage(stories,{}).total,6);
 assert.equal(searchTrendPage(stories,{country:'FR'}).total,4);
 assert.deepEqual(stories[2].jurisdictions,['FR']);
});
