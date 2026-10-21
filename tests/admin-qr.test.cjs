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


test('login UI uses the existing free Magic Link template',()=>{
  const html=file('index.html');
  assert.match(html,/id="magicLinkBtn"/);
  assert.match(html,/id="magicLinkPasteInput"/);
  assert.match(html,/id="verifyMagicLinkBtn"/);
  assert.doesNotMatch(html,/id="emailOtpInput"/);
  assert.match(code,/auth\.verifyOtp\(\{token_hash:tokenHash,type:'magiclink'\}\)/);
  assert.match(code,/shouldCreateUser:false/);
  assert.match(code,/profile\.role!=='admin' \|\| profile\.is_active!==true/);
});
test('email address validation remains correct',()=>{
  assert.ok(code.includes(String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`));
});

function mockMagicLink(){
  const elements={},calls=[];
  function element(id){
    if(!elements[id])elements[id]={
      value:'',disabled:false,textContent:'',listeners:{},
      addEventListener(event,handler){this.listeners[event]=handler},
      focus(){},
    };
    return elements[id];
  }
  let sendError=null,verificationError=null;
  const sandbox={
    $:element,URL,window:{SUPABASE_URL:'https://rhjnrguhnkfotggzxjfs.supabase.co'},
    showError(msg){element('loginError').textContent=msg},
    db:{auth:{
      async signInWithOtp(options){calls.push({action:'send',options});return{error:sendError}},
      async verifyOtp(options){calls.push({action:'verify',options});return{error:verificationError}},
    }}
  };
  const start=code.indexOf('  // The default Supabase email template');
  const end=code.indexOf("  $('logoutBtn').onclick",start);
  assert.ok(start>=0&&end>start,'magic link handler exists');
  vm.runInNewContext(code.slice(start,end),sandbox);
  return {elements,calls,element,failSend(){sendError={status:429,message:'rate limit'}},failVerify(){verificationError={message:'invalid token'}}};
}
const safeToken='a'.repeat(64);
const sampleLink='https://rhjnrguhnkfotggzxjfs.supabase.co/auth/v1/verify?token='+safeToken+'&type=magiclink&redirect_to=https%3A%2F%2Fexample.org';
test('login mail can only be requested for an existing account',async()=>{
  const h=mockMagicLink();
  h.element('loginEmail').value='nishimuradaido@gmail.com';
  await h.element('magicLinkBtn').listeners.click();
  const req=h.calls.find(x=>x.action==='send');
  assert.equal(req.options.email,'nishimuradaido@gmail.com');
  assert.equal(req.options.options.shouldCreateUser,false);
  assert.equal(req.options.options.emailRedirectTo,undefined);
});
test('valid Supabase Magic Link is verified locally in the same browser',async()=>{
  const h=mockMagicLink();
  h.element('magicLinkPasteInput').value=sampleLink;
  await h.element('verifyMagicLinkBtn').listeners.click();
  const req=h.calls.find(x=>x.action==='verify');
  assert.equal(req.options.token_hash,safeToken);
  assert.equal(req.options.type,'magiclink');
  assert.equal(h.element('magicLinkPasteInput').value,'');
  assert.match(h.element('magicLinkNotice').textContent,/認証に成功/);
});
test('malicious site URL never reaches auth verification',async()=>{
  const h=mockMagicLink();
  h.element('magicLinkPasteInput').value='https://evil.example/auth/v1/verify?token='+safeToken+'&type=magiclink';
  await h.element('verifyMagicLinkBtn').listeners.click();
  assert.equal(h.calls.filter(x=>x.action==='verify').length,0);
  assert.match(h.element('loginError').textContent,/Supabaseから届いた/);
});
test('invalid or missing token rejected locally',async()=>{
  const h=mockMagicLink();
  h.element('magicLinkPasteInput').value='https://rhjnrguhnkfotggzxjfs.supabase.co/auth/v1/verify?token=invalid&type=magiclink';
  await h.element('verifyMagicLinkBtn').listeners.click();
  assert.equal(h.calls.filter(x=>x.action==='verify').length,0);
});
test('expired or used token cannot produce a success message',async()=>{
  const h=mockMagicLink();
  h.failVerify();
  h.element('magicLinkPasteInput').value=sampleLink;
  await h.element('verifyMagicLinkBtn').listeners.click();
  assert.match(h.element('loginError').textContent,/無効または使用済み/);
  assert.doesNotMatch(h.element('magicLinkNotice').textContent,/認証に成功/);
});
test('email send rate limits do not trigger hidden retry loops',async()=>{
  const h=mockMagicLink();h.failSend();
  h.element('loginEmail').value='nishimuradaido@gmail.com';
  await h.element('magicLinkBtn').listeners.click();
  assert.equal(h.calls.filter(x=>x.action==='send').length,1);
  assert.match(h.element('loginError').textContent,/回数制限/);
});
