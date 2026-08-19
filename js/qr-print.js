(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
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
    btn.addEventListener('click',function(){
      const err=document.getElementById('qrError');
      if(!canvas.width){ if(err) err.textContent='先にQRコードを表示してください。'; return; }
      const title=(area.querySelector('div')?.textContent||'備品QR').trim();
      const parts=title.split('/').map(s=>s.trim()).filter(Boolean);
      const name=parts.length>1?parts.slice(1).join(' / '):parts[0]||'備品';
      const img=canvas.toDataURL('image/png');
      printSingle(name,img,err);
    });

    const hint=document.createElement('div');
    hint.style.cssText='width:100%;font-size:11px;color:#64748b;margin-top:2px';
    hint.textContent='複数印刷は備品一覧でチェックして「QRまとめ印刷」を使います。A4・4列×4段の16面固定です。';

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    area.insertBefore(wrap,document.getElementById('qrError'));
  }

  function printSingle(name,img,err){
    const w=window.open('','_blank');
    if(!w){ if(err) err.textContent='印刷画面を開けませんでした。ポップアップを許可してください。'; return; }
    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(name)} QR印刷</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;margin:0;color:#111}.sheet{display:flex;justify-content:center;align-items:flex-start}.label{width:72mm;min-height:88mm;border:1.5px solid #111;border-radius:4mm;padding:6mm;text-align:center}.company{font-size:11pt;font-weight:800;margin-bottom:3mm}.name{font-size:13pt;font-weight:700;margin:2mm 0 3mm}.qr{width:48mm;height:48mm;image-rendering:pixelated}.hint{font-size:8pt;color:#555;margin-top:2mm}@media print{button{display:none}}</style></head><body><div class="sheet"><div class="label"><div class="company">熊本大同青果｜備品管理</div><div class="name">${esc(name)}</div><img class="qr" src="${img}" alt="QR"><div class="hint">スマートフォンで読み取ると備品詳細が開きます</div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`);
    w.document.close();
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
      th.style.cssText='width:42px;text-align:center';
      const all=document.createElement('input');
      all.type='checkbox';
      all.title='すべて選択';
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
      td.style.textAlign='center';
      const cb=document.createElement('input');
      cb.type='checkbox';
      cb.className='qr-row-check';
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
    const toolbar=host.closest('.panel')?.querySelector('.toolbar') || host.parentElement;
    if(!toolbar) return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='qrBatchPrintBtn';
    btn.className='secondary';
    btn.style.minHeight='46px';
    btn.textContent='QRまとめ印刷';
    btn.addEventListener('click',printSelectedAssets);
    toolbar.appendChild(btn);
  }

  function updateBatchButton(){
    const btn=document.getElementById('qrBatchPrintBtn');
    if(!btn) return;
    const n=document.querySelectorAll('#assetTable .qr-row-check:checked').length;
    btn.textContent=n?`QRまとめ印刷（${n}件）`:'QRまとめ印刷';
  }

  function chooseStartPosition(){
    const raw=window.prompt('印刷を開始するシール位置を1〜16で入力してください。\n左上が1、右へ2・3・4、次の段が5〜8です。','1');
    if(raw===null)return null;
    const n=Number(raw);
    if(!Number.isInteger(n)||n<1||n>16){alert('開始位置は1〜16で入力してください。');return null;}
    return n;
  }

  function buildPages(labels,startPosition){
    const pages=[];
    let index=0;
    let first=true;
    while(index<labels.length){
      const slots=new Array(16).fill(null);
      let pos=first?startPosition-1:0;
      while(pos<16&&index<labels.length){slots[pos++]=labels[index++];}
      pages.push(slots);
      first=false;
    }
    return pages;
  }

  async function printSelectedAssets(){
    const selected=[...document.querySelectorAll('#assetTable .qr-row-check:checked')];
    if(!selected.length){ alert('印刷する備品にチェックを入れてください。'); return; }
    if(!window.QRCode||typeof QRCode.toCanvas!=='function'){ alert('QRライブラリを読み込めませんでした。ページを再読み込みしてください。'); return; }

    const startPosition=chooseStartPosition();
    if(startPosition===null)return;

    const labels=[];
    for(const cb of selected){
      const url=new URL(window.APP_BASE_URL||location.origin+location.pathname);
      url.pathname='/';
      url.search='';
      url.searchParams.set('asset',cb.dataset.id);
      const c=document.createElement('canvas');
      await QRCode.toCanvas(c,url.toString(),{width:240,margin:1,errorCorrectionLevel:'M'});
      labels.push({name:cb.dataset.name||'備品',img:c.toDataURL('image/png')});
    }

    const pages=buildPages(labels,startPosition);
    const w=window.open('','_blank');
    if(!w){ alert('印刷画面を開けませんでした。ポップアップを許可してください。'); return; }

    const pageHtml=pages.map((slots,pageIndex)=>{
      const cells=slots.map((x,i)=>x
        ?`<div class="label"><div class="company">熊本大同青果</div><div class="name">${esc(x.name)}</div><img class="qr" src="${x.img}" alt="QR"><div class="hint">備品詳細QR</div></div>`
        :'<div class="label blank"></div>').join('');
      return `<section class="sheet${pageIndex<pages.length-1?' page-break':''}">${cells}</section>`;
    }).join('');

    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>備品QR 16面印刷</title><style>
@page{size:A4 portrait;margin:5mm}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
.sheet{width:200mm;height:287mm;display:grid;grid-template-columns:repeat(4,50mm);grid-template-rows:repeat(4,71.75mm);gap:0;margin:0 auto}
.label{width:50mm;height:71.75mm;padding:3mm 2.5mm;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;border:.2mm solid transparent}
.blank{visibility:hidden}
.company{font-size:7.5pt;font-weight:800;line-height:1.15;margin-bottom:1.2mm;white-space:nowrap}
.name{font-size:9pt;font-weight:800;line-height:1.2;height:10mm;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;word-break:break-word;margin-bottom:1mm}
.qr{width:31mm;height:31mm;image-rendering:pixelated;flex:0 0 auto}
.hint{font-size:6pt;color:#555;margin-top:1mm}
.page-break{break-after:page;page-break-after:always}
@media screen{body{background:#eef2f6;padding:8mm 0}.sheet{background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.12);margin-bottom:8mm}.label:not(.blank){outline:1px dashed #cbd5e1}}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.label{border:0}}
</style></head><body>${pageHtml}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    w.document.close();
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

  const observer=new MutationObserver(scheduleEnhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scheduleEnhance);
})();
