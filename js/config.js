// STAGING-ONLY: Do not merge this file into main or deploy it to the production domain.
// Only the Vercel alias assigned to this staging branch is permitted.
// This prevents the staging build from accidentally running under a production alias.
if (location.hostname !== 'kdaido-kanri-auto-git-staging-28a335-tr6dqmrwjx-3964s-projects.vercel.app') {
  throw new Error('STAGING-ONLY build: open the dedicated staging branch URL');
}
window.SUPABASE_URL = 'https://jhcurtjtjzrbsvptkpuz.supabase.co';
window.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_K-b0oxmswodqdLh4Lh1usA_iYLsL5p2';

// 今後ずっと使う本番URL。Vercelの長いデプロイURLで開かれても
// この固定URLへ自動的に寄せることで、QRコードも常に短いURLになります。
window.APP_BASE_URL = location.origin; // Staging QR codes stay within staging Preview.

(function enforceCanonicalProductionUrl(){
  try{
    if (!/^https?:$/.test(location.protocol)) return;
    // ChatGPT経由で付く参照元パラメータだけをURL表示から削除します。
    // QR備品表示の ?asset=... や認証用パラメータは変更しません。
    const current = new URL(location.href);
    if (current.searchParams.get('utm_source') === 'chatgpt.com') {
      current.searchParams.delete('utm_source');
      history.replaceState(history.state, '', current.pathname + current.search + current.hash);
    }
    const canonical = new URL(window.APP_BASE_URL);
    if (location.hostname === canonical.hostname) return;
    if (!location.hostname.endsWith('.vercel.app')) return;
    // Feature branches are served from Vercel preview subdomains. Do not
    // redirect those previews to production: the admin QR flow must be tested.
    // The QR payload itself still uses APP_BASE_URL (the permanent production URL).
    if (location.hostname.startsWith('kdaido-kanri-auto-')) return;

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
  s.src='js/current-user.js?v=20261026-transfer-cas-1';
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
  s.src='js/admin-account-simple.js?v=20261027-shared-auth-1';
  s.defer=true;
  document.head.appendChild(s);
})();

// 履歴を「備品番号 / 備品名」にし、使用者と変更者も表示。
(function loadHistoryLabels(){
  const s=document.createElement('script');
  s.src='js/history-label.js?v=20261022-ops-1';
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

// 管理No.を登録・編集・一覧・詳細から外す。
(function loadAssetNoRemove(){
  const s=document.createElement('script');
  s.src='js/asset-no-remove.js?v=20261022-ops-1';
  s.defer=true;
  document.head.appendChild(s);
})();

// 備品詳細からテスト備品などを削除。DB上は履歴を残すソフト削除。
(function loadAssetDelete(){
  const s=document.createElement('script');
  s.src='js/asset-delete.js?v=20261027-shared-auth-1';
  s.defer=true;
  document.head.appendChild(s);
})();

// 備品一覧では管理No.とカテゴリ列・カテゴリ絞り込みを表示しない。管理画面のカテゴリ欄も非表示。
(function loadAssetListCleanup(){
  const s=document.createElement('script');
  s.src='js/asset-list-cleanup.js?v=20260819-3';
  s.defer=true;
  document.head.appendChild(s);
})();

// 管理画面に備品分析を表示。
(function loadAdminAnalysis(){
  const s=document.createElement('script');
  s.src='js/admin-analysis.js?v=20260819-1';
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
