import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHandler, MAX_PDF_BYTES } from '../api/quote-copy.mjs';

const env = { BLOB_READ_WRITE_TOKEN: 'test-token', QUOTE_APP_ORIGIN: 'https://hosquote.vercel.app' };
const pdf = Buffer.from('%PDF-1.7\nexample\n%%EOF');
async function invoke({ method = 'POST', origin = env.QUOTE_APP_ORIGIN, type = 'application/pdf', body = pdf, store = async () => ({}), config = env, stream = false } = {}) {
  const req = Readable.from([body]);
  Object.assign(req, { method, headers: { origin, 'content-type': type }, body: stream ? undefined : body });
  const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.code=n; return this; }, json(value) { this.value=value; } };
  await createHandler(store, config)(req,res);
  return res;
}
test('saves exact PDF privately and does not return storage URL', async () => {
  let called = false;
  const res = await invoke({ stream: true, store: async (name, bytes, options) => {
    called = true;
    assert.match(name, /^quotes\/\d{4}-\d{2}-\d{2}\/[\w-]+\.pdf$/);
    assert.deepEqual(bytes,pdf);
    assert.equal(options.access,'private');
    assert.equal(options.allowOverwrite,false);
    return { url: 'private-url' };
  }});
  assert.equal(called,true); assert.equal(res.code,201);
  assert.equal(res.value.saved,true); assert.equal(res.value.url,undefined);
});
test('rejects other origins, missing configuration and non-PDF bodies without storing', async () => {
  const store = async () => { throw new Error('must not store'); };
  assert.equal((await invoke({origin:'https://other.example',store})).code,403);
  assert.equal((await invoke({config:{},store})).code,503);
  assert.equal((await invoke({type:'text/html',store})).code,415);
  assert.equal((await invoke({body:Buffer.from('not pdf'),store})).code,400);
  assert.equal((await invoke({method:'GET',store})).code,405);
});
test('rejects oversized PDF both parsed and streaming', async () => {
  const body=Buffer.alloc(MAX_PDF_BYTES+1);
  assert.equal((await invoke({body})).code,413);
  assert.equal((await invoke({body,stream:true})).code,413);
});
test('storage failure never reports success', async () => {
  const res=await invoke({store:async()=>{throw new Error('secret provider message');}});
  assert.equal(res.code,502); assert.equal(res.value.saved,undefined);
  assert.ok(!JSON.stringify(res.value).includes('secret'));
});
test('supports connected stores using Vercel OIDC without a static token', async () => {
  let options;
  const res = await invoke({ config: { BLOB_STORE_ID: 'store_example', QUOTE_APP_ORIGIN: env.QUOTE_APP_ORIGIN }, store: async (_name, _bytes, value) => { options=value; } });
  assert.equal(res.code,201);
  assert.equal(options.storeId,'store_example');
  assert.equal(options.token,undefined);
});
