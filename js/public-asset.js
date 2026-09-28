(function(){
  'use strict';
  const assetId=new URL(location.href).searchParams.get('asset');
  if(!assetId) return;
  window.PUBLIC_ASSET_MODE=true;
  document.body.classList.add('public-asset-mode');

  const style=document.createElement('style');
  style.textContent=`
    body.public-asset-mode{margin:0;background:#f4f8f6!important;color:#153246}
    body.public-asset-mode #loginView,body.public-asset-mode #appView{display:none!important}
    #publicAssetView{min-height:100vh;padding:18px 14px 40px;font-family:system-ui,-apple-system,"Segoe UI","Noto Sans JP",sans-serif}
    #publicAssetView .public-wrap{max-width:680px;margin:0 auto}
    #publicAssetView .public-head{padding:18px 16px;background:linear-gradient(120deg,#075b9b,#1488c9 55%,#58a832);color:white;border-radius:18px 18px 0 0}
    #publicAssetView .public-head small{opacity:.85;letter-spacing:.08em;font-weight:700}
    #publicAssetView .public-head h1{font-size:22px;margin:6px 0 0}
    #publicAssetView .public-card{background:#fff;border:1px solid #dbe8e3;border-top:0;border-radius:0 0 18px 18px;padding:18px;box-shadow:0 12px 32px rgba(10,68,75,.08)}
    #publicAssetView .asset-title{font-size:23px;font-weight:850;margin-bottom:4px;color:#0c416b}
    #publicAssetView .asset-no{color:#5e7c74;font-weight:700;margin-bottom:18px}
    #publicAssetView .photos{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px}
    #publicAssetView .photo-card{background:#f6faf8;border:1px solid #e1ece7;border-radius:12px;padding:8px}
    #publicAssetView .photo-card small{display:block;color:#668078;font-weight:700;margin-bottom:6px}
    #publicAssetView .photo-card img{display:block;width:100%;height:220px;object-fit:contain;background:#fff;border-radius:9px}
    #publicAssetView .public-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    #publicAssetView .item{padding:12px;background:#f6faf8;border:1px solid #e1ece7;border-radius:11px;min-width:0}
    #publicAssetView .item small{display:block;color:#668078;font-weight:700;margin-bottom:4px}
    #publicAssetView .item div{font-weight:750;overflow-wrap:anywhere}
    #publicAssetView .notice{margin-top:14px;font-size:12px;color:#6b7f78;line-height:1.6}
    #publicAssetView .photo-update-btn{width:100%;margin-top:16px;min-height:50px;border:0;border-radius:12px;background:linear-gradient(120deg,#075b9b,#1488c9 55%,#58a832);color:#fff;font-weight:800;font-size:16px;cursor:pointer}
    #publicPhotoOverlay{position:fixed;inset:0;z-index:9999;background:rgba(4,30,47,.62);display:grid;place-items:center;padding:14px;backdrop-filter:blur(3px)}
    #publicPhotoOverlay .card{width:min(560px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;padding:18px;box-shadow:0 28px 80px rgba(0,0,0,.28)}
    #publicPhotoOverlay h3{margin:0 0 6px;color:#173f59}
    #publicPhotoOverlay p{margin:0 0 14px;color:#668078;font-size:13px;line-height:1.6}
    #publicPhotoOverlay label{display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px;margin:12px 0}
    #publicPhotoOverlay input[type=file]{min-height:46px}
    #publicPhotoOverlay .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
    #publicPhotoOverlay button{min-height:46px;border-radius:10px;padding:0 16px;font-weight:800}
    #publicPhotoOverlay .cancel{background:#edf4f2;color:#355e55;border:1px solid #dce8e3}
    #publicPhotoOverlay .save{background:linear-gradient(120deg,#075b9b,#1488c9 55%,#58a832);color:white;border:0}
    #publicPhotoOverlay .err{color:#b42318;font-size:13px;min-height:18px;margin-top:8px}
    #publicAssetView .error{padding:22px;background:white;border-radius:16px;border:1px solid #eed3d0;color:#9b2c22}
    @media(max-width:560px){#publicAssetView .public-grid,#publicAssetView .photos{grid-template-columns:1fr}#publicAssetView{padding:10px 8px 28px}#publicAssetView .photo-card img{height:auto;max-height:320px}}
  `;
  document.head.appendChild(style);

  const view=document.createElement('div');
  view.id='publicAssetView';
  view.innerHTML='<div class="public-wrap"><div class="public-head"><small>KUMAMOTO DAIDO SEIKA</small><h1>備品情報</h1></div><div class="public-card"><div>読み込み中…</div></div></div>';
  document.body.appendChild(view);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function openPublicPhotoUpdate(asset){
    document.getElementById('publicPhotoOverlay')?.remove();
    const overlay=document.createElement('div');
    overlay.id='publicPhotoOverlay';
    overlay.innerHTML=`<div class="card">
      <h3>写真を更新</h3>
      <p>${esc(asset.name||'備品')} の写真だけ更新できます。備品情報そのものは変更できません。</p>
      <label>写真① 現物外観
        <input id="publicPhotoFile1" type="file" accept="image/*" capture="environment">
      </label>
      <label>写真② ラベル・型番
        <input id="publicPhotoFile2" type="file" accept="image/*" capture="environment">
      </label>
      <div class="err" id="publicPhotoErr"></div>
      <div class="actions">
        <button type="button" class="cancel" id="publicPhotoCancel">キャンセル</button>
        <button type="button" class="save" id="publicPhotoSave">写真を保存</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    const card=overlay.querySelector('.card');
    const err=overlay.querySelector('#publicPhotoErr');
    const save=overlay.querySelector('#publicPhotoSave');
    overlay.querySelector('#publicPhotoCancel').onclick=()=>overlay.remove();
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});

    save.onclick=async()=>{
      err.textContent='';
      const f1=overlay.querySelector('#publicPhotoFile1').files?.[0]||null;
      const f2=overlay.querySelector('#publicPhotoFile2').files?.[0]||null;
      if(!f1&&!f2){err.textContent='更新する写真を1枚以上選んでください。';return;}
      if((f1&&f1.size>10*1024*1024)||(f2&&f2.size>10*1024*1024)){err.textContent='写真は1枚10MB以下にしてください。';return;}
      save.disabled=true;save.textContent='保存中…';
      try{
        const form=new FormData();
        form.append('asset_id',assetId);
        if(f1)form.append('photo',f1);
        if(f2)form.append('label_photo',f2);
        const res=await fetch(window.SUPABASE_URL+'/functions/v1/public-photo-update',{
          method:'POST',
          headers:{apikey:window.SUPABASE_PUBLISHABLE_KEY},
          body:form
        });
        const data=await res.json().catch(()=>({}));
        if(!res.ok||data?.error)throw new Error(data?.error||'写真の保存に失敗しました。');
        overlay.remove();
        location.reload();
      }catch(e){
        console.error(e);
        err.textContent=e.message||'写真の保存に失敗しました。';
      }finally{
        if(document.body.contains(save)){save.disabled=false;save.textContent='写真を保存';}
      }
    };
  }
  async function load(){
    try{
      if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY) throw new Error('接続設定を読み込めませんでした。');
      const db=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data,error}=await db.rpc('get_public_asset',{p_asset_id:assetId});
      if(error) throw error;
      const a=Array.isArray(data)?data[0]:data;
      if(!a) throw new Error('この備品は見つかりませんでした。');
      const rows=[
        ['カテゴリ',a.category||'-'],['メーカー',a.manufacturer||'-'],['型番',a.model||'-'],['製造番号',a.serial_number||'-'],
        ['部署',a.department||'-'],['使用・保管場所',a.location||'-'],['現在の使用者',a.user_name||'未設定'],['ステータス',a.status||'-']
      ];
      const publicUrl=path=>path?db.storage.from('asset-photos').getPublicUrl(path).data.publicUrl:null;
      const p1=publicUrl(a.photo_path),p2=publicUrl(a.label_photo_path);
      const photos=(p1||p2)?`<div class="photos">${p1?`<div class="photo-card"><small>現物外観</small><img src="${esc(p1)}" alt="${esc(a.name)}の外観写真"></div>`:''}${p2?`<div class="photo-card"><small>ラベル・型番</small><img src="${esc(p2)}" alt="${esc(a.name)}のラベル写真"></div>`:''}</div>`:'';
      view.querySelector('.public-card').innerHTML=`<div class="asset-title">${esc(a.name)}</div><div class="asset-no">管理No. ${esc(a.asset_no)}</div>${photos}<div class="public-grid">${rows.map(r=>`<div class="item"><small>${esc(r[0])}</small><div>${esc(r[1])}</div></div>`).join('')}</div><button type="button" class="photo-update-btn" id="publicPhotoUpdateBtn">写真更新</button><div class="notice">QRからログインせずに利用する場合は写真だけ更新できます。備品名・使用者・保管場所などの情報編集は管理者ログインが必要です。</div>`;
      view.querySelector('#publicPhotoUpdateBtn').onclick=()=>openPublicPhotoUpdate(a);
    }catch(e){
      console.error(e);
      view.querySelector('.public-wrap').innerHTML=`<div class="error">備品情報を表示できませんでした。<br>${esc(e.message||'')}</div>`;
    }
  }
  load();
})();