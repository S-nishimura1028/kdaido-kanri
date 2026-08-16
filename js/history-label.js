(function(){
  'use strict';

  let client=null;
  let running=false;
  const cache=new Map();

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function loadAssetMap(){
    if(cache.size)return cache;
    const c=db();
    if(!c)return cache;
    const {data,error}=await c.from('assets').select('id,asset_no,name');
    if(error)throw error;
    (data||[]).forEach(a=>{
      const no=String(a.asset_no||'').trim();
      const name=String(a.name||'').trim();
      cache.set(String(a.id),[no,name].filter(Boolean).join(' / ')||String(a.id));
    });
    return cache;
  }

  async function replaceHistoryIds(){
    if(running)return;
    const host=document.getElementById('historyTable');
    if(!host||!host.querySelector('table'))return;
    running=true;
    try{
      const map=await loadAssetMap();
      host.querySelectorAll('tbody tr').forEach(tr=>{
        const cell=tr.children?.[1];
        if(!cell||cell.dataset.assetLabelDone==='1')return;
        const id=String(cell.textContent||'').trim();
        if(map.has(id))cell.textContent=map.get(id);
        cell.dataset.assetLabelDone='1';
      });
    }catch(e){
      console.warn('history asset label',e);
    }finally{
      running=false;
    }
  }

  const obs=new MutationObserver(()=>setTimeout(replaceHistoryIds,0));
  document.addEventListener('DOMContentLoaded',()=>{
    const host=document.getElementById('historyTable');
    if(host)obs.observe(host,{childList:true,subtree:true});
    setTimeout(replaceHistoryIds,300);
  });
})();
