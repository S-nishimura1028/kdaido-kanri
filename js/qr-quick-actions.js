(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opNames={lend:'貸出',return:'返却',fault:'故障報告',move:'場所変更'};
let busy=false,observedAssetId='',panelSequence=0,opening=false;
const context=()=>window.DaidoQrBridge;
function client(){return context()?.getClient()||null}
function ensureDialog(){
  let dialog=$('qrQuickDialog');
  if(dialog)return dialog;
  dialog=document.createElement('dialog');
  dialog.id='qrQuickDialog';
  dialog.className='qr-quick-dialog';
  dialog.setAttribute('aria-labelledby','qrQuickDialogTitle');
  dialog.innerHTML='<div class="dialog-card qr-quick-shell"><div class="dialog-head"><div><small class="qr-quick-eyebrow">QR クイック操作</small><h3 id="qrQuickDialogTitle">操作内容の確認</h3></div><button type="button" class="close" data-qr-close aria-label="クイック操作を閉じる">×</button></div><div id="qrQuickFormStep"><p id="qrQuickAsset" class="qr-quick-asset"></p><p id="qrQuickFormHelp" class="qr-quick-help"></p><div id="qrQuickFields"></div><label class="qr-quick-note-label">操作メモ（任意）<textarea id="qrQuickNote" maxlength="500" rows="3" placeholder="引継ぎ内容や注意点など（500文字以内）"></textarea></label><label class="qr-quick-ack"><input type="checkbox" id="qrQuickAck"><span id="qrQuickAckLabel">現物を確認しました</span></label><div id="qrQuickError" class="error" role="alert" aria-live="polite"></div><div class="dialog-actions"><button type="button" class="secondary" data-qr-close>キャンセル</button><button type="button" class="primary" id="qrQuickReview">確認画面へ</button></div></div><div id="qrQuickReviewStep" class="hidden"><p class="qr-quick-help">保存する前に、対象の備品と変更内容を確認してください。</p><div id="qrQuickSummary" class="qr-quick-summary"></div><div id="qrQuickSubmitError" class="error" role="alert" aria-live="polite"></div><div class="dialog-actions"><button type="button" class="secondary" id="qrQuickBack">内容を修正</button><button type="button" class="primary" id="qrQuickSubmit">この内容で確定</button></div></div></div>';
  document.body.appendChild(dialog);
  dialog.addEventListener('click',e=>{
    if(e.target.closest('[data-qr-close]')&&!busy)dialog.close();
  });
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
  return dialog;
}
function row(label,value){
  const div=document.createElement('div');
  const dt=document.createElement('dt');dt.textContent=label;
  const dd=document.createElement('dd');dd.textContent=value;
  div.append(dt,dd);
  return div;
}
function setBusy(value){
  busy=value;
  ['qrQuickReview','qrQuickBack','qrQuickSubmit'].forEach(id=>{const el=$(id);if(el)el.disabled=value});
  document.querySelectorAll('#qrQuickDialog [data-qr-close]').forEach(b=>b.disabled=value);
  if($('qrQuickSubmit'))$('qrQuickSubmit').textContent=value?'保存しています…':'この内容で確定';
}
async function readAsset(id){
  const db=client();
  if(!db)throw new Error('ログイン情報を取得できません。もう一度ログインしてください。');
  const {data,error}=await db.from('assets').select(
    'id,asset_no,name,status,assigned_user_id,user_name,location_id,location,is_deleted'
  ).eq('id',id).eq('is_deleted',false).maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('備品を取得できません。削除済みまたは権限がありません。');
  return data;
}
async function readMaster(table,fields){
  const {data,error}=await client().from(table).select(fields).eq('is_active',true).order('name');
  if(error)throw error;
  return data||[];
}
function optionValue(record,kind){
  if(kind==='user'){
    return [record.name,record.department,record.location,record.room_number].filter(Boolean).join(' / ');
  }
  return record.name;
}
async function open(action,assetId){
  if(opening||busy)return;
  opening=true;
  const dialog=ensureDialog();
  const seq=++panelSequence;
  try{
    const asset=await readAsset(assetId);
    if(seq!==panelSequence)return;
    const allowed=availableOps(asset).map(x=>x.id);
    if(!allowed.includes(action))throw new Error('現在の備品の状態では、この操作を実行できません。');
    let choices=[];
    if(action==='lend')choices=await readMaster('asset_users','id,name,department,location,room_number');
    if(action==='move')choices=await readMaster('locations','id,name');
    if(seq!==panelSequence)return;
    if(action==='lend'&&!choices.length)throw new Error('貸出先の使用者が登録されていません。先に管理画面で使用者を登録してください。');
    if(action==='move'&&!choices.length)throw new Error('移動先の保管場所が登録されていません。');
    $('qrQuickFormStep').classList.remove('hidden');
    $('qrQuickReviewStep').classList.add('hidden');
    $('qrQuickError').textContent='';
    $('qrQuickSubmitError').textContent='';
    $('qrQuickNote').value='';
    $('qrQuickAck').checked=false;
    $('qrQuickNote').closest('label').firstChild.textContent=action==='fault'?'故障内容（必須・5文字以上）':'操作メモ（任意）';
    $('qrQuickNote').placeholder=action==='fault'?'例：電源が入らず、異音が続いている':'引継ぎ内容や注意点など（500文字以内）';
    $('qrQuickDialogTitle').textContent=opNames[action]+'の登録';
    $('qrQuickAsset').textContent=(asset.asset_no||'管理番号なし')+'　'+asset.name+'　｜　現在: '+asset.status;
    const help={
      lend:'備品の現物と貸出先を確認してください。貸出後は「使用中」になります。',
      return:'現物を回収し、動作・破損・付属品を確認してください。故障品は修理中として管理します。',
      fault:'故障を確認して内容を記録します。割り当て済みの使用者は勝手に解除しません。',
      move:'現物の移動先を選択してください。使用者とステータスは変更しません。'
    };
    $('qrQuickFormHelp').textContent=help[action];
    const ack={lend:'現物と貸出先を確認しました',return:'現物を回収し、状態と付属品を確認しました',fault:'現物の故障状況を確認しました',move:'現物の移動先を確認しました'};
    $('qrQuickAckLabel').textContent=ack[action];
    const container=$('qrQuickFields');container.replaceChildren();
    if(action==='lend'||action==='move'){
      const label=document.createElement('label');
      label.textContent=action==='lend'?'貸出先の使用者 *':'移動先の保管場所 *';
      const select=document.createElement('select');select.id='qrQuickChoice';select.required=true;
      const first=document.createElement('option');first.value='';first.textContent='選択してください';
      select.appendChild(first);
      choices.forEach(item=>{
        if(action==='move'&&item.id===asset.location_id)return;
        const opt=document.createElement('option');opt.value=item.id;opt.textContent=optionValue(item,action==='lend'?'user':'location');
        select.appendChild(opt);
      });
      label.appendChild(select);container.appendChild(label);
    }
    if(action==='return'){
      const label=document.createElement('label');label.textContent='回収後の点検結果 *';
      const select=document.createElement('select');select.id='qrQuickCondition';
      for(const [value,name] of [['','選択してください'],['usable','動作・付属品に問題なし（再利用可能）'],['faulty','故障・破損あり（修理が必要）']]){
        const option=document.createElement('option');option.value=value;option.textContent=name;select.appendChild(option);
      }
      if(asset.status==='修理中'){
        select.value='faulty';
        select.disabled=true;
        const note=document.createElement('p');note.className='qr-quick-help';note.textContent='現在「修理中」のため、返却後も「修理中」を維持します。修理完了の判定は別途管理してください。';
        container.append(label,note);
      }else container.appendChild(label);
      label.appendChild(select);
    }
    const draft={asset,action,choices};
    $('qrQuickReview').onclick=()=>review(draft);
    $('qrQuickBack').onclick=()=>{
      $('qrQuickReviewStep').classList.add('hidden');
      $('qrQuickFormStep').classList.remove('hidden');
      $('qrQuickError').textContent='';
    };
    if(!dialog.open)dialog.showModal();
  }catch(e){
    window.alert(e?.message||'備品を開けませんでした。通信を確認してください。');
  }finally{opening=false}
}
function availableOps(a){
  const arr=[];
  if(a.status==='未使用'&&!a.assigned_user_id)arr.push({id:'lend',label:'貸し出す',desc:'使用者を選択'});
  if(a.assigned_user_id&&(a.status==='使用中'||a.status==='修理中'))arr.push({id:'return',label:'返却を確認',desc:'現物と状態を確認'});
  if(a.status==='使用中'||a.status==='未使用')arr.push({id:'fault',label:'故障を報告',desc:'故障内容を記録'});
  if(a.status!=='廃棄')arr.push({id:'move',label:'場所を変更',desc:'現物の移動先を登録'});
  return arr;
}
function getDraft(draft){
  const action=draft.action,asset=draft.asset;
  const chosen=$('qrQuickChoice')?.value||null;
  const target=draft.choices.find(x=>x.id===chosen);
  const condition=$('qrQuickCondition')?.value||null;
  const note=$('qrQuickNote').value.trim();
  if(!client())throw new Error('ログイン状態を確認してください。');
  if((action==='lend'||action==='move')&&!target)throw new Error('対象を選択してください。');
  if(action==='return'&&!condition)throw new Error('返却後の点検結果を選択してください。');
  if(action==='fault'&&note.length<5)throw new Error('故障内容を5文字以上で入力してください。');
  if(note.length>500)throw new Error('メモは500文字以内で入力してください。');
  if(!$('qrQuickAck').checked)throw new Error('現物確認のチェックを入れてください。');
  const after=action==='lend'?'使用中':
    action==='fault'?'修理中':
    action==='return'?(asset.status==='修理中'||condition==='faulty'?'修理中':'未使用'):
    asset.status;
  return {asset,action,target,condition,note,after};
}
function review(draft){
  $('qrQuickError').textContent='';
  let data;
  try{data=getDraft(draft)}catch(e){$('qrQuickError').textContent=e.message;return}
  const summary=$('qrQuickSummary');summary.replaceChildren();
  summary.appendChild(row('備品',data.asset.asset_no+'　'+data.asset.name));
  summary.appendChild(row('操作',opNames[data.action]));
  summary.appendChild(row('現在の状態',data.asset.status));
  summary.appendChild(row('操作後の状態',data.after));
  if(data.action==='lend')summary.appendChild(row('新しい使用者',optionValue(data.target,'user')));
  if(data.action==='return')summary.appendChild(row('使用者','解除する'));
  if(data.action==='move')summary.appendChild(row('移動先',data.target.name));
  if(data.note)summary.appendChild(row('記録する内容',data.note));
  $('qrQuickFormStep').classList.add('hidden');$('qrQuickReviewStep').classList.remove('hidden');
  $('qrQuickSubmitError').textContent='';
  $('qrQuickSubmit').onclick=()=>submit(data);
}
async function submit(data){
  if(busy)return;
  setBusy(true);
  const dialog=$('qrQuickDialog');
  try{
    const db=client();
    if(!db)throw new Error('ログインが必要です。');
    const {data:result,error}=await db.rpc('apply_asset_qr_action',{
      p_asset_id:data.asset.id,
      p_action:data.action,
      p_expected_status:data.asset.status,
      p_expected_user_id:data.asset.assigned_user_id,
      p_expected_location_id:data.asset.location_id,
      p_user_id:data.action==='lend'?data.target.id:null,
      p_location_id:data.action==='move'?data.target.id:null,
      p_condition:data.action==='return'?data.condition:null,
      p_note:data.note||null
    });
    if(error)throw error;
    if(!result?.id)throw new Error('更新の結果を確認できません。備品詳細を開き直してください。');
    dialog.close();
    await context().refreshAsset(data.asset.id);
    const status=$('qrQuickFeedback')||document.createElement('div');
    status.id='qrQuickFeedback';status.className='qr-quick-feedback';status.setAttribute('role','status');
    status.textContent=(result.asset_no||data.asset.asset_no)+' の'+opNames[data.action]+'を記録しました。履歴にも保存されています。';
    const detail=$('assetDetail');if(detail)detail.prepend(status);
  }catch(e){
    console.error('QR quick action',e);
    $('qrQuickSubmitError').textContent=e?.message||'更新できませんでした。通信を確認して備品の状態を再確認してください。';
  }finally{setBusy(false)}
}
async function enhanceDetail(){
  const host=$('assetDetail');
  const dialog=$('detailDialog');
  const id=dialog?.dataset.assetId;
  if(!host||!id||!dialog.open||host.querySelector('#qrQuickPanel'))return;
  const panel=document.createElement('section');panel.id='qrQuickPanel';panel.className='qr-quick-panel';
  panel.innerHTML='<div class="qr-quick-heading"><div><small>現物確認からそのまま登録</small><h4>QRクイック操作</h4></div><span class="qr-quick-tag">管理者専用</span></div><div id="qrQuickButtons" class="qr-quick-buttons"><p class="qr-quick-loading">現在の状態を確認しています…</p></div><p class="qr-quick-footnote">各操作は内容を確認してから確定します。管理番号やQRシールは変更しません。</p>';
  const actions=host.querySelector('.dialog-actions');if(actions)host.insertBefore(panel,actions);else host.appendChild(panel);
  const seq=++panelSequence;
  try{
    const asset=await readAsset(id);
    if(seq!==panelSequence||!panel.isConnected)return;
    const options=availableOps(asset);
    const buttons=panel.querySelector('#qrQuickButtons');buttons.replaceChildren();
    if(!options.length){
      const empty=document.createElement('p');empty.className='qr-quick-loading';
      empty.textContent='この備品に実行できるクイック操作はありません。';
      buttons.appendChild(empty);
    }else{
      options.forEach(option=>{
        const button=document.createElement('button');
        button.type='button';button.className='qr-quick-action qr-quick-'+option.id;
        button.dataset.qrOperation=option.id;
        const strong=document.createElement('strong');strong.textContent=option.label;
        const small=document.createElement('small');small.textContent=option.desc;
        button.append(strong,small);buttons.appendChild(button);
      });
      buttons.onclick=e=>{
        const button=e.target.closest('[data-qr-operation]');
        if(button)open(button.dataset.qrOperation,id);
      };
    }
  }catch(e){
    const holder=panel.querySelector('#qrQuickButtons');
    if(holder)holder.textContent='操作を表示できません。ログイン・通信状態を確認してください。';
  }
}
let scheduled=false;
function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    const detail=$('detailDialog');
    if(detail?.open)enhanceDetail();
  });
}
function init(){
  const detail=$('assetDetail');
  if(!detail)return;
  new MutationObserver(()=>{if(detail.querySelector('#qrQuickPanel'))return;schedule()}).observe(detail,{childList:true});
  $('detailDialog')?.addEventListener('close',()=>{panelSequence++});
  schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
else init();
})();