(function(){
  'use strict';
  let client=null,rendering=false;
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

  async function isAdmin(){
    const c=db();if(!c)return false;
    const {data:{session}}=await c.auth.getSession();if(!session)return false;
    const {data}=await c.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
    return data?.role==='admin';
  }

  function ensureStyles(){
    if(document.getElementById('adminMasterStyle'))return;
    const s=document.createElement('style');s.id='adminMasterStyle';
    s.textContent=`.master-actions{display:flex;gap:6px;align-items:center}.master-mini{border:0;border-radius:8px;padding:7px 10px;font-weight:700;background:#edf4f2;color:#355e55}.master-mini.danger{background:#f8eceb;color:#9b2c22}.master-add{margin-left:auto}.master-row strong{overflow-wrap:anywhere}`;
    document.head.appendChild(s);
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
    try{for(const def of defs)await renderOne(def);}finally{rendering=false;}
  }

  function reopenAdminAfterReload(){sessionStorage.setItem('reopenAdmin','1');location.reload();}

  document.addEventListener('click',async e=>{
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
    if(e.target.closest('.nav-btn[data-page="admin"]')) setTimeout(render,250);
  });

  const obs=new MutationObserver(()=>{
    if(rendering)return;
    const page=document.getElementById('adminPage');if(!page||page.classList.contains('hidden'))return;
    const needs=defs.some(d=>{const h=document.getElementById(d.host);return h&&!h.querySelector('.master-actions')&&!h.querySelector('.empty')});
    if(needs)setTimeout(render,50);
  });
  document.addEventListener('DOMContentLoaded',()=>{
    const adminPage=document.getElementById('adminPage');if(adminPage)obs.observe(adminPage,{childList:true,subtree:true});
    if(sessionStorage.getItem('reopenAdmin')==='1'){
      sessionStorage.removeItem('reopenAdmin');
      setTimeout(()=>document.querySelector('.nav-btn[data-page="admin"]')?.click(),700);
    }
  });
})();