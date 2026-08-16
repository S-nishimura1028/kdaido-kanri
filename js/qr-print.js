(function(){
  'use strict';

  function addPrintButton(){
    const area=document.getElementById('qrArea');
    const canvas=document.getElementById('qrCanvas');
    if(!area||!canvas||document.getElementById('qrPrintBtn')) return;

    const wrap=document.createElement('div');
    wrap.style.marginTop='12px';
    const btn=document.createElement('button');
    btn.type='button';
    btn.id='qrPrintBtn';
    btn.className='primary';
    btn.textContent='QRを印刷';
    btn.style.minHeight='46px';
    btn.addEventListener('click',function(){
      const err=document.getElementById('qrError');
      if(!canvas.width){ if(err) err.textContent='先にQRコードを表示してください。'; return; }
      const title=(area.querySelector('div')?.textContent||'備品QR').trim();
      const parts=title.split('/').map(s=>s.trim());
      const assetNo=parts[0]||'';
      const name=parts.slice(1).join(' / ')||'';
      const img=canvas.toDataURL('image/png');
      const w=window.open('','_blank');
      if(!w){ if(err) err.textContent='印刷画面を開けませんでした。ポップアップを許可してください。'; return; }
      w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${assetNo} QR印刷</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;margin:0;color:#111}.sheet{display:flex;justify-content:center;align-items:flex-start}.label{width:72mm;min-height:88mm;border:1.5px solid #111;border-radius:4mm;padding:6mm;text-align:center}.company{font-size:11pt;font-weight:800;margin-bottom:3mm}.assetno{font-size:15pt;font-weight:800;margin:1mm 0}.name{font-size:13pt;font-weight:700;margin:2mm 0 3mm}.qr{width:48mm;height:48mm;image-rendering:pixelated}.hint{font-size:8pt;color:#555;margin-top:2mm}@media print{button{display:none}}</style></head><body><div class="sheet"><div class="label"><div class="company">熊本大同青果｜備品管理</div><div class="assetno">${assetNo}</div><div class="name">${name}</div><img class="qr" src="${img}" alt="QR"><div class="hint">スマートフォンで読み取ると備品詳細が開きます</div></div></div><script>window.onload=()=>setTimeout(()=>window.print(),150)<\/script></body></html>`);
      w.document.close();
    });
    wrap.appendChild(btn);
    area.insertBefore(wrap,document.getElementById('qrError'));
  }

  const observer=new MutationObserver(addPrintButton);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',addPrintButton);
})();