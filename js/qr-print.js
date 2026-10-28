(function(){
  'use strict';

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }


  let activeAssetId=null;

  function db(){
    return window.DaidoQrBridge?.getClient?.()||null;
  }

  async function fetchAssetPrintInfo(id,fallbackName,fallbackNo){
    const fallback={name:fallbackName||'備品',asset_no:fallbackNo||null,location:null};
    if(!id)return fallback;
    const c=db();
    if(!c)return fallback;
    try{
      const {data,error}=await c.from('assets').select('id,asset_no,name,location').eq('id',id).single();
      if(error||!data)return fallback;
      return {name:data.name||fallback.name,asset_no:data.asset_no||fallback.asset_no,location:data.location||null};
    }catch(_e){
      return fallback;
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
    btn.textContent='この備品のQRシールを印刷';
    btn.title='エーワン31373（27面）または31071（24面）で印刷します';
    btn.style.minHeight='46px';
    btn.addEventListener('click',async function(){
      const err=document.getElementById('qrError');
      if(!canvas.width){ if(err) err.textContent='先にQRコードを表示してください。'; return; }
      const title=(area.querySelector('div')?.textContent||'備品QR').trim();
      const parts=title.split('/').map(s=>s.trim()).filter(Boolean);
      const fallbackName=parts.length>1?parts.slice(1).join(' / '):parts[0]||'備品';
      const fallbackNo=parts.length>1?parts[0]:'';
      const info=await fetchAssetPrintInfo(activeAssetId,fallbackName,fallbackNo);
      const img=canvas.toDataURL('image/png');
      await printSingle(info.name,info.asset_no,info.location,img,err);
    });

    const hint=document.createElement('div');
    hint.style.cssText='width:100%;font-size:11px;color:#64748b;margin-top:2px';
    hint.textContent='印刷時に用紙を選択：標準はエーワン31373（A4・27面）、屋外用は31071（A4・24面）。複数枚は備品一覧から一括印刷できます。';

    wrap.appendChild(btn);
    wrap.appendChild(hint);
    area.insertBefore(wrap,document.getElementById('qrError'));
  }

  async function printSingle(name,assetNo,location,img,err){
    const settings=choosePrintSettings();
    if(!settings)return;
    const w=window.open('','_blank');
    if(!w){ if(err) err.textContent='印刷画面を開けませんでした。ポップアップを許可してください。'; return; }
    const labels=[{name:name||'備品',asset_no:assetNo||null,location:location||null,img}];
    try{await writeLabelPrintWindow(w,labels,settings.startPosition,`${name||'備品'} QR印刷（${settings.layout.code}）`,settings.layout);}
    catch(e){if(err)err.textContent=e.message||'印刷データを作成できませんでした。';w.close();}
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
      all.title='この一覧に表示中の備品をすべて印刷対象にする';
      all.setAttribute('aria-label','一覧の備品をすべてQR印刷対象にする');
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
      const noIndex=headerIndex(table,'備品番号');
      const offset=headRow?.querySelector('.qr-select-head')?1:0;
      const cells=row.querySelectorAll('td');
      cb.dataset.name=(cells[nameIndex>=0?nameIndex-offset:1]?.textContent||'備品').trim();
      cb.dataset.assetNo=(cells[noIndex>=0?noIndex-offset:0]?.textContent||'').trim();
      cb.setAttribute('aria-label',`${cb.dataset.assetNo||''} ${cb.dataset.name||''} をQRシール印刷対象にする`);
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
    note.textContent='印刷対象を選択してください（カード・一覧表どちらでも選択できます）';
    note.style.cssText='margin-right:auto;font-size:13px;color:#64748b;font-weight:600';

    const btn=document.createElement('button');
    btn.type='button';
    btn.id='qrBatchPrintBtn';
    btn.className='primary';
    btn.style.cssText='min-height:48px;padding:0 20px;font-weight:800';
    btn.textContent='QRシールを一括印刷';
    btn.addEventListener('click',printSelectedAssets);

    const selectBtn=document.createElement('button');
    selectBtn.type='button';
    selectBtn.id='qrSelectAllBtn';
    selectBtn.className='secondary';
    selectBtn.textContent='表示中をすべて選択';
    selectBtn.title='現在の検索結果にある備品をまとめて印刷対象にします';
    selectBtn.addEventListener('click',()=>{
      const table=document.querySelector('#assetTable table');
      const head=table?.querySelector('.qr-select-head input');
      if(!head)return;
      const checkboxes=[...table.querySelectorAll('.qr-row-check')];
      if(!checkboxes.length)return;
      head.checked=!checkboxes.every(c=>c.checked);
      // Preserve the existing QR printer selection logic and notify the
      // card workspace through the same native change event.
      head.dispatchEvent(new Event('change',{bubbles:true}));
    });
    const byGroup=document.createElement('button');
    byGroup.type='button';
    byGroup.id='qrGroupPrintBtn';
    byGroup.className='secondary';
    byGroup.textContent='保管場所・部署別に印刷';
    byGroup.title='保管場所または所属部署からQR印刷対象を絞り込みます';
    byGroup.addEventListener('click',openGroupPrintDialog);
    bar.style.flexWrap='wrap';
    bar.append(note,selectBtn,byGroup,btn);
    parent.insertBefore(bar,host);
  }

  function updateBatchButton(){
    const btn=document.getElementById('qrBatchPrintBtn');
    if(!btn) return;
    const n=document.querySelectorAll('#assetTable .qr-row-check:checked').length;
    // Only mutate the DOM when values actually change. The document-wide
    // MutationObserver must not trigger another animation-frame render loop.
    const label=n?`QRシールを一括印刷（${n}件）`:'QRシールを一括印刷';
    const hint=n?`選択中の${n}件をA4ラベル（31373：27面／31071：24面）から選んで印刷します`:'印刷したい備品にチェックを入れてください';
    if(btn.textContent!==label)btn.textContent=label;
    if(btn.disabled!==(n===0))btn.disabled=n===0;
    if(btn.title!==hint)btn.title=hint;
    const selectBtn=document.getElementById('qrSelectAllBtn');
    if(selectBtn){
      const checks=[...document.querySelectorAll('#assetTable .qr-row-check')];
      const allSelected=checks.length>0&&checks.every(c=>c.checked);
      const selectLabel=allSelected?'選択を解除':'表示中をすべて選択';
      if(selectBtn.textContent!==selectLabel)selectBtn.textContent=selectLabel;
      if(selectBtn.disabled!==(checks.length===0))selectBtn.disabled=checks.length===0;
    }
  }

  // 販売元のフォーマットを実寸で定義（左上起点・列方向の順番）。
  // 31071：左右6.46mm・列間2.54mm・上下13.06mm、行間0。
  const LABEL_STOCKS=Object.freeze({
    '31373':Object.freeze({
      code:'31373',title:'エーワン31373（水に強い・屋内用）',
      width:62,height:31,cols:3,rows:9,left:7,top:9,colGap:5,rowGap:0
    }),
    '31071':Object.freeze({
      code:'31071',title:'エーワン31071（屋外用フィルム）',
      width:64,height:33.86,cols:3,rows:8,left:6.46,top:13.06,colGap:2.54,rowGap:0
    })
  });

  function choosePrintSettings(){
    const raw=window.prompt(
      'QRシール用紙を選択してください。\n1：31373（水に強い・27面／標準）\n2：31071（屋外フィルム・24面）',
      '1'
    );
    if(raw===null)return null;
    const layout=raw.trim()==='1'||raw.trim()==='31373'
      ?LABEL_STOCKS['31373']
      :raw.trim()==='2'||raw.trim()==='31071'
        ?LABEL_STOCKS['31071']:null;
    if(!layout){window.alert('用紙は1（31373）または2（31071）を選択してください。');return null;}
    const startPosition=chooseStartPosition(layout);
    return startPosition===null?null:{layout,startPosition};
  }

  function chooseStartPosition(layout=LABEL_STOCKS['31373']){
    const slots=layout.cols*layout.rows;
    const raw=window.prompt(
      '印刷を開始するシール位置を1〜'+slots+'で入力してください。\n'
      +layout.title+'（'+layout.cols+'列×'+layout.rows+'段）\n'
      +'左上が1、右へ2・3、次の段が4〜6です。\n'
      +'新品のシール用紙は「1」を指定してください。使用済みシートの再給紙は紙詰まりのおそれがあります。',
      '1'
    );
    if(raw===null)return null;
    const n=Number(raw);
    if(!Number.isInteger(n)||n<1||n>slots){
      window.alert('開始位置は1〜'+slots+'で入力してください。');
      return null;
    }
    return n;
  }

  function buildPages(labels,startPosition,layout=LABEL_STOCKS['31373']){
    const capacity=layout.cols*layout.rows;
    const pages=[];
    let index=0;
    let first=true;
    while(index<labels.length){
      const slots=new Array(capacity).fill(null);
      let pos=first?startPosition-1:0;
      while(pos<capacity&&index<labels.length)slots[pos++]=labels[index++];
      pages.push(slots);
      first=false;
    }
    return pages;
  }

  // ブラウザの改ページ処理が回転済みHTMLを分割するため、
  // QRと文字をシール1枚ごとに画像化してから印刷する。
  const LABEL_PX_PER_MM=12;
  const labelMm=mm=>mm*LABEL_PX_PER_MM;
  const labelFont=pt=>Math.round(pt*(25.4/72)*LABEL_PX_PER_MM*10)/10;

  function labelText(ctx,text,x,y,fontPt,maxWidth,color='#111'){
    const value=String(text||'');
    let size=labelFont(fontPt);
    ctx.fillStyle=color;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    while(size>labelFont(5.1)){
      ctx.font='800 '+size+'px "Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
      if(ctx.measureText(value).width<=maxWidth)break;
      size-=0.8;
    }
    ctx.font='800 '+size+'px "Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
    ctx.fillText(value,x,y,maxWidth);
  }

  function labelNameLines(ctx,name,maxWidth){
    const value=String(name||'備品').trim()||'備品';
    for(const pt of [7.6,7.2,6.8,6.4,6,5.6,5.2]){
      ctx.font='800 '+labelFont(pt)+'px "Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
      const lines=[''];
      for(const letter of [...value]){
        const last=lines.length-1;
        if(lines[last]&&ctx.measureText(lines[last]+letter).width>maxWidth){
          lines.push(letter);
        }else{
          lines[last]+=letter;
        }
      }
      if(lines.length<=3)return {lines,pt};
    }
    ctx.font='800 '+labelFont(5.2)+'px "Noto Sans JP","Yu Gothic",Meiryo,sans-serif';
    const lines=[''];
    for(const letter of [...value]){
      const last=lines.length-1;
      if(lines[last]&&ctx.measureText(lines[last]+letter).width>maxWidth){
        if(lines.length>=3){
          while(lines[2]&&ctx.measureText(lines[2]+'…').width>maxWidth)lines[2]=lines[2].slice(0,-1);
          lines[2]+='…';
          return {lines,pt:5.2};
        }
        lines.push(letter);
      }else{
        lines[last]+=letter;
      }
    }
    return {lines,pt:5.2};
  }

  async function rasterizeLabel(label,layout=LABEL_STOCKS['31373']){
    const qr=new Image();
    await new Promise((resolve,reject)=>{
      qr.onload=resolve;
      qr.onerror=()=>reject(new Error('QR画像を読み込めませんでした。'));
      qr.src=label.img;
    });
    // シール1枚分の画像を縦向きに組版し、シート別寸法で回転出力する。
    const portrait=document.createElement('canvas');
    portrait.width=Math.round(labelMm(layout.height));
    portrait.height=Math.round(labelMm(layout.width));
    const ctx=portrait.getContext('2d');
    if(!ctx)throw new Error('印刷用の画像を生成できませんでした。');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,portrait.width,portrait.height);
    const width=portrait.width;
    const name=labelNameLines(ctx,label.name||'備品',labelMm(28.6));
    const lineHeight=labelMm(3);
    const nameHeight=Math.max(labelMm(6),name.lines.length*lineHeight);
    const total=labelMm(2.5+0.8+20+0.7+3.4+0.5)+nameHeight;
    let y=(portrait.height-total)/2;
    labelText(ctx,'熊本大同青果',width/2,y+labelMm(1.25),5.4,labelMm(28.6));
    y+=labelMm(3.3);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(qr,(width-labelMm(20))/2,y,labelMm(20),labelMm(20));
    y+=labelMm(20.7);
    labelText(ctx,'管理No.：'+(label.asset_no||'未設定'),width/2,y+labelMm(1.7),6.5,labelMm(28.6),'#334155');
    y+=labelMm(3.9);
    name.lines.forEach((line,i)=>labelText(ctx,line,width/2,
      y+(i+0.5)*lineHeight+(nameHeight-name.lines.length*lineHeight)/2,
      name.pt,labelMm(28.6)
    ));
    const output=document.createElement('canvas');
    output.width=Math.round(labelMm(layout.width));
    output.height=Math.round(labelMm(layout.height));
    const out=output.getContext('2d');
    if(!out)throw new Error('印刷用の画像を生成できませんでした。');
    out.translate(0,output.height);
    out.rotate(-Math.PI/2);
    out.drawImage(portrait,0,0);
    return output.toDataURL('image/png');
  }

  async function writeLabelPrintWindow(w,labels,startPosition,title,layout=LABEL_STOCKS['31373']){
    // Resolve fonts before baking text into pixels; changing fonts later cannot
    // repair an already-rasterized label.
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;
    const imageCache=new Map();
    const prepared=[];
    for(const item of labels){
      const key=[layout.code,item.img,item.name,item.asset_no].join('|');
      if(!imageCache.has(key))imageCache.set(key,await rasterizeLabel(item,layout));
      prepared.push({...item,printImg:imageCache.get(key)});
    }
    const pages=buildPages(prepared,startPosition,layout);
    // Keep each A4 page a single SVG print object. Text and QR are already
    // combined in each label image, so neither can fragment at a page break.
    const pageHtml=pages.map(slots=>{
      const cells=slots.map((item,slot)=>{
        const col=slot%layout.cols,row=Math.floor(slot/layout.cols);
        const left=Math.round((layout.left+col*(layout.width+layout.colGap))*100)/100;
        const top=Math.round((layout.top+row*(layout.height+layout.rowGap))*100)/100;
        const guide='<rect class="cut-guide" x="'+left+'" y="'+top+'" width="'+layout.width+'" height="'+layout.height+'"/>';
        if(!item)return '<g class="label blank">'+guide+'</g>';
        return '<g class="label">'+guide+'<image class="print-label-image" x="'+left+'" y="'+top+'" width="'+layout.width+'" height="'+layout.height+'" href="'+esc(item.printImg)+'" preserveAspectRatio="none"><title>'+esc((item.asset_no||'')+' '+item.name)+'</title></image></g>';
      }).join('');
      return '<section class="sheet"><svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="296mm" viewBox="0 0 210 296" aria-label="A4・'+(layout.cols*layout.rows)+'面QRシール">'+cells+'</svg></section>';
    }).join('');
    w.document.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title||'備品QR エーワン'+layout.code+'印刷')+'</title><style>'+String.raw`
@page{size:A4 portrait;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif}
.sheet{display:block;position:relative;overflow:hidden;width:210mm;height:296mm;margin:0 auto;break-inside:avoid;page-break-inside:avoid}
.sheet+.sheet{break-before:page;page-break-before:always}
.sheet svg{display:block;width:210mm;height:296mm}
.cut-guide{fill:none;stroke:transparent;stroke-width:.15}
.print-toolbar{display:none}
@media screen{body{background:#e9eff2;padding:9mm 0}.print-toolbar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:9px 18px;background:#fff;border:1px solid #d7e2e8;border-radius:12px;padding:14px 18px;margin:0 auto 8mm;width:min(860px,95%);font-size:13px;color:#25465b}.print-toolbar span{flex-basis:100%;text-align:center}.print-toolbar button{background:#075b9b;color:#fff;border:0;border-radius:9px;padding:10px 19px;font-weight:bold;cursor:pointer}.sheet{background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.15);margin-bottom:9mm}.cut-guide{stroke:#d0dce2}}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.cut-guide{stroke:none!important}.print-toolbar{display:none!important}}
</style></head><body>`+'<div class="print-toolbar"><strong>QRシール '+labels.length+'件・'+pages.length+'ページ / '+esc(layout.code)+'</strong><button type="button" onclick="window.print()">印刷</button><span>A4縦／倍率100%／余白なし／ヘッダー・フッターなし。ラベル用紙の前に普通紙で位置確認してください。</span></div>'+pageHtml+String.raw`<script>
window.addEventListener('load',async function(){
  try{if(document.fonts&&document.fonts.ready)await document.fonts.ready}catch(_e){}
  setTimeout(function(){window.print()},400);
});
</script></body></html>`);
    w.document.close();
  }

  async function loadSelectedAssetInfo(selected){
    const ids=selected.map(cb=>cb.dataset.id).filter(Boolean);
    const fallback=new Map(selected.map(cb=>[cb.dataset.id,{name:cb.dataset.name||'備品',asset_no:cb.dataset.assetNo||null,location:null}]));
    if(!ids.length)return fallback;
    const c=db();
    if(!c)return fallback;
    try{
      const {data,error}=await c.from('assets').select('id,asset_no,name,location').in('id',ids);
      if(error)return fallback;
      (data||[]).forEach(a=>fallback.set(String(a.id),{
        name:a.name||fallback.get(String(a.id))?.name||'備品',
        asset_no:a.asset_no||fallback.get(String(a.id))?.asset_no||null,
        location:a.location||null
      }));
    }catch(_e){}
    return fallback;
  }

  async function printSelectedAssets(){
    const selected=[...document.querySelectorAll('#assetTable .qr-row-check:checked')];
    if(!selected.length){ alert('印刷する備品にチェックを入れてください。'); return; }
    if(!window.QRCode||typeof QRCode.toCanvas!=='function'){ alert('QRライブラリを読み込めませんでした。ページを再読み込みしてください。'); return; }

    const settings=choosePrintSettings();
    if(!settings)return;

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
        const info=infoMap.get(cb.dataset.id)||{name:cb.dataset.name||'備品',asset_no:cb.dataset.assetNo||null,location:null};
        labels.push({name:info.name||'備品',asset_no:info.asset_no||null,location:info.location||null,img:c.toDataURL('image/png')});
      }
      w.document.open();
      await writeLabelPrintWindow(w,labels,settings.startPosition,'備品QR '+settings.layout.title+'・'+(settings.layout.cols*settings.layout.rows)+'面印刷',settings.layout);
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


  // Grouped printing works from the whole RLS-visible inventory, not the
  // currently displayed table or its unrelated search/status filters.
  const GROUP_UNSET='__unset__';
  const groupedPrint={assets:[],loaded:false,busy:false,loading:false,dialog:null};

  function groupLabel(asset,kind,masterMap){
    const id=asset[kind+'_id'];
    return String((id&&masterMap?.get(String(id)))||asset[kind]||'').trim();
  }

  function matchGroupFilter(filter,value){
    return !filter||(filter===GROUP_UNSET?!value:filter===value);
  }

  function filteredGroupAssets(assets,location,department){
    if(!location&&!department)return [];
    return assets.filter(a=>matchGroupFilter(location,a._groupLocation)
      &&matchGroupFilter(department,a._groupDepartment));
  }

  async function fetchGroupPrintAssets(){
    const c=db();
    if(!c)throw new Error('管理者ログインを確認できません。再度ログインしてください。');
    const [places,departments]=await Promise.all([
      c.from('locations').select('id,name'),
      c.from('departments').select('id,name')
    ]);
    if(places.error)throw places.error;
    if(departments.error)throw departments.error;
    const placeMap=new Map((places.data||[]).map(x=>[String(x.id),x.name]));
    const deptMap=new Map((departments.data||[]).map(x=>[String(x.id),x.name]));
    const request=c.from('assets')
      .select('id,asset_no,name,location,department,location_id,department_id,status')
      .eq('is_deleted',false).neq('status','廃棄')
      .order('asset_no').order('id');
    const rows=[];
    for(let offset=0;;offset+=500){
      const {data,error}=await request.range(offset,offset+499);
      if(error)throw error; // Never print an incomplete result on network failure.
      rows.push(...(data||[]));
      if((data||[]).length<500)break;
    }
    return rows.map(a=>({
      ...a,
      _groupLocation:groupLabel(a,'location',placeMap),
      _groupDepartment:groupLabel(a,'department',deptMap)
    }));
  }

  function groupSelections(){
    const d=groupedPrint.dialog;
    if(!d)return {location:'',department:''};
    return {
      location:d.querySelector('#qrGroupLocation').value,
      department:d.querySelector('#qrGroupDepartment').value
    };
  }

  function groupPrintList(){
    const d=groupedPrint.dialog;if(!d)return [];
    const selection=groupSelections();
    return filteredGroupAssets(groupedPrint.assets,selection.location,selection.department);
  }

  function refreshGroupPrintView(){
    const d=groupedPrint.dialog;if(!d)return;
    const summary=d.querySelector('#qrGroupSummary');
    const preview=d.querySelector('#qrGroupPreview');
    const printBtn=d.querySelector('#qrGroupPrintNow');
    if(!groupedPrint.loaded){
      summary.textContent=groupedPrint.loading?'保管場所・所属部署を読み込み中…':'一覧を取得してください。';
      preview.textContent='';printBtn.disabled=true;return;
    }
    const selection=groupSelections(),items=groupPrintList();
    const noSelection=!selection.location&&!selection.department;
    const withoutNumbers=items.filter(a=>!a.asset_no);
    summary.textContent=noSelection
      ? '保管場所または所属部署を1つ以上選択してください。'
      : items.length
        ? '印刷候補 '+items.length+'件（31373なら'+Math.ceil(items.length/27)+'ページ）'
          +(withoutNumbers.length?' ／ 管理No.未設定 '+withoutNumbers.length+'件：印刷不可':'')
        : 'この条件に合う備品はありません。';
    preview.innerHTML=items.length
      ?'<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th style="text-align:left">管理No.</th><th style="text-align:left">備品名</th><th style="text-align:left">保管場所 / 部署</th></tr></thead><tbody>'+
        items.slice(0,60).map(a=>'<tr><td style="padding:7px 4px;border-top:1px solid #e2e8f0">'+esc(a.asset_no||'未設定')+
          '</td><td style="padding:7px 4px;border-top:1px solid #e2e8f0">'+esc(a.name)+
          '</td><td style="padding:7px 4px;border-top:1px solid #e2e8f0">'+
          esc(a._groupLocation||'未設定')+' / '+esc(a._groupDepartment||'未設定')+'</td></tr>').join('')+
        '</tbody></table>'+(items.length>60?'<p>ほか '+(items.length-60)+' 件（印刷時にはすべて対象）</p>':'')
      : '';
    printBtn.disabled=groupedPrint.busy||noSelection||items.length===0||withoutNumbers.length>0;
    printBtn.textContent=items.length?'この条件でQR印刷（'+items.length+'件）':'この条件でQR印刷';
  }

  function populateGroupOptions(){
    const d=groupedPrint.dialog;if(!d)return;
    for(const [kind,field] of [['location','_groupLocation'],['department','_groupDepartment']]){
      const select=d.querySelector(kind==='location'?'#qrGroupLocation':'#qrGroupDepartment');
      const prev=select.value;
      const names=[...new Set(groupedPrint.assets.map(a=>a[field]).filter(Boolean))]
        .sort((a,b)=>a.localeCompare(b,'ja'));
      const hasUnset=groupedPrint.assets.some(a=>!a[field]);
      select.innerHTML='<option value="">すべて'+(kind==='location'?'の保管場所':'の所属部署')+'</option>'+
        (hasUnset?'<option value="'+GROUP_UNSET+'">未設定</option>':'')+
        names.map(n=>'<option value="'+esc(n)+'">'+esc(n)+'</option>').join('');
      if([...select.options].some(o=>o.value===prev))select.value=prev;
    }
  }

  async function reloadGroupPrintAssets(){
    if(groupedPrint.loading)return;
    groupedPrint.loading=true;groupedPrint.loaded=false;
    refreshGroupPrintView();
    try{
      const assets=await fetchGroupPrintAssets();
      groupedPrint.assets=assets;
      groupedPrint.loaded=true;
      populateGroupOptions();
      const d=groupedPrint.dialog;
      if(d)d.querySelector('#qrGroupError').textContent='';
    }catch(e){
      console.error('QRグループ印刷：一覧取得',e);
      const d=groupedPrint.dialog;
      if(d)d.querySelector('#qrGroupError').textContent='一覧を読み込めませんでした：'+(e.message||'通信状況を確認してください。');
    }finally{
      groupedPrint.loading=false;refreshGroupPrintView();
    }
  }

  async function printGroupedAssets(){
    if(!groupedPrint.loaded||groupedPrint.busy)return;
    const d=groupedPrint.dialog;
    const {location:locationFilter,department:departmentFilter}=groupSelections();
    const selection=filteredGroupAssets(groupedPrint.assets,locationFilter,departmentFilter);
    if(!selection.length||selection.some(a=>!a.asset_no))return;
    if(!window.QRCode||typeof QRCode.toCanvas!=='function'){
      d.querySelector('#qrGroupError').textContent='QRライブラリを読み込めませんでした。ページを再読み込みしてください。';
      return;
    }
    const settings=choosePrintSettings();
    if(!settings)return;
    const capacity=settings.layout.cols*settings.layout.rows;
    const pageCount=Math.ceil((selection.length+settings.startPosition-1)/capacity);
    if(pageCount>1&&!window.confirm(
      'この条件には '+selection.length+' 件あります。'+pageCount+'ページの印刷になります。\n'+
      '複数ページの実機位置合わせはまだ検証中です。普通紙で確認してからラベル用紙を使ってください。\n\n続けますか？'
    ))return;
    // Open on the actual click, before the network and QR canvas operations.
    const w=window.open('','_blank');
    if(!w){
      d.querySelector('#qrGroupError').textContent='印刷用タブを開けませんでした。ポップアップを許可してください。';
      return;
    }
    w.document.write('<!doctype html><meta charset="utf-8"><title>QR印刷準備中</title><p>対象備品を確認しています…</p>');
    w.document.close();
    groupedPrint.busy=true;refreshGroupPrintView();
    try{
      // Check for deletion, transfer, rename, or status changes before printing.
      const fresh=await fetchGroupPrintAssets();
      const freshItems=filteredGroupAssets(fresh,locationFilter,departmentFilter);
      const fingerprint=arr=>arr.map(a=>[a.id,a.asset_no,a.name,a._groupLocation,a._groupDepartment,a.status].join('|')).join('\n');
      if(fingerprint(freshItems)!==fingerprint(selection)){
        groupedPrint.assets=fresh;groupedPrint.loaded=true;
        populateGroupOptions();
        throw new Error('印刷候補が変更されました。新しい件数と管理No.を確認して、もう一度印刷してください。');
      }
      const labels=[];
      for(const asset of freshItems){
        const url=new URL(window.APP_BASE_URL||location.origin+location.pathname);
        url.pathname='/';url.search='';url.searchParams.set('asset',asset.id);
        const canvas=document.createElement('canvas');
        await QRCode.toCanvas(canvas,url.toString(),{width:240,margin:1,errorCorrectionLevel:'M'});
        labels.push({name:asset.name,asset_no:asset.asset_no,img:canvas.toDataURL('image/png')});
      }
      const descriptor=[locationFilter?'場所別':'',departmentFilter?'部署別':''].filter(Boolean).join('＋');
      w.document.open();
      await writeLabelPrintWindow(w,labels,settings.startPosition,
        'QR '+descriptor+' '+freshItems.length+'件（'+settings.layout.code+'）',settings.layout);
      d.querySelector('#qrGroupError').textContent='';
    }catch(err){
      console.error('QRグループ印刷',err);
      try{w.close();}catch(_){}
      d.querySelector('#qrGroupError').textContent=err.message||'印刷データを作成できませんでした。';
    }finally{
      groupedPrint.busy=false;refreshGroupPrintView();
    }
  }

  async function openGroupPrintDialog(){
    let d=document.getElementById('qrGroupPrintDialog');
    if(!d){
      d=document.createElement('dialog');
      d.id='qrGroupPrintDialog';
      d.style.cssText='width:min(800px,calc(100vw - 22px));max-width:800px;max-height:90vh;overflow:auto;border:0;border-radius:16px;padding:0;box-shadow:0 18px 70px #10243c66';
      d.innerHTML='<div style="padding:20px;color:#1e293b;background:#fff">'+
        '<h3 style="margin:0 0 6px">保管場所・所属部署ごとのQR印刷</h3>'+
        '<p style="margin:0 0 16px;font-size:13px;color:#475569">備品に登録された保管場所・所属部署を使用します。廃棄済みは対象外。現在の一覧の検索条件には左右されません。</p>'+
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px">'+
        '<label style="font-weight:bold;display:grid;gap:6px">保管場所<select id="qrGroupLocation" style="padding:12px;width:100%;font-size:16px"><option value="">すべての保管場所</option></select></label>'+
        '<label style="font-weight:bold;display:grid;gap:6px">所属部署<select id="qrGroupDepartment" style="padding:12px;width:100%;font-size:16px"><option value="">すべての所属部署</option></select></label>'+
        '</div><p id="qrGroupSummary" role="status" style="font-weight:800;margin:14px 0 8px"></p>'+
        '<div id="qrGroupPreview" style="border:1px solid #e2e8f0;border-radius:9px;max-height:38vh;overflow:auto;padding:6px 10px"></div>'+
        '<p id="qrGroupError" role="alert" style="color:#b42318;font-size:13px;margin-top:10px"></p>'+
        '<div style="display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px;margin-top:16px">'+
        '<button type="button" class="secondary" id="qrGroupRefresh">一覧を更新</button>'+
        '<button type="button" class="secondary" id="qrGroupClose">閉じる</button>'+
        '<button type="button" class="primary" id="qrGroupPrintNow" disabled>この条件でQR印刷</button></div>'+
        '<p style="font-size:12px;color:#64748b;margin:10px 0 0">31373：A4・27面。新しいシール用紙は開始位置1。印刷プレビューで倍率100％を確認してください。</p></div>';
      document.body.appendChild(d);
      groupedPrint.dialog=d;
      d.querySelector('#qrGroupLocation').addEventListener('change',refreshGroupPrintView);
      d.querySelector('#qrGroupDepartment').addEventListener('change',refreshGroupPrintView);
      d.querySelector('#qrGroupRefresh').addEventListener('click',reloadGroupPrintAssets);
      d.querySelector('#qrGroupClose').addEventListener('click',()=>{if(!groupedPrint.busy)d.close()});
      d.querySelector('#qrGroupPrintNow').addEventListener('click',printGroupedAssets);
      d.addEventListener('cancel',e=>{if(groupedPrint.busy)e.preventDefault()});
    }
    groupedPrint.dialog=d;
    if(!d.open)d.showModal();
    await reloadGroupPrintAssets();
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
