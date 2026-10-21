(function(){
  'use strict';

  // Only the asset_users master is authoritative. Never write user_name alone:
  // doing so would disagree with assets.assigned_user_id and the normal editor.
  let client=null;
  let currentAssetId=new URL(location.href).searchParams.get('asset')||null;
  let busy=false;
  const db=()=>{
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    return (client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY));
  };

  function pickUser(asset,users){
    return new Promise(resolve=>{
      document.getElementById('currentUserPickerDialog')?.remove();
      const dialog=document.createElement('dialog');
      dialog.id='currentUserPickerDialog';
      dialog.style.cssText='border:0;padding:0;background:transparent;max-width:none;max-height:none';
      const card=document.createElement('div');
      card.style.cssText='width:min(440px,calc(100vw - 32px));background:#fff;border-radius:18px;padding:20px;box-sizing:border-box;box-shadow:0 24px 70px rgba(0,0,0,.28)';
      const title=document.createElement('h3');title.textContent='使用者変更';title.style.margin='0 0 12px';
      const desc=document.createElement('p');desc.textContent=asset.name||'備品';desc.style.fontSize='13px';
      const label=document.createElement('label');label.textContent='使用者マスタから選択';
      label.style.cssText='display:flex;flex-direction:column;gap:7px;font-weight:700';
      const select=document.createElement('select');
      select.style.cssText='width:100%;min-height:48px;padding:10px;border:1px solid #ccddd7;border-radius:10px;font-size:16px';
      const empty=document.createElement('option');empty.value='';empty.textContent='使用者なし（未割当）';select.appendChild(empty);
      users.forEach(u=>{
        const option=document.createElement('option');option.value=u.id;
        option.textContent=[u.name,u.department?'所属：'+u.department:'',u.room_number?'部屋：'+u.room_number:''].filter(Boolean).join(' / ');
        select.appendChild(option);
      });
      if(asset.assigned_user_id && !users.some(u=>u.id===asset.assigned_user_id)){
        const legacy=document.createElement('option');
        legacy.value=asset.assigned_user_id;
        legacy.textContent=(asset.user_name||'旧使用者')+'（マスタ無効：変更する場合は選び直してください）';
        select.appendChild(legacy);
      }
      select.value=asset.assigned_user_id||'';
      label.appendChild(select);
      const actions=document.createElement('div');actions.style.cssText='display:flex;justify-content:flex-end;gap:10px;margin-top:18px';
      const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='キャンセル';
      const save=document.createElement('button');save.type='button';save.className='primary';save.textContent='変更する';
      actions.append(cancel,save);card.append(title,desc,label,actions);dialog.appendChild(card);document.body.appendChild(dialog);
      let settled=false;
      const finish=value=>{
        if(settled)return;settled=true;
        try{if(dialog.open)dialog.close();}catch(_e){}
        dialog.remove();resolve(value);
      };
      cancel.onclick=()=>finish(null);
      save.onclick=()=>finish({id:select.value});
      dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});
      try{dialog.showModal();}catch(e){console.error(e);finish(null);}
    });
  }

  async function editCurrentUser(){
    if(busy)return;
    if(!currentAssetId){alert('備品を特定できませんでした。');return;}
    const c=db();if(!c){alert('接続準備ができていません。');return;}
    busy=true;
    try{
      const [assetResult,userResult]=await Promise.all([
        c.from('assets').select('id,name,assigned_user_id,user_name,status').eq('id',currentAssetId).eq('is_deleted',false).maybeSingle(),
        c.from('asset_users').select('id,name,department,room_number').eq('is_active',true).order('name')
      ]);
      if(assetResult.error)throw assetResult.error;
      if(userResult.error)throw userResult.error;
      const asset=assetResult.data;if(!asset)throw new Error('対象の備品がありません。');
      const users=userResult.data||[];
      const choice=await pickUser(asset,users);
      if(!choice)return;
      const user=users.find(u=>u.id===choice.id);
      // An inactive master entry is preserved when not changed.
      if(choice.id && !user && choice.id!==asset.assigned_user_id)throw new Error('選択された使用者を確認できません。');
      const payload={
        assigned_user_id:choice.id||null,
        user_name:user?.name||(choice.id===asset.assigned_user_id?asset.user_name:null)||null
      };
      if(['未使用','使用中'].includes(asset.status)){
        payload.status=choice.id?'使用中':'未使用';
      }
      const {data,error}=await c.from('assets').update(payload)
        .eq('id',asset.id).eq('is_deleted',false).select('id').single();
      if(error)throw error;
      if(!data)throw new Error('変更を保存できませんでした。');
      location.reload();
    }catch(e){console.error(e);alert('使用者を更新できませんでした。'+(e.message?'\n'+e.message:''));}
    finally{busy=false;}
  }

  function ensureButton(){
    const dialog=document.getElementById('detailDialog');
    const actions=document.querySelector('#assetDetail .dialog-actions');
    if(!dialog?.open||!actions||!document.getElementById('detailEditBtn'))return;
    if(document.getElementById('currentUserQuickEditBtn'))return;
    const button=document.createElement('button');button.type='button';
    button.id='currentUserQuickEditBtn';button.className='secondary';
    button.textContent='使用者変更';button.style.minHeight='48px';
    actions.insertBefore(button,document.getElementById('qrBtn')||null);
  }
  document.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-id]');
    if(row?.dataset.id)currentAssetId=row.dataset.id;
    if(e.target.closest('#currentUserQuickEditBtn')){
      e.preventDefault();e.stopPropagation();editCurrentUser();
    }
    setTimeout(ensureButton,0);
  },true);
  const obs=new MutationObserver(()=>setTimeout(ensureButton,0));
  document.addEventListener('DOMContentLoaded',()=>{
    obs.observe(document.getElementById('detailDialog')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
    setTimeout(ensureButton,0);
  });
})();
