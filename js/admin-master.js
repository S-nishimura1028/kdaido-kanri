(function(){
  'use strict';
  let client=null,rendering=false,guarding=false,userGroups=[];
  const userMasterFilters={query:'',department:'',location:''};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  const defs=[
    {table:'categories',host:'categoryAdmin',title:'カテゴリ'},
    {table:'locations',host:'locationAdmin',title:'保管場所'},
    {table:'departments',host:'departmentAdmin',title:'部署'}
  ];

  async function currentProfile(){
    const c=db();if(!c)return null;
    const {data:{session}}=await c.auth.getSession();if(!session)return null;
    const {data}=await c.from('profiles').select('id,name,email,role').eq('id',session.user.id).maybeSingle();
    return data||null;
  }

  async function isAdmin(){return (await currentProfile())?.role==='admin';}

  async function enforceAdminOnly(){
    if(guarding||window.PUBLIC_ASSET_MODE)return;
    guarding=true;
    try{
      const c=db();if(!c)return;
      const {data:{session}}=await c.auth.getSession();if(!session)return;
      const {data:p}=await c.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
      if(!p||p.role!=='admin'){
        await c.auth.signOut();
        document.getElementById('appView')?.classList.add('hidden');
        document.getElementById('loginView')?.classList.remove('hidden');
        const err=document.getElementById('loginError');
        if(err)err.textContent='このアプリとQRからの備品情報表示は管理者ログインが必要です。管理者にお問い合わせください。';
      }
    }catch(e){console.warn('admin guard',e)}finally{guarding=false;}
  }

  function ensureStyles(){
    if(document.getElementById('adminMasterStyle'))return;
    const s=document.createElement('style');s.id='adminMasterStyle';
    s.textContent=`.master-actions{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.master-mini{border:0;border-radius:8px;padding:7px 10px;font-weight:700;background:#edf4f2;color:#355e55}.master-mini.danger{background:#f8eceb;color:#9b2c22}.master-mini.promote{background:#e8f1fb;color:#075b9b}.master-add{margin-left:auto}.master-row strong{overflow-wrap:anywhere}.admin-account-note{font-size:13px;color:var(--muted);line-height:1.6;padding:2px 0 12px}.admin-account-meta{display:block;color:var(--muted);font-size:12px;margin-top:3px}.user-admin-assets{display:block;color:var(--muted);font-size:12px;margin-top:4px;line-height:1.5}.user-admin-count{font-size:11px;font-weight:800;padding:4px 8px;border-radius:999px;background:#e8f5ec;color:#166534}.admin-create-overlay{position:fixed;inset:0;z-index:4000;background:rgba(4,30,47,.58);display:grid;place-items:center;padding:16px;backdrop-filter:blur(3px)}.admin-create-card{width:min(500px,95vw);background:#fff;border:1px solid #dbe8e3;border-radius:18px;padding:20px;box-shadow:0 28px 80px rgba(0,0,0,.28)}.admin-create-card h3{margin:0 0 6px;color:#173f59}.admin-create-card p{margin:0 0 16px;color:var(--muted);font-size:13px;line-height:1.6}.admin-create-card label{display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px;margin-bottom:12px}.admin-create-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}.admin-create-actions button{min-height:46px}.password-line{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.password-line button{min-height:44px}.admin-create-error{color:var(--danger);font-size:13px;min-height:18px;margin-top:8px}@media(max-width:600px){.password-line{grid-template-columns:1fr}.admin-create-actions{display:grid;grid-template-columns:1fr 1fr}.admin-create-card{padding:18px}}`;

    s.textContent+=`.admin-grid>.panel:has(#userMasterAdmin){display:none!important}\n    .user-master-inline-editor{grid-column:1/-1;scroll-margin-top:24px;margin:0 0 14px 0;position:relative;z-index:1}
    .user-master-inline-card{width:100%;max-height:none;box-shadow:none;border:2px solid #aacbd9;background:#f8fbfe;border-radius:12px}
    .user-master-inline-card .admin-create-actions{margin-top:16px}
    .user-master-panel{grid-column:1/-1;min-width:0}
    .user-master-panel .panel-head{flex-wrap:wrap;align-items:flex-start}
    .user-master-info{font-size:13px;color:var(--muted);line-height:1.65;margin:0 0 15px}
    .user-master-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:0 0 12px}
    .user-master-toolbar label{display:flex;flex-direction:column;gap:5px;font-weight:700;font-size:12px;color:#42566b}
    .user-master-toolbar label:first-child{flex:2;min-width:200px}
    .user-master-toolbar label:not(:first-child){flex:1;min-width:145px}
    .user-master-toolbar input,.user-master-toolbar select{width:100%;min-height:42px;border:1px solid #cfdae5;border-radius:9px;padding:9px;background:#fff;color:#173047}
    .user-master-count{font-size:12px;color:var(--muted);margin:0 0 9px}
    .user-master-list{display:block}
    .user-master-head,.user-master-row{display:grid;grid-template-columns:minmax(150px,1.4fr) minmax(110px,.85fr) minmax(125px,1fr) minmax(85px,.65fr) minmax(95px,.9fr) minmax(122px,.9fr);gap:10px;align-items:center}
    .user-master-head{font-size:12px;font-weight:800;color:#475569;background:#f0f5f8;border-radius:8px;padding:12px}
    .user-master-row{font-size:13px;padding:14px 12px;border-bottom:1px solid var(--line)}
    .user-master-row:hover{background:#f8fbfc}
    .user-master-row strong{overflow-wrap:anywhere;color:#173047;font-size:14px}
    .user-master-cell{min-width:0;overflow-wrap:anywhere}
    .user-master-muted{color:#9aa8b6}
    .user-master-asset-detail{font-size:11px;color:var(--muted);margin-top:5px;line-height:1.4}
    .user-master-row .master-actions{justify-content:flex-start}
    .user-editor-card{width:min(670px,96vw);max-height:90vh;overflow-y:auto}
    .user-editor-card h3{font-size:20px}
    .user-editor-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px}
    .user-editor-grid label{margin:0}
    .user-editor-grid input{width:100%;min-height:45px;border:1px solid #cfdae5;border-radius:9px;padding:9px 11px;font-size:16px;background:#fff;color:#19354a}
    .user-editor-grid input:focus{outline:2px solid #84b5ce;outline-offset:1px}
    .user-editor-tip{font-size:12px;color:var(--muted);line-height:1.65;padding:12px;background:#f4f8fb;border-radius:9px;margin:14px 0 0}
    .user-editor-error{color:#b42318;min-height:18px;margin-top:9px;font-size:13px}
    @media(max-width:960px){.user-master-head{display:none}.user-master-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;background:#fafcfe;border:1px solid var(--line);border-radius:12px;margin-bottom:10px;padding:14px}.user-master-cell:before{content:attr(data-label);display:block;font-weight:800;font-size:11px;color:#63778a;margin-bottom:4px}.user-master-row .user-master-name,.user-master-row .user-master-actions-cell{grid-column:1/-1}.user-master-row .master-actions{justify-content:flex-end}.user-master-list{padding-top:4px}}
    @media(max-width:580px){.user-editor-grid{grid-template-columns:1fr}.user-master-row .master-actions{justify-content:flex-start}.user-master-panel{padding:12px}.user-master-panel .panel-head button{width:100%}}
    `;
    document.head.appendChild(s);
  }

  function ensureUserPanel(){
    if(document.getElementById('userAdmin'))return;
    const grid=document.querySelector('#adminPage .admin-grid');if(!grid)return;
    const panel=document.createElement('div');panel.className='panel user-master-panel';
    panel.innerHTML='<div class="panel-head"><h3>使用者マスタ</h3><button type="button" class="primary" id="addAssetUserBtn">＋ 使用者を登録</button></div>'+
      '<p class="user-master-info">使用者の氏名・部署・居住場所・部屋番号をまとめて管理します。「情報を編集」で4項目を更新できます。編集内容はシールには印字されません。</p>'+
      '<div class="user-master-toolbar"><label>名前・部署・居住場所・部屋番号で検索<input id="userMasterSearch" placeholder="例：カイン／薄場寮／205" aria-label="使用者の検索"></label>'+
      '<label>所属部署<select id="userMasterDepartmentFilter"><option value="">すべての部署</option></select></label>'+
      '<label>居住場所<select id="userMasterLocationFilter"><option value="">すべての場所</option></select></label></div>'+
      '<div class="user-master-count" id="userMasterCount" aria-live="polite"></div><div id="userAdmin" class="user-master-list"></div>';
    const first=grid.querySelector('.panel');
    if(first?.nextSibling)grid.insertBefore(panel,first.nextSibling);else grid.appendChild(panel);
  }

  function ensureAdminCreateButton(){
    const host=document.getElementById('profileTable');
    const head=host?.closest('.panel')?.querySelector('.panel-head');
    if(!head||document.getElementById('addAdminAccountBtn'))return;
    const b=document.createElement('button');
    b.type='button';b.id='addAdminAccountBtn';b.className='primary';b.textContent='＋ 管理者を追加';
    head.appendChild(b);
  }

  function generatePassword(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const symbols='!@#$%';
    const bytes=new Uint32Array(12);crypto.getRandomValues(bytes);
    let out='';for(let i=0;i<10;i++)out+=chars[bytes[i]%chars.length];
    out+=symbols[bytes[10]%symbols.length]+String(bytes[11]%10);
    return out;
  }

  function openAdminPasswordDialog(target){
    document.getElementById('adminPasswordOverlay')?.remove();
    const overlay=document.createElement('div');overlay.id='adminPasswordOverlay';overlay.className='admin-create-overlay';
    const card=document.createElement('div');card.className='admin-create-card';
    card.innerHTML=`<h3>管理者パスワード変更</h3><p><strong>${esc(target.name||'管理者')}</strong><br>${esc(target.email||'')}</p><div class="password-line"><label style="margin:0">新しいパスワード<input id="adminResetPassword" type="password" autocomplete="new-password" placeholder="8文字以上"></label><button type="button" class="secondary" id="generateResetPasswordBtn">自動生成</button></div><label style="margin-top:12px">確認入力<input id="adminResetPasswordConfirm" type="password" autocomplete="new-password" placeholder="もう一度入力"></label><div style="font-size:12px;color:var(--muted);margin-top:7px">変更後は新しいパスワードを本人へ安全な方法で伝えてください。</div><div id="adminResetError" class="admin-create-error"></div><div class="admin-create-actions"><button type="button" class="secondary" id="cancelAdminResetBtn">キャンセル</button><button type="button" class="primary" id="saveAdminResetBtn">パスワードを変更</button></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const password=card.querySelector('#adminResetPassword');
    const confirmPw=card.querySelector('#adminResetPasswordConfirm');
    const err=card.querySelector('#adminResetError');
    const save=card.querySelector('#saveAdminResetBtn');
    card.querySelector('#generateResetPasswordBtn').onclick=()=>{const pw=generatePassword();password.type='text';confirmPw.type='text';password.value=pw;confirmPw.value=pw;password.focus();password.select();};
    card.querySelector('#cancelAdminResetBtn').onclick=()=>overlay.remove();
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    save.onclick=async()=>{
      err.textContent='';
      const pw=password.value,cpw=confirmPw.value;
      if(pw.length<8){err.textContent='新しいパスワードは8文字以上にしてください。';password.focus();return;}
      if(pw!==cpw){err.textContent='確認用パスワードが一致しません。';confirmPw.focus();return;}
      save.disabled=true;save.textContent='変更中…';
      try{
        const c=db();if(!c)throw new Error('Supabaseに接続できません。');
        const {data:sessionData,error:sessionError}=await c.auth.getSession();
        if(sessionError)throw sessionError;
        const token=sessionData?.session?.access_token;
        if(!token)throw new Error('ログイン情報を確認できません。再ログインしてください。');
        const {data,error}=await c.functions.invoke('admin-users',{body:{action:'reset_password',target_user_id:target.id,password:pw},headers:{Authorization:`Bearer ${token}`}});
        if(error){let message=error.message||'パスワードを変更できませんでした。';try{const details=await error.context?.json?.();if(details?.error)message=details.error;}catch(_e){}throw new Error(message);}
        if(data?.error)throw new Error(data.error);
        alert(`${target.name||target.email||'管理者'} のパスワードを変更しました。\n新しいパスワードを本人へ伝えてください。`);
        overlay.remove();
      }catch(e){err.textContent=e.message||'パスワードを変更できませんでした。';}
      finally{if(document.body.contains(save)){save.disabled=false;save.textContent='パスワード変更';}}
    };
    password.focus();
  }

  function openAdminCreateDialog(){
    document.getElementById('adminCreateOverlay')?.remove();
    const overlay=document.createElement('div');overlay.id='adminCreateOverlay';overlay.className='admin-create-overlay';
    const card=document.createElement('div');card.className='admin-create-card';
    card.innerHTML=`<h3>管理者アカウントを追加</h3><p>作成したアカウントはすぐに管理者としてログインできます。一般社員用アカウントは作成しません。</p><label>表示名<input id="newAdminName" autocomplete="name" placeholder="例：西村"></label><label>メールアドレス<input id="newAdminEmail" type="email" autocomplete="email" placeholder="example@company.jp"></label><div class="password-line"><label style="margin:0">初期パスワード<input id="newAdminPassword" type="text" autocomplete="new-password" placeholder="8文字以上"></label><button type="button" class="secondary" id="generateAdminPasswordBtn">自動生成</button></div><div style="font-size:12px;color:var(--muted);margin-top:7px">初回ログイン用のパスワードです。作成後、本人へ安全な方法で伝えてください。</div><div id="adminCreateError" class="admin-create-error"></div><div class="admin-create-actions"><button type="button" class="secondary" id="cancelAdminCreateBtn">キャンセル</button><button type="button" class="primary" id="saveAdminCreateBtn">管理者を作成</button></div>`;
    overlay.appendChild(card);document.body.appendChild(overlay);
    const name=card.querySelector('#newAdminName'),email=card.querySelector('#newAdminEmail'),password=card.querySelector('#newAdminPassword');
    card.querySelector('#generateAdminPasswordBtn').onclick=()=>{password.value=generatePassword();password.focus();password.select();};
    card.querySelector('#cancelAdminCreateBtn').onclick=()=>overlay.remove();
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
    card.querySelector('#saveAdminCreateBtn').onclick=async()=>{
      const err=card.querySelector('#adminCreateError');err.textContent='';
      const n=name.value.trim(),em=email.value.trim().toLowerCase(),pw=password.value;
      if(!n){err.textContent='表示名を入力してください。';name.focus();return;}
      if(!em||!email.checkValidity()){err.textContent='正しいメールアドレスを入力してください。';email.focus();return;}
      if(pw.length<8){err.textContent='初期パスワードは8文字以上にしてください。';password.focus();return;}
      const save=card.querySelector('#saveAdminCreateBtn');save.disabled=true;save.textContent='作成中…';
      try{
        const c=db();if(!c)throw new Error('Supabaseに接続できません。');
        const {data,error}=await c.functions.invoke('admin-users',{body:{action:'create',name:n,email:em,password:pw,role:'admin'}});
        if(error){
          let message=error.message||'管理者を作成できませんでした。';
          try{const details=await error.context?.json?.();if(details?.error)message=details.error;}catch(_e){}
          throw new Error(message);
        }
        if(data?.error)throw new Error(data.error);
        alert(`管理者アカウントを作成しました。\n\n${n}\n${em}\n\n初期パスワードは作成した管理者へ伝えてください。`);
        overlay.remove();
        await renderProfiles();ensureAdminCreateButton();
      }catch(e){err.textContent=e.message||'管理者を作成できませんでした。';}
      finally{if(document.body.contains(save)){save.disabled=false;save.textContent='管理者を作成';}}
    };
    name.focus();
  }

  async function renderProfiles(){
    const host=document.getElementById('profileTable');if(!host)return;
    const panel=host.closest('.panel');const h=panel?.querySelector('.panel-head h3');if(h)h.textContent='管理者アカウント';
    ensureAdminCreateButton();
    const c=db();
    const {data:{session}}=await c.auth.getSession();
    const currentId=session?.user?.id||'';
    const {data,error}=await c.from('profiles').select('id,name,email,role').eq('role','admin').order('name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    const rows=data||[];
    host.innerHTML=`<div class="admin-account-note">管理者アカウントを追加・管理できます。備品情報とQR読取後の詳細表示には、管理者ログインが必要です。一般社員用アカウントは作成しません。</div>`+
      (rows.length?rows.map(x=>`<div class="master-row" data-profile-row="${x.id}"><span><strong>${esc(x.name||'名称未設定')}</strong><small class="admin-account-meta">${esc(x.email||'メール未設定')}</small></span><div class="master-actions">${x.role==='admin'?`<span class="badge use">管理者</span><button type="button" class="master-mini profile-name-edit" data-id="${x.id}" data-name="${esc(x.name||'')}">表示名を変更</button>${x.id!==currentId?`<button type="button" class="master-mini profile-password-reset" data-id="${x.id}" data-name="${esc(x.name||'')}" data-email="${esc(x.email||'')}">パスワードを変更</button>`:''}`:`<span class="badge">旧権限: ${esc(x.role||'未設定')}</span><button type="button" class="master-mini promote profile-promote" data-id="${x.id}" data-name="${esc(x.name||x.email||'このアカウント')}">管理者にする</button>`}</div></div>`).join(''):'<div class="empty">アカウントはありません。</div>');
  }


  function renderUserRows(){
    const host=document.getElementById('userAdmin');if(!host)return;
    const q=userMasterFilters.query.trim().toLocaleLowerCase();
    const matched=userGroups.map((g,index)=>({g,index})).filter(({g})=>{
      if(userMasterFilters.department && (g.department||'')!==userMasterFilters.department)return false;
      if(userMasterFilters.location && (g.location||'')!==userMasterFilters.location)return false;
      if(!q)return true;
      return [g.name,g.department,g.location,g.room_number].some(s=>String(s||'').toLocaleLowerCase().includes(q));
    });
    const count=document.getElementById('userMasterCount');
    if(count)count.textContent='表示中 '+matched.length+'名 / 登録中 '+userGroups.length+'名　｜　各行の「情報を編集」から変更できます。';
    if(!matched.length){host.innerHTML='<div class="empty">該当する使用者がいません。</div>';return;}
    host.innerHTML='<div class="user-master-head"><span>実習生の名前</span><span>所属部署</span><span>居住場所</span><span>部屋番号</span><span>紐づく備品</span><span>操作</span></div>'+
      matched.map(({g,index})=>{
        const value=(v)=>v?esc(v):'<span class="user-master-muted">未設定</span>';
        const preview=g.items.slice(0,3).map(a=>esc((a.asset_no||'-')+' '+(a.name||''))).join('、');
        return `<div class="user-master-row">
          <div class="user-master-cell user-master-name" data-label="実習生の名前"><strong>${esc(g.name)}</strong></div>
          <div class="user-master-cell" data-label="所属部署">${value(g.department)}</div>
          <div class="user-master-cell" data-label="居住場所">${value(g.location)}</div>
          <div class="user-master-cell" data-label="部屋番号">${value(g.room_number)}</div>
          <div class="user-master-cell" data-label="紐づく備品"><span class="user-admin-count">${g.items.length}件</span>${preview?`<div class="user-master-asset-detail">${preview}</div>`:''}</div>
          <div class="user-master-cell user-master-actions-cell" data-label="操作"><div class="master-actions">
            <button type="button" class="master-mini user-master-edit" data-index="${index}" title="${esc(g.name)} の情報を編集">情報を編集</button>
            <button type="button" class="master-mini danger user-master-delete" data-index="${index}" title="${esc(g.name)} の登録を無効化">登録を無効化</button>
          </div></div></div>`;
      }).join('');
  }

  function updateUserMasterFilterOptions(){
    function apply(id,key,label){
      const el=document.getElementById(id);if(!el)return;
      const values=[...new Set(userGroups.map(u=>u[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
      const keep=userMasterFilters[key];
      el.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
      if(values.includes(keep))el.value=keep;else {el.value='';userMasterFilters[key]='';}
    }
    apply('userMasterDepartmentFilter','department','すべての部署');
    apply('userMasterLocationFilter','location','すべての場所');
    const search=document.getElementById('userMasterSearch');
    if(search && search.value!==userMasterFilters.query)search.value=userMasterFilters.query;
  }

  function openAssetUserEditor(target=null){
    document.getElementById('assetUserEditorOverlay')?.remove();
    const departments=[...new Set(userGroups.map(x=>x.department).filter(v=>v&&!/^\d+$/.test(v)))].sort((a,b)=>a.localeCompare(b,'ja'));
    const locations=[...new Set(userGroups.map(x=>x.location).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    const options=values=>values.map(v=>`<option value="${esc(v)}"></option>`).join('');
    const existingInline=document.getElementById('assetUserInlineEditor');
    const existingTargetId=existingInline?.dataset.userId||'';
    existingInline?.remove();
    document.getElementById('assetUserEditorOverlay')?.remove();
    // Editing happens directly below the selected person: no legacy prompt or preliminary dialog.
    const index=target?userGroups.findIndex(u=>u.id===target.id):-1;
    const row=target?document.querySelector('#userAdmin .user-master-edit[data-index="'+index+'"]')?.closest('.user-master-row'):null;
    if(target && !row)return;
    if(target && existingTargetId===target.id)return; // clicking again closes the editor
    const host=document.createElement('div');
    if(target){
      host.id='assetUserInlineEditor';
      host.className='user-master-inline-editor';
      host.dataset.userId=target.id;
    }else{
      host.id='assetUserEditorOverlay';
      host.className='admin-create-overlay';
    }
    const form=document.createElement('form');
    form.className='admin-create-card user-editor-card'+(target?' user-master-inline-card':'');
    form.setAttribute('aria-label',target?'使用者の一括編集':'実習生の新規登録');
    form.innerHTML=`<h3>${target?'使用者情報をまとめて編集':'実習生を新規登録'}</h3>
      <p>名前・所属部署・居住場所・部屋番号をまとめて設定できます。</p>
      <div class="user-editor-grid">
        <label>実習生の名前 <span style="color:#b42318">*</span><input name="userName" required maxlength="100" placeholder="例：カイン" autocomplete="off"></label>
        <label>所属部署<input name="userDepartment" list="assetUserDepartmentSuggestions" maxlength="100" placeholder="例：農産部" autocomplete="off"><datalist id="assetUserDepartmentSuggestions">${options(departments)}</datalist></label>
        <label>居住場所（寮・社宅など）<input name="userLocation" list="assetUserLocationSuggestions" maxlength="100" placeholder="例：薄場寮" autocomplete="off"><datalist id="assetUserLocationSuggestions">${options(locations)}</datalist></label>
        <label>部屋番号<input name="userRoom" maxlength="100" placeholder="例：201、北側和室" autocomplete="off"></label>
      </div>
      <div class="user-editor-tip">所属部署・居住場所は候補から選ぶほか、直接入力できます。部屋番号は任意です。変更は使用者マスタに保存され、既存備品の登録内容は変更しません。</div>
      <div id="assetUserEditorError" class="user-editor-error" role="alert"></div>
      <div class="admin-create-actions"><button type="button" class="secondary" id="cancelAssetUserEditor">キャンセル</button><button type="submit" class="primary" id="saveAssetUserEditor">${target?'変更を保存':'登録する'}</button></div>`;
    const field=n=>form.elements.namedItem(n);
    field('userName').value=target?.name||'';
    field('userDepartment').value=target?.department||'';
    field('userLocation').value=target?.location||'';
    field('userRoom').value=target?.room_number||'';
    host.appendChild(form);
    if(target){row.after(host);}else{document.body.appendChild(host);}
    const close=()=>host.remove();
    form.querySelector('#cancelAssetUserEditor').onclick=close;
    if(!target)host.addEventListener('click',e=>{if(e.target===host)close();});
    host.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}});
    if(target)host.scrollIntoView({behavior:'smooth',block:'nearest'});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const errorBox=form.querySelector('#assetUserEditorError');
      errorBox.textContent='';
      const payload={
        name:field('userName').value.trim(),
        department:field('userDepartment').value.trim()||null,
        location:field('userLocation').value.trim()||null,
        room_number:field('userRoom').value.trim()||null
      };
      if(!payload.name){errorBox.textContent='実習生の名前を入力してください。';field('userName').focus();return;}
      if(userGroups.some(u=>u.id!==target?.id&&u.name===payload.name&&(u.department||null)===payload.department)){
        errorBox.textContent='同じ名前・所属部署の使用者が既に登録されています。既存の使用者を詳細編集してください。';
        return;
      }
      const save=form.querySelector('#saveAssetUserEditor');
      save.disabled=true;save.textContent='保存中…';
      try{
        const c=db();if(!c)throw new Error('Supabaseに接続できません。');
        let result;
        if(target)result=await c.from('asset_users').update({...payload,updated_at:new Date().toISOString()}).eq('id',target.id).eq('is_active',true).select('id').single();
        else result=await c.from('asset_users').insert({...payload,is_active:true}).select('id').single();
        if(result.error)throw result.error;
        let warning='';
        if(target && target.name!==payload.name){
          const sync=await c.from('assets').update({user_name:payload.name}).eq('assigned_user_id',target.id);
          if(sync.error)warning='使用者マスタは保存されましたが、紐づく備品の表示名更新に失敗しました：'+sync.error.message;
        }
        close();
        await renderUsers();
        document.dispatchEvent(new Event('asset-user-master-updated'));
        if(warning)alert(warning);
      }catch(err){errorBox.textContent=err.message||'保存できませんでした。';}
      finally{save.disabled=false;save.textContent=target?'変更を保存':'登録する';}
    });
    field('userName').focus();
  }

  async function renderUsers(){
    ensureUserPanel();
    const host=document.getElementById('userAdmin');if(!host)return;
    const c=db();if(!c){host.innerHTML='<div class="error">Supabaseに接続できません。</div>';return;}
    const [usersRes,assetsRes]=await Promise.all([
      c.from('asset_users').select('id,name,department,room_number,location,is_active').eq('is_active',true).order('name'),
      c.from('assets').select('id,asset_no,name,assigned_user_id').not('assigned_user_id','is',null)
    ]);
    if(usersRes.error){host.innerHTML=`<div class="error">${esc(usersRes.error.message)}</div>`;return;}
    if(assetsRes.error){host.innerHTML=`<div class="error">${esc(assetsRes.error.message)}</div>`;return;}
    const byUser=new Map();
    (assetsRes.data||[]).forEach(a=>{
      if(!byUser.has(a.assigned_user_id))byUser.set(a.assigned_user_id,[]);
      byUser.get(a.assigned_user_id).push(a);
    });
    userGroups=(usersRes.data||[]).map(u=>({...u,items:byUser.get(u.id)||[]}));
    updateUserMasterFilterOptions();
    renderUserRows();
  }

  async function renderOne(def){
    const host=document.getElementById(def.host);if(!host)return;
    const c=db();
    const {data,error}=await c.from(def.table).select('id,name,is_active').eq('is_active',true).order('name');
    if(error){host.innerHTML=`<div class="error">${esc(error.message)}</div>`;return;}
    const filtered=(data||[]).filter(x=>def.table!=='categories'||!String(x.name||'').startsWith('__USER__:'));
    host.innerHTML=filtered.length?filtered.map(x=>`<div class="master-row" data-master-id="${x.id}"><strong>${esc(x.name)}</strong><div class="master-actions"><button type="button" class="master-mini master-edit" data-table="${def.table}" data-id="${x.id}" data-name="${esc(x.name)}">編集</button><button type="button" class="master-mini danger master-delete" data-table="${def.table}" data-id="${x.id}" data-name="${esc(x.name)}" title="選択肢から非表示にする">非表示</button></div></div>`).join(''):'<div class="empty">登録なし</div>';
  }

  function ensureAddButtons(){
    defs.forEach(def=>{
      const host=document.getElementById(def.host);const panel=host?.closest('.panel');const head=panel?.querySelector('.panel-head');
      if(!head||head.querySelector(`[data-add-table="${def.table}"]`))return;
      const b=document.createElement('button');b.type='button';b.className='secondary master-add';b.dataset.addTable=def.table;b.dataset.title=def.title;b.textContent='＋ 追加';head.appendChild(b);
    });
  }

  async function render(){
    if(rendering)return;
    if(!document.getElementById('adminPage'))return;
    if(!(await isAdmin()))return;
    rendering=true;ensureStyles();ensureUserPanel();ensureAddButtons();ensureAdminCreateButton();
    try{await renderProfiles();await renderUsers();for(const def of defs)await renderOne(def);}finally{rendering=false;}
  }

  function reopenAdminAfterReload(){sessionStorage.setItem('reopenAdmin','1');location.reload();}

  document.addEventListener('input',e=>{
    if(e.target.id==='userMasterSearch'){userMasterFilters.query=e.target.value;renderUserRows();}
  });
  document.addEventListener('change',e=>{
    if(e.target.id==='userMasterDepartmentFilter'){userMasterFilters.department=e.target.value;renderUserRows();}
    if(e.target.id==='userMasterLocationFilter'){userMasterFilters.location=e.target.value;renderUserRows();}
  });

  // Capture user-master clicks before any previously cached legacy handler.
  // The retired user-master.js used the same CSS class and opened a native name prompt.
  document.addEventListener('click',e=>{
    const edit=e.target.closest('.user-master-edit');
    const legacyAdd=e.target.closest('#addUserMasterBtn');
    if(!edit&&!legacyAdd)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if(legacyAdd){openAssetUserEditor();return;}
    let group=null;
    if(edit.hasAttribute('data-index')){
      const index=Number(edit.dataset.index);
      if(Number.isInteger(index)&&index>=0)group=userGroups[index]||null;
    }
    if(!group&&edit.dataset.id)group=userGroups.find(g=>g.id===edit.dataset.id)||null;
    if(!group&&edit.dataset.name){
      const matches=userGroups.filter(g=>g.name===edit.dataset.name);
      if(matches.length===1)group=matches[0];
    }
    if(group)openAssetUserEditor(group);
    else alert('対象の使用者を特定できません。管理画面を再読み込みしてから、使用者マスタの「情報を編集」を押してください。');
  },true);

  document.addEventListener('click',async e=>{
    if(e.target.closest('#addAdminAccountBtn')){openAdminCreateDialog();return;}
    if(e.target.closest('#addAssetUserBtn')){openAssetUserEditor();return;}
    const userDelete=e.target.closest('.user-master-delete');
    if(userDelete){
      const group=userGroups[Number(userDelete.dataset.index)];
      if(!group)return;
      const c=db();
      if(!c){alert('Supabaseに接続できません。');return;}
      userDelete.disabled=true;
      try{
        // Never unlink equipment implicitly. Include soft-deleted assets to preserve history.
        const linked=await c.from('assets')
          .select('asset_no,name')
          .eq('assigned_user_id',group.id)
          .limit(5);
        if(linked.error)throw linked.error;
        if(linked.data?.length){
          const examples=linked.data.map(a=>`${a.asset_no||'-'} ${a.name||''}`).join('、');
          alert(`「${group.name}」は備品が割り当てられているため無効化できません。\n先に備品一覧で使用者を変更・解除してください。\n対象例：${examples}`);
          return;
        }
        // Legacy assets with only a text user_name also need a manual review.
        const legacy=await c.from('assets')
          .select('asset_no,name')
          .is('assigned_user_id',null)
          .eq('user_name',group.name)
          .eq('is_deleted',false)
          .limit(5);
        if(legacy.error)throw legacy.error;
        if(legacy.data?.length){
          alert(`「${group.name}」と同じ名前の未紐づけ備品があります。\n誤って使用者登録を無効化しないよう、備品一覧で使用者を確認してから削除してください。`);
          return;
        }
        if(!confirm(`「${group.name}」（${group.department||'部署未設定'} / ${group.location||'場所未設定'}）の登録を無効化しますか？\n備品・履歴は削除しません。後から復元できるよう、使用者データは無効化して保管します。`))return;
        const {data,error}=await c.from('asset_users')
          .update({is_active:false,updated_at:new Date().toISOString()})
          .eq('id',group.id)
          .eq('is_active',true)
          .select('id');
        if(error)throw error;
        if(!data?.length)throw new Error('使用者が見つからないか、既に削除されています。');
        reopenAdminAfterReload();
      }catch(err){alert('使用者を削除できませんでした: '+(err.message||'不明なエラー'));}
      finally{userDelete.disabled=false;}
      return;
    }
    const userEdit=e.target.closest('.user-master-edit');
    if(userEdit){const group=userGroups[Number(userEdit.dataset.index)];if(group)openAssetUserEditor(group);return;}
    const promote=e.target.closest('.profile-promote');
    if(promote){
      if(!confirm(`「${promote.dataset.name}」を管理者にしますか？\n管理者は備品・履歴・管理画面をすべて編集できます。`))return;
      const c=db();const {error}=await c.from('profiles').update({role:'admin'}).eq('id',promote.dataset.id);
      if(error){alert('管理者に変更できませんでした: '+error.message);return;}await render();return;
    }
    const passwordReset=e.target.closest('.profile-password-reset');
    if(passwordReset){
      openAdminPasswordDialog({id:passwordReset.dataset.id,name:passwordReset.dataset.name||'管理者',email:passwordReset.dataset.email||''});
      return;
    }
    const nameEdit=e.target.closest('.profile-name-edit');
    if(nameEdit){
      const name=prompt('管理者の表示名を入力してください',nameEdit.dataset.name||'');if(!name||!name.trim())return;
      const c=db();const {error}=await c.from('profiles').update({name:name.trim(),role:'admin'}).eq('id',nameEdit.dataset.id);
      if(error){alert('名前を変更できませんでした: '+error.message);return;}await render();return;
    }
    const add=e.target.closest('[data-add-table]');
    if(add){
      const name=prompt(`${add.dataset.title}の名前を入力してください`);if(!name||!name.trim())return;
      const c=db();const {error}=await c.from(add.dataset.addTable).insert({name:name.trim(),is_active:true});
      if(error){alert('追加できませんでした: '+error.message);return;}reopenAdminAfterReload();return;
    }
    const edit=e.target.closest('.master-edit');
    if(edit){
      const name=prompt('新しい名前を入力してください',edit.dataset.name||'');if(!name||!name.trim()||name.trim()===edit.dataset.name)return;
      const c=db();const {error}=await c.from(edit.dataset.table).update({name:name.trim()}).eq('id',edit.dataset.id);
      if(error){alert('編集できませんでした: '+error.message);return;}reopenAdminAfterReload();return;
    }
    const del=e.target.closest('.master-delete');
    if(del){
      if(!confirm(`「${del.dataset.name}」を選択肢から非表示にしますか？\n既存の備品データは残ります。`))return;
      const c=db();const {error}=await c.from(del.dataset.table).update({is_active:false}).eq('id',del.dataset.id);
      if(error){alert('削除できませんでした: '+error.message);return;}reopenAdminAfterReload();return;
    }
    if(e.target.closest('.nav-btn[data-page="admin"]'))setTimeout(render,250);
  });

  const obs=new MutationObserver(()=>{
    if(rendering)return;
    const page=document.getElementById('adminPage');if(!page||page.classList.contains('hidden'))return;
    const profileHost=document.getElementById('profileTable');
    const legacyRoles=profileHost?.querySelector('.role-select');
    const needs=legacyRoles||!document.getElementById('userAdmin')||!document.getElementById('addAdminAccountBtn')||defs.some(d=>{const h=document.getElementById(d.host);return h&&!h.querySelector('.master-actions')&&!h.querySelector('.empty')});
    if(needs)setTimeout(render,60);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    ensureStyles();ensureUserPanel();ensureAdminCreateButton();
    enforceAdminOnly();
    const c=db();c?.auth.onAuthStateChange(()=>setTimeout(enforceAdminOnly,0));
    const adminPage=document.getElementById('adminPage');if(adminPage)obs.observe(adminPage,{childList:true,subtree:true});
    if(sessionStorage.getItem('reopenAdmin')==='1'){
      sessionStorage.removeItem('reopenAdmin');
      setTimeout(()=>document.querySelector('.nav-btn[data-page="admin"]')?.click(),700);
    }
  });
})();