(function(){
  'use strict';

  function clearAssetNo(){
    const input=document.getElementById('assetNo');
    if(!input)return;
    input.required=false;
    input.removeAttribute('required');
    input.value='';
    const label=input.closest('label');
    if(label)label.style.display='none';
  }

  function removeDetailAssetNo(){
    document.querySelectorAll('#assetDetail .detail-item').forEach(item=>{
      const small=item.querySelector('small');
      if((small?.textContent||'').trim()==='管理No.')item.remove();
    });
    const qrArea=document.getElementById('qrArea');
    const title=qrArea?.querySelector('div');
    if(title&&title.textContent.includes(' / ')){
      title.textContent=title.textContent.split(' / ').slice(1).join(' / ');
    }
  }

  function apply(){
    clearAssetNo();
    removeDetailAssetNo();
  }

  document.addEventListener('click',e=>{
    if(e.target.closest('#newAssetBtn,.edit-asset,#detailEditBtn')){
      setTimeout(clearAssetNo,0);
    }
  },true);

  document.addEventListener('submit',e=>{
    if(e.target?.id==='assetForm')clearAssetNo();
  },true);

  const observer=new MutationObserver(apply);
  function start(){
    apply();
    const detail=document.getElementById('assetDetail');
    if(detail)observer.observe(detail,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
