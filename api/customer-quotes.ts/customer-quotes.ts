import { list, put, del } from '@vercel/blob';

const PREFIX = 'customer-quotes/';
const syncKey = () => process.env.QUOTE_SYNC_KEY || process.env.VITE_QUOTE_SYNC_KEY || '';
function authorized(req: any) {
  const key = syncKey();
  if (!key) return true;
  return req.headers.authorization === `Bearer ${key}`;
}
function json(res: any, status: number, body: any) { res.status(status).setHeader('Content-Type','application/json').send(JSON.stringify(body)); }
function safe(s: string) { return String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_'); }

export default async function handler(req: any, res: any) {
  if (!authorized(req)) return json(res, 401, { error: 'Unauthorized' });
  try {
    if (req.method === 'GET') {
      const id = req.query?.id || req.query?.path;
      if (id) {
        const found = await list({ prefix: String(id).startsWith(PREFIX) ? String(id) : PREFIX + String(id) });
        const blob = found.blobs[0];
        if (!blob) return res.status(404).end();
        const r = await fetch(blob.url);
        res.status(r.status).setHeader('Content-Type', r.headers.get('content-type') || 'application/octet-stream');
        return res.send(Buffer.from(await r.arrayBuffer()));
      }
      const key = safe(req.query?.key || 'default');
      const result = await list({ prefix: PREFIX + key + '/' });
      const records = [];
      for (const b of result.blobs) {
        if (b.pathname.endsWith('.json')) {
          try { records.push(JSON.parse(await (await fetch(b.url)).text())); } catch {}
        }
      }
      return json(res, 200, records);
    }
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const key = safe(body.key || body.quoteKey || 'default');
      const id = safe(body.id || body.quoteId || Date.now().toString());
      const record = { ...body, id, key, savedAt: body.savedAt || new Date().toISOString() };
      delete record.pdf;
      await put(PREFIX + key + '/' + id + '.json', JSON.stringify(record), { access: 'public', contentType: 'application/json', addRandomSuffix: false });
      if (body.pdf) {
        const raw = String(body.pdf).replace(/^data:application\/pdf;base64,/, '');
        await put(PREFIX + key + '/' + id + '.pdf', Buffer.from(raw, 'base64'), { access: 'public', contentType: 'application/pdf', addRandomSuffix: false });
      }
      return json(res, 200, { ok: true, id, path: PREFIX + key + '/' + id + '.pdf' });
    }
    if (req.method === 'DELETE') {
      const id = String(req.query?.id || '');
      if (!id) return json(res, 400, { error: 'Missing id' });
      const found = await list({ prefix: id.startsWith(PREFIX) ? id : PREFIX + id });
      await Promise.all(found.blobs.map(b => del(b.url)));
      return json(res, 200, { ok: true });
    }
    res.setHeader('Allow','GET,POST,DELETE'); return res.status(405).end();
  } catch (e: any) { return json(res, 500, { error: e?.message || 'Server error' }); }
}
