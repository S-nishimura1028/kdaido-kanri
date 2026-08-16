(function(){
  'use strict';

  let client=null;
  let running=false;
  let observer=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  function assetUser(h){
    const after=h?.after_data;
    const before=h?.before_data;
    if(after&&Object.prototype.hasOwnProperty.call(after,'user_name')){
      return String(after.user_name||'').trim()||'使用者なし';
    }
    if(before&&Object.prototype.hasOwnProperty.call(before,'user_name')){
      return String(before.user_name||'').trim()||'使用者なし';
    }
    return '-';
  }

  async function renderHistory(){
    if(running)return;
    const host=document.getElementById('historyTable');
    if(!host||!host.querySelector('table'))return;
    if(host.querySelector('th[data-history-enhanced="1"]'))return;

    const c=db();
    if(!c)return;
    running=true;
    try{
      const [historyResult,assetsResult,profilesResult]=await Promise.all([
        c.from('asset_history')
          .select('id,asset_id,asset_no_snapshot,asset_name_snapshot,action,note,user_name,actor_id,before_data,after_data,created_at')
          .order('created_at',{ascending:false})
          .limit(200),
        c.from('assets').select('id,asset_no,name'),
        c.from('profiles').select('id,name,email')
      ]);
      if(historyResult.error)throw historyResult.error;
      if(assetsResult.error)throw assetsResult.error;
      if(profilesResult.error)throw profilesResult.error;

      const assetMap=new Map();
      (assetsResult.data||[]).forEach(a=>{
        const label=[String(a.asset_no||'').trim(),String(a.name||'').trim()].filter(Boolean).join(' / ');
        if(label)assetMap.set(String(a.id),label);
      });

      const profileMap=new Map();
      (profilesResult.data||[]).forEach(p=>{
        const label=String(p.name||'').trim()||String(p.email||'').trim()||'-';
        profileMap.set(String(p.id),label);
      });

      const rows=historyResult.data||[];
      if(!rows.length){
        host.innerHTML='<div class="empty">履歴はありません。</div>';
        return;
      }

      host.innerHTML=`<table><thead><tr><th data-history-enhanced="1">日時</th><th>備品</th><th>使用者</th><th>変更者</th><th>操作</th><th>内容</th></tr></thead><tbody>${rows.map(h=>{
        const snap=[String(h.asset_no_snapshot||'').trim(),String(h.asset_name_snapshot||'').trim()].filter(Boolean).join(' / ');
        const asset=snap||assetMap.get(String(h.asset_id||''))||'-';
        const user=assetUser(h);
        const actor=profileMap.get(String(h.actor_id||''))||String(h.user_name||'').trim()||'-';
        const action=String(h.action||'').trim()||'-';
        const note=String(h.note||'').trim()||'-';
        const when=new Date(h.created_at||Date.now()).toLocaleString('ja-JP');
        return `<tr><td>${esc(when)}</td><td>${esc(asset)}</td><td>${esc(user)}</td><td>${esc(actor)}</td><td>${esc(action)}</td><td>${esc(note)}</td></tr>`;
      }).join('')}</tbody></table>`;
    }catch(e){
      console.warn('history enhanced display',e);
    }finally{
      running=false;
    }
  }

  function init(){
    const host=document.getElementById('historyTable');
    if(!host){setTimeout(init,100);return;}
    if(!observer){
      observer=new MutationObserver(()=>setTimeout(renderHistory,0));
      observer.observe(host,{childList:true,subtree:true});
    }
    setTimeout(renderHistory,0);
    setTimeout(renderHistory,500);
    setTimeout(renderHistory,1500);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
