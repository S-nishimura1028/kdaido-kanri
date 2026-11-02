(function(){
'use strict';

// 読み取り専用の備品点検。備品情報の変更・印刷済みの自動判定は行わない。
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={dialog:null,assets:[],people:[],loading:false,loaded:false};
const db=()=>window.DaidoQrBridge?.getClient?.()||null;

// PURE AUDIT HELPERS START
function normalizedAssetName(value){
  return String(value||'').normalize('NFKC').toLowerCase().replace(/[\s\u3000・･/（）()\-]/g,'');
}
function duplicateGroups(assets,people){
  const peopleById=new Map(people.map(p=>[String(p.id),p.name]));
  const groups=new Map();
  for(const a of assets){
    if(a.is_deleted||!['使用中','修理中'].includes(a.status))continue;
    const id=a.assigned_user_id?String(a.assigned_user_id):'';
    const fallback=String(a.user_name||'').trim();
    if(!id&&!fallback)continue;
    const who=id?(peopleById.get(id)||fallback||'名前未登録'):fallback;
    const kind=normalizedAssetName(a.name);
    if(!kind)continue;
    // Separate master IDs are distinct even if the display name is the same.
    const key=(id?'id:'+id:'legacy:'+fallback.normalize('NFKC'))+'|'+kind;
    if(!groups.has(key))groups.set(key,{person:who,kind,count:0,items:[],sharedHint:/(?:部|課|室)$|インターンシップ/.test(who)});
    const group=groups.get(key);
    group.count+=1;
    group.items.push({id:a.id,asset_no:a.asset_no,name:a.name,location:a.location||'',status:a.status,quantity:a.quantity});
  }
  return [...groups.values()].filter(g=>g.count>1).sort((a,b)=>b.count-a.count||a.person.localeCompare(b.person,'ja')||a.kind.localeCompare(b.kind,'ja'));
}
function printChecklistRows(assets){
  return assets.filter(a=>!a.is_deleted&&a.status!=='廃棄')
    .slice().sort((a,b)=>String(a.asset_no||'').localeCompare(String(b.asset_no||''),'ja'));
}
function safeCsvCell(value){
  const s=String(value??'');
  // Prevent opening an inventory CSV from interpreting a name as a formula.
  const safe=/^[\s]*[=+@-]/.test(s)?"'"+s:s;
  return '"'+safe.replace(/"/g,'""')+'"';
}
function makeLabelChecklistCsv(assets){
  const fields=['管理No.','備品名','使用・保管場所','所属部署','現在の状態','使用者','シール印刷確認','現物貼付確認','確認日','備考'];
  const lines=[fields.map(safeCsvCell).join(',')];
  for(const a of printChecklistRows(assets)){
    lines.push([
      a.asset_no||'',a.name||'',a.location||'',a.department||'',a.status||'',a._userDisplay||a.user_name||'',
      '未確認','未確認','',''
    ].map(safeCsvCell).join(','));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
// PURE AUDIT HELPERS END

async function readAll(query){
  const rows=[];
  for(let offset=0;;offset+=500){
    const {data,error}=await query.range(offset,offset+499);
    if(error)throw error;
    rows.push(...(data||[]));
    if((data||[]).length<500)break;
  }
  return rows;
}
async function loadReviewData(){
  if(state.loading)return;
  const c=db();
  if(!c){message('管理者ログインが必要です。');return}
  state.loading=true;state.loaded=false;
  message('備品を読み込んでいます…');
  const fetchBtn=$('inventoryAuditRefresh');
  if(fetchBtn)fetchBtn.disabled=true;
  try{
    const [assets,people]=await Promise.all([
      readAll(c.from('assets')
        .select('id,asset_no,name,category,location,department,user_name,assigned_user_id,status,quantity,is_deleted')
        .eq('is_deleted',false).order('asset_no').order('id')),
      readAll(c.from('asset_users').select('id,name').order('id'))
    ]);
    const names=new Map(people.map(p=>[String(p.id),p.name]));
    state.assets=assets.map(a=>({...a,_userDisplay:names.get(String(a.assigned_user_id||''))||a.user_name||''}));
    state.people=people;state.loaded=true;
    render();
  }catch(err){
    console.error('備品点検の取得',err);
    message('備品データを取得できませんでした。権限・通信状態を確認してください。');
    $('inventoryAuditResults').replaceChildren();
  }finally{state.loading=false;if(fetchBtn)fetchBtn.disabled=false}
}
function message(s){if($('inventoryAuditSummary'))$('inventoryAuditSummary').textContent=s}
function render(){
  if(!state.loaded)return;
  const all=duplicateGroups(state.assets,state.people);
  const query=String($('inventoryAuditSearch')?.value||'').trim().normalize('NFKC').toLowerCase();
  const groups=all.filter(g=>!query||[g.person,g.kind,...g.items.flatMap(a=>[a.asset_no,a.name,a.location])].some(v=>String(v||'').normalize('NFKC').toLowerCase().includes(query)));
  const checklist=printChecklistRows(state.assets);
  message('使用者と同じ備品名の重複候補：'+all.length+'組 ／ シール確認表の対象：'+checklist.length+'件');
  $('inventoryAuditResults').innerHTML=groups.length?groups.map(g=>'<details style="padding:12px 0;border-bottom:1px solid #dfe8eb">'+
    '<summary style="cursor:pointer;font-weight:750">'+esc(g.person)+' ／ '+esc(g.items[0]?.name||g.kind)+' <strong>('+g.count+'件)</strong>'+
      (g.sharedHint?' <small style="font-weight:500;color:#74623a">共用・部署単位の登録か確認</small>':'')+'</summary>'+
    '<div style="padding:8px 0 0;font-size:13px">'+g.items.map(a=>
      '<p style="margin:7px 0"><a target="_blank" rel="noopener noreferrer" href="'+
      esc(new URL('/?asset='+encodeURIComponent(a.id),window.APP_BASE_URL||location.origin).toString())+
      '">'+esc(a.asset_no||'番号未設定')+'</a>　'+esc(a.name)+
      ' ／ '+esc(a.location||'場所未設定')+' ／ '+esc(a.status)+'</p>').join('')+'</div></details>').join('')
    :'<p style="padding:16px 0;color:#50657a">'+(query?'検索条件に合う重複候補はありません。':'同じ使用者・同じ備品名の候補はありません。')+'</p>';
}
function downloadChecklist(){
  if(!state.loaded){message('先に備品データを読み込んでください。');return}
  const csv=makeLabelChecklistCsv(state.assets);
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');
  link.href=url;link.download='備品QRシール_確認表_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function ensureDialog(){
  if(state.dialog)return state.dialog;
  const d=document.createElement('dialog');
  d.id='inventoryAuditDialog';
  d.style.cssText='border:0;border-radius:18px;width:min(820px,calc(100vw - 18px));max-height:90vh;padding:0;overflow:auto;box-shadow:0 20px 80px #0c263b88';
  d.innerHTML='<div style="padding:20px;max-width:100%;box-sizing:border-box;background:#fff;color:#153047">'+
    '<div style="display:flex;align-items:start;justify-content:space-between;gap:10px"><div><h3 style="margin:0 0 6px;font-size:20px">備品の重複・シール確認</h3>'+
    '<p style="margin:0 0 12px;font-size:13px;color:#536778">同じ使用者に同じ備品名が2件以上ある記録を探します。重複候補＝誤登録とは限りません。</p></div>'+
    '<button type="button" class="secondary" id="inventoryAuditClose" style="min-width:48px">閉じる</button></div>'+
    '<div style="padding:12px;border-radius:10px;background:#edf6f8;margin-bottom:12px;font-size:13px">'+
    '<strong>シールの印刷状況について</strong><p style="margin:6px 0 0">過去の印刷・貼付記録はないため「未印刷」とは断定できません。このCSVは現物確認用で全件「未確認」から始まります。システムへの状況保存は備品一覧の「QRシール状況」で行ってください。</p></div>'+
    '<p id="inventoryAuditSummary" role="status" style="font-weight:800;margin:12px 0"></p>'+
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">'+
    '<button type="button" class="secondary" id="inventoryAuditRefresh">最新の備品を読み込む</button>'+
    '<button type="button" class="primary" id="inventoryAuditCsv">シール確認表をCSV出力</button></div>'+
    '<label style="display:grid;gap:5px;font-size:13px;font-weight:700">重複候補の絞り込み<input id="inventoryAuditSearch" type="search" style="font-size:16px;width:100%;padding:9px" placeholder="例：炊飯器、管理番号、使用者名"></label>'+
    '<div id="inventoryAuditResults" style="margin-top:12px"></div>'+
    '<p style="margin:14px 0 0;font-size:12px;color:#536778">削除・編集はここから行いません。管理番号を押すと備品詳細が別タブで開きます。現物と照合してから登録の修正を判断してください。</p>'+
    '</div>';
  document.body.appendChild(d);
  state.dialog=d;
  d.querySelector('#inventoryAuditClose').onclick=()=>d.close();
  d.querySelector('#inventoryAuditRefresh').onclick=loadReviewData;
  d.querySelector('#inventoryAuditCsv').onclick=downloadChecklist;
  d.querySelector('#inventoryAuditSearch').oninput=render;
  return d;
}
function init(){
  const toolbar=document.querySelector('#assetsPage .toolbar');
  if(!toolbar||$('inventoryAuditOpen'))return;
  const button=document.createElement('button');
  button.id='inventoryAuditOpen';
  button.type='button';button.className='secondary';
  button.textContent='重複・シール確認';
  button.title='重複の可能性を確認し、QRシールの現物確認表を出力します';
  button.addEventListener('click',async()=>{
    const d=ensureDialog();
    if(!d.open)d.showModal();
    await loadReviewData();
  });
  toolbar.appendChild(button);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else init();
})();
