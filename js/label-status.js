(function(){
'use strict';
const STATES=['未確認','印刷済み','貼付済み'];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={items:[],busy:false,loaded:false};
function byStatus(rows,selected,query){
  const q=String(query||'').trim().normalize('NFKC').toLowerCase();
  return rows.filter(a=>(!selected||(a.label_status||'未確認')===selected)
    &&(!q||[a.asset_no,a.name,a.location].some(v=>String(v||'').normalize('NFKC').toLowerCase().includes(q))));
}
function message(t){$('labelStatusMessage').textContent=t}
function render(){
  if(!state.loaded)return;
  const status=$('labelStatusFilter').value,term=$('labelStatusSearch').value;
  const filtered=byStatus(state.items,status,term);
  const counts=STATES.map(x=>x+' '+state.items.filter(a=>(a.label_status||'未確認')===x).length+'件');
  $('labelStatusSummary').textContent=counts.join(' ／ ')+'　（検索一致 '+filtered.length+'件）';
  $('labelStatusRows').innerHTML=filtered.slice(0,75).map(a=>
    '<div style="border-top:1px solid #e0e9ef;display:flex;gap:8px;flex-wrap:wrap;padding:10px 0;align-items:center">'+
    '<div style="flex:1;min-width:150px"><b>'+esc(a.asset_no||'番号未設定')+'</b> '+esc(a.name)+
    '<small style="display:block;color:#52697b">'+esc(a.location||'場所未設定')+'</small></div>'+
    '<select data-label-select="'+esc(a.id)+'" style="min-height:42px;min-width:125px;font-size:16px" aria-label="'+esc(a.asset_no)+'のシール状況">'+
    STATES.map(x=>'<option value="'+x+'" '+((a.label_status||'未確認')===x?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
    '<button type="button" class="secondary" data-label-save="'+esc(a.id)+'" style="min-height:42px">保存</button></div>'
  ).join('')+(filtered.length>75?'<p>ほか'+(filtered.length-75)+'件。検索で絞り込んでください。</p>':'');
  if(!filtered.length)$('labelStatusRows').textContent='該当する備品はありません。';
}
async function read(){
  if(state.busy)return;
  const c=window.DaidoQrBridge?.getClient?.();
  if(!c){message('管理者ログインが必要です。');return}
  state.busy=true;state.loaded=false;message('最新のシール確認状況を取得中…');
  try{
    const all=[];
    const query=c.from('assets')
      .select('id,asset_no,name,location,status,label_status,label_status_changed_at,updated_at')
      .eq('is_deleted',false).neq('status','廃棄').order('asset_no').order('id');
    for(let n=0;;n+=500){
      const {data,error}=await query.range(n,n+499);
      if(error)throw error;
      all.push(...(data||[]));
      if((data||[]).length<500)break;
    }
    state.items=all;state.loaded=true;render();message('管理者間で共有される最新の状況です。');
  }catch(e){message('取得に失敗しました：'+(e.message||'通信エラー'))}
  finally{state.busy=false}
}
async function save(id){
  if(state.busy)return;
  const asset=state.items.find(x=>x.id===id);
  const input=$('labelStatusRows').querySelector('[data-label-select="'+id+'"]');
  if(!asset||!input)return;
  const next=input.value,prior=asset.label_status||'未確認';
  if(!STATES.includes(next))return;
  if(next===prior){message('現在の確認状況と同じです。');return}
  if(!confirm((asset.asset_no||'備品')+'：'+prior+' → '+next+' に変更しますか？\n現物を確認した場合だけ登録してください。'))return;
  state.busy=true;message('保存中…');
  try{
    const c=window.DaidoQrBridge?.getClient?.();
    if(!c)throw Error('ログインが切れています。');
    const {data,error}=await c.from('assets')
      .update({label_status:next})
      .eq('id',id).eq('is_deleted',false).eq('label_status',prior)
      .eq('updated_at',asset.updated_at)
      .select('id,label_status,label_status_changed_at,updated_at').maybeSingle();
    if(error)throw error;
    if(!data)throw Error('他の管理者が更新しました。「最新情報を取得」で確認してください。');
    Object.assign(asset,data);
    render();message((asset.asset_no||'備品')+' を「'+next+'」で保存しました。');
  }catch(e){message('保存できませんでした：'+(e.message||'エラー')+'。再実行の前に最新情報を確認してください。')}
  finally{state.busy=false}
}
function exportCsv(){
  if(!state.loaded){message('先に最新情報を取得してください。');return}
  const csvCell=s=>'"'+(/^\s*[=+@-]/.test(String(s??''))?"'":'')+String(s??'').replace(/"/g,'""')+'"';
  const lines=[['管理No.','備品名','保管場所','シール状況','最終確認日時'].map(csvCell).join(',')];
  for(const a of state.items){
    lines.push([a.asset_no,a.name,a.location,a.label_status||'未確認',a.label_status_changed_at?new Date(a.label_status_changed_at).toLocaleString('ja-JP'):''].map(csvCell).join(','));
  }
  const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='QRシール確認状況.csv';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function createDialog(){
  if($('labelStatusDialog'))return $('labelStatusDialog');
  const d=document.createElement('dialog');d.id='labelStatusDialog';
  d.style.cssText='width:min(800px,calc(100vw - 20px));max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:0;box-shadow:0 20px 70px #0c263b66';
  d.innerHTML='<div style="padding:20px;color:#173247;background:white">'+
  '<div style="display:flex;justify-content:space-between;gap:14px;align-items:start"><div><h3 style="margin:0 0 4px">QRシールの確認状況</h3><p style="font-size:13px;color:#607184;margin:0 0 14px">確認結果をシステムに保存し、ほかの管理者と共有します。</p></div><button type="button" class="secondary" id="labelStatusClose">閉じる</button></div>'+
  '<p style="background:#eff6fa;padding:12px;border-radius:10px;font-size:13px;margin:0 0 14px"><b>未確認は「未印刷」とは限りません。</b> 過去の印刷記録はないため、最初は全件未確認です。現物を確認してから状態を変更してください。</p>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
  '<label style="flex:0 0 130px">確認状況<select id="labelStatusFilter" style="display:block;width:100%;font-size:16px;padding:8px"><option>未確認</option><option>印刷済み</option><option>貼付済み</option><option value="">すべて</option></select></label>'+
  '<label style="flex:1;min-width:150px">備品検索<input id="labelStatusSearch" type="search" placeholder="管理No.・名称・場所" style="display:block;width:100%;font-size:16px;padding:8px"></label></div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0"><button id="labelStatusRefresh" type="button" class="secondary">最新情報を取得</button><button id="labelStatusExport" type="button" class="secondary">一覧をCSV出力</button></div>'+
  '<p id="labelStatusSummary" style="font-weight:700"></p><p id="labelStatusMessage" role="status" style="font-size:13px;color:#075b9b"></p>'+
  '<div id="labelStatusRows" style="max-height:45vh;overflow:auto;padding:0 5px"></div></div>';
  document.body.appendChild(d);
  $('labelStatusClose').onclick=()=>d.close();
  $('labelStatusRefresh').onclick=read;
  $('labelStatusExport').onclick=exportCsv;
  $('labelStatusSearch').oninput=render;
  $('labelStatusFilter').onchange=render;
  $('labelStatusRows').onclick=e=>{const b=e.target.closest('[data-label-save]');if(b)save(b.dataset.labelSave)};
  return d;
}
function init(){
  const bar=document.querySelector('#assetsPage .toolbar');
  if(!bar||$('labelStatusOpen'))return;
  const b=document.createElement('button');b.id='labelStatusOpen';b.type='button';b.className='secondary';b.textContent='QRシール状況';
  b.onclick=async()=>{const d=createDialog();d.showModal();await read()};
  bar.appendChild(b);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();