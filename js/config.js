window.SUPABASE_URL = 'https://rhjnrguhnkfotggzxjfs.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KhDnfK5Fkv_rj71OsCP2Gg_F0fuXZy9';

// 今後ずっと使う本番URL。Vercelの長いデプロイURLで開かれても
// この固定URLへ自動的に寄せることで、QRコードも常に短いURLになります。
window.APP_BASE_URL = 'https://kdaido-kanri.vercel.app';

(function enforceCanonicalProductionUrl(){
  try{
    if (!/^https?:$/.test(location.protocol)) return;
    const canonical = new URL(window.APP_BASE_URL);
    if (location.hostname === canonical.hostname) return;
    if (!location.hostname.endsWith('.vercel.app')) return;

    canonical.pathname = location.pathname;
    canonical.search = location.search;
    canonical.hash = location.hash;
    location.replace(canonical.toString());
  } catch (e) {
    console.warn('canonical url redirect skipped', e);
  }
})();

// 備品詳細から「現在の使用者」をすぐ変更できる補助機能。
(function loadCurrentUserEditor(){
  const s=document.createElement('script');
  s.src='js/current-user.js';
  s.defer=true;
  document.head.appendChild(s);
})();

// 管理画面の使用者マスタと、備品登録時の使用者プルダウン。
(function loadUserMaster(){
  const s=document.createElement('script');
  s.src='js/user-master.js';
  s.defer=true;
  document.head.appendChild(s);
})();

// 管理者アカウント追加を「メールアドレス＋初期パスワード」だけに統一。
(function loadSimpleAdminAccountCreator(){
  const s=document.createElement('script');
  s.src='js/admin-account-simple.js?v=20260817-2';
  s.defer=true;
  document.head.appendChild(s);
})();

// 履歴を「備品番号 / 備品名」にし、使用者と変更者も表示。
(function loadHistoryLabels(){
  const s=document.createElement('script');
  s.src='js/history-label.js?v=20260816-3';
  s.defer=true;
  document.head.appendChild(s);
})();

// 備品登録の×・キャンセルでは必須入力チェックを発生させず、そのまま閉じる。
(function loadAssetDialogCancelFix(){
  const s=document.createElement('script');
  s.src='js/asset-dialog-cancel.js?v=20260816-1';
  s.defer=true;
  document.head.appendChild(s);
})();

// 管理No.と取得年月日は任意入力にする。
(function loadAssetOptionalFields(){
  const s=document.createElement('script');
  s.src='js/asset-optional-fields.js?v=20260819-1';
  s.defer=true;
  document.head.appendChild(s);
})();

// 備品詳細からテスト備品などを削除。DB上は履歴を残すソフト削除。
(function loadAssetDelete(){
  const s=document.createElement('script');
  s.src='js/asset-delete.js?v=20260819-1';
  s.defer=true;
  document.head.appendChild(s);
})();

// 左上のブランド表示を会社名中心に整理。
(function loadSidebarBrand(){
  const s=document.createElement('script');
  s.src='js/sidebar-brand.js?v=20260816-1';
  s.defer=true;
  document.head.appendChild(s);
})();
