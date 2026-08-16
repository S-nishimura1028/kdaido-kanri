(function(){
  'use strict';

  let currentAssetId=new URL(location.href).searchParams.get('asset')||null;
  let client=null;

  function getClient(){
    if(client) return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY) return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  function ensureDialog(){
    let d=document.getElementById('employeePhotoDialog');
    if(d) return d;
    d=document.createElement('dialog');
    d.id='employeePhotoDialog';
    d.innerHTML=`<form method="dialog" class="dialog-card" id="employeePhotoForm">
      <div class="dialog-head"><h3>写真を更新</h3><button type="button" class="close" id="employeePhotoClose">×</button></div>
      <div id="employeePhotoTitle" style="font-weight:800;margin-bottom:14px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
        <div><small style="display:block;margin-bottom:5px;color:var(--muted);font-weight:700">現物外観</small><img id="employeePhotoCurrent1" style="width:100%;height:180px;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#f8fafc" alt="現物外観"></div>
        <div><small style="display:block;margin-bottom:5px;color:var(--muted);font-weight:700">ラベル・型番</small><img id="employeePhotoCurrent2" style="width:100%;height:180px;object-fit:contain;border:1px solid var(--line);border-radius:12px;background:#f8fafc" alt="ラベル・型番"></div>
      </div>
      <label>写真① 現物外観<input id="employeePhotoFile1" type="file" accept="image/*" capture="environment"></label>
      <label>写真② ラベル・型番<input id="employeePhotoFile2" type="file" accept="image/*" capture="environment"></label>
      <div class="dialog-actions"><button type="button" class="secondary" id="employeePhotoCancel">キャンセル</button><button type="submit" class="primary" id="employeePhotoSave">写真を保存</button></div>
      <div id="employeePhotoError" class="error"></div>
    </form>`;
    document.body.appendChild(d);
    d.querySelector('#employeePhotoClose').onclick=()=>d.close();
    d.querySelector('#employeePhotoCancel').onclick=()=>d.close();
    d.querySelector('#employeePhotoForm').addEventListener('submit',savePhotos);
    return d;
  }

  async function signedUrl(path){
    if(!path)return null;
    const db=getClient();if(!db)return null;
    const {data,error}=await db.storage.from('asset-photos').createSignedUrl(path,3600);
    return error?null:data?.signedUrl||null;
  }

  async function openPhotoDialog(){
    if(!currentAssetId){alert('備品を特定できませんでした。');return;}
    const db=getClient();if(!db){alert('接続準備ができていません。');return;}
    const {data,error}=await db.from('assets').select('id,asset_no,name,photo_path,label_photo_path').eq('id',currentAssetId).single();
    if(error||!data){alert('備品情報を取得できませんでした。');return;}
    const d=ensureDialog();d.dataset.assetId=data.id;d.dataset.photoPath=data.photo_path||'';d.dataset.labelPhotoPath=data.label_photo_path||'';
    d.querySelector('#employeePhotoTitle').textContent=`${data.asset_no||''} / ${data.name||''}`;
    d.querySelector('#employeePhotoFile1').value='';d.querySelector('#employeePhotoFile2').value='';d.querySelector('#employeePhotoError').textContent='';
    const [u1,u2]=await Promise.all([signedUrl(data.photo_path),signedUrl(data.label_photo_path)]);
    const i1=d.querySelector('#employeePhotoCurrent1'),i2=d.querySelector('#employeePhotoCurrent2');
    if(u1){i1.src=u1;i1.style.opacity='1'}else{i1.removeAttribute('src');i1.style.opacity='.25'}
    if(u2){i2.src=u2;i2.style.opacity='1'}else{i2.removeAttribute('src');i2.style.opacity='.25'}
    d.showModal();
  }

  async function upload(db,assetId,file,kind){
    if(!file)return null;if(file.size>10*1024*1024)throw new Error('写真は1枚10MB以下にしてください。');
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
    const path=`${assetId}/${kind}-${Date.now()}.${ext}`;
    const {error}=await db.storage.from('asset-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});if(error)throw error;return path;
  }

  async function savePhotos(e){
    e.preventDefault();const d=document.getElementById('employeePhotoDialog'),err=d.querySelector('#employeePhotoError'),save=d.querySelector('#employeePhotoSave');
    err.textContent='';save.disabled=true;save.textContent='保存中…';const db=getClient();
    try{
      const assetId=d.dataset.assetId,old1=d.dataset.photoPath||null,old2=d.dataset.labelPhotoPath||null;
      const f1=d.querySelector('#employeePhotoFile1').files?.[0]||null,f2=d.querySelector('#employeePhotoFile2').files?.[0]||null;
      if(!f1&&!f2)throw new Error('更新する写真を1枚以上選んでください。');
      const new1=f1?await upload(db,assetId,f1,'outside'):old1,new2=f2?await upload(db,assetId,f2,'label'):old2;
      const {error}=await db.rpc('update_asset_photos',{p_asset_id:assetId,p_photo_path:new1,p_label_photo_path:new2});if(error)throw error;
      if(f1&&old1&&old1!==new1)await db.storage.from('asset-photos').remove([old1]).catch(()=>{});
      if(f2&&old2&&old2!==new2)await db.storage.from('asset-photos').remove([old2]).catch(()=>{});
      d.close();location.reload();
    }catch(ex){console.error(ex);err.textContent=ex.message||'写真の保存に失敗しました。';}
    finally{save.disabled=false;save.textContent='写真を保存';}
  }

  function addPhotoButton(){
    const detail=document.getElementById('detailDialog');
    const actions=document.querySelector('#assetDetail .dialog-actions');
    if(!detail||!detail.open||!actions||document.getElementById('employeePhotoUpdateBtn'))return;
    const qr=document.getElementById('qrBtn');
    const btn=document.createElement('button');btn.type='button';btn.id='employeePhotoUpdateBtn';btn.className='secondary';btn.textContent='写真更新';btn.style.minHeight='48px';
    btn.onclick=()=>openPhotoDialog();actions.insertBefore(btn,qr||null);
  }

  document.addEventListener('click',e=>{
    const row=e.target.closest('tr[data-id]');
    if(row&&row.dataset.id)currentAssetId=row.dataset.id;
    const qr=e.target.closest('#qrBtn');
    if(qr){
      const id=new URL(location.href).searchParams.get('asset');
      if(id)currentAssetId=id;
    }
    setTimeout(addPhotoButton,0);
  },true);

  const obs=new MutationObserver(()=>setTimeout(addPhotoButton,0));
  obs.observe(document.getElementById('detailDialog')||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(addPhotoButton,0));
})();