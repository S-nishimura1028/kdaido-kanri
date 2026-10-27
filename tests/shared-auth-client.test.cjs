'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
for(const name of ['admin-master.js','admin-account-simple.js','asset-delete.js','qr-print.js']){
 test(name+' uses the current shared client and waits safely for initialization',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../js',name),'utf8');
  const match=source.match(/  function db\(\)\{[\s\S]*?\n  \}/);
  assert.ok(match);
  let creations=0;
  const window={supabase:{createClient(){creations++;return {separate:true}}},SUPABASE_URL:'fixture',SUPABASE_PUBLISHABLE_KEY:'fixture'};
  const get=vm.runInNewContext('let client=null;'+match[0]+';db',{window});
  assert.equal(get(),null);
  let current={session:'one'};
  window.DaidoQrBridge={getClient:()=>current};
  assert.equal(get(),current);
  current={session:'two'};
  assert.equal(get(),current,'must not retain an obsolete client');
  current=null;
  assert.equal(get(),null);
  assert.equal(creations,0);
 });
}
test('only the main application constructs a Supabase client',()=>{
 const dir=path.join(__dirname,'../js');
 const creators=fs.readdirSync(dir).filter(p=>p.endsWith('.js')&&/supabase\.createClient\(/.test(fs.readFileSync(path.join(dir,p),'utf8')));
 assert.deepEqual(creators,['app.js']);
});
