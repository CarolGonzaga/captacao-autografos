const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');

function app({ key = 'sb_publishable_test', uploadError = null } = {}) {
  const elements = new Map();
  const drawing = new Proxy({}, { get: (_, key) => key === 'getImageData'
    ? () => ({ data: new Uint8ClampedArray() }) : () => {} });
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', style: {}, width: 0, height: 0, offsetWidth: 500,
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener() {}, getContext: () => drawing, focus() {},
      toDataURL: () => 'data:image/png;base64,test',
      toBlob: callback => callback(new Blob(['image'], { type: 'image/png' }))
    });
    return elements.get(id);
  }
  const uploads = [];
  const opened = [];
  const storage = {
    async upload(path, file, options) {
      uploads.push({ path, file, options });
      return { data: uploadError ? null : { path }, error: uploadError };
    },
    getPublicUrl: path => ({ data: { publicUrl: `https://example.test/${path}` } })
  };
  const context = vm.createContext({
    document: { getElementById: element, createElement: () => element('offscreen'), querySelectorAll: () => [] },
    window: { SUPABASE_CONFIG: { publishableKey: key }, _storageReady: Promise.resolve(storage),
      addEventListener() {}, devicePixelRatio: 1, open: (...args) => opened.push(args) },
    File, Blob, crypto: webcrypto, Uint8ClampedArray,
    console: { error() {} }, setTimeout: () => 0, clearTimeout() {}
  });
  vm.runInContext(source, context);
  element('authorName').value = 'Autora de teste';
  return { context, element, uploads, opened,
    run: code => vm.runInContext(code, context),
    selectUpload() { this.run("currentMode = 'upload'; uploadedFile = new File(['image'], 'foto.jpeg', { type: 'image/jpeg' })"); }
  };
}

test('saves image and author metadata, then uses the saved author in WhatsApp', async () => {
  const page = app();
  page.selectUpload();
  await page.run('handleSubmit()');
  assert.equal(page.uploads.length, 1);
  assert.match(page.uploads[0].path, /^signatures\/[0-9a-f-]{36}\.jpg$/);
  assert.equal(page.uploads[0].options.metadata.author_name, 'Autora de teste');
  assert.equal(page.uploads[0].options.metadata.submission_mode, 'upload');
  assert.equal(page.uploads[0].options.upsert, false);
  assert.ok(page.element('successMsg').textContent.includes('Autora de teste'));
  page.element('authorName').value = 'Nome alterado';
  page.run('openWhatsApp()');
  assert.ok(decodeURIComponent(page.opened[0][0]).includes('Autora de teste'));
  assert.ok(!decodeURIComponent(page.opened[0][0]).includes('Nome alterado'));
});

test('canvas submission produces a PNG with draw metadata', async () => {
  const page = app();
  page.run('hasDrawing = true');
  await page.run('handleSubmit()');
  assert.equal(page.uploads[0].file.type, 'image/png');
  assert.equal(page.uploads[0].options.metadata.submission_mode, 'draw');
});

test('failed storage upload never presents success and releases submit button', async () => {
  const page = app({ uploadError: new Error('denied') });
  page.selectUpload();
  await page.run('handleSubmit()');
  assert.equal(page.element('successMsg').textContent, undefined);
  assert.ok(page.element('toast').textContent.includes('Erro ao enviar'));
  assert.equal(page.element('submitBtn').disabled, false);
});

test('missing public key prevents sending', async () => {
  const page = app({ key: '' });
  page.selectUpload();
  await page.run('handleSubmit()');
  assert.equal(page.uploads.length, 0);
  assert.ok(page.element('toast').textContent.includes('ainda não está disponível'));
});

test('empty drawing prevents sending and releases submit button', async () => {
  const page = app();
  await page.run('handleSubmit()');
  assert.equal(page.uploads.length, 0);
  assert.equal(page.element('submitBtn').disabled, false);
});

test('concurrent clicks only produce one upload', async () => {
  const page = app();
  page.selectUpload();
  await page.run('Promise.all([handleSubmit(), handleSubmit()])');
  assert.equal(page.uploads.length, 1);
});
