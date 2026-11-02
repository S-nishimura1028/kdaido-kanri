const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/inventory-audit.js'),'utf8');
const a=src.indexOf('// PURE AUDIT HELPERS START');
const b=src.indexOf('// PURE AUDIT HELPERS END',a);
assert.ok(a>=0&&b>a);
const {duplicateGroups,normalizedAssetName,printChecklistRows,makeLabelChecklistCsv}=vm.runInNewContext('(function(){'+src.slice(a,b)+'return {duplicateGroups,normalizedAssetName,printChecklistRows,makeLabelChecklistCsv}})()');
const people=[{id:'p1',name:'個人A'},{id:'p2',name:'個人B'},{id:'dept',name:'営農部'}];
const a1={id:'a1',asset_no:'KD-0001',name:'炊飯器',assigned_user_id:'p1',status:'使用中',is_deleted:false,location:'薄場寮'};
const a2={...a1,id:'a2',asset_no:'KD-0002',name:'炊飯器 ',status:'修理中'};
const b1={...a1,id:'b1',asset_no:'KD-0003',assigned_user_id:'p2'};
const c1={...a1,id:'c1',asset_no:'KD-0004',assigned_user_id:'dept',name:'洗濯機'};
const c2={...c1,id:'c2',asset_no:'KD-0005'};
test('same user + normalized asset names are identified as candidates',()=>{
  const x=duplicateGroups([a1,a2,b1],people);
  assert.equal(x.length,1);assert.equal(x[0].person,'個人A');
  assert.deepEqual(Array.from(x[0].items,a=>a.asset_no),['KD-0001','KD-0002']);
});
test('department-wide account is marked as possible shared inventory, not assumed duplicate',()=>{
  const x=duplicateGroups([c1,c2],people);
  assert.equal(x.length,1);assert.equal(x[0].sharedHint,true);
});
test('deleted/disposed/unassigned assets never inflate duplicate candidates',()=>{
  const x=duplicateGroups([a1,{...a2,is_deleted:true},{...a2,status:'廃棄'},{...a2,assigned_user_id:null,user_name:null}],people);
  assert.equal(x.length,0);
});
test('same display name with different person master IDs does not merge',()=>{
  const x=duplicateGroups([a1,{...a1,id:'z',asset_no:'KD-0999',assigned_user_id:'pOther'}],[...people,{id:'pOther',name:'個人A'}]);
  assert.equal(x.length,0);
});
test('NFKC normalization treats extra whitespace and fullwidth letters consistently',()=>{
  assert.equal(normalizedAssetName('ＣＤ　プレーヤー'),normalizedAssetName('CDプレーヤー'));
});
test('CSV starts unverified and excludes disposed and deleted while allowing an Excel BOM',()=>{
  const csv=makeLabelChecklistCsv([a1,{...a2,status:'廃棄'},{...b1,is_deleted:true}]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv,/印刷確認/);
  assert.equal((csv.match(/未確認/g)||[]).length,2);
  assert.match(csv,/KD-0001/);assert.doesNotMatch(csv,/KD-0002|KD-0003/);
  assert.equal(printChecklistRows([a1,{...a2,status:'廃棄'}]).length,1);
});
test('CSV protects against spreadsheet formula injection in asset names',()=>{
  const csv=makeLabelChecklistCsv([{...a1,name:'=1+1'}]);
  assert.match(csv,/"'=1\+1"/);
});
test('script performs no direct DB writes',()=>{
  assert.doesNotMatch(src,/\.update\(|\.insert\(|\.delete\(|\.upsert\(|\.rpc\(/);
});
