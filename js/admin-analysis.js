(function(){
  'use strict';

  let client=null;
  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function ensureStyles(){
    if(document.getElementById('adminAnalysisStyle'))return;
    const s=document.createElement('style');
    s.id='adminAnalysisStyle';
    s.textContent=`
      #adminAnalysisPanel{grid-column:1/-1}
      .analysis-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-bottom:16px}
      .analysis-card{padding:14px;border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,#fff,#f8fbfa)}
      .analysis-card small{display:block;color:var(--muted);font-weight:700;margin-bottom:5px}
      .analysis-card strong{font-size:24px;color:#123e5c}
      .analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .analysis-box{border:1px solid var(--line);border-radius:12px;padding:14px;background:#fff}
      .analysis-box h4{margin:0 0 12px;color:#173f59}
      .analysis-row{display:grid;grid-template-columns:minmax(90px,1.1fr) 2fr auto;gap:9px;align-items:center;margin:9px 0;font-size:13px}
      .analysis-bar{height:10px;border-radius:999px;background:#e8f0ed;overflow:hidden}
      .analysis-bar>span{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#1488c9,#58a832)}
      .analysis-recent{display:grid;gap:8px}
      .analysis-recent-item{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line);padding:8px 0;font-size:13px}
      .analysis-recent-item small{color:var(--muted);white-space:nowrap}
      @media(max-width:900px){.analysis-summary{grid-template-columns:repeat(2,1fr)}.analysis-grid{grid-template-columns:1fr}}
      @media(max-width:600px){.analysis-summary{grid-template-columns:1fr 1fr}.analysis-card strong{font-size:20px}.analysis-row{grid-template-columns:90px 1fr auto}.analysis-recent-item{display:block}.analysis-recent-item small{display:block;margin-top:3px}}
    `;
    document.head.appendChild(s);
  }

  function ensurePanel(){
    const grid=document.querySelector('#adminPage .admin-grid');
    if(!grid)return null;
    let panel=document.getElementById('adminAnalysisPanel');
    if(panel)return panel;
    panel=document.createElement('div');
    panel.id='adminAnalysisPanel';
    panel.className='panel';
    panel.innerHTML='<div class="panel-head"><h3>備品分析</h3><span id="analysisUpdatedAt" style="color:var(--muted);font-size:12px"></span></div><div id="adminAnalysisBody"><div class="empty">集計中…</div></div>';
    grid.insertBefore(panel,grid.firstChild);
    return panel;
  }

  function qty(a){return Number(a.quantity||1)||1;}
  function sumBy(rows,key){
    const m=new Map();
    rows.forEach(a=>{
      const k=(a[key]||'未設定').toString().trim()||'未設定';
      m.set(k,(m.get(k)||0)+qty(a));
    });
    return [...m.entries()].sort((a,b)=>b[1]-a[1]);
  }
  function barRows(items){
    const max=Math.max(1,...items.map(x=>x[1]));
    return items.length?items.map(([name,n])=>`<div class="analysis-row"><span>${esc(name)}</span><div class="analysis-bar"><span style="width:${Math.max(4,Math.round(n/max*100))}%"></span></div><strong>${n}</strong></div>`).join(''):'<div class="empty">データなし</div>';
  }

  async function render(){
    const page=document.getElementById('adminPage');
    if(!page)return;
    ensureStyles();
    ensurePanel();
    const body=document.getElementById('adminAnalysisBody');
    const c=db();
    if(!c||!body)return;

    const {data:{session}}=await c.auth.getSession();
    if(!session)return;
    const {data:profile}=await c.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
    if(profile?.role!=='admin')return;

    const {data,error}=await c.from('assets')
      .select('id,asset_no,name,status,location,department,quantity,purchase_price,created_at,updated_at,is_deleted')
      .eq('is_deleted',false)
      .order('updated_at',{ascending:false});
    if(error){body.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}

    const rows=data||[];
    const total=rows.reduce((n,a)=>n+qty(a),0);
    const active=rows.filter(a=>a.status==='使用中').reduce((n,a)=>n+qty(a),0);
    const unused=rows.filter(a=>a.status==='未使用').reduce((n,a)=>n+qty(a),0);
    const repair=rows.filter(a=>a.status==='修理中').reduce((n,a)=>n+qty(a),0);
    const totalValue=rows.reduce((n,a)=>n+(Number(a.purchase_price||0)*qty(a)),0);
    const byLocation=sumBy(rows,'location').slice(0,10);
    const byDept=sumBy(rows,'department').slice(0,10);
    const recent=rows.slice(0,6);

    body.innerHTML=`
      <div class="analysis-summary">
        <div class="analysis-card"><small>備品総数</small><strong>${total.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>使用中</small><strong>${active.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>未使用</small><strong>${unused.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>修理中</small><strong>${repair.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>取得金額合計</small><strong>${Math.round(totalValue).toLocaleString('ja-JP')}円</strong></div>
      </div>
      <div class="analysis-grid">
        <div class="analysis-box"><h4>保管場所別</h4>${barRows(byLocation)}</div>
        <div class="analysis-box"><h4>部署別</h4>${barRows(byDept)}</div>
        <div class="analysis-box" style="grid-column:1/-1"><h4>最近更新された備品</h4><div class="analysis-recent">${recent.length?recent.map(a=>`<div class="analysis-recent-item"><span><strong>${esc(a.asset_no||'No.なし')}</strong> / ${esc(a.name||'名称なし')} <span class="badge">${esc(a.status||'-')}</span></span><small>${a.updated_at?new Date(a.updated_at).toLocaleString('ja-JP'):''}</small></div>`).join(''):'<div class="empty">データなし</div>'}</div></div>
      </div>`;
    const at=document.getElementById('analysisUpdatedAt');
    if(at)at.textContent='最終集計 '+new Date().toLocaleString('ja-JP');
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest('.nav-btn[data-page="admin"],[data-go="admin"]');
    if(b)setTimeout(render,120);
  });
  window.addEventListener('DOMContentLoaded',()=>setTimeout(render,600));
})();
