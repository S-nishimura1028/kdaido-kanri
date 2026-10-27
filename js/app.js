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
      $('connectionStatus').textContent='データ同期中…';
      $('userInfo').textContent=`${profile?.name||user.email} / ${roleLabel(profile?.role)}`;
      document.querySelectorAll('.admin-only').forEach(e=>e.classList.toggle('hidden',!isManager()));
      $('connectionStatus').textContent='データ同期中…';
      await loadMasters(); await loadDashboard(); await loadAssets(); await loadHistory();
      $('connectionStatus').textContent='Supabase接続OK';
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
    finally{btn.disabled=false;btn.textContent='管理者ログイン';}
  });
  $('logoutBtn').onclick=()=>db.auth.signOut();
  $('mobileLogoutBtn').onclick=()=>db.auth.signOut();
  document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=async()=>{
    const page=b.dataset.page;
    go(page);
    if(!db||!profile||profile.role!=='admin')return;
    // A manager may have changed equipment since the last visit.
    try{
      $('connectionStatus').textContent='最新情報を確認中…';
      if(page==='dashboard')await loadDashboard();
      else if(page==='assets')await loadAssets();
      else if(page==='history')await loadHistory();
      $('connectionStatus').textContent='Supabase接続OK';
    }catch(error){
      console.error('画面の再読込エラー',error);
      $('connectionStatus').textContent='再読込失敗';
      const holder=page==='assets'?'assetTable':page==='history'?'historyTable':null;
      if(holder&&$(holder))$(holder).textContent='データを更新できません。通信状態を確認して、もう一度この画面を開いてください。';
    }
  });
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
  $('mobileMenu').onclick=()=>document.querySelector('.sidebar').classList.toggle('open');
  function go(page){
    const titles={dashboard:'ダッシュボード',assets:'備品一覧',roomsDemo:'部屋管理（デモ）',history:'履歴',admin:'管理・履歴'};
    if(!titles[page]||!$(page+'Page'))return;
    document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
    $(page+'Page').classList.remove('hidden');
    $('pageTitle').textContent=titles[page];
    document.querySelectorAll('.nav-btn').forEach(b=>{
      const active=b.dataset.page===page;
      b.classList.toggle('active',active);
      if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    if(page==='admin'&&isManager())loadAdmin();
    document.querySelector('.main')?.scrollTo?.({top:0,behavior:'auto'});
    window.scrollTo({top:0,behavior:'auto'});
  }
  // Dashboard actions navigate directly, rather than simulating a click on
  // another (sometimes hidden) menu button. One handler owns all three cards.
  function openAssetStatus(status){
    window.DaidoAnalysisFilter=null;
    $('assetSearch').value='';
    $('assetCategory').value='';
    $('assetStatus').value=status;
    go('assets');
    $('assetStatus').dispatchEvent(new Event('change',{bubbles:true}));
    $('assetSearch').dispatchEvent(new Event('input',{bubbles:true}));
  }
  // The five dashboard KPIs are shortcuts to their corresponding lists.
  document.getElementById('dashboardPage')?.addEventListener('click',event=>{
    const card=event.target.closest('[data-dashboard-status]');
    if(card&&isManager())openAssetStatus(card.dataset.dashboardStatus);
  });
  document.getElementById('dashboardPage')?.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const card=event.target.closest('[data-dashboard-status]');
    if(!card||!isManager())return;
    event.preventDefault();
    openAssetStatus(card.dataset.dashboardStatus);
  });
  function runDashboardShortcut(action){
    if(!isManager())return;
    if(action==='available'){
      openAssetStatus('未使用');
    }else if(action==='analysis'){
      go('admin');
      document.querySelector('#workspaceAdminTabs [data-admin-tab="analysis"]')?.click();
      // Opening from a shortcut does not fire an admin navigation click;
      // refresh the analysis explicitly rather than displaying stale data.
      if(window.DaidoAnalysis?.render){
        Promise.resolve(window.DaidoAnalysis.render()).catch(error=>{
          console.error('備品分析の表示に失敗',error);
          const body=$('adminAnalysisBody');
          if(body)body.textContent='備品分析を表示できません。通信状態を確認して再試行してください。';
        });
      }
    }else if(action==='new'){
      window.DaidoAnalysisFilter=null;
      go('assets');
      openAssetForm();
    }
  }
  document.addEventListener('click',event=>{
    const b=event.target.closest('#workspaceDashboardShortcuts [data-shortcut]');
    if(!b)return;
    event.preventDefault();
    runDashboardShortcut(b.dataset.shortcut);
  });
  // Exact ID-scoped drill-down keeps similarly named equipment separate.
  // A new search or category choice leaves this special scope.
  window.DaidoAssetNav=Object.freeze({
    openFromAnalysis:({ids,status,label})=>{
      const safeIds=(ids||[]).filter(id=>/^[0-9a-f-]{36}$/i.test(id));
      if(!safeIds.length)return;
      window.DaidoAnalysisFilter={ids:new Set(safeIds),label:String(label||'選択した種類')};
      $('assetSearch').value='';
      $('assetCategory').value='';
      $('assetStatus').value=['使用中','未使用','修理中','廃棄'].includes(status)?status:'';
      go('assets');
      $('assetStatus').dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
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
    // Fetch every page: a dashboard that silently stops at 1,000 assets
    // would be unsafe for procurement and inventory decisions.
    const rows=[];
    const request=db.from('assets').select('status,quantity,photo_path').eq('is_deleted',false).order('id');
    for(let offset=0;;offset+=500){
      const r=await request.range(offset,offset+499);
      if(r.error)throw r.error;
      rows.push(...(r.data||[]));
      if((r.data||[]).length<500)break;
    }$('statTotal').textContent=rows.reduce((n,a)=>n+Number(a.quantity||0),0);$('statAvailable').textContent=rows.filter(a=>a.status==='未使用').reduce((n,a)=>n+Number(a.quantity||0),0);$('statUse').textContent=rows.filter(a=>a.status==='使用中').reduce((n,a)=>n+Number(a.quantity||0),0);$('statRepair').textContent=rows.filter(a=>a.status==='修理中').reduce((n,a)=>n+Number(a.quantity||0),0);$('statDisposed').textContent=rows.filter(a=>a.status==='廃棄').reduce((n,a)=>n+Number(a.quantity||0),0); $('statPhoto').textContent=rows.filter(a=>a.photo_path).length;
    const recent=await db.from('assets').select('*').eq('is_deleted',false).order('created_at',{ascending:false}).limit(5);if(recent.error)throw recent.error;renderAssetsTable(recent.data||[],'recentAssets',false);
  }
  let assetLoadSequence=0;
  async function loadAssets(){
    const thisLoad=++assetLoadSequence;
    const search=$('assetSearch').value.trim().normalize('NFKC').toLowerCase();
    const st=$('assetStatus').value,cat=$('assetCategory').value;
    const scopedIds=window.DaidoAnalysisFilter?.ids||null;
    let q=db.from('assets').select('*').eq('is_deleted',false).order('asset_no').order('id');
    if(st)q=q.eq('status',st);if(cat)q=q.eq('category',cat);
    const rows=[];
    for(let offset=0;;offset+=500){
      const r=await q.range(offset,offset+499);
      if(r.error)throw r.error;
      if(thisLoad!==assetLoadSequence)return;
      rows.push(...(r.data||[]));if((r.data||[]).length<500)break;
    }
    if(thisLoad!==assetLoadSequence)return;
    // Including current-user master and physical storage location in search.
    assets=rows.filter(a=>(!scopedIds||scopedIds.has(a.id))&&(!search||[a.asset_no,a.name,a.manufacturer,a.model,a.location,
      a.department,a.user_name,...(assetUsers.filter(u=>u.id===a.assigned_user_id)
        .flatMap(u=>[u.name,u.department,u.location,u.room_number]))]
      .some(v=>String(v||'').normalize('NFKC').toLowerCase().includes(search))));
    renderAssetsTable(assets,'assetTable',true);
    openAssetFromUrlOnce();
  }
  function renderAssetsTable(rows,target,actions){if(!rows.length){$(target).innerHTML='<div class="empty">該当する備品がありません。</div>';return}$(target).innerHTML=`<table><thead><tr><th>備品番号</th><th>備品名</th><th>カテゴリ</th><th>保管場所</th><th>数量</th><th>状態</th>${actions?'<th>操作</th>':''}</tr></thead><tbody>${rows.map(a=>`<tr class="clickable" data-id="${a.id}"><td>${esc(a.asset_no)}</td><td>${esc(a.name)}</td><td>${esc(a.category)}</td><td>${esc(a.location||'-')}</td><td>${a.quantity}${esc(a.unit)}</td><td><span class="badge ${statusClass(a.status)}">${esc(a.status)}</span></td>${actions?`<td>${isManager()?`<button class="secondary edit-asset" data-id="${a.id}" aria-label="${esc(a.asset_no)} ${esc(a.name)} の情報を編集">情報を編集</button>`:''}</td>`:''}</tr>`).join('')}</tbody></table>`;$(target).querySelectorAll('tr[data-id]').forEach(tr=>tr.onclick=e=>{if(e.target.closest('.edit-asset'))return;showDetail(tr.dataset.id)});$(target).querySelectorAll('.edit-asset').forEach(b=>b.onclick=e=>{e.stopPropagation();openAssetForm(b.dataset.id)});}

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
  async function uploadAssetPhotoFile(assetId,file,kind='outside'){
    if(file.size>10*1024*1024)throw new Error('写真は1枚10MB以下にしてください。');
    if(file.type&&!file.type.startsWith('image/'))throw new Error('画像ファイルを選択してください。');
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
    const path=`${assetId}/${kind}-${Date.now()}-${crypto.randomUUID().slice(0,8)}.${ext}`;
    const {error}=await db.storage.from('asset-photos').upload(path,file,{contentType:file.type||'image/jpeg',upsert:false});
    if(error)throw error;
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
  $('assetSearch').addEventListener('input',event=>{
    if(event.isTrusted)window.DaidoAnalysisFilter=null;
  });
  $('assetCategory').addEventListener('change',event=>{
    if(event.isTrusted)window.DaidoAnalysisFilter=null;
  });
  $('assetSearch').oninput=debounce(loadAssets,300);$('assetStatus').onchange=loadAssets;$('assetCategory').onchange=loadAssets;
  // One stable UUID per open create form makes network retries idempotent.
  // It is not reused for a new registration or an existing-asset edit.
  let pendingCreateId=null;
  function generateAssetCreateId(){
    const cryptoApi=window.crypto;
    if(cryptoApi?.randomUUID)return cryptoApi.randomUUID();
    if(!cryptoApi?.getRandomValues)throw new Error('安全な管理番号登録を開始できません。HTTPSで開き直してください。');
    const bytes=new Uint8Array(16);cryptoApi.getRandomValues(bytes);
    bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
    const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }
  function assignmentHint(){
    const hint=$('assetStatusHint');if(!hint)return;
    const used=Boolean($('currentUserId').value);
    const st=$('statusForm').value;
    hint.textContent=st==='使用中'&&!used
      ?'使用中にするには、使用者マスタから使用者を選択してください。'
      :used&&(st==='未使用'||st==='廃棄')
      ?'この状態では使用者を割り当てられません。返却や引継ぎを確認して使用者を解除してください。'
      :st==='修理中'
      ?'修理中は使用者を保持できます。修理完了・返却時に状態を確認してください。'
      :'使用者を選ぶと、未使用から使用中へ自動切替します。返却時は現物確認後に状態も変更してください。';
    hint.classList.toggle('workspace-field-warning',(st==='使用中'&&!used)||(used&&(st==='未使用'||st==='廃棄')));
  }
  $('currentUserId').addEventListener('change',()=>{
    if($('currentUserId').value&&$('statusForm').value==='未使用'){
      $('statusForm').value='使用中';
      assignmentHint();
      $('assetStatusHint').textContent='使用者を選択したため、ステータスを「使用中」に切り替えました。';
    }else assignmentHint();
  });
  function updateDisposalReasonField(){
    const id=$('assetId').value||null;
    const existing=id?assets.find(a=>String(a.id)===String(id)):null;
    const requireReason=$('statusForm').value==='廃棄'&&(!existing||existing.status!=='廃棄');
    const box=$('assetDisposalReasonField'),field=$('assetDisposalReason');
    if(box)box.classList.toggle('hidden',!requireReason);
    if(field)field.required=requireReason;
  }
  $('statusForm').addEventListener('change',()=>{assignmentHint();updateDisposalReasonField();});
  function openAssetForm(id=null){
    $('assetForm').reset();
    pendingCreateId=id?null:generateAssetCreateId();
    pendingPhotoFile=null;pendingLabelPhotoFile=null;
    $('assetPhoto').value='';$('assetLabelPhoto').value='';
    $('assetPhotoPreview').classList.add('hidden');$('assetPhotoPreview').src='';
    $('assetLabelPhotoPreview').classList.add('hidden');$('assetLabelPhotoPreview').src='';
    $('assetId').value='';$('quantity').value=1;$('unit').value='個';
    $('assetNo').value='';$('assetNo').readOnly=true;
    $('assetNo').placeholder='保存すると自動で付番されます';
    $('statusForm').value='未使用';
    $('assetDisposalReason').value='';
    // Rebuild to remove any temporary legacy entry from the previous edit.
    refreshUserOptions();$('currentUserId').value='';
    $('acquisitionMethod').value='';
    if(id){
      const a=assets.find(x=>x.id===id);if(!a)return;
      $('assetDialogTitle').textContent='備品情報を編集';
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
    }else $('assetDialogTitle').textContent='新しい備品を登録';
    $('saveAssetBtn').textContent=id?'変更を保存':'備品を登録';
    // Existing equipment assignments are changed only by the confirmed QR
    // lending/returning flow or the dedicated direct-transfer action.
    $('currentUserId').disabled=Boolean(id);
    const userHelp=$('currentUserId').closest('label')?.querySelector('small');
    if(userHelp)userHelp.textContent=id
      ?'既存備品の貸出・返却は「QRクイック操作」、直接引継ぎは「使用者変更」から行ってください。'
      :'名前・所属部署・居住場所・部屋番号は管理画面の使用者マスタで管理します。';
    assignmentHint();
    updateDisposalReasonField();
    $('assetFormError').textContent='';$('assetDialog').showModal();
  }
  $('newAssetBtn').onclick=()=>openAssetForm();
  // If the connection drops after a successful UPDATE, confirm the server
  // state before suggesting another save. A matching timestamp change and
  // every expected field are both required; a stale editor is not a success.
  function editedAssetMatches(actual,payload,original){
    if(!actual||actual.is_deleted!==false||!actual.updated_at||
       !original?.updated_at||actual.updated_at===original.updated_at)return false;
    return Object.entries(payload).every(([field,expected])=>{
      const value=actual[field];
      if(value==null||expected==null)return value==null&&expected==null;
      if(field==='purchase_price'||field==='quantity')return Number(value)===Number(expected);
      return String(value)===String(expected);
    });
  }
  async function verifyEditedAssetSaved(id,payload,original){
    try{
      const columns=[...Object.keys(payload),'updated_at','is_deleted'].join(',');
      const {data,error}=await db.from('assets').select(columns)
        .eq('id',id).eq('is_deleted',false).maybeSingle();
      return !error&&editedAssetMatches(data,payload,original);
    }catch(_e){return false;}
  }
  let assetFormSaving=false;
  // Cancel/close must never submit the form. Ignore close actions while a
  // network save is in progress, including the native Escape-key event.
  function closeAssetFormSafely(){
    if(!assetFormSaving)$('assetDialog').close();
  }
  $('assetFormCloseBtn').addEventListener('click',closeAssetFormSafely);
  $('assetFormCancelBtn').addEventListener('click',closeAssetFormSafely);
  $('assetDialog').addEventListener('cancel',e=>{
    if(assetFormSaving)e.preventDefault();
  });
  $('assetForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(assetFormSaving)return;
    assetFormSaving=true;
    const saveButton=$('saveAssetBtn');
    if(saveButton){saveButton.disabled=true;saveButton.textContent='保存しています…';}
    $('assetFormError').textContent='';
    const id=$('assetId').value||null,cat=categories.find(x=>x.id===$('assetCategoryForm').value),loc=locations.find(x=>x.id===$('locationForm').value),dep=departments.find(x=>x.id===$('departmentForm').value),selectedUserId=$('currentUserId').value,user=assetUsers.find(x=>x.id===selectedUserId),legacyOption=selectedUserId==='legacy' ? $('currentUserId').selectedOptions[0] : null,legacyName=legacyOption?.dataset.name||null,legacyId=legacyOption?.dataset.masterId||null;
    const payload={asset_no:id?($('assetNo').value.trim()||null):null,name:$('assetName').value.trim(),category:cat?.name||'その他',category_id:cat?.id||null,manufacturer:$('manufacturer').value.trim()||null,model:$('model').value.trim()||null,purchase_date:$('purchaseDate').value||null,purchase_price:$('purchasePrice').value?Number($('purchasePrice').value):null,location:loc?.name||null,location_id:loc?.id||null,department:dep?.name||null,department_id:dep?.id||null,quantity:Number($('quantity').value),unit:$('unit').value.trim()||'個',status:$('statusForm').value,assigned_user_id:user?.id||legacyId||null,user_name:user?.name||legacyName||null,acquisition_method:$('acquisitionMethod').value.trim()||null,note:$('note').value.trim()||null};
    const uploaded=[];let inserted=false,photoCommitted=false,saveCommitted=false,assetId=id;
    try{
      // Client-side explanation; the database independently enforces the rule.
      const original=id?assets.find(a=>String(a.id)===String(id)):null;
      if(payload.status==='廃棄'&&(!id||original?.status!=='廃棄')){
        const reason=$('assetDisposalReason').value.trim();
        if(reason.length<5)throw new Error('廃棄理由を5文字以上で入力してください。');
        payload.note=[payload.note,'【廃棄理由】'+reason].filter(Boolean).join('\n');
      }
      if(payload.status==='使用中'&&!payload.assigned_user_id){
        throw new Error('「使用中」にするには、使用者マスタから使用者を選択してください。');
      }
      if((payload.status==='未使用'||payload.status==='廃棄')&&payload.assigned_user_id){
        throw new Error('「未使用」「廃棄」にする前に、現物の返却・引継ぎを確認して使用者を解除してください。');
      }
      if(id){
        if(!original)throw new Error('変更前の備品情報が見つかりません。備品一覧を開き直してください。');
        // Prevent the ordinary editor from bypassing physical inspection and
        // the dedicated, audited lending/return/transfer confirmations.
        if((payload.assigned_user_id||null)!==(original.assigned_user_id||null)){
          throw new Error('使用者の変更は通常編集では保存できません。備品詳細のQR貸出・返却、または「使用者変更」を使ってください。');
        }
        if(original.status==='未使用'&&payload.status==='使用中'){
          throw new Error('貸出は備品詳細の「貸し出す」から現物を確認して登録してください。');
        }
        if(original.status==='使用中'&&payload.status==='未使用'){
          throw new Error('返却は備品詳細の「返却を確認」から現物と状態を確認して登録してください。');
        }
        const changes=[];
        if(original.status!==payload.status)changes.push('ステータス：'+original.status+' → '+payload.status);
        if((original.location_id||null)!==(payload.location_id||null))
          changes.push('保管場所：'+(original.location||'未設定')+' → '+(payload.location||'未設定'));
        if(changes.length && !window.confirm(
          (original.asset_no||'管理No.なし')+' / '+(original.name||'備品')+
          '\n\n重要な変更を保存しますか？\n'+changes.join('\n')+
          (payload.status==='廃棄'&&original.status!=='廃棄'?'\n廃棄理由：'+$('assetDisposalReason').value.trim():'')+
          '\n\n現物の状態と場所を確認してから確定してください。'
        ))return;
        // Compare the original row timestamp atomically at the update. A
        // stale edit must never overwrite another manager's QR transfer,
        // return, photo update, or other changes.
        let request=db.from('assets').update(payload).eq('id',id).eq('is_deleted',false);
        if(original.updated_at)request=request.eq('updated_at',original.updated_at);
        request=request.eq('status',original.status);
        request=original.assigned_user_id
          ?request.eq('assigned_user_id',original.assigned_user_id)
          :request.is('assigned_user_id',null);
        let r;
        try{r=await request.select('id').maybeSingle();}
        catch(requestError){r={error:requestError};}
        if(r.error){
          if(!(await verifyEditedAssetSaved(id,payload,original))){
            throw new Error('保存結果を確認できませんでした。再度保存する前に一覧で最新の備品情報を確認してください。詳細：'+(r.error.message||'通信エラー'));
          }
        }else if(!r.data){
          throw new Error('別の管理者が備品情報を更新しています。再度一覧を開いて最新の内容を確認してください。');
        }
        saveCommitted=true;
      }else{
        // The PK is generated once for this form, not once per click/retry.
        assetId=pendingCreateId||generateAssetCreateId();
        pendingCreateId=assetId;
        const r=await db.from('assets').insert({...payload,id:assetId}).select('id').single();
        if(r.error){
          // A timeout can occur after the server successfully committed.
          // Read by *our own UUID* before claiming the insert failed.
          const existing=await db.from('assets')
            .select(['id','is_deleted',...Object.keys(payload)].join(','))
            .eq('id',assetId).eq('is_deleted',false).maybeSingle();
          if(existing.error||!existing.data)throw r.error;
          // A retry may contain changed fields after an earlier response was
          // lost. The name alone cannot prove that those new values persisted.
          // asset_no is generated by the server for a new registration.
          const matches=existing.data.is_deleted===false&&Object.entries(payload).every(([field,expected])=>{
            if(field==='asset_no')return true;
            const value=existing.data[field];
            if(value==null||expected==null)return value==null&&expected==null;
            if(field==='purchase_price'||field==='quantity')return Number(value)===Number(expected);
            return String(value)===String(expected);
          });
          if(!matches){
            throw new Error('同じ登録操作はすでに別の内容で保存されています。管理番号を確認してから編集してください。');
          }
          assetId=existing.data.id;
        }else{
          assetId=r.data.id;
        }
        inserted=true;saveCommitted=true;
      }
      if(pendingPhotoFile||pendingLabelPhotoFile){
        const old=assets.find(x=>String(x.id)===String(assetId));
        const oldPhoto=old?.photo_path||null,oldLabel=old?.label_photo_path||null;
        let photoPath=oldPhoto,labelPhotoPath=oldLabel;
        if(pendingPhotoFile){
          photoPath=await uploadAssetPhotoFile(assetId,pendingPhotoFile,'outside');
          uploaded.push(photoPath);
        }
        if(pendingLabelPhotoFile){
          labelPhotoPath=await uploadAssetPhotoFile(assetId,pendingLabelPhotoFile,'label');
          uploaded.push(labelPhotoPath);
        }
        // Old files stay available until all new uploads and DB changes succeed.
        const r2=await db.rpc('update_asset_photos_checked',{
          p_asset_id:assetId,
          p_photo_path:photoPath,
          p_label_photo_path:labelPhotoPath,
          p_expected_photo_path:oldPhoto,
          p_expected_label_photo_path:oldLabel
        });
        if(r2.error)throw r2.error;
        photoCommitted=true;
        const oldPaths=[pendingPhotoFile&&oldPhoto,pendingLabelPhotoFile&&oldLabel].filter(Boolean);
        if(oldPaths.length){
          const removed=await db.storage.from('asset-photos').remove(oldPaths);
          if(removed.error)console.warn('old photo cleanup',removed.error);
          else oldPaths.forEach(p=>photoUrlCache.delete(p));
        }
      }
      $('assetDialog').close();pendingPhotoFile=null;pendingLabelPhotoFile=null;
      pendingCreateId=null;
      await loadAssets();await loadDashboard();
    }catch(err){
      if(uploaded.length&&!photoCommitted){
        try{
          // On a network error the DB update might already be committed.
          // Only remove uploads that are demonstrably unreferenced.
          const {data:current, error:readError}=await db.from('assets')
            .select('photo_path,label_photo_path').eq('id',id||assetId).maybeSingle();
          if(!readError&&current){
            const referenced=new Set([current.photo_path,current.label_photo_path].filter(Boolean));
            const abandoned=uploaded.filter(p=>!referenced.has(p));
            if(abandoned.length){
              const cleanup=await db.storage.from('asset-photos').remove(abandoned);
              if(cleanup.error)console.warn('new photo cleanup',cleanup.error);
            }
          }
        }catch(e){console.warn('new photo cleanup skipped',e);}
      }
      console.error(err);
      $('assetFormError').textContent=(saveCommitted?'備品情報は保存されました。再登録せず一覧を確認してください。 ':'')+
        (err.message||'保存に失敗しました。');
    }finally{
      assetFormSaving=false;
      if(saveButton){saveButton.disabled=false;saveButton.textContent=$('assetId').value?'変更を保存':'備品を登録';}
    }
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
      <div class="dialog-actions">${isManager()?`<button type="button" class="primary" id="detailEditBtn">情報を編集</button>`:''}<button type="button" class="secondary" id="qrBtn" style="min-height:48px;position:relative;z-index:5">QRコードを表示</button></div>
      <div id="qrArea" class="hidden" style="margin-top:14px;text-align:center;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff">
        <div style="font-weight:700;margin-bottom:8px">${esc(a.asset_no)} / ${esc(a.name)}</div>
        <canvas id="qrCanvas" style="max-width:100%"></canvas>
        <div id="qrError" class="form-error"></div>
      </div>`;
    $('detailDialog').dataset.assetId=String(a.id);
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
  async function loadHistory(){
    const rows=[];
    for(let offset=0;;offset+=500){
      const res=await db.from('asset_history').select(
        'asset_id,asset_no_snapshot,asset_name_snapshot,action,user_name,note,created_at,before_status,after_status,disposal_note:after_data->>note'
      ).order('created_at',{ascending:false}).range(offset,offset+499);
      if(res.error)throw res.error;
      rows.push(...(res.data||[]));
      if((res.data||[]).length<500)break;
    }
    const target=$('historyTable');
    if(!rows.length){
      target.innerHTML='<div class="empty">履歴はありません。</div>';
      return;
    }
    // Older history rows do not always store the management number. Resolve
    // those from the existing asset master for display only, including soft-
    // deleted assets. Do not rewrite or falsify any historical snapshots.
    const missing=rows.some(h=>!h.asset_no_snapshot||!h.asset_name_snapshot);
    const assetLookup=new Map();
    if(missing){
      try{
        const request=db.from('assets').select('id,asset_no,name').order('id');
        for(let offset=0;;offset+=500){
          const r=await request.range(offset,offset+499);
          if(r.error)throw r.error;
          (r.data||[]).forEach(a=>assetLookup.set(String(a.id),a));
          if((r.data||[]).length<500)break;
        }
      }catch(error){
        console.warn('過去の備品番号の補完ができませんでした',error);
      }
    }
    target.innerHTML='<table><thead><tr><th>日時</th><th>備品</th><th>操作</th><th>内容・担当</th></tr></thead><tbody>'+
      rows.map(h=>{
        const original=assetLookup.get(String(h.asset_id));
        const number=h.asset_no_snapshot||original?.asset_no||'番号未記録';
        const name=h.asset_name_snapshot||original?.name||'備品名未記録';
        const time=h.created_at?new Date(h.created_at).toLocaleString('ja-JP'):'日時未記録';
        // Keep the disposal reason visible without fetching full JSON history
        // snapshots (PostgREST projects only the note field from after_data).
        const reason=h.action==='廃棄'
          ?String(h.disposal_note||'').match(/【廃棄理由】([^\r\n]+)/)?.[1]?.trim()
          :null;
        const detail=h.note||(reason?'廃棄理由：'+reason:(
          h.before_status!==h.after_status && h.before_status && h.after_status?
          h.before_status+' → '+h.after_status:'変更履歴'
        ));
        const who=h.user_name?' <small class="workspace-history-actor">操作担当：'+esc(h.user_name)+'</small>':'';
        return '<tr data-asset-id="'+esc(h.asset_id||'')+
          '" data-asset-no="'+esc(number==='番号未記録'?'':number)+
          '" data-asset-name="'+esc(name==='備品名未記録'?'':name)+
          '"><td data-label="日時">'+esc(time)+'</td>'+
          '<td data-label="備品"><strong class="workspace-history-name">'+esc(number)+
          '</strong><small class="workspace-history-asset">'+esc(name)+'</small></td>'+
          '<td data-label="操作">'+esc(h.action||'-')+'</td>'+
          '<td data-label="内容">'+esc(detail)+who+'</td></tr>';
      }).join('')+'</tbody></table>';
  }
  async function loadAdmin(){const p=await db.from('profiles').select('id,name,email,role').eq('role','admin').order('name');$('profileTable').innerHTML=(p.data||[]).map(x=>`<div class="master-row"><span><strong>${esc(x.name||'名称未設定')}</strong><small> ${esc(x.email||'')}</small></span><span class="badge use">管理者</span></div>`).join('');[['categoryAdmin',categories],['locationAdmin',locations],['departmentAdmin',departments]].forEach(([id,list])=>$(id).innerHTML=list.map(x=>`<div class="master-row"><span>${esc(x.name)}</span></div>`).join(''));}
  // Narrow bridge for QR operations: reuse the authenticated client and the
  // existing render/refresh path instead of maintaining a competing cache.
  window.DaidoQrBridge=Object.freeze({
    getClient:()=>db,
    refreshHistory:()=>loadHistory(),
    refreshAsset:async id=>{
      await loadMasters();
      await loadAssets();
      await loadDashboard();
      await loadHistory();
      const res=await db.from('assets').select('*').eq('id',id).eq('is_deleted',false).maybeSingle();
      if(res.error)throw res.error;
      if($('detailDialog').open)$('detailDialog').close();
      if(res.data){
        const index=assets.findIndex(a=>a.id===id);
        if(index<0)assets.push(res.data);else assets[index]=res.data;
        await showDetail(id);
      }
    }
  });
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
