(function(){
'use strict';
// Self-contained room-management prototype. NO Supabase fetches or mutations.
// The room numbers are illustrative; every resident, count and check is fictional.
const sections=[
  {floor:'1階',rooms:['101','102','103','104']},
  {floor:'2階',rooms:['201','202','205','206','207','208']},
  {floor:'和室',rooms:['南側和室','北側和室']}
];
const models=[
  {name:'冷蔵庫',icon:'❄️',status:'使用中'},
  {name:'洗濯機',icon:'🫧',status:'使用中'},
  {name:'炊飯器',icon:'🍚',status:'使用中'},
  {name:'電子レンジ',icon:'▣',status:'修理中'},
  {name:'ベッド',icon:'🛏️',status:'使用中'}
];
const rooms=sections.flatMap(section=>section.rooms.map((code,index)=>({
  id:code,floor:section.floor,
  occupant:(code==='北側和室'||code==='205')?'未登録（架空）':'デモ入居者（架空）',
  occupancy:(code==='北側和室'||code==='205')?'空室（仮）':'入居中（仮）',
  department:section.floor==='和室'?'共用想定（仮）':'サンプル部署（仮）',
  capacity:section.floor==='和室'?'複数人（想定）':'1名（想定）',
  sampleIndex:sections.findIndex(s=>s.floor===section.floor)*6+index
})));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=id=>document.getElementById(id);
const checks=new Map();
const initChecks=()=>rooms.forEach((r,i)=>{
  const count=i%3===0?models.length:i%3===1?2:0;
  checks.set(r.id,models.map((_,j)=>j<count));
});
initChecks();
let floor='すべて',search='',filter='すべて',sort='room',selected='101',detailMode=false;
function record(id){return rooms.find(r=>r.id===id)}
function doneCount(id){return (checks.get(id)||[]).filter(Boolean).length}
function state(id){
  const n=doneCount(id);
  return n===models.length?'確認済み':n===0?'未確認':'確認途中';
}
function badge(id){
  const value=state(id);
  return '<span class="rd-badge rd-'+(value==='確認済み'?'ok':value==='確認途中'?'warn':'idle')+'">'+esc(value)+'</span>';
}
function stats(){
  const complete=rooms.filter(r=>doneCount(r.id)===models.length).length;
  const partial=rooms.filter(r=>doneCount(r.id)>0&&doneCount(r.id)<models.length).length;
  const unstarted=rooms.length-complete-partial;
  return {complete,partial,unstarted,roomCount:rooms.length};
}
function statusPriority(id){
  const s=state(id);
  return s==='未確認'?0:s==='確認途中'?1:2;
}
function notify(msg){
  const el=$('roomDemoFeedback');
  if(!el)return;
  el.textContent=msg;
  el.classList.remove('hidden');
}
function renderOverview(){
  const s=stats(),total=$('roomDemoTotals');
  if(!total)return;
  const cards=[
    {label:'管理候補の部屋',value:s.roomCount+'室',key:'すべて',kind:'rooms',hint:'全部見る'},
    {label:'未確認',value:s.unstarted+'室',key:'未確認',kind:'pending',hint:'優先して確認'},
    {label:'確認途中',value:s.partial+'室',key:'確認途中',kind:'partial',hint:'続きを確認'},
    {label:'確認済み',value:s.complete+'室',key:'確認済み',kind:'done',hint:'完了分を見る'}
  ];
  total.innerHTML=cards.map(c=>
    '<button type="button" class="rd-stat rd-stat-'+c.kind+
    '" data-overview-filter="'+esc(c.key)+'" aria-pressed="'+String(filter===c.key)+'">'+
    '<small>'+c.label+'</small><strong>'+c.value+'</strong>'+
    '<span class="rd-stat-hint">'+c.hint+' →</span></button>'
  ).join('');
}
function renderList(){
  const host=$('roomDemoRoomList');if(!host)return;
  const normalize=x=>String(x).normalize('NFKC').toLowerCase();
  const q=normalize(search.trim());
  const result=rooms.filter(r=>
    (floor==='すべて'||floor===r.floor)&&
    (filter==='すべて'||state(r.id)===filter)&&
    (!q||normalize([r.id,r.floor,r.occupant,r.occupancy,r.department].join(' ')).includes(q))
  );
  const visibleLabel=result.length+' / '+rooms.length+'室を表示（すべてデモデータ）';
  $('roomDemoListCount').textContent=visibleLabel;
  const compare=(a,b)=>sort==='pending'?
    statusPriority(a.id)-statusPriority(b.id)||a.sampleIndex-b.sampleIndex:
    a.sampleIndex-b.sampleIndex;
  const statusExplanation={
    '確認済み':'サンプル備品はすべて仮確認済み',
    '確認途中':'サンプル備品の確認が途中',
    '未確認':'サンプル備品の仮確認が未開始'
  };
  host.innerHTML=sections.map(section=>{
    const list=result.filter(r=>r.floor===section.floor).sort(compare);
    if(!list.length)return '';
    return '<section class="rd-floor" aria-label="'+esc(section.floor)+'">'+
      '<h4>'+esc(section.floor)+'<span>'+list.length+'室</span></h4>'+
      '<div class="rd-room-grid">'+list.map(r=>{
        const n=doneCount(r.id),name=r.floor==='和室'?r.id:r.id+'号室';
        return '<button type="button" class="rd-room-tile'+(r.id===selected?' is-selected':'')+
          '" data-room="'+esc(r.id)+'" aria-pressed="'+String(r.id===selected&&detailMode)+'"'+
          ' aria-label="'+esc(name+'、'+r.occupancy+'、'+state(r.id)+'、備品の仮確認'+n+'件。詳細を見る')+'">'+
          '<div class="rd-tile-head"><strong>'+esc(name)+'</strong>'+badge(r.id)+'</div>'+
          '<div class="rd-tile-main"><span class="rd-occupancy">'+esc(r.occupancy)+'</span>'+
          '<span class="rd-room-count">'+n+' / '+models.length+' 件 仮確認済み</span></div>'+
          '<div class="rd-tile-progress" aria-hidden="true"><span style="width:'+Math.round(n/models.length*100)+'%"></span></div>'+
          '<div class="rd-tile-foot"><span>'+esc(statusExplanation[state(r.id)])+'</span>'+
          '<span class="rd-detail-link" aria-hidden="true">部屋を見る ›</span></div></button>';
      }).join('')+'</div></section>';
  }).join('')||'<div class="rd-empty"><strong>該当する部屋がありません</strong><p>階・確認状況・検索語を変更してください。</p><button type="button" data-clear-filters>条件をクリア</button></div>';
  $('roomDemoFloorTabs')?.querySelectorAll('button[data-floor]').forEach(btn=>{
    const active=btn.dataset.floor===floor;
    btn.setAttribute('aria-pressed',String(active));
    btn.classList.toggle('is-active',active);
  });
  const empty=!result.length;
  $('roomDemoClearFilters')?.classList.toggle('hidden',
    floor==='すべて'&&filter==='すべて'&&!search&&sort==='room');
  $('roomDemoCheckFilter').value=filter;
  $('roomDemoSort').value=sort;
  renderOverview();
}
function renderDetail(){
  const host=$('roomDemoDetail');if(!host)return;
  const r=record(selected);if(!r)return;
  const done=doneCount(selected),percent=Math.round(done/models.length*100);
  const label=r.floor==='和室'?r.id:r.id+'号室';
  host.innerHTML=
    '<div class="rd-detail-top"><div><small>ROOM DETAIL / 体験用</small><h3>'+esc(label)+'</h3></div>'+badge(r.id)+'</div>'+
    '<div class="rd-detail-meta"><div><span>入居区分（仮）</span><strong>'+esc(r.occupancy)+'</strong></div>'+
    '<div><span>入居者（架空）</span><strong>'+esc(r.occupant)+'</strong></div>'+
    '<div><span>所属・区分</span><strong>'+esc(r.department)+'</strong></div>'+
    '<div><span>階・区分</span><strong>'+esc(r.floor)+'</strong></div>'+
    '<div><span>備品</span><strong>5件（すべて架空）</strong></div></div>'+
    '<section class="rd-detail-section"><div class="rd-section-title"><h4>備品の現物確認を体験</h4>'+
    '<span>'+done+' / '+models.length+'件</span></div>'+
    '<div class="rd-progress" role="progressbar" aria-valuenow="'+done+
      '" aria-valuemin="0" aria-valuemax="'+models.length+'" aria-label="この部屋のデモ確認進捗"><span style="width:'+percent+'%"></span></div>'+
    '<p class="rd-helper">仮備品のチェックは画面上だけで変化します。備品台帳・実際の点検履歴には影響しません。</p>'+
    '<div class="rd-equipment">'+models.map((m,i)=>{
      const checked=checks.get(selected)[i];
      return '<label class="rd-equipment-row"><span class="rd-equipment-icon" aria-hidden="true">'+m.icon+'</span>'+
        '<span class="rd-equipment-data"><strong>'+esc(m.name)+'</strong><small>仮備品 DEMO-'+String(i+1).padStart(2,'0')+
        ' ・ '+esc(m.status)+'</small></span>'+
        '<span class="rd-equipment-check"><input type="checkbox" data-room-check="'+i+'" '+
        (checked?'checked':'')+' aria-label="'+esc(m.name)+'の仮現物確認">'+
        '<span>'+ (checked?'仮確認済':'未確認')+'</span></span></label>';
    }).join('')+'</div></section>'+
    '<div class="rd-detail-buttons"><button type="button" class="rd-primary" data-room-action="simulate">確認結果の表示を見る（デモ）</button>'+
    '<button type="button" class="rd-secondary" data-room-action="qr">QR読取の構想を見る</button>'+
    '<button type="button" class="rd-secondary" data-room-action="exit">退去チェックの構想を見る</button></div>'+
    '<div class="rd-detail-note">※ 保存・貸出・利用終了・退去確定などの実処理は一切行いません。</div>';
}
function showRoom(id){
  if(!record(id))return;
  selected=id;detailMode=true;
  const shell=$('roomDemoShell');shell?.classList.add('rd-in-detail');
  renderList();renderDetail();
  if(window.matchMedia('(max-width: 880px)').matches){
    $('roomDemoMobileBack')?.classList.remove('hidden');
    $('roomDemoTop')?.scrollIntoView({behavior:'auto',block:'start'});
    $('roomDemoMobileBack')?.focus({preventScroll:true});
  }
  notify((record(id).floor==='和室'?id:id+'号室')+'のデモ詳細を表示しています。');
}
function back(){
  detailMode=false;
  $('roomDemoShell')?.classList.remove('rd-in-detail');
  $('roomDemoMobileBack')?.classList.add('hidden');
  renderList();
  $('roomDemoTop')?.scrollIntoView({behavior:'auto',block:'start'});
}
function reset(){
  initChecks();floor='すべて';search='';filter='すべて';sort='room';selected='101';detailMode=false;
  $('roomDemoSearch').value='';
  $('roomDemoCheckFilter').value='すべて';
  $('roomDemoSort').value='room';
  back();renderDetail();
  notify('デモのチェック状態を初期化しました。実際の備品データに変更はありません。');
}
function init(){
  const root=$('roomDemoApp');if(!root||root.dataset.ready)return;
  root.dataset.ready='1';
  root.innerHTML=
    '<div class="rd-journey" aria-label="デモの操作手順"><span class="rd-journey-label">使い方</span>'+
    '<span><strong>1.</strong> 階・確認状況から探す</span><span aria-hidden="true">›</span>'+
    '<span><strong>2.</strong> 部屋を開く</span><span aria-hidden="true">›</span>'+
    '<span><strong>3.</strong> 備品を仮確認する</span></div>'+
    '<div class="rd-overview" id="roomDemoTotals" role="group" aria-label="仮確認状況の絞り込み"></div>'+
    '<div id="roomDemoShell" class="rd-shell">'+
    '<div class="rd-list" aria-label="部屋一覧のデモ">'+
    '<div class="rd-panel-head"><div><small>ROOM LIST / 架空データ</small><h3>部屋一覧</h3>'+
    '<p>部屋の状態と確認進捗をひと目で把握できます。</p></div>'+
    '<button type="button" class="rd-reset" id="roomDemoReset">↻ デモを初期化</button></div>'+
    '<div class="rd-floor-tabs" id="roomDemoFloorTabs" role="group" aria-label="階・区分で絞り込む">'+
    ['すべて','1階','2階','和室'].map(x=>'<button type="button" data-floor="'+esc(x)+'" aria-pressed="false">'+esc(x)+'</button>').join('')+'</div>'+
    '<div class="rd-controls">'+
    '<label>部屋を探す<input type="search" id="roomDemoSearch" placeholder="例：205・南側和室" autocomplete="off"></label>'+
    '<label>確認状況<select id="roomDemoCheckFilter"><option>すべて</option><option>未確認</option><option>確認途中</option><option>確認済み</option></select></label>'+
    '<label>並び順<select id="roomDemoSort"><option value="room">部屋番号順</option><option value="pending">未完了優先</option></select></label></div>'+
    '<div class="rd-results-row"><div id="roomDemoListCount" class="rd-list-count" role="status"></div>'+
    '<button id="roomDemoClearFilters" type="button" class="rd-clear hidden">条件をクリア</button></div>'+
    '<div id="roomDemoRoomList"></div></div>'+
    '<div class="rd-detail" aria-label="部屋詳細のデモ">'+
    '<button type="button" id="roomDemoMobileBack" class="rd-mobile-back hidden">← 部屋一覧に戻る</button>'+
    '<div id="roomDemoDetail"></div></div></div>';
  root.addEventListener('click',event=>{
    const floorButton=event.target.closest('[data-floor]');
    if(floorButton){floor=floorButton.dataset.floor;renderList();return}
    const overview=event.target.closest('[data-overview-filter]');
    if(overview){filter=overview.dataset.overviewFilter;renderList();return}
    if(event.target.closest('[data-clear-filters]')){
      floor='すべて';filter='すべて';search='';sort='room';
      $('roomDemoSearch').value='';renderList();return;
    }
    const roomButton=event.target.closest('[data-room]');
    if(roomButton){showRoom(roomButton.dataset.room);return}
    const action=event.target.closest('[data-room-action]');
    if(action){
      if(action.dataset.roomAction==='simulate')notify('仮チェックの表示を更新しました。サーバーには保存されていません。ページを再読み込みすると元に戻ります。');
      if(action.dataset.roomAction==='qr')notify('QR読取は将来の構想です。このデモではカメラを起動せず、実際のQR情報にもアクセスしません。');
      if(action.dataset.roomAction==='exit')notify('退去チェックは将来の連動案です。このデモから退去処理は開始されません。');
    }
  });
  root.addEventListener('change',event=>{
    const box=event.target.closest('input[data-room-check]');
    if(!box)return;
    const i=Number(box.dataset.roomCheck);
    if(!Number.isInteger(i)||i<0||i>=models.length)return;
    checks.get(selected)[i]=box.checked;
    renderList();renderDetail();
    $('roomDemoDetail').querySelector('input[data-room-check="'+i+'"]')?.focus({preventScroll:true});
    notify('現物確認の仮チェックを変更しました。実際の台帳は変更されていません。');
  });
  $('roomDemoSearch').addEventListener('input',e=>{search=e.target.value;renderList()});
  $('roomDemoCheckFilter').addEventListener('change',e=>{filter=e.target.value;renderList()});
  $('roomDemoSort').addEventListener('change',e=>{sort=e.target.value;renderList()});
  $('roomDemoReset').addEventListener('click',reset);
  $('roomDemoClearFilters').addEventListener('click',()=>{
    floor='すべて';filter='すべて';search='';sort='room';
    $('roomDemoSearch').value='';renderList();
  });
  $('roomDemoMobileBack').addEventListener('click',back);
  renderList();renderDetail();
  window.addEventListener('resize',()=>{if(!detailMode)$('roomDemoShell')?.classList.remove('rd-in-detail')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();