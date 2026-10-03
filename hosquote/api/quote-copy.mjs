import { put } from '@vercel/blob';
import { randomUUID } from 'node:crypto';

export const MAX_PDF_BYTES = 4 * 1024 * 1024;

// No read/list/delete endpoint: copies are accessible only in the owner's Vercel dashboard.
export function createHandler(store = put, env = process.env) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (status, body) => res.status(status).json(body);
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return reply(405, { error: 'Method not allowed' });
    }
    if ((!env.BLOB_READ_WRITE_TOKEN && !env.BLOB_STORE_ID) || !env.QUOTE_APP_ORIGIN) {
      return reply(503, { error: '公司副本儲存尚未設定，請聯絡公司。' });
    }
    if (req.headers.origin !== env.QUOTE_APP_ORIGIN) {
      return reply(403, { error: '不允許此來源上傳。' });
    }
    if (req.headers['content-type']?.split(';')[0] !== 'application/pdf') {
      return reply(415, { error: '只接受 PDF。' });
    }
    if (Number(req.headers['content-length']) > MAX_PDF_BYTES) {
      return reply(413, { error: 'PDF 超過 4 MB，請聯絡公司。' });
    }
    try {
      let bytes;
      if (Buffer.isBuffer(req.body)) bytes = req.body;
      else if (req.body !== undefined) return reply(400, { error: 'PDF 格式不正確。' });
      else {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          const buffer = Buffer.from(chunk);
          size += buffer.length;
          if (size > MAX_PDF_BYTES) return reply(413, { error: 'PDF 超過 4 MB，請聯絡公司。' });
          chunks.push(buffer);
        }
        bytes = Buffer.concat(chunks);
      }
      if (bytes.length > MAX_PDF_BYTES) return reply(413, { error: 'PDF 超過 4 MB，請聯絡公司。' });
      if (bytes.length < 8 || bytes.subarray(0, 5).toString() !== '%PDF-' || !bytes.subarray(-1024).includes(Buffer.from('%%EOF'))) {
        return reply(400, { error: 'PDF 格式不正確。' });
      }
      const id = randomUUID();
      const date = new Date().toISOString().slice(0, 10);
      await store(`quotes/${date}/${id}.pdf`, bytes, {
        access: 'private', contentType: 'application/pdf',
        addRandomSuffix: false, allowOverwrite: false,
        ...(env.BLOB_READ_WRITE_TOKEN ? { token: env.BLOB_READ_WRITE_TOKEN } : { storeId: env.BLOB_STORE_ID }),
      });
      // Never expose private blob URLs or credentials to anonymous customers.
      return reply(201, { saved: true, receipt: id });
    } catch {
      return reply(502, { error: '公司副本未能保存，請稍後再試。' });
    }
  };
}

export default createHandler();
