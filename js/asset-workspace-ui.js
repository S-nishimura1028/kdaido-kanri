(function(){
'use strict';
var $=id=>document.getElementById(id);
var esc=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
var statuses=['','未使用','使用中','修理中','廃棄'];
var statusIds={'':'statTotal','未使用':'statAvailable','使用中':'statUse','修理中':'statRepair','廃棄':'statDisposed'};
// Keep a distinct preference for a phone and a wider desktop screen.
var mobileViewQuery=matchMedia('(max-width:800px)');
function viewStorageKey(){return mobileViewQuery.matches?'daido:asset-view-mobile':'daido:asset-view-desktop'}
function readSavedView(){
 var mobile=mobileViewQuery.matches,choice=null;
 try{
  choice=localStorage.getItem(viewStorageKey());
  // Preserve the old shared preference on desktop only: it used to force
  // desktop table layouts onto narrow smartphone screens.
  if(!choice&&!mobile)choice=localStorage.getItem('daido:asset-view');
 }catch(_){}
 return choice==='cards'||choice==='table'?choice:(mobile?'cards':'table');
}
var view=readSavedView(), cardFrame=0, adminTab='analysis', historySearch='', historyType='', historyLimit=80;
var assetMap=new Map(), lookupDone=false;
var historyRefreshing=false;

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
 var on=Boolean(window.DaidoAnalysisFilter?.ids||$('assetSearch')?.value.trim()||$('assetStatus')?.value||$('assetCategory')?.value);
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
function setView(mode,persist=true){
 view=mode==='cards'?'cards':'table';
 if(persist)try{localStorage.setItem(viewStorageKey(),view)}catch(_){}
 $('assetsPage')?.classList.toggle('workspace-card-mode',view==='cards');
 document.querySelectorAll('.workspace-view-btn').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 if(view==='cards')queueCards();
}
function queueCards(){if(cardFrame)return;cardFrame=requestAnimationFrame(()=>{cardFrame=0;renderCards()})}
function renderCards(){
 var table=$('assetTable')?.querySelector('table'),host=$('assetCardGrid');if(!host)return;
 if(!table){host.innerHTML='<div class="workspace-list-empty">該当する備品はありません。</div>';if($('workspaceAssetCount'))$('workspaceAssetCount').textContent=(window.DaidoAnalysisFilter?.label?'種類：'+window.DaidoAnalysisFilter.label+'｜':'')+'検索結果 0件';return}
 var headings=[...table.querySelectorAll('thead th')].map(x=>x.textContent.trim());
 var rows=[...table.querySelectorAll('tbody tr[data-id]')];
 rows.forEach(row=>{
  [...row.querySelectorAll('td')].forEach((td,i)=>{td.dataset.label=headings[i]||''});
  if(row.dataset.workspaceKeyboard)return;
  row.dataset.workspaceKeyboard='1';
  row.tabIndex=0;
  row.title='Enterキーでも備品詳細を開けます';
  row.addEventListener('keydown',e=>{
   if(e.target!==row||(e.key!=='Enter'&&e.key!==' '))return;
   e.preventDefault();
   row.click();
  });
 });
 var cell=(row,name)=>{var i=headings.indexOf(name);return i<0?'':row.querySelectorAll('td')[i]?.textContent.trim()||''};
 if($('workspaceAssetCount'))$('workspaceAssetCount').textContent=(window.DaidoAnalysisFilter?.label?'種類：'+window.DaidoAnalysisFilter.label+'｜':'')+'検索結果 '+rows.length.toLocaleString('ja-JP')+'件';
 host.innerHTML=rows.map(row=>{
  var id=esc(row.dataset.id),no=cell(row,'備品番号'),name=cell(row,'備品名');
  var status=cell(row,'状態'),location=cell(row,'保管場所'),category=cell(row,'カテゴリ'),amount=cell(row,'数量');
  var source=row.querySelector('.qr-row-check');
  var checkbox=source?'<label class="workspace-card-check"><input type="checkbox" data-id="'+id+'" aria-label="'+esc(no)+' '+esc(name)+' をQRシール印刷対象にする" '+(source.checked?'checked':'')+'>QR印刷対象</label>':'';
  var edit=row.querySelector('.edit-asset')?'<button type="button" class="workspace-edit" data-workspace-action="edit" aria-label="'+esc(no)+' '+esc(name)+' の情報を編集">情報を編集</button>':'';
  return '<article class="workspace-asset-card" data-id="'+id+'"><div class="workspace-card-top"><span class="workspace-card-kicker">備品 / ASSET</span><span class="workspace-card-status" data-status="'+esc(status)+'">'+esc(status)+'</span></div><div class="workspace-card-identity"><span class="workspace-card-symbol">'+assetGlyph(name)+'</span><div class="workspace-card-identity-text"><span class="workspace-card-number">'+esc(no)+'</span><h3>'+esc(name)+'</h3></div></div><dl class="workspace-card-meta"><div><dt>保管場所</dt><dd>'+esc(location||'—')+'</dd></div>'+(category&&category!=='その他'?'<div><dt>分類</dt><dd>'+esc(category)+'</dd></div>':'')+'<div><dt>数量</dt><dd>'+esc(amount||'—')+'</dd></div></dl><div class="workspace-card-actions"><button type="button" class="workspace-detail" data-workspace-action="detail" aria-label="'+esc(no)+' '+esc(name)+' の詳細を見る">詳細を見る</button>'+edit+checkbox+'</div></article>';
 }).join('')||'<div class="workspace-list-empty">該当する備品はありません。</div>';
 syncCardSelections();
 updateChips();updateClearControl();
}
function syncCardSelections(){
 // QR print owns the original table checkboxes. Reflect their live state
 // in cards, including the "select all" action from the table header.
 var table=$('assetTable')?.querySelector('table'),grid=$('assetCardGrid');
 if(!table||!grid)return;
 var selected=new Set([...table.querySelectorAll('.qr-row-check:checked')].map(c=>c.dataset.id));
 grid.querySelectorAll('.workspace-card-check input[data-id]').forEach(cb=>{
   var checked=selected.has(cb.dataset.id);
   if(cb.checked!==checked)cb.checked=checked;
 });
}
function initAssets(){
 var page=$('assetsPage'),toolbar=page?.querySelector('.toolbar'),table=$('assetTable');
 if(!toolbar||!table||$('assetWorkspaceHead'))return;
 var chips=document.createElement('div');chips.id='assetStatusChips';chips.className='workspace-status-bar';chips.setAttribute('role','group');chips.setAttribute('aria-label','備品の状態で絞り込み');
 chips.innerHTML=statuses.map(s=>'<button type="button" class="workspace-status-chip" data-state="'+esc(s)+'" aria-pressed="false">'+(s||'すべて')+'<span class="workspace-chip-count"></span></button>').join('');
 toolbar.insertAdjacentElement('afterend',chips);
 chips.addEventListener('click',ev=>{var b=ev.target.closest('[data-state]');if(b)pickStatus(b.dataset.state||'')});
 var head=document.createElement('div');head.id='assetWorkspaceHead';head.className='workspace-asset-head';
 head.innerHTML='<div><strong id="workspaceAssetCount">備品を読み込み中…</strong><p>備品を選ぶと写真・使用者・変更履歴を確認できます <button type="button" id="workspaceResetFilters" class="workspace-clear-filters hidden">検索条件を解除</button></p></div><div class="workspace-list-switch" role="group" aria-label="表示形式"><button type="button" class="workspace-view-btn" data-view="cards" aria-pressed="false">▦ カード</button><button type="button" class="workspace-view-btn" data-view="table" aria-pressed="false">☷ 一覧表</button></div>';
 table.insertAdjacentElement('beforebegin',head);
 head.addEventListener('click',ev=>{
  var reset=ev.target.closest('#workspaceResetFilters');
  if(reset){
   window.DaidoAnalysisFilter=null;
   $('assetSearch').value='';$('assetCategory').value='';
   pickStatus('');$('assetSearch').dispatchEvent(new Event('input',{bubbles:true}));
   updateClearControl();return;
  }
  var b=ev.target.closest('[data-view]');if(b)setView(b.dataset.view);
 });
 var grid=document.createElement('div');grid.id='assetCardGrid';grid.className='workspace-asset-grid';grid.setAttribute('aria-label','備品カード一覧');
 grid.setAttribute('aria-live','polite');
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
 table.addEventListener('change',ev=>{
   if(ev.target.matches('.qr-row-check, .qr-select-head input')){
     syncCardSelections();
   }
 });
 new MutationObserver(queueCards).observe(table,{childList:true,subtree:true});
 $('assetStatus')?.addEventListener('change',()=>{updateChips();updateClearControl()});
 $('assetCategory')?.addEventListener('change',updateClearControl);
 $('assetSearch')?.addEventListener('input',updateClearControl);
 setView(view,false);updateChips();updateClearControl();queueCards();
 // If a tablet is rotated or the browser is resized across the breakpoint,
 // restore that screen size's own preference without overwriting either.
 var onViewportChange=()=>setView(readSavedView(),false);
 if(mobileViewQuery.addEventListener)mobileViewQuery.addEventListener('change',onViewportChange);
 else if(mobileViewQuery.addListener)mobileViewQuery.addListener(onViewportChange);
}
function initShortcuts(){
 var p=$('dashboardPage');if(!p||$('workspaceDashboardShortcuts'))return;
 var bar=document.createElement('div');bar.id='workspaceDashboardShortcuts';bar.className='workspace-dashboard-shortcuts';
 bar.innerHTML='<button type="button" data-shortcut="available"><strong>✓ 使える備品を探す</strong><small>未使用の備品をすぐ確認</small></button><button type="button" data-shortcut="analysis"><strong>▥ 種類別の状況を見る</strong><small>備品分析へ移動</small></button><button type="button" data-shortcut="new"><strong>＋ 備品を登録</strong><small>入力ガイド付きで登録</small></button>';
 p.insertBefore(bar,p.querySelector('.cards'));
 // Navigation is handled centrally by app.js, including newly inserted cards.
}
function getHistory(){
 var t=$('historyTable')?.querySelector('table');
 if(!t)return [];
 return [...t.querySelectorAll('tbody tr')].map(r=>{
  var c=r.querySelectorAll('td');
  return {
   date:c[0]?.textContent.trim()||'',
   id:r.dataset.assetId||'',
   assetNo:r.dataset.assetNo||'',
   assetName:r.dataset.assetName||'',
   action:c[2]?.textContent.trim()||'',
   desc:c[3]?.textContent.trim()||''
  };
 });
}
async function lookupAssets(){
 if(lookupDone)return;
 const c=window.DaidoQrBridge?.getClient?.();
 if(!c)return;
 lookupDone=true;
 try{
  const res=await c.from('assets').select('id,asset_no,name').eq('is_deleted',false).limit(1000);
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
  var a=assetMap.get(r.id),label=[r.assetNo||a?.number||'',r.assetName||a?.name||''].join(' ');
  return !historySearch||[r.date,r.id,r.action,r.desc,label].join(' ').normalize('NFKC').toLowerCase().includes(historySearch);
 });
 var shown=filtered.slice(0,historyLimit);
 $('workspaceHistoryCount').textContent='表示 '+shown.length+'件 ／ 該当 '+filtered.length+'件';
 host.innerHTML=shown.length?'<table><thead><tr><th>日時</th><th>備品</th><th>操作</th><th>内容</th></tr></thead><tbody>'+shown.map(r=>{
  var a=assetMap.get(r.id),no=r.assetNo||a?.number||'',name=r.assetName||a?.name||'';
  var label=no?(no+' / '+name):(r.id?r.id.slice(0,8)+'…':'記録された備品');
  var actionClass=/廃棄|削除/.test(r.action)?'dispose':/修理|故障/.test(r.action)?'repair':'use';
  var link=(a?.number||no)&&a?
    '<button type="button" class="workspace-history-link" data-asset-search="'+esc(no||a.number)+'">'+esc(label)+'</button>':
    esc(label);
  return '<tr><td data-label="日時">'+esc(r.date)+'</td><td data-label="備品">'+link+'</td><td data-label="操作"><span class="badge '+actionClass+'">'+esc(r.action)+'</span></td><td data-label="内容">'+esc(r.desc)+'</td></tr>';
 }).join('')+'</tbody></table>':'<div class="workspace-list-empty">該当する履歴はありません。</div>';
 $('workspaceHistoryMore').classList.toggle('hidden',shown.length>=filtered.length);
}
async function refreshAdminHistory(){
 if(historyRefreshing)return;
 const button=$('workspaceHistoryRefresh'),indicator=$('workspaceHistoryRefreshState');
 const refresh=window.DaidoQrBridge?.refreshHistory;
 if(!refresh){
  if(indicator)indicator.textContent='履歴の読み込み機能が準備できていません。画面を再読み込みしてください。';
  return;
 }
 historyRefreshing=true;
 if(button)button.disabled=true;
 if(indicator)indicator.textContent='最新の履歴を確認中…';
 try{
  await refresh();
  if(adminTab==='history')renderAdminHistory();
  if(indicator)indicator.textContent='更新 '+new Date().toLocaleString('ja-JP');
 }catch(error){
  console.error('変更履歴の再取得に失敗',error);
  if(indicator)indicator.textContent='更新に失敗しました。通信を確認して再度お試しください。';
 }finally{
  historyRefreshing=false;
  if(button)button.disabled=false;
 }
}
function setAdminTab(tab){
 adminTab=['analysis','users','settings','history','exit'].includes(tab)?tab:'analysis';
 document.querySelectorAll('.workspace-tab[data-admin-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.adminTab===adminTab)));
 applyAdminPanels();
 if(adminTab==='history'){renderAdminHistory();lookupAssets();refreshAdminHistory()}
 if(adminTab==='analysis'&&window.DaidoAnalysis?.render){
  Promise.resolve(window.DaidoAnalysis.render()).catch(err=>console.error('備品分析の更新に失敗',err));
 }
 if(adminTab==='exit')window.DaidoExit?.show();else window.DaidoExit?.hide();
}
function applyAdminPanels(){
 var grid=$('adminPage')?.querySelector('.admin-grid');if(!grid)return;
 grid.style.display=(adminTab==='history'||adminTab==='exit')?'none':'grid';
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
 tabs.innerHTML=[['analysis','備品分析'],['users','使用者管理'],['exit','退去・回収'],['settings','管理設定'],['history','変更履歴']].map(x=>'<button type="button" role="tab" class="workspace-tab" data-admin-tab="'+x[0]+'" aria-selected="false">'+x[1]+'</button>').join('');
 grid.insertAdjacentElement('beforebegin',tabs);
 tabs.addEventListener('click',ev=>{var b=ev.target.closest('[data-admin-tab]');if(b)setAdminTab(b.dataset.adminTab)});
 tabs.addEventListener('keydown',ev=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
  var b=ev.target.closest('[data-admin-tab]');if(!b)return;
  var buttons=[...tabs.querySelectorAll('[data-admin-tab]')],index=buttons.indexOf(b);
  var next=ev.key==='Home'?0:ev.key==='End'?buttons.length-1:(index+(ev.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  ev.preventDefault();setAdminTab(buttons[next].dataset.adminTab);buttons[next].focus();
 });
 var pane=document.createElement('section');pane.id='workspaceAdminHistory';pane.className='workspace-history-pane hidden';
 pane.innerHTML='<div class="panel"><div class="panel-head"><h3>備品の変更履歴</h3></div><div class="workspace-history-meta"><button type="button" id="workspaceHistoryRefresh" class="secondary">最新の履歴を取得</button><span id="workspaceHistoryRefreshState" role="status" aria-live="polite"></span></div><div class="workspace-history-tools"><input id="workspaceHistorySearch" type="search" aria-label="変更履歴を検索" placeholder="管理No.・備品名・操作内容で検索"><select id="workspaceHistoryKind" aria-label="操作区分"><option value="">すべての操作</option></select></div><div id="workspaceHistoryCount" class="workspace-history-count"></div><div id="workspaceHistoryRows" class="table-wrap"></div><button type="button" id="workspaceHistoryMore" class="secondary hidden" style="min-height:42px;margin-top:12px">次の80件を表示</button></div>';
 grid.insertAdjacentElement('afterend',pane);
 $('workspaceHistoryRefresh').addEventListener('click',refreshAdminHistory);
 $('workspaceHistorySearch').addEventListener('input',ev=>{historySearch=ev.target.value.trim().normalize('NFKC').toLowerCase();historyLimit=80;renderAdminHistory()});
 $('workspaceHistoryKind').addEventListener('change',ev=>{historyType=ev.target.value;historyLimit=80;renderAdminHistory()});
 $('workspaceHistoryMore').addEventListener('click',()=>{historyLimit+=80;renderAdminHistory()});
 $('workspaceHistoryRows').addEventListener('click',ev=>{
  var b=ev.target.closest('[data-asset-search]');if(!b)return;
  window.DaidoAnalysisFilter=null;
  $('assetSearch').value=b.dataset.assetSearch;$('assetStatus').value='';$('assetCategory').value='';
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
  tabs.innerHTML='<button type="button" class="workspace-tab" data-detail-tab="info">基本情報</button><button type="button" class="workspace-tab" data-detail-tab="photos">写真</button><button type="button" class="workspace-tab" data-detail-tab="history">この備品の履歴</button>';
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