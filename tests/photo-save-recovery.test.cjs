'use strict';

// Isolated regression tests for the production photo-save handler.
// No Supabase account, browser session, file uploads, or production data needed.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../js/photo-update.js'),'utf8');
const start=source.indexOf('async function savePhotos(e){');
const end=source.indexOf('  function addPhotoButton(){',start);
assert.ok(start>=0 && end>start,'Photo-save handler source boundaries must remain findable');
const code=source.slice(start,end);

function scenario(mode){
  let current={photo_path:'old.jpg',label_photo_path:'old_label.jpg'};
  const events={reload:0,close:0,alerts:[],removed:[],uploaded:[],rpc:0,skippedErrors:[]};
  const save={disabled:false,textContent:'写真を保存'};
  const errorLabel={textContent:''};
  const dialog={
    dataset:{assetId:'asset-test-id',photoPath:'old.jpg',labelPhotoPath:'old_label.jpg'},
    querySelector(id){
      if(id==='#employeePhotoError')return errorLabel;
      if(id==='#employeePhotoSave')return save;
      if(id==='#employeePhotoFile1')return {files:mode==='no-file'?[]:[{name:'new.jpg',type:'image/jpeg',size:100}]};
      if(id==='#employeePhotoFile2')return {files:[]};
      throw new Error('Unexpected selector: '+id);
    },
    close(){events.close++}
  };

  const client={
    from(name){
      assert.equal(name,'assets');
      return {
        select(){return this},
        eq(){return this},
        async maybeSingle(){
          if(mode==='unverified' && events.rpc) return {data:null,error:new Error('readback unavailable')};
          if(mode==='concurrent')return {data:{...current,photo_path:'another-manager.jpg'},error:null};
          return {data:{...current},error:null};
        }
      };
    },
    storage:{
      from(name){
        assert.equal(name,'asset-photos');
        return {async remove(paths){events.removed.push(...paths);return {error:null}}};
      }
    },
    async rpc(name,args){
      assert.equal(name,'update_asset_photos_checked');
      assert.equal(args.p_asset_id,'asset-test-id');
      events.rpc++;
      if(mode==='failure')return {error:new Error('RPC rejected')};
      current.photo_path='new.jpg';
      if(mode==='ambiguous'||mode==='unverified')return {error:new Error('network timeout')};
      return {error:null};
    }
  };

  const handler=new Function('getClient','upload','window','document','location','console',
    code+';return savePhotos')(
      ()=>client,
      async()=>{events.uploaded.push('new.jpg');return 'new.jpg'},
      {alert(message){events.alerts.push(message)}},
      {getElementById(){return dialog}},
      {reload(){events.reload++}},
      {error(ex){events.skippedErrors.push(ex.message)},warn(){}}
    );

  return {events,save,errorLabel,handler};
}

const cases=[
  {name:'successful save removes obsolete image after RPC',mode:'success',commit:true,oldRemoved:1,newRemoved:0},
  {name:'failed RPC removes only orphan upload',mode:'failure',commit:false,oldRemoved:0,newRemoved:1},
  {name:'lost response after commit does not delete referenced upload',mode:'ambiguous',commit:true,oldRemoved:0,newRemoved:0},
  {name:'failed readback keeps uncertain upload rather than deleting it',mode:'unverified',commit:false,oldRemoved:0,newRemoved:0},
  {name:'missing file blocks save without RPC',mode:'no-file',commit:false,oldRemoved:0,newRemoved:0},
  {name:'concurrent update stops before upload or RPC',mode:'concurrent',commit:false,oldRemoved:0,newRemoved:0}
];

for(const spec of cases){
  test(spec.name,async()=>{
    const state=scenario(spec.mode);
    await state.handler({preventDefault(){}});
    assert.equal(state.events.reload,spec.commit?1:0);
    assert.equal(state.events.close,spec.commit?1:0);
    assert.equal(state.events.removed.filter(x=>x==='old.jpg').length,spec.oldRemoved);
    assert.equal(state.events.removed.filter(x=>x==='new.jpg').length,spec.newRemoved);
    assert.equal(state.save.disabled,false,'Save button must be restored');
    if(!spec.commit)assert.ok(state.errorLabel.textContent,'Failure must be shown');
    if(spec.mode==='no-file'||spec.mode==='concurrent'){
      assert.equal(state.events.rpc,0);
      assert.equal(state.events.uploaded.length,0);
    }
    if(spec.mode==='ambiguous')assert.equal(state.events.alerts.length,1,'Recovered save should inform user');
  });
}
