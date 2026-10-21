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

test('email OTP login is available without weakening administrator requirements',()=>{
  const html=file('index.html');
  assert.match(html,/id="magicLinkBtn"/);
  assert.match(html,/id="emailOtpInput"/);
  assert.match(html,/id="verifyEmailOtpBtn"/);
  assert.match(code,/auth\.signInWithOtp\(/);
  assert.match(code,/shouldCreateUser:false/);
  assert.match(code,/auth\.verifyOtp\(\{email:pendingOtpEmail,token,type:'email'\}\)/);
  assert.doesNotMatch(code,/emailRedirectTo:redirectTo/);
  assert.match(code,/profile\.role!=='admin' \|\| profile\.is_active!==true/);
});
test('email address validation does not accidentally escape regex metacharacters',()=>{
  assert.ok(code.includes(String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`));
});


function mockOtp(){
  const elements={};
  const calls=[];
  function element(id){
    if(!elements[id]){
      elements[id]={
        value:'',disabled:false,textContent:'',listeners:{},
        classList:{remove(name){calls.push({kind:'show',id,name})}},
        addEventListener(event,callback){this.listeners[event]=callback},
        focus(){},
      };
    }
    return elements[id];
  }
  let success=true,verifyError=null;
  const context={
    $:element,console:{error(){}},
    showError(text){element('loginError').textContent=text},
    db:{auth:{
      async signInWithOtp(options){calls.push({kind:'send',options});return {error:success?null:{status:429,message:'rate limit exceeded'}}},
      async verifyOtp(options){calls.push({kind:'verify',options});return {error:verifyError}}
    }}
  };
  const start=code.indexOf('  // An email OTP creates a normal Supabase session');
  const end=code.indexOf("  $('logoutBtn').onclick",start);
  assert.ok(start>=0&&end>start,'OTP handler exists');
  vm.runInNewContext(code.slice(start,end),context);
  return {element,calls,failSend(){success=false},failVerify(){verifyError={message:'invalid token'}}};
}

test('email OTP requests are limited to existing accounts and do not use redirects',async()=>{
  const h=mockOtp();
  h.element('loginEmail').value='nishimuradaido@gmail.com';
  await h.element('magicLinkBtn').listeners.click();
  assert.equal(h.calls.filter(c=>c.kind==='send').length,1);
  const request=h.calls.find(c=>c.kind==='send').options;
  assert.equal(request.email,'nishimuradaido@gmail.com');
  assert.equal(request.options.shouldCreateUser,false);
  assert.equal(request.options.emailRedirectTo,undefined);
  assert.ok(h.calls.some(c=>c.kind==='show'&&c.id==='emailOtpPanel'));
});

test('six digit code is required before attempting a Supabase verification',async()=>{
  const h=mockOtp();
  h.element('loginEmail').value='nishimuradaido@gmail.com';
  await h.element('magicLinkBtn').listeners.click();
  h.element('emailOtpInput').value='abc123';
  await h.element('verifyEmailOtpBtn').listeners.click();
  assert.equal(h.calls.filter(c=>c.kind==='verify').length,0);
  assert.match(h.element('loginError').textContent,/6桁/);
});

test('OTP is verified in the current browser using an email-type code',async()=>{
  const h=mockOtp();
  h.element('loginEmail').value='nishimuradaido@gmail.com';
  await h.element('magicLinkBtn').listeners.click();
  h.element('emailOtpInput').value='123456';
  await h.element('verifyEmailOtpBtn').listeners.click();
  const requests=h.calls.filter(c=>c.kind==='verify');
  assert.equal(requests.length,1);
  assert.equal(requests[0].options.email,'nishimuradaido@gmail.com');
  assert.equal(requests[0].options.token,'123456');
  assert.equal(requests[0].options.type,'email');
  assert.equal(h.element('emailOtpInput').value,'');
});

test('incorrect or expired codes never show an authentication success message',async()=>{
  const h=mockOtp();
  h.element('loginEmail').value='nishimuradaido@gmail.com';
  await h.element('magicLinkBtn').listeners.click();
  h.failVerify();
  h.element('emailOtpInput').value='111111';
  await h.element('verifyEmailOtpBtn').listeners.click();
  assert.match(h.element('loginError').textContent,/認証できませんでした/);
  assert.doesNotMatch(h.element('magicLinkNotice').textContent,/認証に成功しました/);
});
