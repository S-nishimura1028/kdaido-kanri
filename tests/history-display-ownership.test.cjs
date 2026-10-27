'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../js/history-label.js'),'utf8');

async function run(nativeRows){
  let html='<table>native history with asset identity and disposal reason</table>';
  let clients=0;
  const callbacks=[];
  const host={
    querySelector(selector){
      if(selector==='table')return {};
      if(selector==='tbody tr[data-asset-id]')return nativeRows?{}:null;
      return null;
    },
    get innerHTML(){return html},set innerHTML(value){html=value}
  };
  const client={from(){return {
    select(){return this},order(){return this},
    async range(){return {data:[],error:null}},
    then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject)}
  }}};
  vm.runInNewContext(source,{
    window:{supabase:{createClient(){clients++;return client}},SUPABASE_URL:'fixture',SUPABASE_PUBLISHABLE_KEY:'fixture'},
    document:{readyState:'complete',getElementById(){return host}},
    MutationObserver:class{observe(){}},setTimeout(fn){callbacks.push(fn)},console
  });
  for(const fn of callbacks)await fn();
  return {html,clients};
}

test('legacy history enhancer preserves native row identity, action and disposal details',async()=>{
  const result=await run(true);
  assert.equal(result.html,'<table>native history with asset identity and disposal reason</table>');
  assert.equal(result.clients,0,'native history must not start a competing authenticated client');
});

test('legacy history tables without native asset metadata still use the fallback renderer',async()=>{
  const result=await run(false);
  assert.equal(result.clients,1);
  assert.match(result.html,/履歴はありません/);
});

test('history asset link navigates to assets and resets unrelated filters',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'../js/asset-workspace-ui.js'),'utf8');
  const start=ui.indexOf(" $('workspaceHistoryRows').addEventListener('click',ev=>{");
  const end=ui.indexOf('\n });',start)+5;
  assert.ok(start>=0&&end>start);
  let handler,navigations=0,searchEvents=0;
  const fields={assetSearch:{value:'old',dispatchEvent(e){assert.equal(e.type,'input');searchEvents++}},assetStatus:{value:'使用中'},assetCategory:{value:'old'},workspaceHistoryRows:{addEventListener(_,fn){handler=fn}}};
  const window={DaidoAnalysisFilter:{ids:['old']}};
  vm.runInNewContext(ui.slice(start,end),{
    $:id=>fields[id],window,Event:class{constructor(type){this.type=type}},
    document:{querySelector(selector){assert.equal(selector,'.nav-btn[data-page="assets"]');return {click(){navigations++}}}}
  });
  handler({target:{closest(){return {dataset:{assetSearch:'KD-0010'}}}}});
  assert.equal(navigations,1);
  assert.equal(fields.assetSearch.value,'KD-0010');
  assert.equal(fields.assetStatus.value,'');
  assert.equal(fields.assetCategory.value,'');
  assert.equal(window.DaidoAnalysisFilter,null);
  assert.equal(searchEvents,1);
  handler({target:{closest(){return null}}});
  assert.equal(navigations,1);
});

