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
  occupant:code==='北側和室'?'空室（例）':'サンプル入居者（例）',
  department:section.floor==='和室'?'設定例：共用':'設定例：未指定',
  capacity:section.floor==='和室'?'複数人（例）':'1名（例）',
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
let floor='すべて',search='',filter='すべて',selected='101',detailMode=false;
function record(id){return rooms.find(r=>r.id===id)}
function doneCount(id){return (checks.get(id)||[]).filter(Boolean).length}
function state(id){
  const n=doneCount(id);
  return n===models.length?'確認済み':n===0?'未確認':'要確認';
}
function badge(id){
  const value=state(id);
  return '<span class="rd-badge rd-'+(value==='確認済み'?'ok':value==='要確認'?'warn':'idle')+'">'+esc(value)+'</span>';
}
function stats(){
  const complete=rooms.filter(r=>doneCount(r.id)===models.length).length;
  const partial=rooms.filter(r=>doneCount(r.id)>0&&doneCount(r.id)<models.length).length;
  return {complete,partial,pending:rooms.length-complete,roomCount:rooms.length};
}
function notify(msg){
  const el=$('roomDemoFeedback');
  if(!el)return;
  el.textContent=msg;
  el.classList.remove('hidden');
}
function renderOverview(){
  const s=stats();
  const total=$('roomDemoTotals');
  if(total)total.innerHTML=[
    ['候補の部屋',''+s.roomCount+'室','rooms'],
    ['確認済み（例）',''+s.complete+'室','done'],
    ['未完了（例）',''+s.pending+'室','pending']
  ].map(([label,value,kind])=>
    '<div class="rd-stat rd-stat-'+kind+'"><small>'+label+'</small><strong>'+value+'</strong></div>'
  ).join('');
}
function renderList(){
  const host=$('roomDemoRoomList');if(!host)return;
  const normalize=x=>String(x).normalize('NFKC').toLowerCase();
  const q=normalize(search.trim());
  const result=rooms.filter(r=>
    (floor==='すべて'||floor===r.floor)&&
    (filter==='すべて'||state(r.id)===filter)&&
    (!q||normalize([r.id,r.floor,r.occupant].join(' ')).includes(q))
  );
  $('roomDemoListCount').textContent=result.length+' / '+rooms.length+'室を表示（サンプル）';
  host.innerHTML=sections.map(section=>{
    const list=result.filter(r=>r.floor===section.floor);
    if(!list.length)return '';
    return '<section class="rd-floor" aria-label="'+esc(section.floor)+'">'+
      '<h4>'+esc(section.floor)+'<span>'+list.length+'室</span></h4>'+
      '<div class="rd-room-grid">'+list.map(r=>{
        const n=doneCount(r.id);
        return '<button type="button" class="rd-room-tile'+(r.id===selected?' is-selected':'')+
          '" data-room="'+esc(r.id)+'" aria-label="'+esc(r.id)+'号室のデモ詳細を見る">'+
          '<div class="rd-tile-head"><strong>'+esc(r.id)+(r.floor==='和室'?'':'号室')+'</strong>'+badge(r.id)+'</div>'+
          '<p>'+esc(r.occupant)+'</p><div class="rd-tile-foot"><span>仮チェック '+n+'/'+models.length+'件</span>'+
          '<span aria-hidden="true">詳細を見る ›</span></div></button>';
      }).join('')+'</div></section>';
  }).join('')||'<div class="rd-empty">該当する部屋はありません。検索条件を変えてください。</div>';
  $('roomDemoFloorTabs')?.querySelectorAll('button[data-floor]').forEach(btn=>{
    const active=btn.dataset.floor===floor;
    btn.setAttribute('aria-pressed',String(active));
    btn.classList.toggle('is-active',active);
  });
  renderOverview();
}
function renderDetail(){
  const host=$('roomDemoDetail');if(!host)return;
  const r=record(selected);if(!r)return;
  const done=doneCount(selected),percent=Math.round(done/models.length*100);
  const label=r.floor==='和室'?r.id:r.id+'号室';
  host.innerHTML=
    '<div class="rd-detail-top"><div><small>ROOM DETAIL / 体験用</small><h3>'+esc(label)+'</h3></div>'+badge(r.id)+'</div>'+
    '<div class="rd-detail-meta"><div><span>入居者</span><strong>'+esc(r.occupant)+'</strong></div>'+
    '<div><span>所属・区分</span><strong>'+esc(r.department)+'</strong></div>'+
    '<div><span>部屋</span><strong>'+esc(r.floor)+'</strong></div>'+
    '<div><span>備品</span><strong>5件（すべて架空）</strong></div></div>'+
    '<section class="rd-detail-section"><div class="rd-section-title"><h4>備品の現物確認を体験</h4>'+
    '<span>'+done+' / '+models.length+'件</span></div>'+
    '<div class="rd-progress" role="progressbar" aria-valuenow="'+done+
      '" aria-valuemin="0" aria-valuemax="'+models.length+'" aria-label="この部屋のデモ確認進捗"><span style="width:'+percent+'%"></span></div>'+
    '<p class="rd-helper">チェックはこの画面内だけの仮操作です。備品台帳や実際の棚卸し履歴には保存されません。</p>'+
    '<div class="rd-equipment">'+models.map((m,i)=>{
      const checked=checks.get(selected)[i];
      return '<label class="rd-equipment-row"><span class="rd-equipment-icon" aria-hidden="true">'+m.icon+'</span>'+
        '<span class="rd-equipment-data"><strong>'+esc(m.name)+'</strong><small>仮備品 DEMO-'+String(i+1).padStart(2,'0')+
        ' ・ '+esc(m.status)+'</small></span>'+
        '<span class="rd-equipment-check"><input type="checkbox" data-room-check="'+i+'" '+
        (checked?'checked':'')+' aria-label="'+esc(m.name)+'の仮現物確認">'+
        '<span>'+ (checked?'仮確認済':'未確認')+'</span></span></label>';
    }).join('')+'</div></section>'+
    '<div class="rd-detail-buttons"><button type="button" class="rd-primary" data-room-action="simulate">確認結果を仮反映</button>'+
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
  initChecks();floor='すべて';search='';filter='すべて';selected='101';detailMode=false;
  $('roomDemoSearch').value='';
  $('roomDemoCheckFilter').value='すべて';
  back();renderDetail();
  notify('デモのチェック状態を初期化しました。実際の備品データに変更はありません。');
}
function init(){
  const root=$('roomDemoApp');if(!root||root.dataset.ready)return;
  root.dataset.ready='1';
  root.innerHTML=
    '<div class="rd-overview" id="roomDemoTotals"></div>'+
    '<div id="roomDemoShell" class="rd-shell">'+
    '<div class="rd-list" aria-label="部屋一覧のデモ">'+
    '<div class="rd-panel-head"><div><small>ROOM LIST</small><h3>部屋一覧</h3></div>'+
    '<button type="button" class="rd-reset" id="roomDemoReset">↻ デモを初期化</button></div>'+
    '<div class="rd-controls"><label>部屋番号で検索<input type="search" id="roomDemoSearch" placeholder="例：205・和室" autocomplete="off"></label>'+
    '<label>仮確認状況<select id="roomDemoCheckFilter"><option>すべて</option><option>確認済み</option><option>要確認</option><option>未確認</option></select></label></div>'+
    '<div id="roomDemoFloorTabs" class="rd-floor-tabs" role="group" aria-label="階を選ぶ">'+
    ['すべて','1階','2階','和室'].map(x=>'<button type="button" data-floor="'+esc(x)+'" aria-pressed="false">'+esc(x)+'</button>').join('')+'</div>'+
    '<div id="roomDemoListCount" class="rd-list-count" role="status"></div>'+
    '<div id="roomDemoRoomList"></div></div>'+
    '<div class="rd-detail" aria-label="部屋詳細のデモ">'+
    '<button type="button" id="roomDemoMobileBack" class="rd-mobile-back hidden">← 部屋一覧に戻る</button>'+
    '<div id="roomDemoDetail"></div></div></div>';
  root.addEventListener('click',event=>{
    const floorButton=event.target.closest('[data-floor]');
    if(floorButton){floor=floorButton.dataset.floor;renderList();return}
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
  $('roomDemoFloorTabs').addEventListener('click',()=>{});
  $('roomDemoSearch').addEventListener('input',e=>{search=e.target.value;renderList()});
  $('roomDemoCheckFilter').addEventListener('change',e=>{filter=e.target.value;renderList()});
  $('roomDemoReset').addEventListener('click',reset);
  $('roomDemoMobileBack').addEventListener('click',back);
  renderList();renderDetail();
  window.addEventListener('resize',()=>{if(!detailMode)$('roomDemoShell')?.classList.remove('rd-in-detail')});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();