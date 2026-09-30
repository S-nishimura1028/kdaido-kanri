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
  const statuses=['使用中','未使用','修理中','廃棄'];

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
      .analysis-type-box{grid-column:1/-1;overflow:hidden}
      .analysis-type-note{margin:-4px 0 10px;color:var(--muted);font-size:12px}
      .analysis-type-wrap{overflow:auto}
      .analysis-type-table{width:100%;min-width:700px;border-collapse:collapse}
      .analysis-type-table th,.analysis-type-table td{padding:10px 9px;border-bottom:1px solid var(--line);text-align:center;font-size:13px}
      .analysis-type-table th:first-child,.analysis-type-table td:first-child{text-align:left;font-weight:700;position:sticky;left:0;background:#fff;z-index:1}
      .analysis-type-table thead th{background:#f4f8f6;color:#45685f}
      .analysis-count-btn{border:0;background:transparent;color:#075b9b;font-weight:800;text-decoration:underline;text-underline-offset:3px;padding:4px 7px;border-radius:7px}
      .analysis-count-btn:hover{background:#eaf4f8}
      .analysis-count-zero{color:#a0aaa6}
      .analysis-total{font-weight:900;color:#173f59}
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
  function cleanName(v){return String(v||'名称未設定').trim().replace(/[　\s]+/g,' ')||'名称未設定';}
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
  function typeSummary(rows){
    const map=new Map();
    rows.forEach(a=>{
      const name=cleanName(a.name);
      if(!map.has(name))map.set(name,{name,'使用中':0,'未使用':0,'修理中':0,'廃棄':0,total:0});
      const item=map.get(name);
      const n=qty(a);
      if(statuses.includes(a.status))item[a.status]+=n;
      item.total+=n;
    });
    return [...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ja'));
  }
  function countCell(item,status){
    const n=item[status]||0;
    if(!n)return '<span class="analysis-count-zero">0</span>';
    return `<button type="button" class="analysis-count-btn" data-analysis-name="${esc(item.name)}" data-analysis-status="${esc(status)}" title="${esc(item.name)}・${esc(status)}を表示">${n}</button>`;
  }
  function typeTable(rows){
    const items=typeSummary(rows);
    if(!items.length)return '<div class="empty">データなし</div>';
    return `
      <div class="analysis-type-note">備品名ごとの現在数です。青い数字を押すと、その備品・状態で一覧を絞り込みます。</div>
      <div class="analysis-type-wrap">
        <table class="analysis-type-table">
          <thead><tr><th>備品種類</th><th>使用中</th><th>未使用</th><th>修理中</th><th>廃棄</th><th>合計</th></tr></thead>
          <tbody>${items.map(item=>`
            <tr>
              <td>${esc(item.name)}</td>
              <td>${countCell(item,'使用中')}</td>
              <td>${countCell(item,'未使用')}</td>
              <td>${countCell(item,'修理中')}</td>
              <td>${countCell(item,'廃棄')}</td>
              <td class="analysis-total">${item.total}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function openFilteredAssets(name,status){
    const search=document.getElementById('assetSearch');
    const statusEl=document.getElementById('assetStatus');
    const category=document.getElementById('assetCategory');
    if(!search||!statusEl)return;
    search.value=name;
    statusEl.value=status;
    if(category)category.value='';
    const nav=document.querySelector('.nav-btn[data-page="assets"]');
    if(nav)nav.click();
    statusEl.dispatchEvent(new Event('change',{bubbles:true}));
    search.dispatchEvent(new Event('input',{bubbles:true}));
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
    if(!['admin','manager'].includes(profile?.role))return;

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
    const disposed=rows.filter(a=>a.status==='廃棄').reduce((n,a)=>n+qty(a),0);
    const byLocation=sumBy(rows,'location').slice(0,10);
    const byDept=sumBy(rows,'department').slice(0,10);
    const recent=rows.slice(0,6);

    body.innerHTML=`
      <div class="analysis-summary">
        <div class="analysis-card"><small>備品総数</small><strong>${total.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>使用中</small><strong>${active.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>未使用</small><strong>${unused.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>修理中</small><strong>${repair.toLocaleString('ja-JP')}</strong></div>
        <div class="analysis-card"><small>廃棄</small><strong>${disposed.toLocaleString('ja-JP')}</strong></div>
      </div>
      <div class="analysis-grid">
        <div class="analysis-box analysis-type-box"><h4>備品種類 × 使用状態</h4>${typeTable(rows)}</div>
        <div class="analysis-box"><h4>保管場所別</h4>${barRows(byLocation)}</div>
        <div class="analysis-box"><h4>部署別</h4>${barRows(byDept)}</div>
        <div class="analysis-box" style="grid-column:1/-1"><h4>最近更新された備品</h4><div class="analysis-recent">${recent.length?recent.map(a=>`<div class="analysis-recent-item"><span><strong>${esc(a.asset_no||'No.なし')}</strong> / ${esc(a.name||'名称なし')} <span class="badge">${esc(a.status||'-')}</span></span><small>${a.updated_at?new Date(a.updated_at).toLocaleString('ja-JP'):''}</small></div>`).join(''):'<div class="empty">データなし</div>'}</div></div>
      </div>`;
    const at=document.getElementById('analysisUpdatedAt');
    if(at)at.textContent='最終集計 '+new Date().toLocaleString('ja-JP');
  }

  document.addEventListener('click',e=>{
    const count=e.target.closest('.analysis-count-btn');
    if(count){
      openFilteredAssets(count.dataset.analysisName||'',count.dataset.analysisStatus||'');
      return;
    }
    const b=e.target.closest('.nav-btn[data-page="admin"],[data-go="admin"]');
    if(b)setTimeout(render,120);
  });
  window.addEventListener('DOMContentLoaded',()=>setTimeout(render,600));
})();