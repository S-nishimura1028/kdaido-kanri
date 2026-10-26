/* Equipment detail — compact mobile overview, desktop remains unchanged.
 * Presentation-only; does not access Supabase or mutate asset records. */
(function(){
  'use strict';
  const host=document.getElementById('assetDetail');
  if(!host)return;

  function detailText(label){
    const item=[...host.querySelectorAll('.detail-item')].find(el=>
      (el.querySelector('small')?.textContent||'').trim()===label
    );
    if(!item)return '';
    const clone=item.cloneNode(true);
    clone.querySelector('small')?.remove();
    return (clone.textContent||'').trim();
  }

  function make(tag,className,text){
    const el=document.createElement(tag);
    if(className)el.className=className;
    if(text!==undefined)el.textContent=text;
    return el;
  }

  function meta(label,value){
    const block=make('div','mobile-detail-meta');
    block.append(make('span','mobile-detail-meta-label',label),
      make('strong','mobile-detail-meta-value',value||'未設定'));
    return block;
  }

  function enhance(){
    const tabs=host.querySelector('#workspaceDetailTabs');
    const grid=host.querySelector('.detail-grid');
    if(!tabs||!grid||host.querySelector('#mobileDetailOverview'))return;

    const name=detailText('名称')||'備品';
    const status=detailText('ステータス')||'未設定';
    const number=detailText('管理No.')||'—';
    const location=detailText('使用・保管場所');
    const user=detailText('貸出先（使用者マスタ）');
    const statusValue=['未使用','使用中','修理中','廃棄'].includes(status)?status:'未設定';

    const overview=make('section','mobile-detail-overview');
    overview.id='mobileDetailOverview';
    overview.setAttribute('aria-label','備品の要点');

    const header=make('div','mobile-detail-summary-head');
    header.append(make('span','mobile-detail-eyebrow','備品の概要'));
    const badge=make('span','mobile-detail-state',status);
    badge.dataset.status=statusValue;
    header.append(badge);
    overview.append(header);

    const title=make('h4','mobile-detail-name',name);
    overview.append(title);

    const identity=make('div','mobile-detail-identity');
    identity.append(make('span','','管理No.'),make('strong','',number));
    overview.append(identity);

    const essentials=make('div','mobile-detail-essentials');
    essentials.append(meta('使用・保管場所',location==='-'?'未設定':location),
      meta('現在の使用者',user==='-'?'使用者なし':user));
    overview.append(essentials);

    const photos=make('button','mobile-detail-photo-link','写真を確認  ›');
    photos.type='button';
    photos.addEventListener('click',()=>{
      tabs.querySelector('[data-detail-tab="photos"]')?.click();
      tabs.scrollIntoView({behavior:'auto',block:'nearest'});
    });
    overview.append(photos);
    host.insertBefore(overview,tabs);

    const more=make('button','mobile-detail-more-toggle','登録情報をすべて見る');
    more.type='button';
    more.setAttribute('aria-expanded','false');
    more.setAttribute('aria-controls','workspaceDetailInfoGrid');
    grid.id='workspaceDetailInfoGrid';
    more.addEventListener('click',()=>{
      const open=!host.classList.contains('mobile-detail-more-open');
      host.classList.toggle('mobile-detail-more-open',open);
      more.setAttribute('aria-expanded',String(open));
      more.textContent=open?'登録情報を閉じる':'登録情報をすべて見る';
    });
    grid.insertAdjacentElement('beforebegin',more);
    host.classList.add('mobile-detail-enhanced');
  }

  let scheduled=false;
  function queue(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;enhance()});
  }
  new MutationObserver(queue).observe(host,{childList:true,subtree:true});
  queue();
})();