(function(){
  'use strict';

  function cleanLabel(input){
    const label=input?.closest('label');
    if(!label)return;
    for(const node of label.childNodes){
      if(node.nodeType!==Node.TEXT_NODE)continue;
      node.textContent=node.textContent.replace(/\s*[＊*]\s*$/,'');
    }
  }

  function apply(){
    const assetNo=document.getElementById('assetNo');
    const purchaseDate=document.getElementById('purchaseDate');

    if(assetNo){
      assetNo.required=false;
      assetNo.removeAttribute('required');
      assetNo.setAttribute('aria-required','false');
      cleanLabel(assetNo);
    }
    if(purchaseDate){
      purchaseDate.required=false;
      purchaseDate.removeAttribute('required');
      purchaseDate.setAttribute('aria-required','false');
      cleanLabel(purchaseDate);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
})();
