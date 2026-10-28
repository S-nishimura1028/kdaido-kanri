'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/qr-print.js'),'utf8');
const begin=source.indexOf("  const GROUP_UNSET=");
const end=source.indexOf("\n  let scheduled=false;",begin);
assert.ok(begin>=0&&end>begin,'Grouped print helpers must exist');
const groupSource=source.slice(begin,end);
function helpers(client){
  const window={
    DaidoQrBridge:{getClient:()=>client}
  };
  const sandbox={window,document:{},console};
  return vm.runInNewContext(
    '(function(){ const db=()=>window.DaidoQrBridge.getClient();'+
    groupSource+
    ';return {groupLabel,matchGroupFilter,filteredGroupAssets,fetchGroupPrintAssets,groupedPrint};})()',
    sandbox
  );
}
const assets=[
 {id:'a',asset_no:'KD-0001',name:'A',_groupLocation:'南側寮',_groupDepartment:'総務'},
 {id:'b',asset_no:'KD-0002',name:'B',_groupLocation:'北側寮',_groupDepartment:'総務'},
 {id:'c',asset_no:'KD-0003',name:'C',_groupLocation:'南側寮',_groupDepartment:'農業'},
 {id:'d',asset_no:'KD-0004',name:'D',_groupLocation:'',_groupDepartment:''}
];
test('requires selecting at least one location or department before printing',()=>{
  const h=helpers({});
  assert.equal(h.filteredGroupAssets(assets,'','').length,0);
});
test('filters by location only / department only / both in combination',()=>{
  const h=helpers({});
  assert.deepEqual(Array.from(h.filteredGroupAssets(assets,'南側寮',''),x=>x.id),['a','c']);
  assert.deepEqual(Array.from(h.filteredGroupAssets(assets,'','総務'),x=>x.id),['a','b']);
  assert.deepEqual(Array.from(h.filteredGroupAssets(assets,'南側寮','総務'),x=>x.id),['a']);
  assert.equal(h.filteredGroupAssets(assets,'不存在','').length,0);
});
test('unassigned groups are selectable without printing unrelated items',()=>{
  const h=helpers({});
  assert.deepEqual(Array.from(h.filteredGroupAssets(assets,'__unset__',''),x=>x.id),['d']);
  assert.deepEqual(Array.from(h.filteredGroupAssets(assets,'','__unset__'),x=>x.id),['d']);
});
test('resolves master ID first and falls back to legacy name text',()=>{
  const h=helpers({});
  const masters=new Map([['loc-1','更新後の場所']]);
  assert.equal(h.groupLabel({location_id:'loc-1',location:'以前の場所'},'location',masters),'更新後の場所');
  assert.equal(h.groupLabel({location_id:'missing',location:'既存文字列'},'location',masters),'既存文字列');
  assert.equal(h.groupLabel({department_id:null,department:null},'department',new Map()),'');
});
function stubClient(pages,{failedPage=-1}={}){
  const qs={ranges:[],filters:[]};
  return {
    qs,
    from(table){
      if(table==='locations')return {select:async()=>({data:[{id:'l1',name:'第1倉庫'}],error:null})};
      if(table==='departments')return {select:async()=>({data:[{id:'d1',name:'総務課'}],error:null})};
      assert.equal(table,'assets');
      return {
        select(columns){
          assert.match(columns,/department_id/);return this;
        },
        eq(field,value){qs.filters.push([field,value]);return this},
        neq(field,value){qs.filters.push([field,'!'+value]);return this},
        order(){return this},
        async range(from,to){
          assert.equal(to-from,499);
          qs.ranges.push([from,to]);
          if(qs.ranges.length-1===failedPage)return {data:null,error:new Error('network failure')};
          return {data:pages[qs.ranges.length-1]||[],error:null};
        }
      };
    }
  };
}
test('loads all 500+ assets, not just the visible table or first database page',async()=>{
  const page=Array.from({length:500},(_,i)=>({id:String(i),asset_no:'KD-'+i,name:'設備'+i,location_id:'l1',department_id:'d1',status:'未使用'}));
  const client=stubClient([page,[{id:'last',asset_no:'KD-0501',name:'最後',location:'旧倉庫',department:'旧部署',status:'使用中'}]]);
  const h=helpers(client);
  const rows=await h.fetchGroupPrintAssets();
  assert.equal(rows.length,501);
  assert.equal(rows[0]._groupLocation,'第1倉庫');
  assert.equal(rows[0]._groupDepartment,'総務課');
  assert.equal(rows[500]._groupLocation,'旧倉庫');
  assert.equal(rows[500]._groupDepartment,'旧部署');
  assert.deepEqual(client.qs.filters,[['is_deleted',false],['status','!廃棄']]);
  assert.deepEqual(client.qs.ranges,[[0,499],[500,999]]);
});
test('aborts on a failed database page instead of allowing an incomplete print',async()=>{
  const first=Array.from({length:500},(_,i)=>({id:String(i),status:'未使用'}));
  const h=helpers(stubClient([first,[]],{failedPage:1}));
  await assert.rejects(()=>h.fetchGroupPrintAssets(),/network failure/);
});
test('label printing avoids deleted/disposed assets and requires confirmation for multiple pages',()=>{
  assert.match(groupSource,/\.eq\('is_deleted',false\)\.neq\('status','廃棄'\)/);
  assert.match(groupSource,/pageCount>1&&\!window\.confirm/);
  assert.match(groupSource,/if\(fingerprint\(freshItems\)!==fingerprint\(selection\)\)/);
  assert.match(groupSource,/asset\.id\)/);
  assert.match(source,/保管場所・部署別に印刷/);
});
