'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const start=source.indexOf('  async function enterApp(user){');
const end=source.indexOf("  $('loginForm').addEventListener('submit'",start);
assert.ok(start>=0&&end>start,'actual post-login authorization handler exists');
async function run(profileResult,{queryError=null,loadError=null}={}){
 const state={signouts:0,loads:[],errors:[],profileQueries:[]};
 const elements={loginView:{classList:{add(){},remove(){}}},appView:{classList:{add(){},remove(){}}},connectionStatus:{textContent:''},userInfo:{textContent:''}};
 const context={
  currentUser:null,profile:null,$:id=>elements[id],roleLabel:()=> '管理者',isManager:()=>true,
  showLogin(){state.login=true},showError(message){state.errors.push(message)},
  document:{querySelectorAll(){return[]}},console:{error(){}},
  db:{auth:{async signOut(){state.signouts++}},from(table){state.profileQueries.push(table);return{select(){return this},eq(key,value){assert.equal(key,'id');assert.equal(value,'local-fixture-user');return this},async maybeSingle(){return{data:profileResult,error:queryError}}}}},
  async loadMasters(){state.loads.push('masters');if(loadError)throw loadError},
  async loadDashboard(){state.loads.push('dashboard')},async loadAssets(){state.loads.push('assets')},async loadHistory(){state.loads.push('history')}
 };
 const enter=vm.runInNewContext(source.slice(start,end)+';enterApp',context);
 await enter({id:'local-fixture-user',email:'fixture@example.invalid'});
 return{...state,elements};
}
for(const [name,profile] of [
 ['non-admin account',{role:'viewer',is_active:true}],
 ['inactive admin',{role:'admin',is_active:false}],
 ['missing profile',null],
 ['admin without explicit active flag',{role:'admin'}]
])test(name+' is signed out before any business data loads',async()=>{
 const r=await run(profile);
 assert.equal(r.signouts,1);assert.deepEqual(r.loads,[]);
 assert.deepEqual(r.profileQueries,['profiles']);assert.equal(r.login,true);
 assert.match(r.errors.join(''),/管理者アカウント専用/);
});
test('active admin follows the complete business-data loading sequence',async()=>{
 const r=await run({role:'admin',is_active:true,name:'Local fixture'});
 assert.equal(r.signouts,0);assert.deepEqual(r.errors,[]);
 assert.deepEqual(r.loads,['masters','dashboard','assets','history']);
 assert.equal(r.elements.connectionStatus.textContent,'Supabase接続OK');
});
test('profile lookup error fails closed without loading business data',async()=>{
 const r=await run(null,{queryError:new Error('fixture profile lookup failure')});
 assert.deepEqual(r.loads,[]);assert.equal(r.login,true);
 assert.match(r.errors.join(''),/fixture profile lookup failure/);
});
test('authorized data-load error returns to the login view without reporting connected',async()=>{
 const r=await run({role:'admin',is_active:true},{loadError:new Error('fixture data failure')});
 assert.deepEqual(r.loads,['masters']);assert.equal(r.login,true);
 assert.notEqual(r.elements.connectionStatus.textContent,'Supabase接続OK');
 assert.match(r.errors.join(''),/fixture data failure/);
});
