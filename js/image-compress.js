(function(){
  'use strict';
  const MAX_DIMENSION=1600;
  const TARGET_BYTES=550*1024;
  const PHOTO_INPUTS=new Set(['assetPhoto','assetLabelPhoto','employeePhotoFile1','employeePhotoFile2']);

  function loadImage(file){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('写真を読み込めませんでした。'))};img.src=url})}
  function canvasBlob(canvas,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('写真を圧縮できませんでした。')),'image/jpeg',quality))}

  window.compressAssetImage=async function(file){
    if(!file||!String(file.type||'').startsWith('image/'))return file;
    try{
      const img=await loadImage(file);let w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
      const scale=Math.min(1,MAX_DIMENSION/Math.max(w,h));w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);
      let quality=.82,blob=await canvasBlob(canvas,quality);while(blob.size>TARGET_BYTES&&quality>.5){quality-=.08;blob=await canvasBlob(canvas,quality)}
      const base=(file.name||'photo').replace(/\.[^.]+$/,'');return new File([blob],base+'.jpg',{type:'image/jpeg',lastModified:Date.now()});
    }catch(e){console.warn('image compression skipped',e);return file}
  };

  document.addEventListener('change',async function(e){
    const input=e.target;if(!input||!PHOTO_INPUTS.has(input.id)||input.dataset.compressedReady==='1')return;
    const file=input.files&&input.files[0];if(!file)return;
    e.stopImmediatePropagation();
    input.disabled=true;
    try{
      const compressed=await window.compressAssetImage(file);
      const dt=new DataTransfer();dt.items.add(compressed);input.files=dt.files;input.dataset.compressedReady='1';
      input.dispatchEvent(new Event('change',{bubbles:true}));
    }finally{input.disabled=false;setTimeout(()=>delete input.dataset.compressedReady,0)}
  },true);
})();