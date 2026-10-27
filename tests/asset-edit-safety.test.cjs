const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8');
const first=source.indexOf('  function editedAssetMatches(');
const last=source.indexOf('  let assetFormSaving=false;',first);
assert.ok(first>=0&&last>first,'Expected readback helpers in asset editor');
const helpers=source.slice(first,last);
const build=db=>new Function('db',helpers+'return {editedAssetMatches,verifyEditedAssetSaved}')(db);
const expected={
  asset_no:'KD-0042',name:'電子レンジ',category:'家電',category_id:null,manufacturer:null,
  model:null,purchase_date:null,purchase_price:0,location:'寮',location_id:null,
  department:null,department_id:null,quantity:1,unit:'個',status:'未使用',
  assigned_user_id:null,user_name:null,acquisition_method:null,note:null
};
const original={updated_at:'2026-10-27T01:00:00Z'};
const committed={...expected,purchase_price:'0.00',updated_at:'2026-10-27T01:00:01Z',is_deleted:false};
function dbFor(data,error){
  return {from(table){
    assert.equal(table,'assets');
    return {select(){return {eq(){return this},async maybeSingle(){return {data,error}}}}};
  }};
}
test('successful readback checks all fields and different updated_at',()=>{
  const {editedAssetMatches:match}=build(null);
  assert.equal(match(committed,expected,original),true);
  assert.equal(match({...committed,updated_at:original.updated_at},expected,original),false);
  assert.equal(match({...committed,name:'old name'},expected,original),false);
  assert.equal(match({...committed,is_deleted:true},expected,original),false);
  assert.equal(match(null,expected,original),false);
});
test('numeric fields compare by value, not JSON string formatting',()=>{
  const {editedAssetMatches:match}=build(null);
  assert.equal(match({...committed,quantity:'1',purchase_price:'0.0'},expected,original),true);
  assert.equal(match({...committed,purchase_price:'1.0'},expected,original),false);
});
test('ambiguous edit can be confirmed only by current persisted row',async()=>{
  assert.equal(await build(dbFor(committed,null)).verifyEditedAssetSaved('some-id',expected,original),true);
  assert.equal(await build(dbFor({...committed,status:'修理中'},null)).verifyEditedAssetSaved('some-id',expected,original),false);
  assert.equal(await build(dbFor(null,null)).verifyEditedAssetSaved('some-id',expected,original),false);
});
test('readback error or exception is never reported as confirmed',async()=>{
  assert.equal(await build(dbFor(null,new Error('unreachable'))).verifyEditedAssetSaved('some-id',expected,original),false);
  assert.equal(await build({from(){throw new Error('unreachable')}}).verifyEditedAssetSaved('some-id',expected,original),false);
});
test('disposal needs a fresh reason, and cannot silently reuse old notes',()=>{
  assert.match(source,/payload\.status==='廃棄'&&\(!id\|\|original\?\.status!=='廃棄'\)/);
  assert.match(source,/reason\.length<5/);
  assert.match(source,/【廃棄理由】/);
  assert.match(source,/updateDisposalReasonField\(\)/);
  assert.match(source,/assetDisposalReason/);
});

test('cancel and close buttons do not submit the form',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.match(html,/<button type="button" id="assetFormCloseBtn"/);
  assert.match(html,/<button type="button" id="assetFormCancelBtn"/);
  assert.match(html,/<button type="submit" id="saveAssetBtn"/);
});
test('closing is blocked while asset save is active, including Escape',()=>{
  const first=source.indexOf('  let assetFormSaving=false;');
  const last=source.indexOf("  $('assetForm').addEventListener('submit',async e=>{",first);
  assert.ok(first>=0&&last>first);
  const callbacks={};let closes=0;
  const elements={
    assetDialog:{close(){closes++;},addEventListener(type,fn){callbacks['dialog:'+type]=fn;}},
    assetFormCloseBtn:{addEventListener(type,fn){callbacks['x:'+type]=fn;}},
    assetFormCancelBtn:{addEventListener(type,fn){callbacks['cancel:'+type]=fn;}}
  };
  const {setSaving}=new Function('$',source.slice(first,last)+
    'return {setSaving:value=>assetFormSaving=value};')(id=>elements[id]);
  callbacks['cancel:click']();
  assert.equal(closes,1);
  setSaving(true);
  callbacks['cancel:click']();
  callbacks['x:click']();
  assert.equal(closes,1);
  let prevented=false;
  callbacks['dialog:cancel']({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  setSaving(false);
  callbacks['x:click']();
  assert.equal(closes,2);
});
test('disposal history displays its reason from JSON projection',()=>{
  assert.match(source,/disposal_note:after_data->>note/);
  assert.match(source,/廃棄理由：/);
});
