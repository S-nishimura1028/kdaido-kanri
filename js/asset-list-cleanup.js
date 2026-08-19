(function(){
  'use strict';

  function hideCategoryFilter(){
    const sel=document.getElementById('assetCategory');
    if(!sel)return;
    sel.value='';
    sel.style.display='none';
  }

  function hideAdminCategory(){
    const list=document.getElementById('categoryAdmin');
    const panel=list?.closest('.panel');
    if(panel)panel.style.display='none';
  }

  function cleanSearchPlaceholder(){
    const input=document.getElementById('assetSearch');
    if(input)input.placeholder='備品名・メーカー・型番で検索';
  }

  function stripColumns(targetId){
    const root=document.getElementById(targetId);
    const table=root?.querySelector('table');
    if(!table)return;

    ['備品番号','カテゴリ'].forEach(label=>{
      const headers=Array.from(table.querySelectorAll('thead th'));
      const index=headers.findIndex(th=>(th.textContent||'').trim()===label);
      if(index<0)return;
      table.querySelectorAll('tr').forEach(tr=>{
        const cell=tr.children[index];
        if(cell)cell.remove();
      });
    });
  }

  function apply(){
    hideCategoryFilter();
    hideAdminCategory();
    cleanSearchPlaceholder();
    stripColumns('assetTable');
    stripColumns('recentAssets');
  }

  const observer=new MutationObserver(()=>apply());
  function start(){
    apply();
    ['assetTable','recentAssets','adminPage'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)observer.observe(el,{childList:true,subtree:true});
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
