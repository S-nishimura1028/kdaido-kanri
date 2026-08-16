(function(){
  'use strict';

  let client=null;
  let running=false;
  let observer=null;

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function replaceHistoryIds(){
    if(running)return;
    const host=document.getElementById('historyTable');
    const rows=[...(host?.querySelectorAll('tbody tr')||[])];
    if(!host||!rows.length)return;

    // すでに変換済みなら何もしない。
    if(rows.every(tr=>tr.children?.[1]?.dataset.assetLabelDone==='1'))return;

    const c=db();
    if(!c)return;
    running=true;
    try{
      const [historyResult,assetsResult]=await Promise.all([
        c.from('asset_history')
          .select('asset_id,asset_no_snapshot,asset_name_snapshot,created_at')
          .order('created_at',{ascending:false})
          .limit(200),
        c.from('assets').select('id,asset_no,name')
      ]);
      if(historyResult.error)throw historyResult.error;
      if(assetsResult.error)throw assetsResult.error;

      const assetMap=new Map();
      (assetsResult.data||[]).forEach(a=>{
        const label=[String(a.asset_no||'').trim(),String(a.name||'').trim()].filter(Boolean).join(' / ');
        if(label)assetMap.set(String(a.id),label);
      });

      const histories=historyResult.data||[];
      rows.forEach((tr,index)=>{
        const cell=tr.children?.[1];
        if(!cell)return;
        const h=histories[index];
        if(!h)return;
        const snap=[String(h.asset_no_snapshot||'').trim(),String(h.asset_name_snapshot||'').trim()].filter(Boolean).join(' / ');
        const current=assetMap.get(String(h.asset_id||''));
        if(snap||current)cell.textContent=snap||current;
        cell.dataset.assetLabelDone='1';
      });
    }catch(e){
      console.warn('history asset label',e);
    }finally{
      running=false;
    }
  }

  function init(){
    const host=document.getElementById('historyTable');
    if(!host){setTimeout(init,100);return;}
    if(!observer){
      observer=new MutationObserver(()=>setTimeout(replaceHistoryIds,0));
      observer.observe(host,{childList:true,subtree:true});
    }
    setTimeout(replaceHistoryIds,0);
    setTimeout(replaceHistoryIds,500);
    setTimeout(replaceHistoryIds,1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
