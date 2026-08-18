(function(){
  'use strict';

  let client=null;
  let currentAssetId=null;

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  function detailValue(label){
    const items=document.querySelectorAll('#assetDetail .detail-item');
    for(const item of items){
      const small=item.querySelector('small');
      if((small?.textContent||'').trim()!==label)continue;
      const clone=item.cloneNode(true);
      clone.querySelector('small')?.remove();
      return (clone.textContent||'').trim();
    }
    return '';
  }

  function resolveAssetId(){
    if(currentAssetId)return currentAssetId;
    try{return new URL(location.href).searchParams.get('asset')||null;}catch(_e){return null;}
  }

  async function deleteAsset(button){
    const id=resolveAssetId();
    if(!id){alert('削除する備品を特定できませんでした。いったん備品一覧から開き直してください。');return;}

    const assetNo=detailValue('管理No.')||'（番号なし）';
    const assetName=detailValue('名称')||'この備品';
    const ok=confirm(`${assetNo} / ${assetName}\n\nこの備品を削除しますか？\n一覧・ダッシュボード・QR閲覧からは表示されなくなります。\n変更履歴は残ります。`);
    if(!ok)return;

    button.disabled=true;
    const oldText=button.textContent;
    button.textContent='削除中…';
    try{
      const c=db();
      if(!c)throw new Error('Supabaseに接続できません。');
      const {error}=await c.from('assets').update({is_deleted:true,deleted_at:new Date().toISOString()}).eq('id',id);
      if(error)throw error;

      document.getElementById('detailDialog')?.close();
      try{
        const url=new URL(location.href);
        if(url.searchParams.get('asset')===String(id)){
          url.searchParams.delete('asset');
          history.replaceState(null,'',url.pathname+(url.search?url.search:'')+url.hash);
        }
      }catch(_e){}
      alert(`${assetNo} / ${assetName} を削除しました。\n履歴には「削除」として残ります。`);
      location.reload();
    }catch(e){
      console.error(e);
      const msg=(e&&typeof e==='object'&&(e.message||e.error_description||e.details))||String(e||'');
      alert('削除できませんでした。'+(msg?`\n${msg}`:''));
      button.disabled=false;
      button.textContent=oldText;
    }
  }

  function addDeleteButton(){
    const detail=document.getElementById('assetDetail');
    const actions=detail?.querySelector('.dialog-actions');
    const edit=detail?.querySelector('#detailEditBtn');
    if(!actions||!edit||actions.querySelector('#detailDeleteBtn'))return;

    const button=document.createElement('button');
    button.type='button';
    button.id='detailDeleteBtn';
    button.className='secondary';
    button.textContent='削除';
    button.style.cssText='min-height:48px;border-color:#dc2626;color:#b91c1c;background:#fff;';
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();deleteAsset(button);});
    actions.insertBefore(button,actions.firstChild);
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-id]');
    if(row?.dataset?.id)currentAssetId=row.dataset.id;
  },true);

  const observer=new MutationObserver(()=>addDeleteButton());
  window.addEventListener('DOMContentLoaded',()=>{
    const detail=document.getElementById('assetDetail');
    if(detail)observer.observe(detail,{childList:true,subtree:true});
    addDeleteButton();
  });
})();
