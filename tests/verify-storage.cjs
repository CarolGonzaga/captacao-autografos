// Teste manual de integração: grava um PNG de teste (1 pixel) no projeto configurado.
// Executar explicitamente com: node tests/verify-storage.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../supabase-config.js'), 'utf8'), context);
const config = context.window.SUPABASE_CONFIG;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1cAAAAASUVORK5CYII=', 'base64');
const path = `signatures/${randomUUID()}.png`;
const headers = { apikey: config.publishableKey };
const base = `${config.url}/storage/v1`;

async function upload(objectPath, authorName) {
  const form = new FormData();
  form.append('cacheControl', '3600');
  form.append('metadata', JSON.stringify({ author_name: authorName, submission_mode: 'upload' }));
  form.append('', new Blob([png], { type: 'image/png' }), 'teste.png');
  const response = await fetch(`${base}/object/${config.bucket}/${objectPath}`, {
    method: 'POST', headers: { ...headers, 'x-upsert': 'false' }, body: form,
    signal: AbortSignal.timeout(20000)
  });
  return { status: response.status, ok: response.ok, body: await response.json() };
}

(async () => {
  const invalid = await upload(`signatures/${randomUUID()}.png`, '');
  assert.ok(!invalid.ok, 'RLS deve recusar nome da autora vazio');
  console.log('RLS: nome vazio recusado', invalid.status);

  const result = await upload(path, 'TESTE DE INTEGRAÇÃO — pode remover');
  assert.ok(result.ok, `Upload falhou: ${JSON.stringify(result)}`);
  console.log('Upload PNG: OK');

  const url = `${base}/object/public/${config.bucket}/${path}`;
  const download = await fetch(url, { signal: AbortSignal.timeout(20000) });
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  console.log('Download público: bytes conferidos');

  const list = await fetch(`${base}/object/list/${config.bucket}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: 'signatures', limit: 100 }), signal: AbortSignal.timeout(20000)
  });
  const entries = await list.json();
  assert.ok(!list.ok || (Array.isArray(entries) && entries.length === 0), 'Visitantes não devem listar arquivos');
  console.log('Listagem anônima: sem acesso aos arquivos');
  console.log('Arquivo de teste salvo:', path);
})().catch(error => { console.error(error.message, error.cause?.code || ''); process.exitCode = 1; });
