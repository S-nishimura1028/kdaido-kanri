'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');

test('all application JavaScript files parse',()=>{
  for(const p of fs.readdirSync(path.join(root,'js')).filter(p=>p.endsWith('.js'))){
    assert.doesNotThrow(()=>new vm.Script(file('js/'+p),{filename:p}));
  }
});

test('mobile has a logout control wired to Supabase Auth',()=>{
  const html=file('index.html'),app=file('js/app.js');
  assert.match(html,/id="mobileLogoutBtn"/);
  assert.match(html,/\.topbar \.mobile-logout\{display:inline-flex!important/);
  assert.match(app,/\$\('mobileLogoutBtn'\)\.onclick=\(\)=>db\.auth\.signOut\(\)/);
});

test('hidden management number retains existing value on edit',()=>{
  const script=file('js/asset-no-remove.js'),app=file('js/app.js');
  assert.doesNotMatch(script,/input\.value\s*=\s*''/);
  assert.ok(app.includes("asset_no:id?($('assetNo').value.trim()||null):null"));
});

test('all-history pagination and soft-deleted filtering are present',()=>{
  const app=file('js/app.js'),detail=file('js/history-label.js');
  assert.match(app,/\.eq\('is_deleted',false\)\.order\('asset_no'\)\.order\('id'\)/);
  assert.match(app,/\.select\('status,quantity,photo_path'\)\.eq\('is_deleted',false\)/);
  assert.match(detail,/\.range\(offset,offset\+499\)/);
  assert.doesNotMatch(detail,/\.limit\(200\)/);
});

test('search supports user masters and location with filtered active rows',async()=>{
  const app=file('js/app.js');
  const start=app.indexOf('  let assetLoadSequence=0;');
  const end=app.indexOf('\n  function renderAssetsTable(',start);
  assert.ok(start>=0&&end>start);
  const seen={eq:[],pages:[],table:null};
  const records=[
    {id:'asset1',name:'乾燥機',asset_no:null,location:'倉庫',assigned_user_id:'u1'},
    {id:'asset2',name:'冷蔵庫',asset_no:null,location:'事務所',assigned_user_id:null}
  ];
  const values={assetSearch:{value:'山本'},assetStatus:{value:''},assetCategory:{value:''}};
  const q={
    select(){return this;},eq(k,v){seen.eq.push([k,v]);return this;},
    order(){return this;},
    async range(start,end){seen.pages.push([start,end]);return{data:records,error:null};}
  };
  const sandbox={
    $,window:{},assets:[],assetUsers:[{id:'u1',name:'山本さん'}],
    db:{from(t){assert.equal(t,'assets');return q;}},
    renderAssetsTable(rows){seen.table=rows;},
    openAssetFromUrlOnce(){},console
  };
  function $(id){return values[id];}
  const run=vm.runInNewContext(app.slice(start,end)+';loadAssets',sandbox);
  await run();
  assert.equal(seen.table.length,1);
  assert.equal(seen.table[0].id,'asset1');
  assert.deepEqual(JSON.parse(JSON.stringify(seen.eq)),[['is_deleted',false]]);
  values.assetSearch.value='事務所';
  await run();
  assert.equal(seen.table.length,1);
  assert.equal(seen.table[0].id,'asset2');
});

test('quick user change updates master ID and name in one atomic asset update',async()=>{
  const src=file('js/current-user.js');
  const start=src.indexOf('  async function editCurrentUser(){');
  const end=src.indexOf('\n  function ensureButton(){',start);
  assert.ok(start>=0&&end>start);
  const assetId='asset-demo';
  const users=[{id:'u2',name:'新使用者',department:'農業'}];
  const saved=[];
  let reloads=0;
  const asset={id:assetId,name:'備品A',assigned_user_id:'u1',user_name:'旧使用者',status:'使用中'};
  const dbClient={
    from(table){
      if(table==='asset_users')return {
        select(){return this},eq(){return this},
        async order(){return{data:users,error:null}}
      };
      if(table==='assets')return {
        select(){return this},eq(){return this},
        async maybeSingle(){return{data:asset,error:null}},
        update(payload){
          saved.push(payload);
          return {eq(){return this},select(){return this},async maybeSingle(){return{data:{id:assetId},error:null}}};
        }
      };
      throw new Error(table);
    }
  };
  const context={
    currentAssetId:assetId,busy:false,window:{confirm:()=>true},
    db:()=>dbClient,pickUser:async()=>({id:'u2'}),
    location:{reload(){reloads++;}},document:{getElementById(){return{dataset:{assetId}}}},
    alert(){throw new Error('unexpected error alert');},console
  };
  const run=vm.runInNewContext(src.slice(start,end)+';editCurrentUser',context);
  await run();
  assert.deepEqual(JSON.parse(JSON.stringify(saved)),[
    {assigned_user_id:'u2',user_name:'新使用者'}
  ]);
  assert.equal(reloads,1);
});

test('photo replacement never removes old photos before database update',()=>{
  const app=file('js/app.js'),quick=file('js/photo-update.js');
  const appUpdate=app.indexOf("rpc('update_asset_photos_checked'");
  const appDelete=app.indexOf("remove(oldPaths)");
  assert.ok(appUpdate>0&&appDelete>appUpdate);
  const quickRpc=quick.indexOf("rpc('update_asset_photos_checked'");
  const quickCleanup=quick.indexOf("remove(obsolete)");
  assert.ok(quickRpc>0&&quickCleanup>quickRpc);
  assert.match(quick,/const referenced=new Set/);
  assert.match(app,/const referenced=new Set/);
});

test('deletion always targets the asset displayed, not a stale URL',async()=>{
  const app=file('js/app.js'),del=file('js/asset-delete.js');
  assert.match(app,/\$\('detailDialog'\)\.dataset\.assetId=String\(a\.id\)/);
  const start=del.indexOf('  async function resolveAssetId(){');
  const end=del.indexOf('\n  async function deleteAsset(',start);
  assert.ok(start>=0&&end>start);
  const context={
    document:{getElementById(){return{dataset:{assetId:'visible-record'}}}},
    location:{href:'https://example.test/?asset=outdated-id'},
    currentAssetId:'another-record',URL
  };
  const resolve=vm.runInNewContext(del.slice(start,end)+';resolveAssetId',context);
  assert.equal(await resolve(),'visible-record');
});

test('quick user editor and photo editor resolve the currently displayed asset',()=>{
  assert.match(file('js/current-user.js'),/dataset\.assetId\|\|currentAssetId/);
  assert.match(file('js/photo-update.js'),/dataset\.assetId\|\|currentAssetId/);
});

