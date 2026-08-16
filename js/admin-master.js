(function(){
  'use strict';
  let client=null,rendering=false,guarding=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
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
    s.textContent=`.master-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.master-mini{border:0;border-radius:8px;padding:7px 10px;font-weight:700;background:#edf4f2;color:#355e55}.master-mini.danger{background:#f8eceb;color:#9b2c22}.master-mini.promote{background:#e8f1fb;color:#075b9b}.master-add{margin-left:auto}.master-row strong{overflow-wrap:anywhere}.admin-account-note{font-size:13px;color:var(--muted);line-height:1.6;padding:2px 0 12px}.admin-account-meta{display:block;color:var(--muted);font-size:12px;margin-top:3px}`;
    document.head.appendChild(s);
  }

  async function renderProfiles(){
    const host=document.getElementById('profileTable');if(!host)return;
    const panel=host.closest('.panel');const h=panel?.querySelector('.panel-head h3');if(h)h.textContent='管理者アカウント';
    const c=db();
    const {data,error}=await c.from('profiles').select('id,name,email,role').order('name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    const rows=data||[];
    host.innerHTML=`<div class="admin-account-note">このアプリへログインできるのは管理者だけです。一般社員はアカウントを作らず、QRコードから閲覧します。旧アカウントが残っている場合は「管理者にする」で統一できます。</div>`+
      (rows.length?rows.map(x=>`<div class="master-row" data-profile-row="${x.id}"><span><strong>${esc(x.name||'名称未設定')}</strong><small class="admin-account-meta">${esc(x.email||'メール未設定')}</small></span><div class="master-actions">${x.role==='admin'?`<span class="badge use">管理者</span><button type="button" class="master-mini profile-name-edit" data-id="${x.id}" data-name="${esc(x.name||'')}">名前編集</button>`:`<span class="badge">旧権限: ${esc(x.role||'未設定')}</span><button type="button" class="master-mini promote profile-promote" data-id="${x.id}" data-name="${esc(x.name||x.email||'このアカウント')}">管理者にする</button>`}</div></div>`).join(''):'<div class="empty">アカウントはありません。</div>');
  }

  async function renderOne(def){
    const host=document.getElementById(def.host);if(!host)return;
    const c=db();
    const {data,error}=await c.from(def.table).select('id,name,is_active').eq('is_active',true).order('name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    host.innerHTML=(data||[]).length?(data||[]).map(x=>`<div class="master-row" data-master-id="${x.id}"><strong>${esc(x.name)}</strong><div class="master-actions"><button type="button" class="master-mini master-edit" data-table="${def.table}" data-id="${x.id}" data-name="${esc(x.name)}">編集</button><button type="button" class="master-mini danger master-delete" data-table="${def.table}" data-id="${x.id}" data-name="${esc(x.name)}">削除</button></div></div>`).join(''):'<div class="empty">登録なし</div>';
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
    rendering=true;ensureStyles();ensureAddButtons();
    try{await renderProfiles();for(const def of defs)await renderOne(def);}finally{rendering=false;}
  }

  function reopenAdminAfterReload(){sessionStorage.setItem('reopenAdmin','1');location.reload();}

  document.addEventListener('click',async e=>{
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
    const needs=legacyRoles||defs.some(d=>{const h=document.getElementById(d.host);return h&&!h.querySelector('.master-actions')&&!h.querySelector('.empty')});
    if(needs)setTimeout(render,60);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    ensureStyles();
    enforceAdminOnly();
    const c=db();c?.auth.onAuthStateChange(()=>setTimeout(enforceAdminOnly,0));
    const adminPage=document.getElementById('adminPage');if(adminPage)obs.observe(adminPage,{childList:true,subtree:true});
    if(sessionStorage.getItem('reopenAdmin')==='1'){
      sessionStorage.removeItem('reopenAdmin');
      setTimeout(()=>document.querySelector('.nav-btn[data-page="admin"]')?.click(),700);
    }
  });
})();