(function(){
  'use strict';

  function prepareButtons(){
    const dialog=document.getElementById('assetDialog');
    if(!dialog)return;
    const closeBtn=dialog.querySelector('.dialog-head .close');
    const cancelBtn=dialog.querySelector('.dialog-actions .secondary');
    [closeBtn,cancelBtn].forEach(btn=>{if(btn)btn.type='button';});
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('#assetDialog .dialog-head .close, #assetDialog .dialog-actions .secondary');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    const dialog=document.getElementById('assetDialog');
    const err=document.getElementById('assetFormError');
    if(err)err.textContent='';
    if(dialog?.open)dialog.close('cancel');
  },true);

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',prepareButtons,{once:true});
  else prepareButtons();
})();
