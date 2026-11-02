'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../js/label-status.js'),'utf8');
const start=src.indexOf('function byStatus(');
const end=src.indexOf('\nfunction message(',start);
assert.ok(start>0&&end>start,'filter helper must exist');
const filter=vm.runInNewContext('(function(){'+src.slice(start,end)+';return byStatus})()');
const assets=[
 {id:'1',asset_no:'KD-0010',name:'炊飯器',location:'薄場寮',label_status:'未確認'},
 {id:'2',asset_no:'KD-0011',name:'冷蔵庫',location:'倉庫',label_status:'印刷済み'},
 {id:'3',asset_no:'KD-0012',name:'カーテン',location:'春日社宅',label_status:'貼付済み'},
 {id:'4',asset_no:'KD-0013',name:'電子レンジ',location:'倉庫',label_status:null}
];
test('未確認 includes legacy null records and excludes marked ones',()=>{
  assert.deepEqual(Array.from(filter(assets,'未確認',''),x=>x.id),['1','4']);
});
test('printed and physically attached are distinct',()=>{
  assert.deepEqual(Array.from(filter(assets,'印刷済み',''),x=>x.id),['2']);
  assert.deepEqual(Array.from(filter(assets,'貼付済み',''),x=>x.id),['3']);
});
test('search matches management number, item name, and location',()=>{
  assert.deepEqual(Array.from(filter(assets,'','kd-0012'),x=>x.id),['3']);
  assert.deepEqual(Array.from(filter(assets,'','冷蔵庫'),x=>x.id),['2']);
  assert.equal(filter(assets,'','薄場寮').length,1);
});
test('one update is conditional on the ID, previous state and timestamp',()=>{
  assert.match(src,/\.update\(\{label_status:next\}\)/);
  assert.match(src,/\.eq\('id',id\)\.eq\('is_deleted',false\)\.eq\('label_status',prior\)/);
  assert.match(src,/\.eq\('updated_at',asset\.updated_at\)/);
  assert.match(src,/\.maybeSingle\(\)/);
});
test('existing deleted and disposed items are excluded from the status list',()=>{
  assert.match(src,/\.eq\('is_deleted',false\)\.neq\('status','廃棄'\)/);
});
test('saving requires manual confirmation; no auto-mark on opening the print window',()=>{
  assert.match(src,/if\(!confirm\(/);
  assert.doesNotMatch(src,/window\.print\(|QRCode/);
  assert.match(src,/過去の印刷記録はない/);
});
