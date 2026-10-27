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
  '(function(){ const esc = value => String(value); ' + source.slice(start, end) +
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
    assert.equal((sheet.match(/<div class="label(?: blank)?"/g) || []).length, 27);
  }
  assert.match(sheets[0], /KD-0027/);
  assert.doesNotMatch(sheets[0], /KD-0028/);
  assert.match(sheets[1], /KD-0028/);
  assert.match(sheets[1], /<div class="label" style="left:7mm;top:9mm"/);
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
  assert.match(sheets[1], /<div class="label" style="left:7mm;top:9mm"/);
  assert.match(sheets[0], /<div class="label" style="left:141mm;top:102mm"/);
});

test('page boundaries cannot alter absolute label coordinates', async () => {
  const {html} = await render(28, 1);
  assert.match(html, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(html, /\.sheet\{position:relative;width:210mm;height:296mm;/);
  assert.match(html, /\.label\{position:absolute;width:62mm;height:31mm;/);
  assert.match(html, /\.page-break\{break-after:page;page-break-after:always\}/);
  assert.doesNotMatch(html, /\.sheet\{[^\n]*height:297mm/);
});

test('QR and all text are combined into one image per printed label', async () => {
  const {sheets,html}=await render(28,1);
  assert.equal((html.match(/class="print-label-image"/g)||[]).length,28);
  assert.doesNotMatch(html,/class="label-inner"/);
  assert.doesNotMatch(html,/\.label-inner\{[^}]*rotate/);
  assert.match(sheets[0],/src="data:image\/png;base64,LABEL"/);
  assert.match(sheets[1],/src="data:image\/png;base64,LABEL"/);
});


test('31071 layout has exactly 24 positions at the vendor coordinates', async () => {
  const {html,sheets}=await render(25,1,'31071');
  assert.equal(sheets.length,2);
  assert.equal((sheets[0].match(/<div class="label(?: blank)?"/g)||[]).length,24);
  assert.equal((sheets[1].match(/<div class="label(?: blank)?"/g)||[]).length,24);
  assert.match(sheets[0],/left:6.46mm;top:13.06mm/);
  assert.match(sheets[0],/left:73mm;top:13.06mm/);
  assert.match(sheets[0],/left:139.54mm;top:13.06mm/);
  assert.match(sheets[0],/left:6.46mm;top:46.92mm/);
  assert.match(sheets[0],/left:139.54mm;top:250.08mm/);
  assert.match(sheets[1],/KD-0025/);
  assert.match(sheets[1],/class="label" style="left:6.46mm;top:13.06mm"/);
  assert.match(html,/\.label\{position:absolute;width:64mm;height:33.86mm/);
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
  assert.match(sheets[0],/left:7mm;top:9mm/);
  assert.match(sheets[0],/left:141mm;top:257mm/);
  assert.match(html,/\.print-label-image\{display:block;width:62mm;height:31mm/);
});

test('both formats keep printed QR label as a single raster image',async()=>{
  for(const stock of ['31373','31071']){
    const {sheets}=await render(2,1,stock);
    assert.equal((sheets[0].match(/class="print-label-image"/g)||[]).length,2);
    assert.doesNotMatch(sheets[0],/class="label-inner"/);
  }
});
