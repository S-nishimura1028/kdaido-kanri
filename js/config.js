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
