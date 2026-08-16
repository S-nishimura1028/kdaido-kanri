(function(){
  'use strict';
  let client=null,rendering=false,guarding=false,userGroups=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  const defs=[
    {table:'categories',host:'categoryAdmin',title:'カテゴリ'},
    {table:'locations',host:'locationAdmin',title:'保管場所'},
    {table:'departments',host:'departmentAdmin',title:'部署'}
  ];

  async function currentProfile(){
    const c=db();if(!c)return null;
    const {data:{session}}=await c.auth.getSession();if(!session)return null;
    const {data}=await c.from('profiles').select('id,name,email,role').eq('id',session.user.id).maybeSingle();
    return data||null;
  }

  async function isAdmin(){return (await currentProfile())?.role==='admin';}

  async function enforceAdminOnly(){
    if(guarding||window.PUBLIC_ASSET_MODE)return;
    guarding=true;
    try{
      const c=db();if(!c)return;
      const {data:{session}}=await c.auth.getSession();if(!session)return;
      const {data:p}=await c.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
      if(p&&p.role!=='admin'){
        await c.auth.signOut();
        document.getElementById('appView')?.classList.add('hidden');
        document.getElementById('loginView')?.classList.remove('hidden');
        const err=document.getElementById('loginError');
        if(err)err.textContent='このアプリは管理者アカウント専用です。一般社員はログインせず、QRコードから備品情報を確認してください。';
      }
    }catch(e){console.warn('admin guard',e)}finally{guarding=false;}
  }

  function ensureStyles(){
    if(document.getElementById('adminMasterStyle'))return;
    const s=document.createElement('style');s.id='adminMasterStyle';
    s.textContent=`.master-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.master-mini{border:0;border-radius:8px;padding:7px 10px;font-weight:700;background:#edf4f2;color:#355e55}.master-mini.danger{background:#f8eceb;color:#9b2c22}.master-mini.promote{background:#e8f1fb;color:#075b9b}.master-add{margin-left:auto}.master-row strong{overflow-wrap:anywhere}.admin-account-note{font-size:13px;color:var(--muted);line-height:1.6;padding:2px 0 12px}.admin-account-meta{display:block;color:var(--muted);font-size:12px;margin-top:3px}.user-admin-assets{display:block;color:var(--muted);font-size:12px;margin-top:4px;line-height:1.5}.user-admin-count{font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;background:#e8f5ec;color:#166534}.admin-create-overlay{position:fixed;inset:0;z-index:4000;background:rgba(4,30,47,.58);display:grid;place-items:center;padding:16px;backdrop-filter:blur(3px)}.admin-create-card{width:min(500px,95vw);background:#fff;border:1px solid #dbe8e3;border-radius:18px;padding:20px;box-shadow:0 28px 80px rgba(0,0,0,.28)}.admin-create-card h3{margin:0 0 6px;color:#173f59}.admin-create-card p{margin:0 0 16px;color:var(--muted);font-size:13px;line-height:1.6}.admin-create-card label{display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px;margin-bottom:12px}.admin-create-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}.admin-create-actions button{min-height:46px}.password-line{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.password-line button{min-height:44px}.admin-create-error{color:var(--danger);font-size:13px;min-height:18px;margin-top:8px}@media(max-width:600px){.password-line{grid-template-columns:1fr}.admin-create-actions{display:grid;grid-template-columns:1fr 1fr}.admin-create-card{padding:18px}}`;
    document.head.appendChild(s);
  }

  function ensureUserPanel(){
    if(document.getElementById('userAdmin'))return;
    const grid=document.querySelector('#adminPage .admin-grid');if(!grid)return;
    const panel=document.createElement('div');panel.className='panel';panel.innerHTML='<div class="panel-head"><h3>現在の使用者</h3></div><div class="admin-account-note">備品に登録されている使用者を一覧表示します。名前を編集すると、その人が使用中の備品すべてに反映されます。</div><div id="userAdmin" class="master-list"></div>';
    const first=grid.querySelector('.panel');
    if(first?.nextSibling)grid.insertBefore(panel,first.nextSibling);else grid.appendChild(panel);
  }

  function ensureAdminCreateButton(){
    const host=document.getElementById('profileTable');
    const head=host?.closest('.panel')?.querySelector('.panel-head');
    if(!head||document.getElementById('addAdminAccountBtn'))return;
    const b=document.createElement('button');
    b.type='button';b.id='addAdminAccountBtn';b.className='primary';b.textContent='＋ 管理者追加';
    head.appendChild(b);
  }

  function generatePassword(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const symbols='!@#$%';
    const bytes=new Uint32Array(12);crypto.getRandomValues(bytes);
    let out='';for(let i=0;i<10;i++)out+=chars[bytes[i]%chars.length];
    out+=symbols[bytes[10]%symbols.length]+String(bytes[11]%10);
    return out;
  }

  function openAdminCreateDialog(){
    document.getElementById('adminCreateOverlay')?.remove();
    const overlay=document.createElement('div');overlay.id='adminCreateOverlay';overlay.className='admin-create-overlay';
    const card=document.createElement('div');card.className='admin-create-card';
    card.innerHTML=`<h3>管理者アカウントを追加</h3><p>作成したアカウントはすぐに管理者としてログインできます。一般社員用アカウントは作成しません。</p><label>表示名<input id="newAdminName" autocomplete="name" placeholder="例：西村"></label><label>メールアドレス<input id="newAdminEmail" type="email" autocomplete="email" placeholder="example@company.jp"></label><div class="password-line"><label style="margin:0">初期パスワード<input id="newAdminPassword" type="text" autocomplete="new-password" placeholder="8文字以上"></label><button type="button" class="secondary" id="generateAdminPasswordBtn">自動生成</button></div><div style="font-size:12px;color:var(--muted);margin-top:7px">初回ログイン用のパスワードです。作成後、本人へ安全な方法で伝えてください。</div><div id="adminCreateError" class="admin-create-error"></div><div class="admin-create-actions"><button type="button" class="secondary" id="cancelAdminCreateBtn">キャンセル</button><button type="button" class="primary" id="saveAdminCreateBtn">管理者を作成</button></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const name=card.querySelector('#newAdminName'),email=card.querySelector('#newAdminEmail'),password=card.querySelector('#newAdminPassword');
    card.querySelector('#generateAdminPasswordBtn').onclick=()=>{password.value=generatePassword();password.focus();password.select();};
    card.querySelector('#cancelAdminCreateBtn').onclick=()=>overlay.remove();
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    card.querySelector('#saveAdminCreateBtn').onclick=async()=>{
      const err=card.querySelector('#adminCreateError');err.textContent='';
      const n=name.value.trim(),em=email.value.trim().toLowerCase(),pw=password.value;
      if(!n){err.textContent='表示名を入力してください。';name.focus();return;}
      if(!em||!email.checkValidity()){err.textContent='正しいメールアドレスを入力してください。';email.focus();return;}
      if(pw.length<8){err.textContent='初期パスワードは8文字以上にしてください。';password.focus();return;}
      const save=card.querySelector('#saveAdminCreateBtn');save.disabled=true;save.textContent='作成中…';
      try{
        const c=db();if(!c)throw new Error('Supabaseに接続できません。');
        const {data,error}=await c.functions.invoke('admin-users',{body:{action:'create',name:n,email:em,password:pw,role:'admin'}});
        if(error){
          let message=error.message||'管理者を作成できませんでした。';
          try{const details=await error.context?.json?.();if(details?.error)message=details.error;}catch(_e){}
          throw new Error(message);
        }
        if(data?.error)throw new Error(data.error);
        alert(`管理者アカウントを作成しました。\n\n${n}\n${em}\n\n初期パスワードは作成した管理者へ伝えてください。`);
        overlay.remove();
        await renderProfiles();ensureAdminCreateButton();
      }catch(e){err.textContent=e.message||'管理者を作成できませんでした。';}
      finally{if(document.body.contains(save)){save.disabled=false;save.textContent='管理者を作成';}}
    };
    name.focus();
  }

  async function renderProfiles(){
    const host=document.getElementById('profileTable');if(!host)return;
    const panel=host.closest('.panel');const h=panel?.querySelector('.panel-head h3');if(h)h.textContent='管理者アカウント';
    ensureAdminCreateButton();
    const c=db();
    const {data,error}=await c.from('profiles').select('id,name,email,role').order('name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    const rows=data||[];
    host.innerHTML=`<div class="admin-account-note">管理者はこの画面から別の管理者アカウントを追加できます。一般社員はアカウントを作らず、QRコードから閲覧します。</div>`+
      (rows.length?rows.map(x=>`<div class="master-row" data-profile-row="${x.id}"><span><strong>${esc(x.name||'名称未設定')}</strong><small class="admin-account-meta">${esc(x.email||'メール未設定')}</small></span><div class="master-actions">${x.role==='admin'?`<span class="badge use">管理者</span><button type="button" class="master-mini profile-name-edit" data-id="${x.id}" data-name="${esc(x.name||'')}">名前編集</button>`:`<span class="badge">旧権限: ${esc(x.role||'未設定')}</span><button type="button" class="master-mini promote profile-promote" data-id="${x.id}" data-name="${esc(x.name||x.email||'このアカウント')}">管理者にする</button>`}</div></div>`).join(''):'<div class="empty">アカウントはありません。</div>');
  }

  async function renderUsers(){
    ensureUserPanel();
    const host=document.getElementById('userAdmin');if(!host)return;
    const c=db();
    const {data,error}=await c.from('assets').select('id,asset_no,name,user_name,status').not('user_name','is',null).order('user_name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    const map=new Map();
    (data||[]).forEach(a=>{
      const name=String(a.user_name||'').trim();if(!name)return;
      if(!map.has(name))map.set(name,[]);
      map.get(name).push(a);
    });
    userGroups=[...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],'ja')).map(([name,items])=>({name,items}));
    host.innerHTML=userGroups.length?userGroups.map((g,i)=>{
      const items=g.items.slice(0,4).map(a=>`${esc(a.asset_no||'-')} ${esc(a.name||'')}`).join('、');
      const more=g.items.length>4?` ほか${g.items.length-4}件`:'';
      return `<div class="master-row"><span><strong>${esc(g.name)}</strong><small class="user-admin-assets">${items}${more}</small></span><div class="master-actions"><span class="user-admin-count">${g.items.length}件</span><button type="button" class="master-mini user-name-edit" data-index="${i}">名前編集</button></div></div>`;
    }).join(''):'<div class="empty">現在の使用者は登録されていません。</div>';
  }

  async function renderOne(def){
    const host=document.getElementById(def.host);if(!host)return;
    const c=db();
    const {data,error}=await c.from(def.table).select('id,name,is_active').eq('is_active',true).order('name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    const filtered=(data||[]).filter(x=>def.table!=='categories'||!String(x.name||'').startsWith('__USER__:'));
    host.innerHTML=filtered.length?filtered.map(x=>`<div class="master-row" data-master-id="${x.id}"><strong>${esc(x.name)}</strong><div class="master-actions"><button type="button" class="master-mini master-edit" data-table="${def.table}" data-id="${x.id}" data-name="${esc(x.name)}">編集</button><button type="button" class="master-mini danger master-delete" data-table="${def.table}" data-id="${x.id}" data-name="${esc(x.name)}">削除</button></div></div>`).join(''):'<div class="empty">登録なし</div>';
  }

  function ensureAddButtons(){
    defs.forEach(def=>{
      const host=document.getElementById(def.host);const panel=host?.closest('.panel');const head=panel?.querySelector('.panel-head');
      if(!head||head.querySelector(`[data-add-table="${def.table}"]`))return;
      const b=document.createElement('button');b.type='button';b.className='secondary master-add';b.dataset.addTable=def.table;b.dataset.title=def.title;b.textContent='＋ 追加';head.appendChild(b);
    });
  }

  async function render(){
    if(rendering)return;
    if(!document.getElementById('adminPage'))return;
    if(!(await isAdmin()))return;
    rendering=true;ensureStyles();ensureUserPanel();ensureAddButtons();ensureAdminCreateButton();
    try{await renderProfiles();await renderUsers();for(const def of defs)await renderOne(def);}finally{rendering=false;}
  }

  function reopenAdminAfterReload(){sessionStorage.setItem('reopenAdmin','1');location.reload();}

  document.addEventListener('click',async e=>{
    if(e.target.closest('#addAdminAccountBtn')){openAdminCreateDialog();return;}
    const userEdit=e.target.closest('.user-name-edit');
    if(userEdit){
      const group=userGroups[Number(userEdit.dataset.index)];if(!group)return;
      const next=prompt('使用者の新しい名前を入力してください',group.name);if(!next||!next.trim()||next.trim()===group.name)return;
      if(!confirm(`「${group.name}」を「${next.trim()}」へ変更しますか？\nこの使用者が登録されている ${group.items.length} 件の備品すべてに反映されます。`))return;
      const c=db();const {error}=await c.from('assets').update({user_name:next.trim()}).eq('user_name',group.name);
      if(error){alert('使用者名を変更できませんでした: '+error.message);return;}
      await renderUsers();return;
    }
    const promote=e.target.closest('.profile-promote');
    if(promote){
      if(!confirm(`「${promote.dataset.name}」を管理者にしますか？\n管理者は備品・履歴・管理画面をすべて編集できます。`))return;
      const c=db();const {error}=await c.from('profiles').update({role:'admin'}).eq('id',promote.dataset.id);
      if(error){alert('管理者に変更できませんでした: '+error.message);return;}await render();return;
    }
    const nameEdit=e.target.closest('.profile-name-edit');
    if(nameEdit){
      const name=prompt('管理者の表示名を入力してください',nameEdit.dataset.name||'');if(!name||!name.trim())return;
      const c=db();const {error}=await c.from('profiles').update({name:name.trim(),role:'admin'}).eq('id',nameEdit.dataset.id);
      if(error){alert('名前を変更できませんでした: '+error.message);return;}await render();return;
    }
    const add=e.target.closest('[data-add-table]');
    if(add){
      const name=prompt(`${add.dataset.title}の名前を入力してください`);if(!name||!name.trim())return;
      const c=db();const {error}=await c.from(add.dataset.addTable).insert({name:name.trim(),is_active:true});
      if(error){alert('追加できませんでした: '+error.message);return;}reopenAdminAfterReload();return;
    }
    const edit=e.target.closest('.master-edit');
    if(edit){
      const name=prompt('新しい名前を入力してください',edit.dataset.name||'');if(!name||!name.trim()||name.trim()===edit.dataset.name)return;
      const c=db();const {error}=await c.from(edit.dataset.table).update({name:name.trim()}).eq('id',edit.dataset.id);
      if(error){alert('編集できませんでした: '+error.message);return;}reopenAdminAfterReload();return;
    }
    const del=e.target.closest('.master-delete');
    if(del){
      if(!confirm(`「${del.dataset.name}」を削除しますか？\n既存の備品データは残し、新しい選択肢から非表示にします。`))return;
      const c=db();const {error}=await c.from(del.dataset.table).update({is_active:false}).eq('id',del.dataset.id);
      if(error){alert('削除できませんでした: '+error.message);return;}reopenAdminAfterReload();return;
    }
    if(e.target.closest('.nav-btn[data-page="admin"]'))setTimeout(render,250);
  });

  const obs=new MutationObserver(()=>{
    if(rendering)return;
    const page=document.getElementById('adminPage');if(!page||page.classList.contains('hidden'))return;
    const profileHost=document.getElementById('profileTable');
    const legacyRoles=profileHost?.querySelector('.role-select');
    const needs=legacyRoles||!document.getElementById('userAdmin')||!document.getElementById('addAdminAccountBtn')||defs.some(d=>{const h=document.getElementById(d.host);return h&&!h.querySelector('.master-actions')&&!h.querySelector('.empty')});
    if(needs)setTimeout(render,60);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    ensureStyles();ensureUserPanel();ensureAdminCreateButton();
    enforceAdminOnly();
    const c=db();c?.auth.onAuthStateChange(()=>setTimeout(enforceAdminOnly,0));
    const adminPage=document.getElementById('adminPage');if(adminPage)obs.observe(adminPage,{childList:true,subtree:true});
    if(sessionStorage.getItem('reopenAdmin')==='1'){
      sessionStorage.removeItem('reopenAdmin');
      setTimeout(()=>document.querySelector('.nav-btn[data-page="admin"]')?.click(),700);
    }
  });
})();