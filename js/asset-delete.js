(function(){
  'use strict';

  let client=null;
  let currentAssetId=null;
  let observer=null;

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

  async function resolveAssetId(){
    try{
      const fromUrl=new URL(location.href).searchParams.get('asset');
      if(fromUrl)return fromUrl;
    }catch(_e){}

    if(currentAssetId)return currentAssetId;

    const assetNo=detailValue('管理No.');
    if(!assetNo)return null;
    const c=db();
    if(!c)return null;
    const {data,error}=await c.from('assets').select('id').eq('asset_no',assetNo).eq('is_deleted',false).maybeSingle();
    if(error)throw error;
    return data?.id||null;
  }

  async function deleteAsset(button){
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
      const id=await resolveAssetId();
      if(!id)throw new Error('削除する備品を特定できませんでした。いったん備品一覧から開き直してください。');

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

  function start(){
    const detail=document.getElementById('assetDetail');
    if(!detail)return;
    if(observer)observer.disconnect();
    observer=new MutationObserver(()=>addDeleteButton());
    observer.observe(detail,{childList:true,subtree:true});
    addDeleteButton();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',start,{once:true});
  }else{
    start();
  }
})();
