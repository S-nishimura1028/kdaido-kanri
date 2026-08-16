(function(){
  'use strict';

  let client=null;
  let currentAssetId=new URL(location.href).searchParams.get('asset')||null;

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function canEdit(){
    const c=db(); if(!c)return false;
    const {data:{session}}=await c.auth.getSession();
    if(!session)return false;
    const {data}=await c.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
    return ['manager','admin'].includes(data?.role);
  }

  async function editCurrentUser(){
    if(!currentAssetId){alert('備品を特定できませんでした。');return;}
    const c=db(); if(!c){alert('接続準備ができていません。');return;}

    const {data:a,error}=await c.from('assets').select('id,asset_no,name,user_name,status').eq('id',currentAssetId).single();
    if(error||!a){alert('備品情報を取得できませんでした。');return;}

    const value=prompt(`現在の使用者を入力してください\n${a.asset_no||''} / ${a.name||''}\n\n空欄にすると「使用者なし」にします。`,a.user_name||'');
    if(value===null)return;
    const name=value.trim();
    const payload={user_name:name||null};
    if(name&&a.status==='未使用')payload.status='使用中';
    if(!name&&a.status==='使用中')payload.status='未使用';

    const {error:updateError}=await c.from('assets').update(payload).eq('id',a.id);
    if(updateError){alert('使用者を更新できませんでした: '+updateError.message);return;}
    location.reload();
  }

  async function addButton(){
    const detail=document.getElementById('detailDialog');
    const actions=document.querySelector('#assetDetail .dialog-actions');
    if(!detail||!detail.open||!actions||document.getElementById('currentUserQuickEditBtn'))return;
    if(!(await canEdit()))return;

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='currentUserQuickEditBtn';
    btn.className='secondary';
    btn.textContent='使用者変更';
    btn.style.minHeight='48px';
    btn.addEventListener('click',editCurrentUser);
    const qr=document.getElementById('qrBtn');
    actions.insertBefore(btn,qr||null);
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-id]');
    if(row?.dataset.id)currentAssetId=row.dataset.id;
    setTimeout(addButton,0);
  },true);

  const obs=new MutationObserver(()=>setTimeout(addButton,0));
  document.addEventListener('DOMContentLoaded',()=>{
    obs.observe(document.getElementById('detailDialog')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    setTimeout(addButton,0);
  });
})();
