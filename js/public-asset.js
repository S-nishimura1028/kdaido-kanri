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
    #publicAssetView .error{padding:22px;background:white;border-radius:16px;border:1px solid #eed3d0;color:#9b2c22}
    @media(max-width:560px){#publicAssetView .public-grid,#publicAssetView .photos{grid-template-columns:1fr}#publicAssetView{padding:10px 8px 28px}#publicAssetView .photo-card img{height:auto;max-height:320px}}
  `;
  document.head.appendChild(style);

  const view=document.createElement('div');
  view.id='publicAssetView';
  view.innerHTML='<div class="public-wrap"><div class="public-head"><small>KUMAMOTO DAIDO SEIKA</small><h1>備品情報</h1></div><div class="public-card"><div>読み込み中…</div></div></div>';
  document.body.appendChild(view);

  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
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
      view.querySelector('.public-card').innerHTML=`<div class="asset-title">${esc(a.name)}</div><div class="asset-no">管理No. ${esc(a.asset_no)}</div>${photos}<div class="public-grid">${rows.map(r=>`<div class="item"><small>${esc(r[0])}</small><div>${esc(r[1])}</div></div>`).join('')}</div><div class="notice">この画面はQRコードから確認できる閲覧専用画面です。購入金額や管理メモなど、管理者向け情報は表示しません。</div>`;
    }catch(e){
      console.error(e);
      view.querySelector('.public-wrap').innerHTML=`<div class="error">備品情報を表示できませんでした。<br>${esc(e.message||'')}</div>`;
    }
  }
  load();
})();