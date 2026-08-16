(function(){
  'use strict';

  let client=null;
  function db(){
    if(client)return client;
    if(!window.supabase||!window.SUPABASE_URL||!window.SUPABASE_PUBLISHABLE_KEY)return null;
    client=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  function errorMessage(value,fallback='管理者を作成できませんでした。'){
    if(value==null||value==='')return fallback;
    if(typeof value==='string')return value;
    if(value instanceof Error)return value.message||fallback;
    if(typeof value==='object'){
      const nested=value.error ?? value.message ?? value.msg ?? value.error_description ?? value.details ?? value.hint;
      if(nested!=null&&nested!==value)return errorMessage(nested,fallback);
      try{
        const text=JSON.stringify(value);
        return text&&text!=='{}'?text:fallback;
      }catch(_e){return fallback;}
    }
    return String(value);
  }

  function generatePassword(){
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const symbols='!@#$%';
    const bytes=new Uint32Array(14);crypto.getRandomValues(bytes);
    let out='';
    for(let i=0;i<12;i++)out+=chars[bytes[i]%chars.length];
    return out+symbols[bytes[12]%symbols.length]+String(bytes[13]%10);
  }

  function openDialog(){
    document.getElementById('adminCreateOverlay')?.remove();
    document.getElementById('adminSimpleCreateOverlay')?.remove();

    const overlay=document.createElement('div');
    overlay.id='adminSimpleCreateOverlay';
    overlay.style.cssText='position:fixed;inset:0;z-index:5000;background:rgba(4,30,47,.58);display:grid;place-items:center;padding:16px;backdrop-filter:blur(3px)';

    const card=document.createElement('div');
    card.style.cssText='width:min(500px,95vw);background:#fff;border:1px solid #dbe8e3;border-radius:18px;padding:20px;box-shadow:0 28px 80px rgba(0,0,0,.28)';
    card.innerHTML=`
      <h3 style="margin:0 0 6px;color:#173f59">管理者アカウントを追加</h3>
      <p style="margin:0 0 16px;color:#668078;font-size:13px;line-height:1.6">必要なのはメールアドレスと初期パスワードだけです。作成したアカウントはすぐ管理者としてログインできます。</p>
      <label style="display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px;margin-bottom:12px">メールアドレス
        <input id="simpleAdminEmail" type="email" autocomplete="email" placeholder="example@company.jp">
      </label>
      <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end">
        <label style="display:flex;flex-direction:column;gap:7px;font-weight:700;font-size:14px">初期パスワード
          <input id="simpleAdminPassword" type="text" autocomplete="new-password" placeholder="8文字以上">
        </label>
        <button type="button" class="secondary" id="simpleGeneratePassword" style="min-height:44px">自動生成</button>
      </div>
      <div style="font-size:12px;color:#668078;margin-top:8px;line-height:1.5">初期パスワードは本人へ直接伝えてください。メールは自動送信しません。</div>
      <div id="simpleAdminError" style="color:#b42318;font-size:13px;min-height:18px;margin-top:8px"></div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px">
        <button type="button" class="secondary" id="simpleAdminCancel" style="min-height:46px">キャンセル</button>
        <button type="button" class="primary" id="simpleAdminSave" style="min-height:46px">管理者を作成</button>
      </div>`;

    overlay.appendChild(card);document.body.appendChild(overlay);
    const email=card.querySelector('#simpleAdminEmail');
    const password=card.querySelector('#simpleAdminPassword');
    const err=card.querySelector('#simpleAdminError');
    const save=card.querySelector('#simpleAdminSave');

    card.querySelector('#simpleGeneratePassword').onclick=()=>{password.value=generatePassword();password.focus();password.select();};
    card.querySelector('#simpleAdminCancel').onclick=()=>overlay.remove();
    overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});

    save.onclick=async()=>{
      err.textContent='';
      const em=email.value.trim().toLowerCase(),pw=password.value;
      if(!em||!email.checkValidity()){err.textContent='正しいメールアドレスを入力してください。';email.focus();return;}
      if(pw.length<8){err.textContent='初期パスワードは8文字以上にしてください。';password.focus();return;}
      save.disabled=true;save.textContent='作成中…';
      try{
        const c=db();if(!c)throw new Error('Supabaseに接続できません。');
        const {data:sessionData,error:sessionError}=await c.auth.getSession();
        if(sessionError)throw sessionError;
        const token=sessionData?.session?.access_token;
        if(!token)throw new Error('ログイン情報を確認できません。いったんログアウトして再ログインしてください。');

        const {data,error}=await c.functions.invoke('admin-users',{
          body:{action:'create',email:em,password:pw},
          headers:{Authorization:`Bearer ${token}`}
        });
        if(error){
          let message=errorMessage(error);
          try{
            const details=await error.context?.json?.();
            if(details)message=errorMessage(details,message);
          }catch(_e){}
          throw new Error(message);
        }
        if(data?.error)throw new Error(errorMessage(data.error));
        alert(`管理者アカウントを作成しました。\n\n${em}\n\n初期パスワードは本人へ伝えてください。`);
        overlay.remove();
        sessionStorage.setItem('reopenAdmin','1');
        location.reload();
      }catch(e){err.textContent=errorMessage(e);}
      finally{if(document.body.contains(save)){save.disabled=false;save.textContent='管理者を作成';}}
    };

    email.focus();
  }

  // 既存の管理者追加ダイアログより先に処理し、入力項目を2つだけに統一する。
  document.addEventListener('click',e=>{
    if(!e.target.closest('#addAdminAccountBtn'))return;
    e.preventDefault();
    e.stopImmediatePropagation();
    openDialog();
  },true);
})();
