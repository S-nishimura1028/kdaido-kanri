const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const file = p => fs.readFileSync(path.join(root,p),'utf8');
const code = file('js/app.js');
const start = code.indexOf('  let openedAssetFromUrl=false;');
const end = code.indexOf('\n  function debounce(',start);
assert.ok(start >= 0 && end > start, 'QR route exists');
const handler = code.slice(start,end);
const id = '55f25b20-8135-4848-8c54-6b96760baffb';

async function run(assetParam, current=[], fetched=null) {
  const seen={opened:[],queries:[],notices:[]};
  const sandbox={
    URL,
    location:{href:'https://preview.test/?asset='+assetParam},
    assets:current,
    db:{from(t){seen.queries.push(t);return {
      select(){return this},eq(){return this},
      async maybeSingle(){return {data:fetched,error:null}}
    }}},
    go(){}, async showDetail(x){seen.opened.push(x)},
    $(){return {prepend(el){seen.notices.push(el.textContent)}}},
    document:{createElement(){return {setAttribute(){},style:{},textContent:''}}},
    console,
  };
  const open = vm.runInNewContext(handler+';openAssetFromUrlOnce', sandbox);
  await open(); await open();
  return seen;
}

test('existing QR opens exactly once',async()=>{
  const result=await run(id,[{id}]);
  assert.deepEqual(result.opened,[id]);
  assert.deepEqual(result.queries,[]);
});
test('QR can fetch a missing row from assets by ID',async()=>{
  const result=await run(id,[],{id});
  assert.deepEqual(result.opened,[id]);
  assert.deepEqual(result.queries,['assets']);
});
test('bad UUID cannot query or display assets',async()=>{
  const result=await run('invalid');
  assert.deepEqual(result.opened,[]);
  assert.deepEqual(result.queries,[]);
  assert.match(result.notices.join(''),/形式が正しくありません/);
});
test('unknown UUID cannot display an asset',async()=>{
  const result=await run(id);
  assert.deepEqual(result.opened,[]);
  assert.match(result.notices.join(''),/見つかりません/);
});
test('public QR code is not loaded',()=>{
  assert.doesNotMatch(file('index.html'), /<script[^>]*src="js\/public-asset\.js/);
});
test('QR links use the canonical production site',()=>{
  assert.match(code,/new URL\(window\.APP_BASE_URL\|\|location\.origin/);
});
test('source files parse without syntax errors',()=>{
  for(const p of ['js/app.js','js/config.js','js/public-asset.js']){
    assert.doesNotThrow(()=>new vm.Script(file(p),{filename:p}));
  }
});



test('login view shows only email and password controls',()=>{
  const html=file('index.html');
  assert.match(html,/id="loginForm"/);
  assert.match(html,/id="loginEmail"/);
  assert.match(html,/id="loginPassword"/);
  assert.doesNotMatch(html,/id="(?:magicLinkBtn|emailOtpInput|verifyEmailOtpBtn|magicLinkPasteInput|verifyMagicLinkBtn)"/);
});
test('no temporary email-based authentication remains',()=>{
  assert.doesNotMatch(code,/auth\.signInWithOtp\(/);
  assert.doesNotMatch(code,/auth\.verifyOtp\(/);
  assert.doesNotMatch(code,/magicLinkBtn|verifyMagicLinkBtn|magicLinkPasteInput|emailOtpInput/);
});
test('authenticated users must still have active admin profiles',()=>{
  assert.match(code,/profile\.role!=='admin' \|\| profile\.is_active!==true/);
  assert.match(code,/db\.auth\.signOut\(\)/);
  assert.match(code,/db\.from\('profiles'\)\.select\('\*'\)\.eq\('id',user\.id\)/);
});
test('password login uses Supabase Auth with the entered credentials',async()=>{
  const app=code.indexOf("  $('loginForm').addEventListener('submit',async e=>{");
  const end=code.indexOf("\n  $('logoutBtn').onclick",app);
  assert.ok(app>=0 && end>app, 'password handler exists');
  const calls=[],els={};
  function $(id){
    if(!els[id])els[id]={
      value:'',textContent:'',disabled:false,listeners:{},
      addEventListener(event,listener){this.listeners[event]=listener},
      querySelector(){return els.submit || (els.submit={disabled:false,textContent:'管理者ログイン'})}
    };
    return els[id];
  }
  let error=null;
  const ctx={$,
    db:{auth:{async signInWithPassword(params){calls.push(params);return{error}}}},
    showError(message){$('loginError').textContent=message},
    console:{error(){}},
  };
  vm.runInNewContext(code.slice(app,end),ctx);
  $('loginEmail').value='staff@example.com';
  $('loginPassword').value='a-test-password';
  const e={preventDefault(){},submitter:{disabled:false,textContent:'管理者ログイン'}};
  await $('loginForm').listeners.submit(e);
  assert.equal(calls.length,1);
  assert.equal(calls[0].email,'staff@example.com');
  assert.equal(calls[0].password,'a-test-password');
  assert.equal(e.submitter.disabled,false);
  assert.equal(e.submitter.textContent,'ログイン');
  error={message:'Invalid login credentials'};
  await $('loginForm').listeners.submit(e);
  assert.equal(calls.length,2);
  assert.match($('loginError').textContent,/Invalid login credentials/);
});
