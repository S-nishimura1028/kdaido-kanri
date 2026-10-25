(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label={pending:'未処理',returned:'返却済み',transferred:'引継ぎ済み',unrecovered:'回収不能（要追跡）'};
const state={users:[],assets:[],sessions:[],items:[],unrecovered:[],staff:[],session:null,busy:false,loadSeq:0,recoveryItemId:null};
const db=()=>window.DaidoQrBridge?.getClient()||null;
const setText=(id,text)=>{const el=$(id);if(el)el.textContent=text||''};
const err=e=>e?.message||'処理に失敗しました。通信状況を確認してください。';
const toast=(msg,warning=false)=>{
 const el=$('exitMessage');if(!el)return;
 el.textContent=msg||'';el.classList.toggle('exit-warning',warning);
};
const fullname=u=>[u?.name,u?.department,u?.location,u?.room_number].filter(Boolean).join(' / ')||'未設定';
const userById=id=>state.users.find(u=>u.id===id);
function busy(on){
 state.busy=on;
 document.querySelectorAll('#workspaceAdminExit button,#workspaceAdminExit select,#workspaceAdminExit input,#workspaceAdminExit textarea')
  .forEach(el=>el.disabled=on);
}
async function readList(table,columns,build){
 let q=db().from(table).select(columns);
 if(build)q=build(q);
 const {data,error}=await q;if(error)throw error;
 return data||[];
}
async function refreshRoster(){
 const c=db();if(!c)throw new Error('管理者ログインが必要です');
 const [users,assets,sessions,unrecovered,staff]=await Promise.all([
  readList('asset_users','id,name,department,location,room_number,is_active',q=>q.order('name').limit(1000)),
  readList('assets','id,asset_no,name,status,assigned_user_id,location,is_deleted',q=>q.eq('is_deleted',false).limit(2000)),
  readList('asset_exit_sessions','id,asset_user_id,status,started_at,completed_at,started_by,completed_by',q=>q.order('started_at',{ascending:false}).limit(300)),
  readList('asset_exit_items','id,asset_id,asset_no_snapshot,asset_name_snapshot,session_id,note,checked_at,recovered_at,recovered_by,recovery_condition,recovery_note',q=>q.eq('resolution','unrecovered').order('checked_at',{ascending:false}).limit(1000)),
  readList('profiles','id,name',q=>q.order('name').limit(300))
 ]);
 state.users=users;state.assets=assets;state.sessions=sessions;state.unrecovered=unrecovered;state.staff=staff;
 const selected=$('exitUserSelect')?.value||'';
 const active=users.filter(u=>u.is_active);
 const options=active.map(u=>{
  const count=assets.filter(a=>a.assigned_user_id===u.id).length;
  const activeSession=sessions.some(s=>s.asset_user_id===u.id&&s.status==='in_progress');
  return '<option value="'+esc(u.id)+'">'+esc(u.name)+' ／ '+esc(u.department||'部署未設定')+' ／ '+esc(u.room_number||u.location||'場所未設定')+'（備品'+count+'件'+(activeSession?'・チェック進行中':'')+'）</option>';
 }).join('');
 $('exitUserSelect').innerHTML='<option value="">退去する使用者を選択してください</option>'+options;
 if(active.some(u=>u.id===selected))$('exitUserSelect').value=selected;
 const running=sessions.filter(s=>s.status==='in_progress');
 $('exitOngoing').innerHTML=running.length?
  '<h4>進行中の退去チェック</h4>'+running.map(s=>'<button type="button" class="exit-session-link" data-exit-resume="'+esc(s.asset_user_id)+'">'+esc(userById(s.asset_user_id)?.name||'使用者')+' <small>再開</small></button>').join(''):
  '<p class="exit-muted">現在進行中の退去チェックはありません。</p>';
 const finished=sessions.filter(s=>s.status==='completed');
 $('exitCompleted').innerHTML='<div class="exit-history-head"><h4>退去チェックの履歴</h4><small>利用終了済み '+finished.length+'件</small></div>'+
  (finished.length?'<div class="exit-history-list">'+finished.map(s=>{
    const name=userById(s.asset_user_id)?.name||'登録済み使用者';
    const date=s.completed_at?new Date(s.completed_at).toLocaleDateString('ja-JP'):'日付未設定';
    return '<button type="button" class="exit-history-row" data-exit-history="'+esc(s.id)+'"><span><strong>'+esc(name)+'</strong><small>利用終了 '+esc(date)+'</small></span><span class="exit-history-chevron">詳細を見る ›</span></button>';
  }).join('')+'</div><div id="exitHistoryDetail"></div>':'<p class="exit-muted">利用終了済みの退去チェックはまだありません。</p>');
 renderUnrecovered();
}
async function reload(){
 if(state.busy)return;
 const seq=++state.loadSeq;
 try{
  toast('読み込み中…');
  await refreshRoster();
  if(seq!==state.loadSeq)return;
  if(state.session?.id)await loadSession(state.session.id);
  toast('');
 }catch(e){console.error('exit roster',e);toast(err(e),true);}
}
function renderUnrecovered(){
 const host=$('exitUnrecovered');if(!host)return;
 const open=state.unrecovered.filter(i=>!i.recovered_at);
 const done=state.unrecovered.filter(i=>i.recovered_at);
 if(!state.unrecovered.length){host.innerHTML='';return}
 const renderRow=(i,resolved)=>{
  const session=state.sessions.find(s=>s.id===i.session_id);
  const owner=userById(session?.asset_user_id);
  const asset=state.assets.find(a=>a.id===i.asset_id);
  const conflict=!resolved&&(!asset||asset.assigned_user_id!==session?.asset_user_id);
  const assignee=conflict?'台帳の割当が変更済み（要確認）':'退去者の割当が残っています';
  return '<div class="exit-unrecovered-row'+(resolved?' exit-recovered-row':'')+'"><div><strong>'+
   esc(i.asset_no_snapshot)+' '+esc(i.asset_name_snapshot)+'</strong>'+
   '<small>退去者：'+esc(owner?.name||'登録済み使用者')+' ／ '+
   esc(resolved?'回収済み：'+new Date(i.recovered_at).toLocaleString('ja-JP'):assignee)+'</small>'+
   (i.note?'<p>未回収時：'+esc(i.note)+'</p>':'')+
   (resolved?'<p>回収経緯：'+esc(i.recovery_note||'記録なし')+' ／ '+
     esc(i.recovery_condition==='faulty'?'修理が必要':'再利用可能')+' ／ 確認担当：'+
     esc(state.staff.find(u=>u.id===i.recovered_by)?.name||'管理者')+'</p>':'')+
   '</div><div class="exit-recovery-actions">'+
   (!resolved&&asset&&!conflict?'<button type="button" class="primary" data-exit-recover="'+esc(i.id)+'">回収済みにする</button>':'')+
   (asset?'<button type="button" class="secondary" data-exit-find="'+esc(i.asset_no_snapshot)+'">備品を確認</button>':'')+
   '</div></div>';
 };
 host.innerHTML='<h4>未回収品・継続調査 <span>'+open.length+'件</span></h4>'+
  '<p class="exit-muted">後から見つかった場合は現物・付属品を確認して「回収済みにする」を押してください。元の未回収記録も残します。</p>'+
  (open.length?'<div class="exit-unrecovered-list">'+open.map(i=>renderRow(i,false)).join('')+'</div>':
   '<p class="exit-muted">未回収の備品はありません。</p>')+
  (done.length?'<details class="exit-recovered-details"><summary>後日回収済みの記録 '+done.length+'件</summary>'+
   '<div class="exit-unrecovered-list">'+done.map(i=>renderRow(i,true)).join('')+'</div></details>':'');
}
function ensureRecoveryDialog(){
 let d=$('exitRecoveryDialog');if(d)return d;
 d=document.createElement('dialog');d.id='exitRecoveryDialog';d.className='exit-recovery-dialog';
 d.innerHTML='<div class="dialog-card"><div class="dialog-head"><h3>未回収品の後日回収</h3><button type="button" class="close" aria-label="閉じる" data-recovery-cancel>×</button></div>'+
  '<p id="exitRecoveryAsset" class="exit-recovery-asset"></p>'+
  '<p class="exit-muted">回収時に現物と付属品を確認してください。既に「修理中」の備品は点検結果が良好でも修理中を維持します。</p>'+
  '<label>点検結果 *<select id="exitRecoveryCondition"><option value="">選択してください</option><option value="usable">再利用可能（未使用へ）</option><option value="faulty">故障・破損あり（修理中へ）</option></select></label>'+
  '<label>回収場所・回収経緯（必須・5文字以上）<textarea id="exitRecoveryNote" maxlength="500" rows="3" placeholder="例：薄場寮101号室の押入れで発見、付属品を確認"></textarea></label>'+
  '<label class="exit-check"><input type="checkbox" id="exitRecoveryChecked"><span>現物と付属品を確認しました</span></label>'+
  '<p id="exitRecoveryError" class="error" role="alert"></p>'+
  '<div class="dialog-actions"><button type="button" class="secondary" data-recovery-cancel>キャンセル</button><button type="button" class="primary" id="exitRecoverySave">確認して確定</button></div></div>';
 document.body.appendChild(d);
 d.addEventListener('click',e=>{if(e.target.closest('[data-recovery-cancel]')&&!state.busy)d.close()});
 d.addEventListener('cancel',e=>{if(state.busy)e.preventDefault()});
 $('exitRecoverySave').addEventListener('click',saveRecovery);
 return d;
}
function beginRecovery(itemId){
 if(state.busy)return;
 const item=state.unrecovered.find(i=>i.id===itemId&&!i.recovered_at);
 if(!item){toast('処理済みの可能性があります。画面を更新してください。',true);return}
 state.recoveryItemId=itemId;
 const dialog=ensureRecoveryDialog();
 setText('exitRecoveryAsset',item.asset_no_snapshot+'　'+item.asset_name_snapshot);
 $('exitRecoveryCondition').value='';$('exitRecoveryNote').value='';
 $('exitRecoveryChecked').checked=false;setText('exitRecoveryError','');
 if(!dialog.open)dialog.showModal();
}
async function saveRecovery(){
 if(state.busy)return;
 const item=state.unrecovered.find(x=>x.id===state.recoveryItemId&&!x.recovered_at);
 if(!item){setText('exitRecoveryError','未回収品が見つかりません。画面を更新してください。');return}
 const condition=$('exitRecoveryCondition').value;
 const note=$('exitRecoveryNote').value.trim();
 if(!['usable','faulty'].includes(condition)){setText('exitRecoveryError','点検結果を選択してください。');return}
 if(note.length<5||note.length>500){setText('exitRecoveryError','回収場所と経緯を5〜500文字で入力してください。');return}
 if(!$('exitRecoveryChecked').checked){setText('exitRecoveryError','現物と付属品の確認が必要です。');return}
 const msg=item.asset_no_snapshot+' '+item.asset_name_snapshot+
  '\n後日回収を記録します。\n点検結果：'+(condition==='faulty'?'修理が必要':'再利用可能')+
  '\n回収経緯：'+note+'\n\n元の「未回収」の調査記録は削除されません。確定しますか？';
 if(!window.confirm(msg))return;
 state.busy=true;
 $('exitRecoverySave').disabled=true;setText('exitRecoverySave','保存中…');
 try{
  const {data,error}=await db().rpc('resolve_unrecovered_asset_exit',{
   p_item_id:item.id,p_condition:condition,p_note:note,p_physical_check:true
  });
  if(error)throw error;
  if(!data?.resolved)throw new Error('更新結果を取得できませんでした。');
  $('exitRecoveryDialog').close();
  await refreshRoster();
  if(state.session?.id)await loadSession(state.session.id);
  document.dispatchEvent(new Event('asset-user-master-updated'));
  toast(item.asset_no_snapshot+' の後日回収を記録しました。台帳と履歴を更新しました。');
 }catch(e){console.error('resolve late recovery',e);setText('exitRecoveryError',
    '更新結果を確認してください。'+err(e));
   try{await refreshRoster()}catch(_){}}
 finally{state.busy=false;$('exitRecoverySave').disabled=false;setText('exitRecoverySave','確認して確定');}
}
async function loadExitHistory(sid){
 const host=$('exitHistoryDetail');if(!host)return;
 const session=state.sessions.find(s=>s.id===sid&&s.status==='completed');
 if(!session)return;
 host.innerHTML='<p class="exit-muted">履歴を読み込み中…</p>';
 const {data,error}=await db().from('asset_exit_items').select(
  'asset_no_snapshot,asset_name_snapshot,resolution,item_condition,next_user_id,note,checked_at,checked_by,recovered_at,recovered_by,recovery_condition,recovery_note'
 ).eq('session_id',sid).order('asset_no_snapshot');
 if(error){host.textContent='履歴を読み込めませんでした：'+err(error);return}
 const actor=id=>state.staff.find(s=>s.id===id)?.name||'管理者';
 const counts=(data||[]).reduce((o,x)=>{o[x.resolution]=(o[x.resolution]||0)+1;return o},{});
 const u=userById(session.asset_user_id);
 host.innerHTML='<section class="exit-history-detail"><div class="exit-history-detail-head"><h5>'+esc(u?.name||'使用者')+
  'の退去チェック</h5><button type="button" class="secondary" data-exit-history-close>閉じる</button></div>'+
  '<p class="exit-muted">開始：'+esc(new Date(session.started_at).toLocaleString('ja-JP'))+
  '（'+esc(actor(session.started_by))+'）／ 利用終了：'+esc(new Date(session.completed_at).toLocaleString('ja-JP'))+
  '（'+esc(actor(session.completed_by))+'）</p>'+
  '<p class="exit-history-summary">対象 '+(data||[]).length+'件　返却 '+(counts.returned||0)+
  '件　引継ぎ '+(counts.transferred||0)+'件　回収不能記録 '+(counts.unrecovered||0)+'件</p>'+
  (data||[]).map(x=>'<div class="exit-history-item"><strong>'+esc(x.asset_no_snapshot)+'　'+
   esc(x.asset_name_snapshot)+'</strong><span class="exit-badge exit-'+esc(x.resolution)+'">'+
   esc(label[x.resolution]||x.resolution)+'</span>'+
   '<p>処理日時：'+esc(x.checked_at?new Date(x.checked_at).toLocaleString('ja-JP'):'-')+
   ' ／ 担当：'+esc(actor(x.checked_by))+'</p>'+
   (x.resolution==='transferred'?'<p>引継ぎ先：'+esc(userById(x.next_user_id)?.name||'登録済み使用者')+'</p>':'')+
   (x.note?'<p>当時の記録：'+esc(x.note)+'</p>':'')+
   (x.resolution==='unrecovered'?'<p>'+ (x.recovered_at?
     '後日回収：'+esc(new Date(x.recovered_at).toLocaleString('ja-JP'))+
     ' ／ 担当：'+esc(actor(x.recovered_by))+' ／ '+esc(x.recovery_note||''):
     '現在も未回収として記録されています')+'</p>':'')+
   '</div>').join('')+'</section>';
}

async function loadSession(sid){
 const c=db();
 const [sess,items]=await Promise.all([
  c.from('asset_exit_sessions').select('*').eq('id',sid).single(),
  c.from('asset_exit_items').select('*').eq('session_id',sid).order('asset_no_snapshot')
 ]);
 if(sess.error)throw sess.error;
 if(items.error)throw items.error;
 state.session=sess.data;state.items=items.data||[];
 // The row list derives current statuses from fresh assets data on every reload.
 const ids=state.items.map(i=>i.asset_id);
 if(ids.length){
  const fresh=await c.from('assets').select('id,asset_no,name,status,assigned_user_id,location,is_deleted').in('id',ids);
  if(fresh.error)throw fresh.error;
  const map=new Map(state.assets.map(a=>[a.id,a]));
  (fresh.data||[]).forEach(a=>map.set(a.id,a));
  state.assets=[...map.values()];
 }
 renderSession();
}
async function start(uid){
 if(state.busy||!uid)return;
 const user=userById(uid);
 if(!user?.is_active){toast('有効な使用者を選択してください',true);return}
 const count=state.assets.filter(a=>a.assigned_user_id===uid).length;
 const running=state.sessions.find(s=>s.asset_user_id===uid&&s.status==='in_progress');
 if(!running&&!window.confirm(
  '「'+user.name+'」の退去・回収チェックを開始します。\n対象備品：'+count+'件\n\n開始時点では備品と使用者は変更しません。続けますか？'
 ))return;
 busy(true);
 try{
  toast('');
  const {data,error}=await db().rpc('start_asset_exit',{p_asset_user_id:uid});
  if(error)throw error;
  // Preserve the selected user; readback adds any newly assigned assets.
  await refreshRoster();
  $('exitUserSelect').value=uid;
  await loadSession(data);
  toast('退去チェックを開きました。各備品の現物確認から進めてください。');
 }catch(e){console.error('exit start',e);toast(err(e),true);}
 finally{busy(false);}
}
function choiceHtml(type,item){
 const disabledTransfer=state.assets.find(a=>a.id===item.asset_id)?.status==='修理中';
 return '<select class="exit-resolution" aria-label="処理内容を選択" data-item="'+esc(item.id)+'">'+
 '<option value="">処理方法を選択してください</option>'+
 '<option value="returned">現物を返却・回収</option>'+
 (disabledTransfer?'':'<option value="transferred">別の使用者へ直接引継ぎ</option>')+
 '<option value="unrecovered">回収不能（調査記録を残す）</option></select>';
}
function renderItem(item){
 const asset=state.assets.find(a=>a.id===item.asset_id);
 const processed=item.resolution!=='pending';
 const top='<div class="exit-item-header"><div><small>'+esc(item.asset_no_snapshot)+'</small><strong>'+esc(item.asset_name_snapshot)+'</strong><span class="exit-meta">'+esc(asset?.location||'場所未設定')+' ／ '+esc(asset?.status||'状態未確認')+'</span></div><span class="exit-badge exit-'+esc(item.resolution)+'">'+esc(label[item.resolution]||item.resolution)+'</span></div>';
 if(processed){
  const recipient=userById(item.next_user_id);
  return '<article class="exit-item exit-done">'+top+
   '<p class="exit-processed">'+(item.resolution==='transferred'?'引継ぎ先：'+esc(recipient?.name||'登録済み使用者')+' ／ ':'')+
   (item.resolution==='unrecovered'?'未回収のため引き続き調査対象です。／ ':'')+
   '確認日：'+esc(item.checked_at?new Date(item.checked_at).toLocaleString('ja-JP'):'-')+'</p>'+
   (item.note?'<p class="exit-item-note">'+esc(item.note)+'</p>':'')+'</article>';
 }
 const recipients=state.users.filter(u=>u.is_active&&u.id!==state.session.asset_user_id)
  .map(u=>'<option value="'+esc(u.id)+'">'+esc(fullname(u))+'</option>').join('');
 return '<article class="exit-item" data-exit-item="'+esc(item.id)+'">'+top+
 '<div class="exit-item-form"><label>現物確認後の処理方法'+choiceHtml('',item)+'</label>'+
 '<label class="exit-conditional hidden" data-show="returned">回収後の点検結果'+
 '<select class="exit-condition"><option value="">結果を選択してください</option><option value="usable">再利用可能（未使用へ）</option><option value="faulty">故障・破損あり（修理中へ）</option></select></label>'+
 '<label class="exit-conditional hidden" data-show="transferred">引継ぎ先の使用者'+
 '<select class="exit-next-user"><option value="">引継ぎ先を選択してください</option>'+recipients+'</select></label>'+
 '<label class="exit-item-memo">備考・調査内容<textarea class="exit-item-note-input" maxlength="500" rows="2" placeholder="引継ぎ時の注意事項など（回収不能の場合は理由と調査内容が必須）"></textarea></label>'+
 '<label class="exit-check"><input type="checkbox" class="exit-checked"><span class="exit-confirm-text">現物を確認しました</span></label>'+
 '<button type="button" class="primary exit-process" data-exit-save="'+esc(item.id)+'">処理内容を確認</button>'+
 '</div></article>';
}
function renderSession(){
 const target=$('exitSession');if(!target)return;
 const s=state.session;if(!s){target.innerHTML='';return}
 const user=userById(s.asset_user_id);
 const pending=state.items.filter(i=>i.resolution==='pending').length;
 const missing=state.items.filter(i=>i.resolution==='unrecovered').length;
 const total=state.items.length,done=total-pending;
 target.innerHTML='<div class="exit-session-head"><div><small>退去チェック進捗</small><h4>'+esc(fullname(user))+'</h4><p>点検した備品を1点ずつ確定します。返却・引継ぎの更新は自動的に履歴へ記録します。</p></div><button class="secondary" type="button" id="exitReload">最新の状態に更新</button></div>'+
 '<div class="exit-progress-numbers"><strong>'+done+' / '+total+' 件処理済み</strong><span>未処理 '+pending+'件'+(missing?' ／ 未回収 '+missing+'件':'')+'</span></div>'+
 '<progress class="exit-progress" max="'+Math.max(total,1)+'" value="'+done+'"></progress>'+
 (missing?'<p class="exit-caution">未回収 '+missing+'件：元の使用者への割当を残しています。利用終了後も調査・回収が必要です。</p>':'')+
 '<div class="exit-item-list">'+state.items.map(renderItem).join('')+
 (total===0?'<p class="exit-muted">現在、割当備品はありません。追加の備品がないことを確認して利用終了してください。</p>':'')+'</div>'+
 '<div class="exit-finalize"><p>すべての備品について処理方法と現物確認を記録すると、使用者の「利用終了」を確定できます。</p>'+
 '<button type="button" class="primary" id="exitFinalize" '+(pending||s.status!=='in_progress'?'disabled':'')+'>利用終了を確定'+(pending?'（残り'+pending+'件）':'')+'</button></div>';
}
function updateConditional(card){
 const selected=card.querySelector('.exit-resolution')?.value||'';
 card.querySelectorAll('.exit-conditional').forEach(x=>x.classList.toggle('hidden',x.dataset.show!==selected));
 const text=card.querySelector('.exit-confirm-text');
 text.textContent=selected==='unrecovered'
  ?'現物が回収できないことを確認し、所在調査を行いました'
  :selected==='transferred'?'現物と引継ぎ先を確認しました':'現物を回収し、状態・付属品を確認しました';
 const condition=card.querySelector('.exit-condition');
 if(selected==='returned'){
  const asset=state.assets.find(a=>a.id===state.items.find(i=>i.id===card.dataset.exitItem)?.asset_id);
  if(asset?.status==='修理中'){condition.value='faulty';condition.disabled=true}
  else condition.disabled=false;
 }else condition.disabled=false;
}
async function saveItem(itemId){
 if(state.busy)return;
 const item=state.items.find(i=>i.id===itemId);
 const card=[...document.querySelectorAll('[data-exit-item]')].find(e=>e.dataset.exitItem===itemId);
 if(!item||!card||item.resolution!=='pending')return;
 const resolution=card.querySelector('.exit-resolution').value;
 const condition=card.querySelector('.exit-condition').value;
 const nextUser=card.querySelector('.exit-next-user').value;
 const note=card.querySelector('.exit-item-note-input').value.trim();
 const verified=card.querySelector('.exit-checked').checked;
 if(!['returned','transferred','unrecovered'].includes(resolution)){toast('処理方法を選んでください。',true);return}
 if(resolution==='returned'&&!condition){toast('返却後の点検結果を選んでください。',true);return}
 if(resolution==='transferred'&&!nextUser){toast('引継ぎ先の使用者を選んでください。',true);return}
 if(resolution==='unrecovered'&&note.length<10){toast('回収不能の理由・調査内容を10文字以上で入力してください。',true);return}
 if(!verified){toast('現物確認、または所在調査のチェックを入れてください。',true);return}
 const title={returned:'返却・回収',transferred:'直接引継ぎ',unrecovered:'回収不能の記録'}[resolution];
 const target=resolution==='transferred'?' → '+fullname(userById(nextUser))+'（保管場所は変更しません）':'';
 const warning=resolution==='unrecovered'?
  '\n\n※ 備品は返却済みになりません。利用終了後も未回収として追跡します。':'';
 const question=item.asset_no_snapshot+' '+item.asset_name_snapshot+'\n処理：'+title+target+
  (resolution==='returned'?'\n点検：'+(condition==='faulty'?'修理が必要':'再利用可能'):'')+
  (note?'\n備考：'+note:'')+warning+'\n\nこの内容で確定しますか？';
 if(!window.confirm(question))return;
 busy(true);toast('処理を保存しています…');
 try{
  const {error}=await db().rpc('process_asset_exit_item',{
   p_item_id:itemId,p_resolution:resolution,
   p_condition:resolution==='returned'?condition:null,
   p_next_user_id:resolution==='transferred'?nextUser:null,
   p_note:note||null,p_physical_check:true
  });
  if(error)throw error;
  await refreshRoster();
  await loadSession(state.session.id);
  document.dispatchEvent(new Event('asset-user-master-updated'));
  toast(item.asset_no_snapshot+' の'+title+'を記録しました。');
 }catch(e){console.error('exit process',e);toast('処理結果を確認してください。'+err(e),true);
  try{await refreshRoster();await loadSession(state.session.id)}catch(_){}
 }finally{busy(false)}
}
async function finalize(){
 const s=state.session;if(!s||state.busy)return;
 const pending=state.items.filter(i=>i.resolution==='pending').length;
 if(pending){toast('未処理の備品が'+pending+'件残っています。',true);return}
 const missing=state.items.filter(i=>i.resolution==='unrecovered').length;
 const user=userById(s.asset_user_id);
 const promptText='「'+(user?.name||'使用者')+'」の利用終了を確定します。\n'+
  'すべての備品の処理結果を確認した場合だけ進めてください。'+
  (missing?'\n\n注意：未回収品 '+missing+'件は引き続き調査対象として残ります。':'')+
  '\n\n実行する場合は「利用終了」と入力してください。';
 if(window.prompt(promptText,'')!=='利用終了')return;
 busy(true);toast('利用終了を確定しています…');
 try{
  const {data,error}=await db().rpc('finalize_asset_exit',{p_session_id:s.id});
  if(error)throw error;
  state.session=null;state.items=[];
  await refreshRoster();
  renderSession();
  document.dispatchEvent(new Event('asset-user-master-updated'));
  toast((user?.name||'対象者')+'の利用終了を確定しました。'+(data?.unrecovered_count?'未回収 '+data.unrecovered_count+'件の調査は継続してください。':''));
 }catch(e){console.error('finalize exit',e);toast('確定できませんでした。'+err(e),true);
  try{await refreshRoster();await loadSession(s.id)}catch(_){}
 }finally{busy(false)}
}
function init(){
 const grid=$('adminPage')?.querySelector('.admin-grid');
 if(!grid||$('workspaceAdminExit'))return;
 const pane=document.createElement('section');pane.id='workspaceAdminExit';pane.className='workspace-exit-pane hidden';
 pane.innerHTML='<div class="panel exit-panel"><div class="panel-head"><div><h3>退去・回収チェック</h3><p class="exit-intro">退去者の備品をすべて確認し、返却・引継ぎ・回収不能を記録してから利用終了します。</p></div></div>'+
 '<div class="exit-picker"><label>対象の使用者<select id="exitUserSelect"><option>読み込み中…</option></select></label><button type="button" class="primary" id="exitStart">退去チェックを開始・再開</button></div>'+
 '<div id="exitMessage" class="exit-message" role="status" aria-live="polite"></div>'+
 '<div id="exitOngoing" class="exit-ongoing"></div><div id="exitSession" class="exit-session"></div><div id="exitUnrecovered" class="exit-unrecovered"></div><div id="exitCompleted" class="exit-completed"></div></div>';
 const after=$('workspaceAdminHistory')||grid;after.insertAdjacentElement('afterend',pane);
 pane.addEventListener('click',e=>{
  const resume=e.target.closest('[data-exit-resume]');if(resume){start(resume.dataset.exitResume);return}
  if(e.target.closest('#exitStart')){start($('exitUserSelect')?.value);return}
  if(e.target.closest('#exitReload')){reload();return}
  const save=e.target.closest('[data-exit-save]');if(save){saveItem(save.dataset.exitSave);return}
  const recover=e.target.closest('[data-exit-recover]');if(recover){beginRecovery(recover.dataset.exitRecover);return}
  const history=e.target.closest('[data-exit-history]');if(history){loadExitHistory(history.dataset.exitHistory);return}
  if(e.target.closest('[data-exit-history-close]')){const detail=$('exitHistoryDetail');if(detail)detail.innerHTML='';return}
  const find=e.target.closest('[data-exit-find]');
  if(find){
   const search=$('assetSearch'),status=$('assetStatus'),category=$('assetCategory');
   if(search&&status){
     search.value=find.dataset.exitFind;status.value='';
     if(category)category.value='';
     document.querySelector('.nav-btn[data-page="assets"]')?.click();
     status.dispatchEvent(new Event('change',{bubbles:true}));
     search.dispatchEvent(new Event('input',{bubbles:true}));
   }
   return;
  }
  if(e.target.closest('#exitFinalize'))finalize();
 });
 pane.addEventListener('change',e=>{
  if(e.target.matches('.exit-resolution'))updateConditional(e.target.closest('[data-exit-item]'));
 });
}
window.DaidoExit={
 show:()=>{init();const pane=$('workspaceAdminExit');if(pane){pane.classList.remove('hidden');if(db())reload()}},
 hide:()=>{$('workspaceAdminExit')?.classList.add('hidden')},
 refresh:()=>{if(!$('workspaceAdminExit')?.classList.contains('hidden'))reload()}
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();