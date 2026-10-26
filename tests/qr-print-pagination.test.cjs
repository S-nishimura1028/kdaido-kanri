const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../js/qr-print.js'), 'utf8');
const start = source.indexOf('  function buildPages(');
const end = source.indexOf('\n  async function loadSelectedAssetInfo(', start);
assert.ok(start >= 0 && end > start, 'QR pagination helpers should exist');
const helpers = vm.runInNewContext(
  '(function(){ const esc = value => String(value); ' + source.slice(start, end) +
  '; return {buildPages,writeLabelPrintWindow}; })()'
);

function render(count, startPosition) {
  const labels = Array.from({length: count}, (_, index) => ({
    name: '備品 ' + (index + 1),
    asset_no: 'KD-' + String(index + 1).padStart(4, '0'),
    img: 'data:image/png;base64,TEST'
  }));
  let html = '';
  helpers.writeLabelPrintWindow({
    document: { write(value) { html = value; }, close() {} }
  }, labels, startPosition, 'テスト印刷');
  const sheets = html.split(/<section class="sheet(?: page-break)?"?>/).slice(1)
    .map(s => s.split('</section>')[0]);
  return {html, sheets};
}

test('28 labels become two exactly 27-slot pages', () => {
  const {sheets} = render(28, 1);
  assert.equal(sheets.length, 2);
  for (const sheet of sheets) {
    assert.equal((sheet.match(/<div class="label(?: blank)?"/g) || []).length, 27);
  }
  assert.match(sheets[0], /KD-0027/);
  assert.doesNotMatch(sheets[0], /KD-0028/);
  assert.match(sheets[1], /KD-0028/);
  assert.match(sheets[1], /<div class="label" style="left:7mm;top:9mm"/);
});

test('54 labels become two full pages, 55 labels become three pages', () => {
  assert.equal(render(54, 1).sheets.length, 2);
  assert.equal(render(55, 1).sheets.length, 3);
});

test('starting at an intermediate slot affects only the first page', () => {
  const {sheets} = render(28, 12);
  assert.equal(sheets.length, 2);
  assert.equal((sheets[0].match(/class="label blank"/g) || []).length, 11);
  assert.match(sheets[0], /KD-0016/);
  assert.doesNotMatch(sheets[0], /KD-0017/);
  assert.match(sheets[1], /KD-0017/);
  assert.match(sheets[1], /<div class="label" style="left:7mm;top:9mm"/);
  assert.match(sheets[0], /<div class="label" style="left:141mm;top:102mm"/);
});

test('page boundaries cannot alter absolute label coordinates', () => {
  const {html} = render(28, 1);
  assert.match(html, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(html, /\.sheet\{position:relative;width:210mm;height:296mm;/);
  assert.match(html, /\.label\{position:absolute;width:62mm;height:31mm;/);
  assert.match(html, /\.page-break\{break-after:page;page-break-after:always\}/);
  assert.doesNotMatch(html, /\.sheet\{[^\n]*height:297mm/);
});
