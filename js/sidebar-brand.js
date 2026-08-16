(function(){
  'use strict';

  function applyBrand(){
    const brand=document.querySelector('.sidebar-brand');
    if(!brand)return;

    brand.innerHTML='<span class="daido-brand-mark">大同</span><div class="daido-brand-copy"><strong>熊本大同青果</strong><small>備品管理システム</small></div>';

    if(!document.getElementById('daidoSidebarBrandStyle')){
      const style=document.createElement('style');
      style.id='daidoSidebarBrandStyle';
      style.textContent=`
        .sidebar-brand:after{content:none!important}
        .sidebar-brand{gap:11px!important;align-items:center!important}
        .sidebar-brand>.daido-brand-mark{
          width:42px!important;height:42px!important;min-width:42px!important;
          font-size:13px!important;letter-spacing:.03em!important;
          border-radius:12px!important;line-height:1!important
        }
        .daido-brand-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
        .daido-brand-copy strong{font-size:15px;line-height:1.25;color:#fff;letter-spacing:.02em;white-space:nowrap}
        .daido-brand-copy small{display:block!important;margin:0!important;font-size:10px!important;line-height:1.2;color:#b8d8d0!important;font-weight:600!important;letter-spacing:.04em}
      `;
      document.head.appendChild(style);
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',applyBrand,{once:true});
  else applyBrand();
})();
