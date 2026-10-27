const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/qr-print.js'), 'utf8');
const start = source.indexOf('  const LABEL_STOCKS=');
const end = source.indexOf('\n  async function loadSelectedAssetInfo(', start);
assert.ok(start >= 0 && end > start, 'QR pagination helpers should exist');
const mockCanvasContext = () => ({
  fillRect() {}, drawImage() {}, fillText() {}, translate() {}, rotate() {},
  measureText(text) {return {width: String(text).length * 12};},
  fillStyle: '', textAlign: '', textBaseline: '', font: '', imageSmoothingEnabled: false
});
const mockDocument = {
  createElement(tag) {
    assert.equal(tag,'canvas');
    return {
      width:0,height:0,
      getContext(){return mockCanvasContext();},
      toDataURL(){return 'data:image/png;base64,LABEL';}
    };
  }
};
class FakeImage {
  set src(value){this.value=value; if(this.onload)this.onload();}
}
const helpers = vm.runInNewContext(
  '(function(){ '+source.slice(source.indexOf('  function esc('),source.indexOf('  let activeAssetId='))+source.slice(start, end) +
  '; return {LABEL_STOCKS,buildPages,writeLabelPrintWindow}; })()',
  {document:mockDocument,Image:FakeImage}
);

async function render(count, startPosition, paper='31373') {
  const labels = Array.from({length: count}, (_, index) => ({
    name: '備品 ' + (index + 1),
    asset_no: 'KD-' + String(index + 1).padStart(4, '0'),
    img: 'data:image/png;base64,TEST'
  }));
  let html = '';
  await helpers.writeLabelPrintWindow({
    document: { write(value) { html = value; }, close() {} }
  }, labels, startPosition, 'テスト印刷',helpers.LABEL_STOCKS[paper]);
  const sheets = html.split(/<section class="sheet(?: page-break)?"?>/).slice(1)
    .map(s => s.split('</section>')[0]);
  return {html, sheets};
}

test('28 labels become two exactly 27-slot pages', async () => {
  const {sheets} = await render(28, 1);
  assert.equal(sheets.length, 2);
  for (const sheet of sheets) {
    assert.equal((sheet.match(/<g class="label(?: blank)?"/g) || []).length, 27);
  }
  assert.match(sheets[0], /KD-0027/);
  assert.doesNotMatch(sheets[0], /KD-0028/);
  assert.match(sheets[1], /KD-0028/);
  assert.match(sheets[1], /<g class="label"><rect class="cut-guide" x="7" y="9"/);
});

test('54 labels become two full pages, 55 labels become three pages', async () => {
  assert.equal((await render(54, 1)).sheets.length, 2);
  assert.equal((await render(55, 1)).sheets.length, 3);
});

test('starting at an intermediate slot affects only the first page', async () => {
  const {sheets} = await render(28, 12);
  assert.equal(sheets.length, 2);
  assert.equal((sheets[0].match(/class="label blank"/g) || []).length, 11);
  assert.match(sheets[0], /KD-0016/);
  assert.doesNotMatch(sheets[0], /KD-0017/);
  assert.match(sheets[1], /KD-0017/);
  assert.match(sheets[1], /<g class="label"><rect class="cut-guide" x="7" y="9"/);
  assert.match(sheets[0], /<g class="label"><rect class="cut-guide" x="141" y="102"/);
});

test('page boundaries cannot alter absolute label coordinates', async () => {
  const {html} = await render(28, 1);
  assert.match(html, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(html, /\.sheet\{[^}]*width:210mm;height:296mm;/);
  assert.match(html, /viewBox="0 0 210 296"/);
  assert.match(html, /\.sheet\+\.sheet\{break-before:page;page-break-before:always\}/);
  assert.doesNotMatch(html, /\.sheet\{[^\n]*height:297mm/);
});

test('QR and all text are combined into one image per printed label', async () => {
  const {sheets,html}=await render(28,1);
  assert.equal((html.match(/class="print-label-image"/g)||[]).length,28);
  assert.doesNotMatch(html,/class="label-inner"/);
  assert.doesNotMatch(html,/\.label-inner\{[^}]*rotate/);
  assert.match(sheets[0],/href="data:image\/png;base64,LABEL"/);
  assert.match(sheets[1],/href="data:image\/png;base64,LABEL"/);
});


test('31071 layout has exactly 24 positions at the vendor coordinates', async () => {
  const {html,sheets}=await render(25,1,'31071');
  assert.equal(sheets.length,2);
  assert.equal((sheets[0].match(/<g class="label(?: blank)?"/g)||[]).length,24);
  assert.equal((sheets[1].match(/<g class="label(?: blank)?"/g)||[]).length,24);
  assert.match(sheets[0],/x="6.46" y="13.06"/);
  assert.match(sheets[0],/x="73" y="13.06"/);
  assert.match(sheets[0],/x="139.54" y="13.06"/);
  assert.match(sheets[0],/x="6.46" y="46.92"/);
  assert.match(sheets[0],/x="139.54" y="250.08"/);
  assert.match(sheets[1],/KD-0025/);
  assert.match(sheets[1],/class="label"><rect class="cut-guide" x="6.46" y="13.06"/);
  assert.match(html,/width="64" height="33.86"/);
});

test('31071 starts at slot 24 and moves next printed label to sheet two',async()=>{
  const {sheets}=await render(2,24,'31071');
  assert.equal(sheets.length,2);
  assert.equal((sheets[0].match(/class="label blank"/g)||[]).length,23);
  assert.match(sheets[0],/KD-0001/);
  assert.doesNotMatch(sheets[0],/KD-0002/);
  assert.match(sheets[1],/KD-0002/);
});

test('31373 is the standard sheet and uses 27 positions at the existing layout',async()=>{
  const {html,sheets}=await render(27,1);
  assert.equal(sheets.length,1);
  assert.match(sheets[0],/x="7" y="9"/);
  assert.match(sheets[0],/x="141" y="257"/);
  assert.match(html,/width="62" height="31"/);
});

test('both formats keep printed QR label as a single raster image',async()=>{
  for(const stock of ['31373','31071']){
    const {sheets}=await render(2,1,stock);
    assert.equal((sheets[0].match(/class="print-label-image"/g)||[]).length,2);
    assert.doesNotMatch(sheets[0],/class="label-inner"/);
  }
});


test('page counts and printed item order remain correct at every sheet boundary',async()=>{
  for(const [stock,capacity] of [['31373',27],['31071',24]]){
    for(const count of [1,capacity,capacity+1,capacity*2,capacity*2+1]){
      const {html,sheets}=await render(count,1,stock);
      assert.equal(sheets.length,Math.ceil(count/capacity));
      assert.equal((html.match(/<svg /g)||[]).length,sheets.length);
      assert.equal((html.match(/class="print-label-image"/g)||[]).length,count);
      const ids=[...html.matchAll(/<title>(KD-\d+) 備品/g)].map(m=>m[1]);
      assert.deepEqual(ids,Array.from({length:count},(_,i)=>'KD-'+String(i+1).padStart(4,'0')));
    }
  }
});

test('font readiness is awaited before rasterization begins',async()=>{
  let ready;let canvases=0;let written=false;
  const document={...mockDocument,fonts:{ready:new Promise(r=>ready=r)},createElement(tag){canvases++;return mockDocument.createElement(tag)}};
  const fn=vm.runInNewContext('(function(){const esc=String;'+source.slice(start,end)+';return writeLabelPrintWindow})()', {document,Image:FakeImage});
  const rendering=fn({document:{write(){written=true},close(){}}},[{name:'備品',img:'data:image/png;base64,TEST'}],1);
  assert.equal(canvases,0);assert.equal(written,false);
  ready();await rendering;assert.equal(canvases,2);assert.equal(written,true);
});

test('a failed QR image prevents printing an incomplete sheet',async()=>{
  class BrokenImage{set src(_){this.onerror();}}
  const fn=vm.runInNewContext('(function(){const esc=String;'+source.slice(start,end)+';return writeLabelPrintWindow})()', {document:mockDocument,Image:BrokenImage});
  let writes=0;
  await assert.rejects(()=>fn({document:{write(){writes++},close(){}}},[{name:'備品',img:'bad'}],1),/QR画像/);
  assert.equal(writes,0);
});

test('label names and document titles cannot add markup to the print page',async()=>{
  let html='';await helpers.writeLabelPrintWindow({document:{write(v){html=v},close(){}}},[{name:'<img src=x onerror=alert(1)>',asset_no:'KD-<&',img:'data:image/png;base64,TEST'}],1,'<script>danger</script>');
  assert.ok(html.includes('&lt;script&gt;danger&lt;/script&gt;'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(!html.includes('<img src=x'));
});


test('print document has executable load handling and a manual reprint control',async()=>{
  const {html}=await render(28,1);
  assert.ok(html.includes('onclick="window.print()"'));
  const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,1,'generated document closes its script element');
  let onLoad,prints=0,delay;
  vm.runInNewContext(scripts[0][1],{
    window:{addEventListener(type,fn){assert.equal(type,'load');onLoad=fn},print(){prints++}},
    document:{fonts:{ready:Promise.resolve()}},setTimeout(fn,ms){delay=ms;fn()}
  });
  assert.equal(prints,0);
  await onLoad();assert.equal(prints,1);assert.equal(delay,400);
});
