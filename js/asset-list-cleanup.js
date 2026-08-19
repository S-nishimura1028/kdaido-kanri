(function(){
  'use strict';

  function hideCategoryFilter(){
    const sel=document.getElementById('assetCategory');
    if(!sel)return;
    sel.value='';
    sel.style.display='none';
  }

  function stripCategoryColumn(targetId){
    const root=document.getElementById(targetId);
    const table=root?.querySelector('table');
    if(!table)return;
    table.querySelectorAll('tr').forEach(tr=>{
      const cells=tr.children;
      if(cells.length>=3){cells[2]?.remove();}
    });
  }

  function apply(){
    hideCategoryFilter();
    stripCategoryColumn('assetTable');
    stripCategoryColumn('recentAssets');
  }

  const observer=new MutationObserver(apply);
  function start(){
    apply();
    ['assetTable','recentAssets'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)observer.observe(el,{childList:true,subtree:true});
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
