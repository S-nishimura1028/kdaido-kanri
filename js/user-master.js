(function(){
  'use strict';
  const PREFIX='__USER__:';
  const RESERVED_RE=/^__USER__:?\s*/;
  let client=null,refreshing=false,seedChecked=false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const db=()=>client||(window.supabase&&window.SUPABASE_URL&&window.SUPABASE_PUBLISHABLE_KEY?(client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY)):null);
  const isReserved=n=>RESERVED_RE.test(String(n||''));
  const displayName=n=>String(n||'').replace(RESERVED_RE,'').trim();
  const storedName=n=>PREFIX+String(n||'').trim();

  function ensureSelect(){
    const old=document.getElementById('currentUserName');
    if(!old||old.tagName==='SELECT')return;
    const select=document.createElement('select');
    select.id='currentUserName';
    select.innerHTML='<option value="">未使用・使用者なし</option>';
    old.replaceWith(select);
  }

  function ensureAdminPanel(){
    const grid=document.querySelector('#adminPage .admin-grid');
    if(!grid||document.getElementById('userMasterAdmin'))return;
    const panel=document.createElement('div');
    panel.className='panel';
    panel.innerHTML='<div class="panel-head"><h3>使用者</h3><button type="button" class="secondary" id="addUserMasterBtn">＋ 追加</button></div><div id="userMasterAdmin" class="master-list"></div>';
    grid.appendChild(panel);
  }

  function ensureHideStyle(){
    if(document.getElementById('userMasterHideStyle'))return;
    const s=document.createElement('style');
    s.id='userMasterHideStyle';
    s.textContent='.master-row:has(.master-edit[data-table="categories"][data-name^="__USER__"]),.master-row:has(.master-delete[data-table="categories"][data-name^="__USER__"]){display:none!important}';
    document.head.appendChild(s);
  }

  function hideReservedCategoryEntries(){
    document.querySelectorAll('#assetCategory option,#assetCategoryForm option').forEach(o=>{if(isReserved(o.textContent))o.remove();});
    document.querySelectorAll('#categoryAdmin .master-row').forEach(r=>{if(isReserved(r.querySelector('strong,span')?.textContent))r.remove();});
  }

  async function ensureInitialUser(name){
    if(seedChecked)return;
    seedChecked=true;
    const c=db();if(!c)return;
    const {data,error}=await c.from('categories').select('id,name,is_active');
    if(error)throw error;
    const exists=(data||[]).some(x=>isReserved(x.name)&&displayName(x.name)===name);
    if(!exists){
      const r=await c.from('categories').insert({name:storedName(name),is_active:true});
      if(r.error)throw r.error;
    }
  }

  async function normalizeStatuses(){
    const c=db();if(!c)return;
    const {data,error}=await c.from('assets').select('id,user_name,status');
    if(error)throw error;
    const fixes=[];
    for(const a of data||[]){
      const hasUser=Boolean(String(a.user_name||'').trim());
      if(!hasUser&&a.status==='使用中') fixes.push(c.from('assets').update({status:'未使用'}).eq('id',a.id));
      else if(hasUser&&a.status==='未使用') fixes.push(c.from('assets').update({status:'使用中'}).eq('id',a.id));
    }
    if(fixes.length){
      const results=await Promise.all(fixes);
      const failed=results.find(r=>r.error);if(failed?.error)throw failed.error;
    }
  }

  async function readUsers(){
    const c=db();if(!c)return {masters:[],assets:[]};
    const [m,a]=await Promise.all([
      c.from('categories').select('id,name,is_active').eq('is_active',true).order('name'),
      c.from('assets').select('user_name').not('user_name','is',null)
    ]);
    if(m.error)throw m.error;if(a.error)throw a.error;
    return {masters:(m.data||[]).filter(x=>isReserved(x.name)),assets:a.data||[]};
  }

  async function refresh(){
    if(refreshing)return;refreshing=true;
    try{
      ensureSelect();ensureAdminPanel();ensureHideStyle();hideReservedCategoryEntries();
      await ensureInitialUser('西村');
      await normalizeStatuses();
      const {masters,assets}=await readUsers();
      const masterMap=new Map(masters.map(x=>[displayName(x.name),x]));
      const names=[...new Set([...masterMap.keys(),...assets.map(x=>String(x.user_name||'').trim()).filter(Boolean)])].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ja'));
      const select=document.getElementById('currentUserName');
      if(select){
        const current=select.value;
        select.innerHTML='<option value="">未使用・使用者なし</option>'+names.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
        if(names.includes(current))select.value=current;
      }
      const host=document.getElementById('userMasterAdmin');
      if(host){
        host.innerHTML=names.length?names.map(n=>{
          const master=masterMap.get(n);const count=assets.filter(a=>String(a.user_name||'').trim()===n).length;
          return `<div class="master-row"><span><strong>${esc(n)}</strong><small style="display:block;color:var(--muted);font-size:12px">使用中の備品 ${count}件${master?'':' / 備品データから検出'}</small></span><div class="master-actions"><button type="button" class="master-mini user-master-edit" data-id="${master?.id||''}" data-name="${esc(n)}">編集</button><button type="button" class="master-mini danger user-master-delete" data-id="${master?.id||''}" data-name="${esc(n)}">削除</button></div></div>`;
        }).join(''):'<div class="empty">使用者はまだ登録されていません。</div>';
      }
      hideReservedCategoryEntries();
    }catch(e){console.warn('user master refresh',e);const h=document.getElementById('userMasterAdmin');if(h)h.innerHTML=`<div class="error">使用者一覧を読み込めませんでした: ${esc(e.message||'')}</div>`;}
    finally{refreshing=false;}
  }

  async function addUser(name){
    const c=db(),n=String(name||'').trim();if(!c||!n)return;
    const {data,error}=await c.from('categories').select('id,name,is_active');if(error)throw error;
    const exists=(data||[]).find(x=>isReserved(x.name)&&displayName(x.name)===n);
    if(exists){if(!exists.is_active){const r=await c.from('categories').update({is_active:true}).eq('id',exists.id);if(r.error)throw r.error;}return;}
    const {error:insertError}=await c.from('categories').insert({name:storedName(n),is_active:true});if(insertError)throw insertError;
  }

  function syncStatusFromUser(){
    const user=document.getElementById('currentUserName');
    const status=document.getElementById('statusForm');
    if(!user||!status)return;
    const hasUser=Boolean(String(user.value||'').trim());
    if(hasUser&&status.value==='未使用')status.value='使用中';
    if(!hasUser&&status.value==='使用中')status.value='未使用';
  }

  document.addEventListener('change',e=>{
    if(e.target?.id==='currentUserName')syncStatusFromUser();
  });

  document.addEventListener('submit',e=>{
    if(e.target?.id==='assetForm')syncStatusFromUser();
  },true);

  document.addEventListener('click',async e=>{
    if(e.target.closest('#addUserMasterBtn')){
      const name=prompt('使用者名を入力してください');if(!name||!name.trim())return;
      try{await addUser(name);await refresh();}catch(err){alert('使用者を追加できませんでした: '+err.message);}return;
    }
    const edit=e.target.closest('.user-master-edit');
    if(edit){
      const oldName=edit.dataset.name||'';const next=prompt('使用者名を変更してください',oldName);if(!next||!next.trim()||next.trim()===oldName)return;
      try{
        const c=db();await addUser(next.trim());
        const r=await c.from('assets').update({user_name:next.trim()}).eq('user_name',oldName);if(r.error)throw r.error;
        if(edit.dataset.id){const d=await c.from('categories').update({is_active:false}).eq('id',edit.dataset.id);if(d.error)throw d.error;}
        await refresh();
      }catch(err){alert('使用者名を変更できませんでした: '+err.message);}return;
    }
    const del=e.target.closest('.user-master-delete');
    if(del){
      const name=del.dataset.name||'';const {count}=await db().from('assets').select('id',{count:'exact',head:true}).eq('user_name',name);
      if(count>0&&!confirm(`「${name}」は現在 ${count}件の備品で使用者になっています。\n一覧から削除しても備品側の使用者名は残します。削除しますか？`))return;
      if(count===0&&!confirm(`「${name}」を使用者一覧から削除しますか？`))return;
      try{if(del.dataset.id){const r=await db().from('categories').update({is_active:false}).eq('id',del.dataset.id);if(r.error)throw r.error;}await refresh();}catch(err){alert('使用者を削除できませんでした: '+err.message);}return;
    }
    if(e.target.closest('.nav-btn[data-page="admin"]'))setTimeout(refresh,180);
    if(e.target.closest('#newAssetBtn,.edit-asset,#detailEditBtn'))setTimeout(()=>{refresh();syncStatusFromUser();},120);
  });

  ensureSelect();ensureHideStyle();hideReservedCategoryEntries();
  const obs=new MutationObserver(()=>{hideReservedCategoryEntries();if(!document.getElementById('adminPage')?.classList.contains('hidden'))setTimeout(refresh,60);});
  function init(){
    ensureSelect();ensureAdminPanel();ensureHideStyle();hideReservedCategoryEntries();
    const admin=document.getElementById('adminPage');if(admin)obs.observe(admin,{childList:true,subtree:true});
    const c=db();c?.auth.onAuthStateChange(()=>setTimeout(refresh,250));
    setTimeout(refresh,500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();