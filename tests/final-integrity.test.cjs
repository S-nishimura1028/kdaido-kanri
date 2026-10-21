'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','js','app.js'),'utf8');

test('parallel searches cannot overwrite the newest search results',async()=>{
  const start=app.indexOf('  let assetLoadSequence=0;'),end=app.indexOf('\n  function renderAssetsTable(',start);
  assert.ok(start>=0&&end>start);
  const ui={
    assetSearch:{value:'古い'},
    assetStatus:{value:''},
    assetCategory:{value:''}
  };
  let oldFinish;
  let queryNumber=0;
  const rendered=[];
  const queryFor=n=>({
    select(){return this;},eq(){return this;},order(){return this;},
    range(){return n===1?new Promise(resolve=>{oldFinish=resolve;}):Promise.resolve({
      data:[{id:'new',name:'新しい備品'}],error:null
    });}
  });
  const c={
    $:id=>ui[id], assetUsers:[],assets:[],console,
    db:{from(){return queryFor(++queryNumber);}},
    renderAssetsTable(rows){rendered.push(rows.map(x=>x.id));},
    openAssetFromUrlOnce(){}
  };
  const run=vm.runInNewContext(app.slice(start,end)+';loadAssets',c);
  const first=run();
  ui.assetSearch.value='新しい';
  const second=run();
  await second;
  oldFinish({data:[{id:'old',name:'古い備品'}],error:null});
  await first;
  assert.deepEqual(rendered,[['new']]);
});

test('rapid double submission creates only one asset and restores save button state',async()=>{
  const start=app.indexOf('  let assetFormSaving=false;'),
        end=app.indexOf('\n  async function showDetail(',start);
  assert.ok(start>=0&&end>start);
  const ui=new Map();
  function $(id){
    if(!ui.has(id))ui.set(id,{value:'',textContent:'',disabled:false,selectedOptions:[]});
    return ui.get(id);
  }
  $('assetForm').addEventListener=function(_event,cb){this.handler=cb;};
  $('assetDialog').close=function(){this.closed=true;};
  $('assetName').value='二重送信防止テスト';
  $('statusForm').value='未使用';
  $('quantity').value='1';
  $('unit').value='個';
  let completeInsert, insertCount=0;
  const mock={
    from(table){
      assert.equal(table,'assets');
      return {
        insert(payload){
          insertCount++;
          assert.equal(payload.asset_no,null);
          assert.equal(payload.name,'二重送信防止テスト');
          return this;
        },
        select(){return this;},
        single(){return new Promise(resolve=>completeInsert=resolve);}
      };
    }
  };
  const sandbox={
    $,db:mock, categories:[],locations:[],departments:[],assetUsers:[],
    pendingPhotoFile:null,pendingLabelPhotoFile:null,assets:[],console,
    async loadAssets(){},async loadDashboard(){}
  };
  vm.runInNewContext(app.slice(start,end),sandbox);
  const submit=$('assetForm').handler;
  const event={preventDefault(){}};
  const first=submit(event);
  assert.equal($('saveAssetBtn').disabled,true);
  const second=submit(event);
  assert.equal(insertCount,1);
  completeInsert({data:{id:'only-one-record'},error:null});
  await Promise.all([first,second]);
  assert.equal(insertCount,1);
  assert.equal($('assetDialog').closed,true);
  assert.equal($('saveAssetBtn').disabled,false);
  assert.equal($('saveAssetBtn').textContent,'保存');
});

test('save button is released even when insertion fails',async()=>{
  const start=app.indexOf('  let assetFormSaving=false;'),end=app.indexOf('\n  async function showDetail(',start);
  const ui=new Map();
  const $=id=>{if(!ui.has(id))ui.set(id,{value:'',textContent:'',disabled:false,selectedOptions:[]});return ui.get(id)};
  $('assetForm').addEventListener=function(event,fn){this.handler=fn;};
  $('assetName').value='テスト';$('quantity').value='1';
  const mock={from:()=>({insert(){return this;},select(){return this;},async single(){return{data:null,error:new Error('simulated database error')}}})};
  vm.runInNewContext(app.slice(start,end),{
    $,db:mock,categories:[],locations:[],departments:[],assetUsers:[],
    pendingPhotoFile:null,pendingLabelPhotoFile:null,assets:[],
    console:{error(){}},loadAssets:async()=>{},loadDashboard:async()=>{}
  });
  await $('assetForm').handler({preventDefault(){}});
  assert.equal($('saveAssetBtn').disabled,false);
  assert.match($('assetFormError').textContent,/simulated database error/);
});
