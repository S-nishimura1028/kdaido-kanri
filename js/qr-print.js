(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  let client=null;
  let activeAssetId=null;

  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  async function fetchAssetPrintInfo(id,fallbackName){
    if(!id)return {name:fallbackName||'備品',user_name:null,location:null};
    const c=db();
    if(!c)return {name:fallbackName||'備品',user_name:null,location:null};
    try{
      const {data,error}=await c.from('assets').select('id,name,user_name,location').eq('id',id).single();
      if(error||!data)return {name:fallbackName||'備品',user_name:null,location:null};
      return {name:data.name||fallbackName||'備品',user_name:data.user_name||null,location:data.location||null};
    }catch(_e){
      return {name:fallbackName||'備品',user_name:null,location:null};
    }
  }

  function addPrintButton(){
    const area=document.getElementById('qrArea');
    const canvas=document.getElementById('qrCanvas');
    if(!area||!canvas||document.getElementById('qrPrintBtn')) return;

    const wrap=document.createElement('div');
    wrap.style.cssText='margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap';

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='qrPrintBtn';
    btn.className='primary';
    btn.textContent='このQRを印刷';
    btn.style.minHeight='46px';
    btn.addEventListener('click',async function(){
      const err=document.getElementById('qrError');
      if(!canvas.width){ if(err) err.textContent='先にQRコードを表示してください。'; return; }
      const title=(area.querySelector('div')?.textContent||'備品QR').trim();
      const parts=title.split('/').map(s=>s.trim()).filter(Boolean);
      const fallbackName=parts.length>1?parts.slice(1).join(' / '):parts[0]||'備品';
      const info=await fetchAssetPrintInfo(activeAssetId,fallbackName);
      const img=canvas.toDataURL('image/png');
      printSingle(info.name,info.user_name,info.location,img,err);
    });

    const hint=document.createElement('div');
    hint.style.cssText='width:100%;font-size:11px;color:#64748b;margin-top:2px';
    hint.textContent='複数印刷は備品一覧でチェックして「QRまとめ印刷」を使います。インクファクトリー LBLA4-WPG-27（A4・27面）用です。';

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    area.insertBefore(wrap,document.getElementById('qrError'));
  }

  function printSingle(name,userName,location,img,err){
    const startPosition=chooseStartPosition();
    if(startPosition===null)return;
    const w=window.open('','_blank');
    if(!w){ if(err) err.textContent='印刷画面を開けませんでした。ポップアップを許可してください。'; return; }
    const labels=[{name:name||'備品',user_name:userName||null,location:location||null,img}];
    writeLabelPrintWindow(w,labels,startPosition,`${name||'備品'} QR印刷`);
  }

  function headerIndex(table,label){
    return [...table.querySelectorAll('thead th')].findIndex(th=>(th.textContent||'').trim()===label);
  }

  function enhanceAssetTable(){
    const host=document.getElementById('assetTable');
    const table=host?.querySelector('table');
    if(!table) return;

    const headRow=table.querySelector('thead tr');
    if(headRow&&!headRow.querySelector('.qr-select-head')){
      const th=document.createElement('th');
      th.className='qr-select-head';
      th.style.cssText='width:58px;min-width:58px;text-align:center';
      const all=document.createElement('input');
      all.type='checkbox';
      all.title='すべて選択';
      all.style.cssText='width:24px;height:24px;cursor:pointer;vertical-align:middle';
      all.addEventListener('click',e=>e.stopPropagation());
      all.addEventListener('change',()=>{
        table.querySelectorAll('.qr-row-check').forEach(c=>c.checked=all.checked);
        updateBatchButton();
      });
      th.appendChild(all);
      headRow.insertBefore(th,headRow.firstChild);
    }

    table.querySelectorAll('tbody tr[data-id]').forEach(row=>{
      if(row.querySelector('.qr-select-cell')) return;
      const td=document.createElement('td');
      td.className='qr-select-cell';
      td.style.cssText='text-align:center;width:58px;min-width:58px';
      const cb=document.createElement('input');
      cb.type='checkbox';
      cb.className='qr-row-check';
      cb.style.cssText='width:24px;height:24px;cursor:pointer;vertical-align:middle';
      cb.dataset.id=row.dataset.id||'';
      const nameIndex=headerIndex(table,'備品名');
      const offset=headRow?.querySelector('.qr-select-head')?1:0;
      const cells=row.querySelectorAll('td');
      cb.dataset.name=(cells[(nameIndex>=0?nameIndex:0)+offset]?.textContent||'備品').trim();
      cb.addEventListener('click',e=>e.stopPropagation());
      cb.addEventListener('change',updateBatchButton);
      td.appendChild(cb);
      row.insertBefore(td,row.firstChild);
    });

    addBatchButton(host);
    updateBatchButton();
  }

  function addBatchButton(host){
    if(document.getElementById('qrBatchPrintBtn')) return;
    const parent=host.parentElement;
    if(!parent) return;

    const bar=document.createElement('div');
    bar.id='qrBatchPrintBar';
    bar.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:0 0 14px;padding:10px 12px;background:#f8fbfd;border:1px solid #dbe7ee;border-radius:12px';

    const note=document.createElement('div');
    note.textContent='印刷する備品にチェックを入れてください';
    note.style.cssText='margin-right:auto;font-size:13px;color:#64748b;font-weight:600';

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='qrBatchPrintBtn';
    btn.className='primary';
    btn.style.cssText='min-height:48px;padding:0 20px;font-weight:800';
    btn.textContent='QRまとめ印刷';
    btn.addEventListener('click',printSelectedAssets);

    bar.append(note,btn);
    parent.insertBefore(bar,host);
  }

  function updateBatchButton(){
    const btn=document.getElementById('qrBatchPrintBtn');
    if(!btn) return;
    const n=document.querySelectorAll('#assetTable .qr-row-check:checked').length;
    btn.textContent=n?`QRまとめ印刷（${n}件）`:'QRまとめ印刷';
  }

  function chooseStartPosition(){
    const raw=window.prompt('印刷を開始するシール位置を1〜27で入力してください。\nLBLA4-WPG-27は左上が1、右へ2・3、次の段が4〜6です。','1');
    if(raw===null)return null;
    const n=Number(raw);
    if(!Number.isInteger(n)||n<1||n>27){alert('開始位置は1〜27で入力してください。');return null;}
    return n;
  }

  function buildPages(labels,startPosition){
    const pages=[];
    let index=0;
    let first=true;
    while(index<labels.length){
      const slots=new Array(27).fill(null);
      let pos=first?startPosition-1:0;
      while(pos<27&&index<labels.length){slots[pos++]=labels[index++];}
      pages.push(slots);
      first=false;
    }
    return pages;
  }

  function writeLabelPrintWindow(w,labels,startPosition,title){
    const pages=buildPages(labels,startPosition);
    const pageHtml=pages.map((slots,pageIndex)=>{
      const cells=slots.map(x=>x
        ?`<div class="label"><div class="label-inner"><div class="company">熊本大同青果</div><img class="qr" src="${x.img}" alt="QR"><div class="name">${esc(x.name)}</div><div class="user">使用者：${esc(x.user_name||'未使用')}</div><div class="location">保管場所：${esc(x.location||'未設定')}</div></div></div>`
        :'<div class="label blank"></div>').join('');
      return `<section class="sheet${pageIndex<pages.length-1?' page-break':''}">${cells}</section>`;
    }).join('');

    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title||'備品QR LBLA4-WPG-27印刷')}</title><style>
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
.sheet{width:210mm;height:297mm;padding:9mm 7mm;display:grid;grid-template-columns:repeat(3,62mm);grid-template-rows:repeat(9,31mm);column-gap:5mm;row-gap:0;margin:0 auto;overflow:hidden}
.label{width:62mm;height:31mm;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.label-inner{position:absolute;left:50%;top:50%;width:31mm;height:62mm;transform:translate(-50%,-50%) rotate(-90deg);transform-origin:center center;padding:1.4mm 1.2mm;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden}
.blank{visibility:hidden}
.company{font-size:5.4pt;font-weight:800;line-height:1;margin-bottom:.7mm;white-space:nowrap}
.qr{width:20mm;height:20mm;image-rendering:pixelated;flex:0 0 auto;margin-bottom:.6mm}
.name{font-size:7pt;font-weight:800;line-height:1.1;min-height:7mm;max-height:8.5mm;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;word-break:break-word}
.user{font-size:5.7pt;font-weight:700;line-height:1.06;max-height:4.7mm;width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#334155;margin-top:.3mm}.location{font-size:5.4pt;font-weight:700;line-height:1.06;max-height:4.7mm;width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;color:#475569;margin-top:.3mm}
.page-break{break-after:page;page-break-after:always}
@media screen{body{background:#eef2f6;padding:8mm 0}.sheet{background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.12);margin-bottom:8mm}.label:not(.blank){outline:1px dashed #cbd5e1}}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.label{outline:0}}
</style></head><body>${pageHtml}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);
    w.document.close();
  }

  async function loadSelectedAssetInfo(selected){
    const ids=selected.map(cb=>cb.dataset.id).filter(Boolean);
    const fallback=new Map(selected.map(cb=>[cb.dataset.id,{name:cb.dataset.name||'備品',user_name:null,location:null}]));
    if(!ids.length)return fallback;
    const c=db();
    if(!c)return fallback;
    try{
      const {data,error}=await c.from('assets').select('id,name,user_name,location').in('id',ids);
      if(error)return fallback;
      (data||[]).forEach(a=>fallback.set(String(a.id),{name:a.name||fallback.get(String(a.id))?.name||'備品',user_name:a.user_name||null,location:a.location||null}));
    }catch(_e){}
    return fallback;
  }

  async function printSelectedAssets(){
    const selected=[...document.querySelectorAll('#assetTable .qr-row-check:checked')];
    if(!selected.length){ alert('印刷する備品にチェックを入れてください。'); return; }
    if(!window.QRCode||typeof QRCode.toCanvas!=='function'){ alert('QRライブラリを読み込めませんでした。ページを再読み込みしてください。'); return; }

    const startPosition=chooseStartPosition();
    if(startPosition===null)return;

    // ブラウザのポップアップ制限対策：クリック直後に印刷タブを先に開く
    const w=window.open('','_blank');
    if(!w){ alert('印刷画面を開けませんでした。ポップアップを許可してください。'); return; }
    w.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>印刷準備中</title></head><body style="font-family:sans-serif;padding:24px">QRを準備しています…</body></html>');
    w.document.close();

    try{
      const infoMap=await loadSelectedAssetInfo(selected);
      const labels=[];
      for(const cb of selected){
        const url=new URL(window.APP_BASE_URL||location.origin+location.pathname);
        url.pathname='/';
        url.search='';
        url.searchParams.set('asset',cb.dataset.id);
        const c=document.createElement('canvas');
        await QRCode.toCanvas(c,url.toString(),{width:240,margin:1,errorCorrectionLevel:'M'});
        const info=infoMap.get(cb.dataset.id)||{name:cb.dataset.name||'備品',user_name:null,location:null};
        labels.push({name:info.name||'備品',user_name:info.user_name||null,location:info.location||null,img:c.toDataURL('image/png')});
      }
      w.document.open();
      writeLabelPrintWindow(w,labels,startPosition,'備品QR LBLA4-WPG-27・27面印刷');
    }catch(err){
      console.error('QRまとめ印刷',err);
      try{
        w.document.open();
        w.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>印刷エラー</title></head><body style="font-family:sans-serif;padding:24px"><h2>印刷データを作成できませんでした</h2><p>'+esc(err&&err.message?err.message:'不明なエラー')+'</p></body></html>');
        w.document.close();
      }catch(_e){}
      alert('QRまとめ印刷の準備中にエラーが発生しました。');
    }
  }

  let scheduled=false;
  function scheduleEnhance(){
    if(scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{
      scheduled=false;
      addPrintButton();
      enhanceAssetTable();
    });
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-id]');
    if(row?.dataset.id)activeAssetId=row.dataset.id;
  },true);

  const urlAssetId=new URL(location.href).searchParams.get('asset');
  if(urlAssetId)activeAssetId=urlAssetId;

  const observer=new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scheduleEnhance);
})();
