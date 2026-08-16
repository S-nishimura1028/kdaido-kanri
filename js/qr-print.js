(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
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
      const parts=title.split('/').map(s=>s.trim());
      const assetNo=parts[0]||'';
      const name=parts.slice(1).join(' / ')||'';
      const img=canvas.toDataURL('image/png');
      printSingle(assetNo,name,img,err);
    });

    const hint=document.createElement('div');
    hint.style.cssText='width:100%;font-size:11px;color:#64748b;margin-top:2px';
    hint.textContent='複数のQRをA4にまとめる場合は、備品一覧でチェックして「QRまとめ印刷」を使えます。';

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    area.insertBefore(wrap,document.getElementById('qrError'));
  }

  function printSingle(assetNo,name,img,err){
    const w=window.open('','_blank');
    if(!w){ if(err) err.textContent='印刷画面を開けませんでした。ポップアップを許可してください。'; return; }
    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(assetNo)} QR印刷</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;margin:0;color:#111}.sheet{display:flex;justify-content:center;align-items:flex-start}.label{width:72mm;min-height:88mm;border:1.5px solid #111;border-radius:4mm;padding:6mm;text-align:center}.company{font-size:11pt;font-weight:800;margin-bottom:3mm}.assetno{font-size:15pt;font-weight:800;margin:1mm 0}.name{font-size:13pt;font-weight:700;margin:2mm 0 3mm}.qr{width:48mm;height:48mm;image-rendering:pixelated}.hint{font-size:8pt;color:#555;margin-top:2mm}@media print{button{display:none}}</style></head><body><div class="sheet"><div class="label"><div class="company">熊本大同青果｜備品管理</div><div class="assetno">${esc(assetNo)}</div><div class="name">${esc(name)}</div><img class="qr" src="${img}" alt="QR"><div class="hint">スマートフォンで読み取ると備品詳細が開きます</div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`);
    w.document.close();
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
      const cells=row.querySelectorAll('td');
      cb.dataset.assetNo=(cells[0]?.textContent||'').trim();
      cb.dataset.name=(cells[1]?.textContent||'').trim();
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
    const next=n?`QRまとめ印刷（${n}件）`:'QRまとめ印刷';
    if(btn.textContent!==next) btn.textContent=next;
  }

  async function printSelectedAssets(){
    const selected=[...document.querySelectorAll('#assetTable .qr-row-check:checked')];
    if(!selected.length){ alert('印刷する備品にチェックを入れてください。'); return; }
    if(!window.QRCode||typeof QRCode.toCanvas!=='function'){ alert('QRライブラリを読み込めませんでした。ページを再読み込みしてください。'); return; }

    const labels=[];
    for(const cb of selected){
      const url=new URL(location.origin+location.pathname);
      url.searchParams.set('asset',cb.dataset.id);
      const c=document.createElement('canvas');
      await QRCode.toCanvas(c,url.toString(),{width:260,margin:2,errorCorrectionLevel:'M'});
      labels.push({assetNo:cb.dataset.assetNo,name:cb.dataset.name,img:c.toDataURL('image/png')});
    }

    const w=window.open('','_blank');
    if(!w){ alert('印刷画面を開けませんでした。ポップアップを許可してください。'); return; }
    const cards=labels.map(x=>`<div class="label"><div class="company">熊本大同青果｜備品管理</div><div class="assetno">${esc(x.assetNo)}</div><div class="name">${esc(x.name)}</div><img class="qr" src="${x.img}" alt="QR"><div class="hint">読み取ると備品詳細が開きます</div></div>`).join('');
    w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>備品QRまとめ印刷</title><style>@page{size:A4;margin:8mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;margin:0;color:#111}.sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm}.label{height:65mm;border:1px dashed #888;border-radius:2.5mm;padding:3mm;text-align:center;break-inside:avoid;page-break-inside:avoid}.company{font-size:8pt;font-weight:800;margin-bottom:1mm}.assetno{font-size:11pt;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.name{font-size:9pt;font-weight:700;height:8mm;display:flex;align-items:center;justify-content:center;overflow:hidden}.qr{width:35mm;height:35mm;image-rendering:pixelated}.hint{font-size:6.5pt;color:#555;margin-top:1mm}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><div class="sheet">${cards}</div><script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></body></html>`);
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