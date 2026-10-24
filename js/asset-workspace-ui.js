(function(){
'use strict';
var $=id=>document.getElementById(id);
var esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var statuses=['','未使用','使用中','修理中','廃棄'];
var statusIds={'':'statTotal','未使用':'statAvailable','使用中':'statUse','修理中':'statRepair','廃棄':'statDisposed'};
var view='table', cardFrame=0, adminTab='analysis', historySearch='', historyType='', historyLimit=80;
var assetMap=new Map(), lookupDone=false;
try{view=localStorage.getItem('daido:asset-view')|| (matchMedia('(max-width:800px)').matches?'cards':'table')}catch(_){view='cards'}

function assetGlyph(name){
 var n=String(name||'');
 var path;
 if(/自転車|サイクル|バイク/.test(n))path='<circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m5 17 5-10 5 10H5m5-10h3m2 10 4-9h-4"/>';
 else if(/洗濯/.test(n))path='<rect x="3" y="2.5" width="18" height="19" rx="2.5"/><circle cx="12" cy="13.5" r="5"/><path d="M3 7.5h18M7 5h.01M10 5h.01"/>';
 else if(/冷蔵|冷凍/.test(n))path='<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M6 10h12M9 6v2M9 13v3"/>';
 else if(/炊飯|ポット|電気釜/.test(n))path='<path d="M5 10h14l-1 10H6L5 10ZM7 10V8a5 5 0 0 1 10 0v2M9 6h6M10 15h4"/>';
 else if(/電子レンジ|レンジ/.test(n))path='<rect x="2" y="5" width="20" height="15" rx="2"/><rect x="5" y="8" width="11" height="9" rx="1"/><path d="M19 9h.01M19 13h.01M5 20h14"/>';
 else if(/テレビ|モニター|画面/.test(n))path='<rect x="3" y="3" width="18" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>';
 else if(/机|テーブル/.test(n))path='<path d="M3 7h18v4H3zM6 11v10m12-10v10"/>';
 else if(/椅子|チェア/.test(n))path='<path d="M6 3h12v11H6zM6 14v3h12v-3M8 17v4m8-4v4"/>';
 else path='<path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/>';
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
}
function updateClearControl(){
 var b=$('workspaceResetFilters');if(!b)return;
 var on=Boolean($('assetSearch')?.value.trim()||$('assetStatus')?.value||$('assetCategory')?.value);
 b.classList.toggle('hidden',!on);
}

function pickStatus(value){
 var select=$('assetStatus');if(!select)return;
 select.value=value; select.dispatchEvent(new Event('change',{bubbles:true}));updateChips();
}
function updateChips(){
 var current=$('assetStatus')?.value||'';
 document.querySelectorAll('.workspace-status-chip').forEach(b=>{
  var v=b.dataset.state||'';
  b.setAttribute('aria-pressed',String(v===current));
  var n=b.querySelector('.workspace-chip-count'),source=$(statusIds[v]);
  if(n&&source){var t=(source.textContent||'').trim();n.textContent=t==='-'?'':' '+t}
 });
}
function setView(mode){
 view=mode==='cards'?'cards':'table';
 try{localStorage.setItem('daido:asset-view',view)}catch(_){}
 $('assetsPage')?.classList.toggle('workspace-card-mode',view==='cards');
 document.querySelectorAll('.workspace-view-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 if(view==='cards')queueCards();
}
function queueCards(){if(cardFrame)return;cardFrame=requestAnimationFrame(()=>{cardFrame=0;renderCards()})}
function renderCards(){
 var table=$('assetTable')?.querySelector('table'),host=$('assetCardGrid');if(!host)return;
 if(!table){host.innerHTML='<div class="workspace-list-empty">該当する備品はありません。</div>';if($('workspaceAssetCount'))$('workspaceAssetCount').textContent='検索結果 0件';return}
 var headings=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
 var rows=[...table.querySelectorAll('tbody tr[data-id]')];
 rows.forEach(row=>[...row.querySelectorAll('td')].forEach((td,i)=>{td.dataset.label=headings[i]||''}));
 var cell=(row,name)=>{var i=headings.indexOf(name);return i<0?'':row.querySelectorAll('td')[i]?.textContent.trim()||''};
 if($('workspaceAssetCount'))$('workspaceAssetCount').textContent='検索結果 '+rows.length.toLocaleString('ja-JP')+'件';
 host.innerHTML=rows.map(row=>{
  var id=esc(row.dataset.id),no=cell(row,'備品番号'),name=cell(row,'備品名');
  var status=cell(row,'状態'),location=cell(row,'保管場所'),category=cell(row,'カテゴリ'),amount=cell(row,'数量');
  var source=row.querySelector('.qr-row-check');
  var checkbox=source?'<label class="workspace-card-check"><input type="checkbox" data-id="'+id+'" '+(source.checked?'checked':'')+'>印刷対象</label>':'';
  var edit=row.querySelector('.edit-asset')?'<button type="button" class="workspace-edit" data-workspace-action="edit">編集</button>':'';
  return '<article class="workspace-asset-card" data-id="'+id+'"><div class="workspace-card-top"><span class="workspace-card-kicker">備品 / ASSET</span><span class="workspace-card-status" data-status="'+esc(status)+'">'+esc(status)+'</span></div><div class="workspace-card-identity"><span class="workspace-card-symbol">'+assetGlyph(name)+'</span><div class="workspace-card-identity-text"><span class="workspace-card-number">'+esc(no)+'</span><h3>'+esc(name)+'</h3></div></div><dl class="workspace-card-meta"><div><dt>保管場所</dt><dd>'+esc(location||'—')+'</dd></div>'+(category&&category!=='その他'?'<div><dt>分類</dt><dd>'+esc(category)+'</dd></div>':'')+'<div><dt>数量</dt><dd>'+esc(amount||'—')+'</dd></div></dl><div class="workspace-card-actions"><button type="button" class="workspace-detail" data-workspace-action="detail">詳細を見る</button>'+edit+checkbox+'</div></article>';
 }).join('')||'<div class="workspace-list-empty">該当する備品はありません。</div>';
 updateChips();updateClearControl();
}
function initAssets(){
 var page=$('assetsPage'),toolbar=page?.querySelector('.toolbar'),table=$('assetTable');
 if(!toolbar||!table||$('assetWorkspaceHead'))return;
 var chips=document.createElement('div');chips.id='assetStatusChips';chips.className='workspace-status-bar';chips.setAttribute('role','group');chips.setAttribute('aria-label','備品の状態で絞り込み');
 chips.innerHTML=statuses.map(s=>'<button type="button" class="workspace-status-chip" data-state="'+esc(s)+'" aria-pressed="false">'+(s||'すべて')+'<span class="workspace-chip-count"></span></button>').join('');
 toolbar.insertAdjacentElement('afterend',chips);
 chips.addEventListener('click',ev=>{var b=ev.target.closest('[data-state]');if(b)pickStatus(b.dataset.state||'')});
 var head=document.createElement('div');head.id='assetWorkspaceHead';head.className='workspace-asset-head';
 head.innerHTML='<div><strong id="workspaceAssetCount">備品を読み込み中…</strong><p>名称・状態・場所をすばやく確認 <button type="button" id="workspaceResetFilters" class="workspace-clear-filters hidden">条件をクリア</button></p></div><div class="workspace-list-switch" role="group" aria-label="表示形式"><button type="button" class="workspace-view-btn" data-view="cards" aria-pressed="false">▦ カード</button><button type="button" class="workspace-view-btn" data-view="table" aria-pressed="false">☷ 一覧表</button></div>';
 table.insertAdjacentElement('beforebegin',head);
 head.addEventListener('click',ev=>{
  var reset=ev.target.closest('#workspaceResetFilters');
  if(reset){
   $('assetSearch').value='';$('assetCategory').value='';
   pickStatus('');$('assetSearch').dispatchEvent(new Event('input',{bubbles:true}));
   updateClearControl();return;
  }
  var b=ev.target.closest('[data-view]');if(b)setView(b.dataset.view);
 });
 var grid=document.createElement('div');grid.id='assetCardGrid';grid.className='workspace-asset-grid';grid.setAttribute('aria-label','備品カード一覧');
 table.insertAdjacentElement('afterend',grid);
 grid.addEventListener('click',ev=>{
  if(ev.target.closest('.workspace-card-check'))return;
  var b=ev.target.closest('[data-workspace-action]');if(!b)return;
  var card=b.closest('[data-id]'),row=[...table.querySelectorAll('tbody tr[data-id]')].find(x=>x.dataset.id===card?.dataset.id);
  if(!row)return;
  if(b.dataset.workspaceAction==='detail')row.click();
  if(b.dataset.workspaceAction==='edit')row.querySelector('.edit-asset')?.click();
 });
 grid.addEventListener('change',ev=>{
  var cb=ev.target.closest('.workspace-card-check input');if(!cb)return;
  var row=[...table.querySelectorAll('tbody tr[data-id]')].find(x=>x.dataset.id===cb.dataset.id);
  var orig=row?.querySelector('.qr-row-check');if(!orig)return;
  orig.checked=cb.checked;orig.dispatchEvent(new Event('change',{bubbles:true}));
 });
 new MutationObserver(queueCards).observe(table,{childList:true,subtree:true});
 $('assetStatus')?.addEventListener('change',()=>{updateChips();updateClearControl()});
 $('assetCategory')?.addEventListener('change',updateClearControl);
 $('assetSearch')?.addEventListener('input',updateClearControl);
 setView(view);updateChips();updateClearControl();queueCards();
}
function initShortcuts(){
 var p=$('dashboardPage');if(!p||$('workspaceDashboardShortcuts'))return;
 var bar=document.createElement('div');bar.id='workspaceDashboardShortcuts';bar.className='workspace-dashboard-shortcuts';
 bar.innerHTML='<button type="button" data-shortcut="available"><strong>✓ 使える備品を探す</strong><small>未使用の備品をすぐ確認</small></button><button type="button" data-shortcut="analysis"><strong>▥ 種類別の状況を見る</strong><small>備品分析へ移動</small></button><button type="button" data-shortcut="new"><strong>＋ 備品を登録</strong><small>入力ガイド付きで登録</small></button>';
 p.insertBefore(bar,p.querySelector('.cards'));
 bar.addEventListener('click',ev=>{
  var key=ev.target.closest('[data-shortcut]')?.dataset.shortcut;
  if(key==='available'){$('.nav-btn[data-page="assets"]')?.click();pickStatus('未使用')}
  if(key==='analysis'){$('.nav-btn[data-page="admin"]')?.click();setAdminTab('analysis')}
  if(key==='new')$('newAssetBtn')?.click();
 });
}
function getHistory(){
 var t=$('historyTable')?.querySelector('table');
 if(!t)return [];
 return [...t.querySelectorAll('tbody tr')].map(r=>{
  var c=r.querySelectorAll('td');
  return {date:c[0]?.textContent.trim()||'',id:c[1]?.textContent.trim()||'',action:c[2]?.textContent.trim()||'',desc:c[3]?.textContent.trim()||''};
 });
}
async function lookupAssets(){
 if(lookupDone||!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return;
 lookupDone=true;
 try{
  var c=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
  var res=await c.from('assets').select('id,asset_no,name').limit(1000);
  if(res.error)throw res.error;
  (res.data||[]).forEach(a=>assetMap.set(String(a.id),{number:a.asset_no||'',name:a.name||''}));
  if(adminTab==='history')renderAdminHistory();
 }catch(ex){lookupDone=false;console.warn('History labels unavailable',ex)}
}
function renderAdminHistory(){
 var host=$('workspaceHistoryRows');if(!host)return;
 var records=getHistory();
 var types=[...new Set(records.map(x=>x.action).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
 var select=$('workspaceHistoryKind');
 if(select && select.options.length!==types.length+1){
  select.innerHTML='<option value="">すべての操作</option>'+types.map(t=>'<option value="'+esc(t)+'">'+esc(t)+'</option>').join('');
  select.value=types.includes(historyType)?historyType:'';
  historyType=select.value;
 }
 var filtered=records.filter(r=>{
  if(historyType&&r.action!==historyType)return false;
  var a=assetMap.get(r.id),label=a?(a.number+' '+a.name):'';
  return !historySearch||[r.date,r.id,r.action,r.desc,label].join(' ').normalize('NFKC').toLowerCase().includes(historySearch);
 });
 var shown=filtered.slice(0,historyLimit);
 $('workspaceHistoryCount').textContent='表示 '+shown.length+'件 ／ 該当 '+filtered.length+'件';
 host.innerHTML=shown.length?'<table><thead><tr><th>日時</th><th>備品</th><th>操作</th><th>内容</th></tr></thead><tbody>'+shown.map(r=>{
  var a=assetMap.get(r.id),label=a?(a.number+' / '+a.name):(r.id.slice(0,8)+'…');
  var actionClass=/廃棄|削除/.test(r.action)?'dispose':/修理|故障/.test(r.action)?'repair':'use';
  var link=a?.number?'<button type="button" class="workspace-history-link" data-asset-search="'+esc(a.number)+'">'+esc(label)+'</button>':esc(label);
  return '<tr><td data-label="日時">'+esc(r.date)+'</td><td data-label="備品">'+link+'</td><td><span class="badge '+actionClass+'">'+esc(r.action)+'</span></td><td>'+esc(r.desc)+'</td></tr>';
 }).join('')+'</tbody></table>':'<div class="workspace-list-empty">該当する履歴はありません。</div>';
 $('workspaceHistoryMore').classList.toggle('hidden',shown.length>=filtered.length);
}
function setAdminTab(tab){
 adminTab=['analysis','users','settings','history'].includes(tab)?tab:'analysis';
 document.querySelectorAll('.workspace-tab[data-admin-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.adminTab===adminTab)));
 applyAdminPanels();
 if(adminTab==='history'){renderAdminHistory();lookupAssets()}
}
function applyAdminPanels(){
 var grid=$('adminPage')?.querySelector('.admin-grid');if(!grid)return;
 grid.style.display=adminTab==='history'?'none':'grid';
 $('workspaceAdminHistory')?.classList.toggle('hidden',adminTab!=='history');
 [...grid.children].forEach(p=>{
  if(!p.classList.contains('panel'))return;
  var type=p.id==='adminAnalysisPanel'?'analysis':p.querySelector('#userAdmin')?'users':'settings';
  p.style.display=type===adminTab?'':'none';
 });
}
function initAdmin(){
 var grid=$('adminPage')?.querySelector('.admin-grid');if(!grid||$('workspaceAdminTabs'))return;
 var tabs=document.createElement('div');tabs.id='workspaceAdminTabs';tabs.className='workspace-tabs';
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','管理画面メニュー');
 tabs.innerHTML=[['analysis','備品分析'],['users','使用者管理'],['settings','基本設定'],['history','変更履歴']].map(x=>'<button type="button" role="tab" class="workspace-tab" data-admin-tab="'+x[0]+'" aria-selected="false">'+x[1]+'</button>').join('');
 grid.insertAdjacentElement('beforebegin',tabs);
 tabs.addEventListener('click',ev=>{var b=ev.target.closest('[data-admin-tab]');if(b)setAdminTab(b.dataset.adminTab)});
 var pane=document.createElement('section');pane.id='workspaceAdminHistory';pane.className='workspace-history-pane hidden';
 pane.innerHTML='<div class="panel"><div class="panel-head"><h3>備品の変更履歴</h3></div><div class="workspace-history-tools"><input id="workspaceHistorySearch" type="search" aria-label="変更履歴を検索" placeholder="管理No.・備品名・操作内容で検索"><select id="workspaceHistoryKind" aria-label="操作区分"><option value="">すべての操作</option></select></div><div id="workspaceHistoryCount" class="workspace-history-count"></div><div id="workspaceHistoryRows" class="table-wrap"></div><button type="button" id="workspaceHistoryMore" class="secondary hidden" style="min-height:42px;margin-top:12px">さらに表示</button></div>';
 grid.insertAdjacentElement('afterend',pane);
 $('workspaceHistorySearch').addEventListener('input',ev=>{historySearch=ev.target.value.trim().normalize('NFKC').toLowerCase();historyLimit=80;renderAdminHistory()});
 $('workspaceHistoryKind').addEventListener('change',ev=>{historyType=ev.target.value;historyLimit=80;renderAdminHistory()});
 $('workspaceHistoryMore').addEventListener('click',()=>{historyLimit+=80;renderAdminHistory()});
 $('workspaceHistoryRows').addEventListener('click',ev=>{
  var b=ev.target.closest('[data-asset-search]');if(!b)return;
  $('assetSearch').value=b.dataset.assetSearch;$('assetStatus').value='';
  $('.nav-btn[data-page="assets"]')?.click();
  $('assetSearch').dispatchEvent(new Event('input',{bubbles:true}));
 });
 new MutationObserver(applyAdminPanels).observe(grid,{childList:true});
 $('historyTable')&&new MutationObserver(()=>{if(adminTab==='history')renderAdminHistory()}).observe($('historyTable'),{childList:true,subtree:true});
 setAdminTab('analysis');
 document.querySelectorAll('.nav-btn[data-page="admin"]').forEach(x=>x.addEventListener('click',()=>setTimeout(applyAdminPanels,180)));
}
function initDetail(){
 var host=$('assetDetail');if(!host)return;
 new MutationObserver(()=>{
  if(!host.querySelector('#detailPhotos')||host.querySelector('#workspaceDetailTabs'))return;
  var photos=host.querySelector('#detailPhotos'),info=host.querySelector('.detail-grid'),actions=host.querySelector('.dialog-actions');
  if(!info||!actions)return;
  var tabs=document.createElement('div');tabs.id='workspaceDetailTabs';tabs.className='workspace-tabs workspace-detail-tabs';
  tabs.innerHTML='<button type="button" class="workspace-tab" data-detail-tab="info">基本情報</button><button type="button" class="workspace-tab" data-detail-tab="photos">写真</button><button type="button" class="workspace-tab" data-detail-tab="history">変更履歴</button>';
  host.insertBefore(tabs,photos);
  var history=document.createElement('div');history.id='workspaceDetailHistory';history.className='hidden';host.insertBefore(history,actions);
  function change(t){
   tabs.querySelectorAll('button').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.detailTab===t)));
   photos.classList.toggle('hidden',t!=='photos');info.classList.toggle('hidden',t!=='info');history.classList.toggle('hidden',t!=='history');
   if(t==='history'){
    var id=$('detailDialog')?.dataset.assetId,rows=getHistory().filter(r=>r.id===id);
    history.innerHTML=rows.length?rows.slice(0,80).map(r=>'<div class="workspace-detail-event"><small>'+esc(r.date)+' ／ '+esc(r.action)+'</small><div>'+esc(r.desc||'変更履歴')+'</div></div>').join(''):'<div class="workspace-list-empty">この備品の履歴はありません。</div>';
   }
  }
  tabs.addEventListener('click',ev=>{var b=ev.target.closest('[data-detail-tab]');if(b)change(b.dataset.detailTab)});
  change('info');
 }).observe(host,{childList:true});
}
function init(){initAssets();initShortcuts();initAdmin();initDetail()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();