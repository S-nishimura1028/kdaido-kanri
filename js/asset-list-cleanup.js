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

  function stripCategoryColumn(targetId){
    const root=document.getElementById(targetId);
    const table=root?.querySelector('table');
    if(!table)return;

    const headers=Array.from(table.querySelectorAll('thead th'));
    const categoryIndex=headers.findIndex(th=>(th.textContent||'').trim()==='カテゴリ');
    if(categoryIndex<0)return;

    table.querySelectorAll('tr').forEach(tr=>{
      const cell=tr.children[categoryIndex];
      if(cell)cell.remove();
    });
  }

  function apply(){
    hideCategoryFilter();
    hideAdminCategory();
    stripCategoryColumn('assetTable');
    stripCategoryColumn('recentAssets');
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
