(function(){
  'use strict';

  const USER_PREFIX='__USER__:';
  let client=null;
  let currentAssetId=new URL(location.href).searchParams.get('asset')||null;

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function loadUserChoices(c,currentName){
    const [masters,used]=await Promise.all([
      c.from('categories').select('name').like('name',USER_PREFIX+'%').eq('is_active',true).order('name'),
      c.from('assets').select('user_name').not('user_name','is',null)
    ]);
    if(masters.error)throw masters.error;
    if(used.error)throw used.error;
    const names=new Set();
    (masters.data||[]).forEach(x=>{
      const raw=String(x.name||'');
      if(raw.startsWith(USER_PREFIX)){
        const name=raw.slice(USER_PREFIX.length).trim();
        if(name)names.add(name);
      }
    });
    (used.data||[]).forEach(x=>{
      const name=String(x.user_name||'').trim();
      if(name)names.add(name);
    });
    if(currentName)names.add(String(currentName).trim());
    return [...names].filter(Boolean).sort((a,b)=>a.localeCompare(b,'ja'));
  }

  function chooseUser(asset,names){
    return new Promise(resolve=>{
      document.getElementById('currentUserPickerOverlay')?.remove();
      const overlay=document.createElement('div');
      overlay.id='currentUserPickerOverlay';
      overlay.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(4,30,47,.55);display:grid;place-items:center;padding:16px;backdrop-filter:blur(3px)';
      const card=document.createElement('div');
      card.style.cssText='width:min(440px,94vw);background:#fff;border-radius:18px;padding:20px;box-shadow:0 24px 70px rgba(0,0,0,.28);border:1px solid #dbe8e3';
      const title=document.createElement('h3');
      title.textContent='使用者変更';
      title.style.cssText='margin:0 0 6px;color:#173f59';
      const desc=document.createElement('div');
      desc.textContent=`${asset.asset_no||''} / ${asset.name||''}`;
      desc.style.cssText='font-size:13px;color:#668078;margin-bottom:14px';
      const label=document.createElement('label');
      label.textContent='現在の使用者';
      label.style.cssText='display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px';
      const select=document.createElement('select');
      select.id='currentUserPickerSelect';
      select.style.cssText='width:100%;min-height:48px;border:1px solid #ccddd7;border-radius:11px;padding:10px 11px;background:#fff;font-size:16px';
      const empty=document.createElement('option');
      empty.value='';
      empty.textContent='使用者なし（未使用）';
      select.appendChild(empty);
      names.forEach(name=>{
        const option=document.createElement('option');
        option.value=name;
        option.textContent=name;
        select.appendChild(option);
      });
      select.value=asset.user_name||'';
      label.appendChild(select);
      const actions=document.createElement('div');
      actions.style.cssText='display:flex;gap:10px;justify-content:flex-end;margin-top:18px';
      const cancel=document.createElement('button');
      cancel.type='button';cancel.className='secondary';cancel.textContent='キャンセル';cancel.style.minHeight='46px';
      const save=document.createElement('button');
      save.type='button';save.className='primary';save.textContent='変更する';save.style.minHeight='46px';
      actions.append(cancel,save);
      card.append(title,desc,label,actions);overlay.appendChild(card);document.body.appendChild(overlay);
      let finished=false;
      const finish=value=>{if(finished)return;finished=true;overlay.remove();resolve(value);};
      cancel.addEventListener('click',()=>finish(undefined));
      save.addEventListener('click',()=>finish(select.value));
      overlay.addEventListener('click',e=>{if(e.target===overlay)finish(undefined);});
      select.focus();
    });
  }

  async function editCurrentUser(){
    if(!currentAssetId){alert('備品を特定できませんでした。');return;}
    const c=db();if(!c){alert('接続準備ができていません。');return;}
    const {data:a,error}=await c.from('assets').select('id,asset_no,name,user_name,status').eq('id',currentAssetId).single();
    if(error||!a){alert('備品情報を取得できませんでした。');return;}
    let names;
    try{names=await loadUserChoices(c,a.user_name);}catch(err){alert('使用者一覧を読み込めませんでした: '+(err.message||''));return;}
    const value=await chooseUser(a,names);
    if(value===undefined)return;
    const name=String(value||'').trim();
    const payload={user_name:name||null};
    if(['未使用','使用中'].includes(a.status))payload.status=name?'使用中':'未使用';
    const {error:updateError}=await c.from('assets').update(payload).eq('id',a.id);
    if(updateError){alert('使用者を更新できませんでした: '+updateError.message);return;}
    location.reload();
  }

  function ensureButton(){
    const detail=document.getElementById('detailDialog');
    const actions=document.querySelector('#assetDetail .dialog-actions');
    if(!detail||!detail.open||!actions)return;

    // app.js が管理者だけに出す「編集」ボタンを権限判定に使う。
    // Supabaseのセッション確認待ちでボタンが消える問題を避ける。
    if(!document.getElementById('detailEditBtn'))return;

    const existing=[...actions.querySelectorAll('button')].filter(b=>b.id==='currentUserQuickEditBtn'||b.textContent.trim()==='使用者変更');
    existing.slice(1).forEach(b=>b.remove());
    if(existing[0]){existing[0].id='currentUserQuickEditBtn';return;}

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='currentUserQuickEditBtn';
    btn.className='secondary';
    btn.textContent='使用者変更';
    btn.style.minHeight='48px';
    const qr=document.getElementById('qrBtn');
    actions.insertBefore(btn,qr||null);
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-id]');
    if(row?.dataset.id)currentAssetId=row.dataset.id;
    if(e.target.closest('#currentUserQuickEditBtn')){
      e.preventDefault();e.stopPropagation();editCurrentUser();return;
    }
    setTimeout(ensureButton,0);
  },true);

  const obs=new MutationObserver(()=>setTimeout(ensureButton,0));
  document.addEventListener('DOMContentLoaded',()=>{
    obs.observe(document.getElementById('detailDialog')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    setTimeout(ensureButton,0);
  });
})();
