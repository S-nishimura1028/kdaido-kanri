(function(){
  'use strict';

  // Reuse the main authenticated client, avoiding independent auth sessions
  // and duplicate GoTrue auto-refresh listeners.
  function db(){
    return window.DaidoQrBridge?.getClient?.()||null;
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
  // Analyze standardized display groups, without rewriting the source assets.
  // Preserve a search term guaranteed to match existing names.
  function typeGroup(raw){
    const name=cleanName(raw);
    if(/^冷蔵庫(?:[（(].*[)）])?$/.test(name))return {name:'冷蔵庫',search:'冷蔵庫'};
    if(/^セット[：:；;]/.test(name))return {name:'テーブル・椅子セット',search:'セット'};
    if(name==='ベット'||name==='ベッド')return {name:'ベッド',search:'ベッ'};
    return {name,search:name};
  }
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
      const grouped=typeGroup(a.name),name=grouped.name;
      if(!map.has(name))map.set(name,{
        name,search:grouped.search,'使用中':0,'未使用':0,'修理中':0,'廃棄':0,total:0,
        ids:{all:[],'使用中':[],'未使用':[],'修理中':[],'廃棄':[]}
      });
      const item=map.get(name),n=qty(a);
      item.total+=n;
      if(a.id)item.ids.all.push(a.id);
      if(statuses.includes(a.status)){
        item[a.status]+=n;
        if(a.id)item.ids[a.status].push(a.id);
      }
    });
    return [...map.values()].sort((a,b)=>b.total-a.total||a.name.localeCompare(b.name,'ja'));
  }
  // One exact selection powers both desktop table cells and mobile cards.
  // Never use substring search for grouped names (e.g. ベッド/ベット).
  function countCell(item,status,style=''){
    const n=status?item[status]:item.total;
    const display=status||'合計';
    if(!n)return '<span class="analysis-count-zero" aria-label="'+esc(display)+'は0件">0</span>';
    const ids=item.ids[status||'all'].join(',');
    return '<button type="button" class="analysis-count-btn '+style+
      '" data-analysis-ids="'+esc(ids)+'" data-analysis-name="'+esc(item.name)+
      '" data-analysis-status="'+esc(status||'')+
      '" aria-label="'+esc(item.name+'の'+display+' '+n+'件を一覧で見る')+'">'+n+
      '<span class="analysis-count-action" aria-hidden="true"> ↗</span></button>';
  }
  function typeTable(rows){
    const items=typeSummary(rows);
    if(!items.length)return '<div class="empty">分析できる備品がありません。</div>';
    const desktop=items.map(item=>'<tr data-analysis-type-item data-label="'+esc(item.name)+
      '" data-total="'+item.total+'" data-available="'+item['未使用']+'" data-repair="'+item['修理中']+'">'+
      '<th scope="row" class="analysis-type-name">'+esc(item.name)+'</th>'+
      '<td>'+countCell(item,'使用中')+'</td><td class="analysis-available-cell">'+countCell(item,'未使用')+'</td>'+
      '<td>'+countCell(item,'修理中')+'</td><td>'+countCell(item,'廃棄')+'</td>'+
      '<td class="analysis-total">'+countCell(item,'','analysis-count-total')+'</td></tr>').join('');
    const mobile=items.map(item=>'<article class="analysis-type-item-card" data-analysis-type-item data-label="'+esc(item.name)+
      '" data-total="'+item.total+'" data-available="'+item['未使用']+'" data-repair="'+item['修理中']+'">'+
      '<div class="analysis-type-card-header"><h5>'+esc(item.name)+'</h5>'+
      '<div class="analysis-type-card-total"><span>合計</span>'+countCell(item,'','analysis-count-total')+'</div></div>'+
      '<div class="analysis-type-card-grid">'+[
        ['未使用','available'],['使用中','inuse'],['修理中','repair'],['廃棄','disposed']
      ].map(([status,key])=>'<div class="analysis-type-card-stat analysis-state-'+key+'"><span>'+esc(status)+
        '</span>'+countCell(item,status)+'</div>').join('')+'</div>'+
      '</article>').join('');
    return '<p class="analysis-type-intro">備品名で集計しています。<strong>数字を押すと、その備品だけの一覧</strong>に移動します。</p>'+
      '<div class="analysis-type-toolbar"><label>種類を探す<input type="search" id="analysisTypeSearch" autocomplete="off" placeholder="例：冷蔵庫・自転車"></label>'+
      '<label>並び順<select id="analysisTypeSort"><option value="total">総数が多い順</option><option value="available">未使用が多い順</option>'+
      '<option value="repair">修理中が多い順</option><option value="name">種類名順</option></select></label></div>'+
      '<div class="analysis-type-count" id="analysisTypeMeta" role="status" aria-live="polite">'+items.length+'種類を表示</div>'+
      '<div class="analysis-type-desktop"><table class="analysis-type-table"><thead><tr>'+
      '<th scope="col">備品の種類</th><th scope="col">使用中</th><th scope="col">未使用</th>'+
      '<th scope="col">修理中</th><th scope="col">廃棄</th><th scope="col">合計</th></tr></thead><tbody>'+
      desktop+'</tbody></table></div>'+
      '<div class="analysis-type-mobile" id="analysisTypeCards">'+mobile+'</div>'+
      '<div id="analysisTypeEmpty" class="analysis-type-empty hidden">該当する種類はありません。検索条件を変えてください。</div>'+
      '<p class="analysis-type-footnote">※ マスタのカテゴリとは別に、備品名をもとに集計しています。元の登録情報は変更しません。</p>';
  }
  function filterTypeViews(){
    const box=document.getElementById('adminAnalysisPanel');if(!box)return;
    const search=box.querySelector('#analysisTypeSearch');
    const sort=box.querySelector('#analysisTypeSort');
    if(!search||!sort)return;
    const query=search.value.trim().normalize('NFKC').toLowerCase();
    const selector='[data-analysis-type-item]';
    const table=box.querySelector('.analysis-type-table tbody');
    const cards=box.querySelector('#analysisTypeCards');
    const rows=[...(table?.querySelectorAll(selector)||[])];
    const cardNodes=[...(cards?.querySelectorAll(selector)||[])];
    const compare=(x,y)=>{
      const key=sort.value;
      if(key==='name')return x.dataset.label.localeCompare(y.dataset.label,'ja');
      const field=key==='repair'?'repair':key==='available'?'available':'total';
      return (Number(y.dataset[field])||0)-(Number(x.dataset[field])||0)||
        x.dataset.label.localeCompare(y.dataset.label,'ja');
    };
    rows.sort(compare).forEach(el=>table.appendChild(el));
    cardNodes.sort(compare).forEach(el=>cards.appendChild(el));
    let shown=0;
    rows.forEach(el=>{
      const visible=el.dataset.label.normalize('NFKC').toLowerCase().includes(query);
      el.hidden=!visible;
      if(visible)shown++;
    });
    cardNodes.forEach(el=>{
      el.hidden=!el.dataset.label.normalize('NFKC').toLowerCase().includes(query);
    });
    const label=box.querySelector('#analysisTypeMeta');
    if(label)label.textContent=shown+' / '+rows.length+'種類を表示';
    box.querySelector('#analysisTypeEmpty')?.classList.toggle('hidden',shown!==0);
  }
  function openFilteredAssets(ids,status,name){
    const api=window.DaidoAssetNav;
    if(!api?.openFromAnalysis){
      window.alert('備品一覧の準備ができていません。画面を更新してください。');
      return;
    }
    api.openFromAnalysis({ids,status,label:name});
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
      openFilteredAssets((count.dataset.analysisIds||'').split(',').filter(Boolean),count.dataset.analysisStatus||'',count.dataset.analysisName||'');
      return;
    }
    const b=e.target.closest('.nav-btn[data-page="admin"],[data-go="admin"]');
    if(b)setTimeout(render,120);
  });
  document.addEventListener('input',e=>{
    if(e.target?.id==='analysisTypeSearch')filterTypeViews();
  });
  document.addEventListener('change',e=>{
    if(e.target?.id==='analysisTypeSort')filterTypeViews();
  });
  window.DaidoAnalysis=Object.freeze({render});
  window.addEventListener('DOMContentLoaded',()=>setTimeout(render,600));
})();