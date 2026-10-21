(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  let db, currentUser=null, profile=null, assets=[], categories=[], locations=[], departments=[], assetUsers=[], pendingPhotoFile=null, pendingLabelPhotoFile=null; const photoUrlCache=new Map();
  const statusClass=s=>({'未使用':'ok','使用中':'use','修理中':'repair','廃棄':'dispose'}[s]||'');
  const ACQ_MARK='【取得方法】';

  // The master record (asset_users.id) is the single current source of user identity.
  // Legacy assets.user_name is written only as a compatibility snapshot.
  function userNameForDisplay(person){
    const full=String(person?.name||'').trim();
    const department=String(person?.department||'').trim();
    const prefix=department && full.startsWith(department)?full.slice(department.length):'';
    return prefix && /^[\s\u3000]+/.test(prefix)?prefix.trim():full;
  }
  function refreshUserOptions(){
    const select=$('currentUserId');
    const selected=select.value;
    select.innerHTML='<option value="">使用者なし（未割当）</option>'+assetUsers.map(x=>{
      const profile=[
        x.department?'所属：'+x.department:'',
        x.location?'居住：'+x.location:'',
        x.room_number?'部屋：'+x.room_number:''
      ].filter(Boolean).join(' / ');
      return `<option value="${esc(x.id)}">${esc(userNameForDisplay(x))}${profile?`（${esc(profile)}）`:''}</option>`;
    }).join('');
    if(selected&&assetUsers.some(x=>x.id===selected))select.value=selected;
  }

  function parseAcquisitionMethod(note){
    const s=String(note||'');
    const m=s.match(/【取得方法】([^\n\r]*)/);
    return m?m[1].trim():'';
  }
  function parseUserNote(note){
    return String(note||'').replace(/【取得方法】[^\n\r]*(?:\r?\n)?/,'').trim();
  }
  function buildStoredNote(method,note){
    const m=String(method||'').trim(), n=String(note||'').trim();
    return [m?`${ACQ_MARK}${m}`:'',n].filter(Boolean).join('\n')||null;
  }

  function showError(msg){ const el=$('loginError'); if(el) el.textContent=msg; }
  function roleLabel(){return '管理者'}
  function isManager(){return profile?.role==='admin'}
  function showLogin(){ $('appView').classList.add('hidden'); $('loginView').classList.remove('hidden'); }

  async function init(){
    try{
      if(!window.supabase || !window.supabase.createClient) throw new Error('Supabaseのライブラリを読み込めませんでした。インターネット接続を確認してください。');
      if(!window.SUPABASE_URL || !window.SUPABASE_PUBLISHABLE_KEY) throw new Error('Supabase接続設定がありません。');
      db=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
      const {data,error}=await db.auth.getSession();
      if(error) throw error;
      if(data.session) await enterApp(data.session.user);
      db.auth.onAuthStateChange((_event,session)=>{ setTimeout(()=>session?enterApp(session.user):showLogin(),0); });
    }catch(e){ console.error(e); showError('Supabaseに接続できませんでした。 '+(e.message||'')); }
  }

  async function enterApp(user){
    try{
      currentUser=user;
      const r=await db.from('profiles').select('*').eq('id',user.id).maybeSingle();
      if(r.error) throw r.error;
      profile=r.data;
      if(!profile || profile.role!=='admin' || profile.is_active!==true){
        await db.auth.signOut();
        throw new Error('このアプリとQR備品情報は管理者アカウント専用です。');
      }
      $('loginView').classList.add('hidden');$('appView').classList.remove('hidden');
      $('userInfo').textContent=`${profile?.name||user.email} / ${roleLabel(profile?.role)}`;
      document.querySelectorAll('.admin-only').forEach(e=>e.classList.toggle('hidden',!isManager()));
      $('connectionStatus').textContent='Supabase接続OK';
      await loadMasters(); await loadDashboard(); await loadAssets(); await loadHistory();
    }catch(e){console.error(e);showLogin();showError('ログイン後のデータ取得に失敗しました。 '+(e.message||''));}
  }

  $('loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    showError('');
    const btn=e.submitter||$('loginForm').querySelector('button[type="submit"]');
    btn.disabled=true;btn.textContent='ログイン中…';
    try{
      if(!db) throw new Error('Supabaseへの接続準備ができていません。少し待ってから再度お試しください。');
      const {error}=await db.auth.signInWithPassword({email:$('loginEmail').value.trim(),password:$('loginPassword').value});
      if(error) throw error;
    }catch(err){console.error(err);showError(err.message||'ログインに失敗しました。');}
    finally{btn.disabled=false;btn.textContent='ログイン';}
  });
  // One-time email login for existing users only. Admin authorization is
  // still enforced by enterApp() and the Supabase table/storage RLS policies.
  $('magicLinkBtn').addEventListener('click',async()=>{
    const email=$('loginEmail').value.trim();
    const button=$('magicLinkBtn');
    const notice=$('magicLinkNotice');
    showError('');
    notice.textContent='';
    if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){
      showError('登録済みメールアドレスを入力してください。');
      $('loginEmail').focus();
      return;
    }
    if(!db){
      showError('接続準備中です。少し待ってから再度お試しください。');
      return;
    }
    button.disabled=true;
    button.textContent='メール送信中…';
    try{
      const redirectTo=window.location.href.split('#')[0];
      const {error}=await db.auth.signInWithOtp({
        email,
        options:{shouldCreateUser:false,emailRedirectTo:redirectTo}
      });
      if(error)throw error;
      notice.textContent='ログイン用メールを送信しました。届いたメールのリンクからアクセスしてください。リンクは一度だけ使用できます。';
    }catch(err){
      console.error('magic link request',err);
      showError('メールを送れませんでした。'+(err.message||'少し時間をおいて再度お試しください。'));
    }finally{
      button.disabled=false;
      button.textContent='メールで一時ログイン';
    }
  });
  $('logoutBtn').onclick=()=>db.auth.signOut();
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>go(b.dataset.page));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('mobileMenu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
  function go(page){const titles={dashboard:'ダッシュボード',assets:'備品一覧',history:'履歴',admin:'管理'};document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$(page+'Page').classList.remove('hidden');$('pageTitle').textContent=titles[page];document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='admin'&&isManager())loadAdmin();}
  async function loadMasters(){
    const [c,l,d,u]=await Promise.all([
      db.from('categories').select('*').eq('is_active',true).order('name'),
      db.from('locations').select('*').eq('is_active',true).order('name'),
      db.from('departments').select('*').eq('is_active',true).order('name'),
      db.from('asset_users').select('*').eq('is_active',true).order('name')
    ]);
    for(const r of [c,l,d,u])if(r.error)throw r.error;
    categories=c.data||[];locations=l.data||[];departments=d.data||[];assetUsers=u.data||[];
    $('assetCategory').innerHTML='<option value="">すべてのカテゴリ</option>'+categories.map(x=>`<option>${esc(x.name)}</option>`).join('');
    $('assetCategoryForm').innerHTML='<option value="">その他</option>'+categories.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    $('locationForm').innerHTML='<option value="">未設定</option>'+locations.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    $('departmentForm').innerHTML='<option value="">未設定</option>'+departments.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    refreshUserOptions();
  }
  async function loadDashboard(){
    const r=await db.from('assets').select('status,quantity,photo_path');if(r.error)throw r.error;
    const rows=r.data||[];$('statTotal').textContent=rows.reduce((n,a)=>n+Number(a.quantity||0),0);$('statAvailable').textContent=rows.filter(a=>a.status==='未使用').reduce((n,a)=>n+Number(a.quantity||0),0);$('statUse').textContent=rows.filter(a=>a.status==='使用中').reduce((n,a)=>n+Number(a.quantity||0),0);$('statRepair').textContent=rows.filter(a=>a.status==='修理中').reduce((n,a)=>n+Number(a.quantity||0),0);$('statDisposed').textContent=rows.filter(a=>a.status==='廃棄').reduce((n,a)=>n+Number(a.quantity||0),0); $('statPhoto').textContent=rows.filter(a=>a.photo_path).length;
    const recent=await db.from('assets').select('*').order('created_at',{ascending:false}).limit(5);if(recent.error)throw recent.error;renderAssetsTable(recent.data||[],'recentAssets',false);
  }
  async function loadAssets(){let q=db.from('assets').select('*').order('asset_no');const search=$('assetSearch').value.trim(),st=$('assetStatus').value,cat=$('assetCategory').value;if(st)q=q.eq('status',st);if(cat)q=q.eq('category',cat);if(search)q=q.or(`asset_no.ilike.%${search}%,name.ilike.%${search}%,manufacturer.ilike.%${search}%,model.ilike.%${search}%`);const r=await q;if(r.error)throw r.error;assets=r.data||[];renderAssetsTable(assets,'assetTable',true);openAssetFromUrlOnce();}
  function renderAssetsTable(rows,target,actions){if(!rows.length){$(target).innerHTML='<div class="empty">該当する備品がありません。</div>';return}$(target).innerHTML=`<table><thead><tr><th>備品番号</th><th>備品名</th><th>カテゴリ</th><th>保管場所</th><th>数量</th><th>状態</th>${actions?'<th>操作</th>':''}</tr></thead><tbody>${rows.map(a=>`<tr class="clickable" data-id="${a.id}"><td>${esc(a.asset_no)}</td><td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${esc(a.location||'-')}</td><td>${a.quantity}${esc(a.unit)}</td><td><span class="badge ${statusClass(a.status)}">${esc(a.status)}</span></td>${actions?`<td>${isManager()?`<button class="secondary edit-asset" data-id="${a.id}">編集</button>`:''}</td>`:''}</tr>`).join('')}</tbody></table>`;$(target).querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('.edit-asset'))return;showDetail(tr.dataset.id)});$(target).querySelectorAll('.edit-asset').forEach(b=>b.onclick=e=>{e.stopPropagation();openAssetForm(b.dataset.id)});}

  async function signedPhotoUrl(path){
    if(!path)return null;
    const cached=photoUrlCache.get(path); if(cached && cached.expires>Date.now())return cached.url;
    const {data,error}=await db.storage.from('asset-photos').createSignedUrl(path,3600);
    if(error){console.warn('photo signed url',error);return null}
    photoUrlCache.set(path,{url:data.signedUrl,expires:Date.now()+3500*1000});return data.signedUrl;
  }
  async function setPhotoPreview(path){
    const img=$('assetPhotoPreview');
    if(!img)return;
    if(!path){img.src='';img.classList.add('hidden');return}
    const url=await signedPhotoUrl(path);if(url){img.src=url;img.classList.remove('hidden')}else img.classList.add('hidden');
  }
  $('assetPhoto').addEventListener('change',()=>{
    pendingPhotoFile=$('assetPhoto').files?.[0]||null;
    const img=$('assetPhotoPreview');
    if(pendingPhotoFile){img.src=URL.createObjectURL(pendingPhotoFile);img.classList.remove('hidden')}
  });
  async function setLabelPhotoPreview(path){
    const img=$('assetLabelPhotoPreview');
    if(!img)return;
    if(!path){img.src='';img.classList.add('hidden');return}
    const url=await signedPhotoUrl(path);if(url){img.src=url;img.classList.remove('hidden')}else img.classList.add('hidden');
  }
  $('assetLabelPhoto').addEventListener('change',()=>{
    pendingLabelPhotoFile=$('assetLabelPhoto').files?.[0]||null;
    const img=$('assetLabelPhotoPreview');
    if(pendingLabelPhotoFile){img.src=URL.createObjectURL(pendingLabelPhotoFile);img.classList.remove('hidden')}
  });
  async function uploadAssetPhotoFile(assetId,file,oldPath,kind='outside'){
    if(!file)return oldPath||null;
    if(file.size>10*1024*1024)throw new Error('写真は1枚10MB以下にしてください。');
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
    const path=`${assetId}/${kind}-${Date.now()}.${ext}`;
    const {error}=await db.storage.from('asset-photos').upload(path,file,{contentType:file.type||undefined,upsert:false});
    if(error)throw error;
    if(oldPath){await db.storage.from('asset-photos').remove([oldPath]).catch(()=>{});photoUrlCache.delete(oldPath)}
    return path;
  }
  let openedAssetFromUrl=false;
  function showQrOpenError(message){
    go('assets');
    const notice=document.createElement('div');
    notice.setAttribute('role','alert');
    notice.className='error';
    notice.style.cssText='padding:12px;margin-bottom:12px;border:1px solid #e6adb1;border-radius:10px';
    notice.textContent=message;
    $('assetTable').prepend(notice);
  }
  async function openAssetFromUrlOnce(){
    if(openedAssetFromUrl)return;
    const id=new URL(location.href).searchParams.get('asset');
    if(!id)return;
    openedAssetFromUrl=true;
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
      showQrOpenError('QRコードの形式が正しくありません。');
      return;
    }
    try{
      let asset=assets.find(a=>String(a.id)===id);
      if(!asset){
        const {data,error}=await db.from('assets').select('*').eq('id',id).eq('is_deleted',false).maybeSingle();
        if(error)throw error;
        asset=data;
        if(asset)assets.push(asset);
      }
      if(!asset){showQrOpenError('該当する備品が見つかりません。削除済みの可能性があります。');return;}
      go('assets');
      await showDetail(asset.id);
    }catch(error){
      console.error('admin QR asset open',error);
      showQrOpenError('QRから備品を開けませんでした。通信状態を確認し、もう一度お試しください。');
    }
  }

  function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}
  $('assetSearch').oninput=debounce(loadAssets,300);$('assetStatus').onchange=loadAssets;$('assetCategory').onchange=loadAssets;
  function openAssetForm(id=null){
    $('assetForm').reset();
    pendingPhotoFile=null;pendingLabelPhotoFile=null;
    $('assetPhoto').value='';$('assetLabelPhoto').value='';
    $('assetPhotoPreview').classList.add('hidden');$('assetPhotoPreview').src='';
    $('assetLabelPhotoPreview').classList.add('hidden');$('assetLabelPhotoPreview').src='';
    $('assetId').value='';$('quantity').value=1;$('unit').value='個';
    $('statusForm').value='未使用';
    // Rebuild to remove any temporary legacy entry from the previous edit.
    refreshUserOptions();$('currentUserId').value='';
    $('acquisitionMethod').value='';
    if(id){
      const a=assets.find(x=>x.id===id);if(!a)return;
      $('assetDialogTitle').textContent='備品編集';
      $('assetId').value=a.id;$('assetNo').value=a.asset_no;$('assetName').value=a.name;
      $('assetCategoryForm').value=a.category_id||'';$('manufacturer').value=a.manufacturer||'';
      $('model').value=a.model||'';$('purchaseDate').value=a.purchase_date||'';
      $('acquisitionMethod').value=a.acquisition_method||parseAcquisitionMethod(a.note||a.notes);
      $('purchasePrice').value=a.purchase_price||'';
      $('locationForm').value=a.location_id||'';$('departmentForm').value=a.department_id||'';
      const master=assetUsers.find(u=>u.id===a.assigned_user_id);
      if(master){
        $('currentUserId').value=master.id;
      }else if(a.assigned_user_id||a.user_name){
        // Keep historical/inactive assignments intact unless the manager explicitly changes them.
        const legacy=document.createElement('option');
        legacy.value='legacy';
        legacy.textContent=(a.user_name||'使用者名不明')+'（旧データ：使用者マスタで選択し直せます）';
        legacy.dataset.name=a.user_name||'';
        legacy.dataset.masterId=a.assigned_user_id||'';
        $('currentUserId').appendChild(legacy);
        $('currentUserId').value='legacy';
      }
      $('quantity').value=a.quantity;$('unit').value=a.unit||'個';
      $('statusForm').value=a.status;$('note').value=parseUserNote(a.note||a.notes);
      setPhotoPreview(a.photo_path);setLabelPhotoPreview(a.label_photo_path);
    }else $('assetDialogTitle').textContent='備品登録';
    $('assetFormError').textContent='';$('assetDialog').showModal();
  }
  $('newAssetBtn').onclick=()=>openAssetForm();
  $('assetForm').addEventListener('submit',async e=>{
    e.preventDefault();$('assetFormError').textContent='';
    const id=$('assetId').value||null,cat=categories.find(x=>x.id===$('assetCategoryForm').value),loc=locations.find(x=>x.id===$('locationForm').value),dep=departments.find(x=>x.id===$('departmentForm').value),selectedUserId=$('currentUserId').value,user=assetUsers.find(x=>x.id===selectedUserId),legacyOption=selectedUserId==='legacy' ? $('currentUserId').selectedOptions[0] : null,legacyName=legacyOption?.dataset.name||null,legacyId=legacyOption?.dataset.masterId||null;
    const payload={asset_no:$('assetNo').value.trim(),name:$('assetName').value.trim(),category:cat?.name||'その他',category_id:cat?.id||null,manufacturer:$('manufacturer').value.trim()||null,model:$('model').value.trim()||null,purchase_date:$('purchaseDate').value||null,purchase_price:$('purchasePrice').value?Number($('purchasePrice').value):null,location:loc?.name||null,location_id:loc?.id||null,department:dep?.name||null,department_id:dep?.id||null,quantity:Number($('quantity').value),unit:$('unit').value.trim()||'個',status:$('statusForm').value,assigned_user_id:user?.id||legacyId||null,user_name:user?.name||legacyName||null,acquisition_method:$('acquisitionMethod').value.trim()||null,note:$('note').value.trim()||null};
    try{
      let assetId=id, oldPath=null;
      if(id){const old=assets.find(x=>String(x.id)===String(id));oldPath=old?.photo_path||null;const r=await db.from('assets').update(payload).eq('id',id).select('id').single();if(r.error)throw r.error;}
      else{const r=await db.from('assets').insert(payload).select('id').single();if(r.error)throw r.error;assetId=r.data.id;}
      if(pendingPhotoFile||pendingLabelPhotoFile){const old=assets.find(x=>String(x.id)===String(assetId));const photoPath=await uploadAssetPhotoFile(assetId,pendingPhotoFile,old?.photo_path||null,'outside');const labelPhotoPath=await uploadAssetPhotoFile(assetId,pendingLabelPhotoFile,old?.label_photo_path||null,'label');const r2=await db.from('assets').update({photo_path:photoPath,label_photo_path:labelPhotoPath}).eq('id',assetId);if(r2.error)throw r2.error;}
      $('assetDialog').close();pendingPhotoFile=null;pendingLabelPhotoFile=null;await loadAssets();await loadDashboard();
    }catch(err){console.error(err);$('assetFormError').textContent=err.message||'保存に失敗しました。'}
  });
  async function showDetail(id){
    const a=assets.find(x=>String(x.id)===String(id));if(!a)return;
    const rows=[['管理No.',a.asset_no],['名称',a.name],['メーカー',a.manufacturer||'-'],['取得年月日',a.purchase_date||'-'],['取得方法',a.acquisition_method||parseAcquisitionMethod(a.note||a.notes)||'-'],['取得単価',a.purchase_price?Number(a.purchase_price).toLocaleString()+'円':'-'],['購入部署',a.department||'-'],['使用・保管場所',a.location||'-'],['貸出先（使用者マスタ）',assetUsers.find(u=>u.id===a.assigned_user_id)?userNameForDisplay(assetUsers.find(u=>u.id===a.assigned_user_id)):(a.user_name||'-')],['ステータス',a.status],['備考',parseUserNote(a.note||a.notes)||'-']];
    $('assetDetail').innerHTML=`
      <div id="detailPhotos" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:16px">
        <div id="detailPhotoWrap" class="hidden"><small style="display:block;margin-bottom:5px;color:var(--muted);font-weight:700">外観</small><img id="detailPhoto" alt="${esc(a.name)}の外観写真" style="width:100%;height:190px;object-fit:contain;border-radius:14px;border:1px solid var(--line);background:#f8fafc"></div>
        <div id="detailLabelPhotoWrap" class="hidden"><small style="display:block;margin-bottom:5px;color:var(--muted);font-weight:700">ラベル・型番</small><img id="detailLabelPhoto" alt="${esc(a.name)}のラベル写真" style="width:100%;height:190px;object-fit:contain;border-radius:14px;border:1px solid var(--line);background:#f8fafc"></div>
      </div>
      <div class="detail-grid">${rows.map(x=>`<div class="detail-item"><small>${esc(x[0])}</small>${esc(x[1])}</div>`).join('')}</div>
      <div class="dialog-actions">${isManager()?`<button type="button" class="primary" id="detailEditBtn">編集</button>`:''}<button type="button" class="secondary" id="qrBtn" style="min-height:48px;position:relative;z-index:5">QR表示</button></div>
      <div id="qrArea" class="hidden" style="margin-top:14px;text-align:center;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff">
        <div style="font-weight:700;margin-bottom:8px">${esc(a.asset_no)} / ${esc(a.name)}</div>
        <canvas id="qrCanvas" style="max-width:100%"></canvas>
        <div id="qrError" class="form-error"></div>
      </div>`;
    $('detailDialog').showModal();
    if(isManager())$('detailEditBtn').addEventListener('click',()=>{$('detailDialog').close();openAssetForm(a.id)});
    const qrButton=$('qrBtn');
    qrButton.addEventListener('click',async(ev)=>{ev.preventDefault();ev.stopPropagation();await makeQR(a)});
    if(a.photo_path){const url=await signedPhotoUrl(a.photo_path);if(url&&$('detailPhoto')){$('detailPhoto').src=url;$('detailPhotoWrap').classList.remove('hidden')}}
    if(a.label_photo_path){const url=await signedPhotoUrl(a.label_photo_path);if(url&&$('detailLabelPhoto')){$('detailLabelPhoto').src=url;$('detailLabelPhotoWrap').classList.remove('hidden')}}
  }
  $('detailClose').onclick=()=>$('detailDialog').close();async function makeQR(a){
    const area=$('qrArea'), c=$('qrCanvas'), err=$('qrError');
    if(!area||!c)return;
    area.classList.remove('hidden');err.textContent='';
    const url=new URL(window.APP_BASE_URL||location.origin+location.pathname);url.pathname='/';url.searchParams.set('asset',a.id);
    try{
      if(!window.QRCode||typeof QRCode.toCanvas!=='function')throw new Error('QRライブラリを読み込めませんでした。ページを再読み込みしてください。');
      await QRCode.toCanvas(c,url.toString(),{width:240,margin:2,errorCorrectionLevel:'M'});
      area.scrollIntoView({behavior:'smooth',block:'nearest'});
    }catch(e){console.error(e);err.textContent=e.message||'QRコードを表示できませんでした。';}
  }
  async function loadHistory(){const r=await db.from('asset_history').select('*').order('created_at',{ascending:false}).limit(200);if(r.error)throw r.error;const rows=r.data||[];$('historyTable').innerHTML=rows.length?`<table><thead><tr><th>日時</th><th>備品</th><th>操作</th><th>内容</th></tr></thead><tbody>${rows.map(h=>`<tr><td>${new Date(h.created_at||Date.now()).toLocaleString('ja-JP')}</td><td>${esc(h.asset_id||'-')}</td><td>${esc(h.action||h.event_type||'-')}</td><td>${esc(h.note||h.description||'-')}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">履歴はありません。</div>';}
  async function loadAdmin(){const p=await db.from('profiles').select('id,name,email,role').eq('role','admin').order('name');$('profileTable').innerHTML=(p.data||[]).map(x=>`<div class="master-row"><span><strong>${esc(x.name||'名称未設定')}</strong><small> ${esc(x.email||'')}</small></span><span class="badge use">管理者</span></div>`).join('');[['categoryAdmin',categories],['locationAdmin',locations],['departmentAdmin',departments]].forEach(([id,list])=>$(id).innerHTML=list.map(x=>`<div class="master-row"><span>${esc(x.name)}</span></div>`).join(''));}
  // Keep the dropdown current after edits to the dedicated user master.
  document.addEventListener('asset-user-master-updated',()=>{if(db)loadMasters().catch(e=>console.warn('master refresh',e));});
  window.addEventListener('DOMContentLoaded',()=>{
    if(new URL(location.href).searchParams.has('asset')){
      const note=document.createElement('p');
      note.textContent='備品QRからのアクセスです。管理者ログイン後、該当する備品の詳細を開きます。';
      $('loginForm').before(note);
    }
    init();
  });
})();
