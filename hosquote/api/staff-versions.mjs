import { put, list, get } from '@vercel/blob';
import { createHash, randomUUID } from 'node:crypto';
const MAX_BODY = 4 * 1024 * 1024;
const uuid = /^[a-f0-9-]{36}$/;
export function createHandler(storage = { put, list, get }, env = process.env) {
  return async (req,res) => {
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const reply=(code,body)=>res.status(code).json(body);
    if(!['GET','POST'].includes(req.method)) return reply(405,{error:'Method not allowed'});
    if(!env.QUOTE_APP_ORIGIN||(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN)) return reply(503,{error:'雲端版本儲存尚未設定。'});
    if((req.method==='POST'&&req.headers.origin!==env.QUOTE_APP_ORIGIN)||(req.headers.origin&&req.headers.origin!==env.QUOTE_APP_ORIGIN)) return reply(403,{error:'不允許此來源。'});
    const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if(!token) return reply(401,{error:'請使用私人同步連結連接報價紀錄。'});
    const prefix=`staff-versions/${createHash('sha256').update(token).digest('hex')}/`;
    const options=env.BLOB_READ_WRITE_TOKEN?{token:env.BLOB_READ_WRITE_TOKEN}:{storeId:env.BLOB_STORE_ID};
    const read=async path=>{const result=await storage.get(path,{...options,access:'private'});if(!result||result.statusCode!==200)throw new Error('missing');return new Response(result.stream);};
    try {
      const url=new URL(req.url,'https://local.invalid');
      if(req.method==='GET') {
        const id=url.searchParams.get('id');
        if(id){if(!uuid.test(id))return reply(400,{error:'版本編號不正確。'});const response=await read(`${prefix}pdf/${id}.pdf`);res.setHeader('Content-Type','application/pdf');return res.status(200).send(Buffer.from(await response.arrayBuffer()));}
        const page=await storage.list({...options,prefix:`${prefix}records/`,limit:50,cursor:url.searchParams.get('cursor')||undefined});
        const records=await Promise.all(page.blobs.map(async blob=>{if(!blob.pathname.startsWith(`${prefix}records/`))throw new Error('scope');return (await read(blob.pathname)).json();}));
        return reply(200,{records,cursor:page.hasMore?page.cursor:null});
      }
      if(req.headers['content-type']?.split(';')[0]!=='application/json')return reply(415,{error:'只接受報價資料。'});
      if(Number(req.headers['content-length'])>MAX_BODY)return reply(413,{error:'報價檔案過大。'});
      let body=req.body;
      if(body===undefined){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)return reply(413,{error:'報價檔案過大。'});chunks.push(Buffer.from(chunk));}body=JSON.parse(Buffer.concat(chunks).toString());}
      else if(typeof body==='string'||Buffer.isBuffer(body))body=JSON.parse(body.toString());
      if(Buffer.byteLength(JSON.stringify(body))>MAX_BODY)return reply(413,{error:'報價檔案過大。'});
      const d=body?.draft;
      if(!d||!uuid.test(d.quoteId)||typeof d.customer?.name!=='string'||!d.customer.name.trim()||!Array.isArray(d.catalog)||!Array.isArray(d.categories)||!d.selections||!Number.isFinite(body.total)||typeof body.pdf!=='string')return reply(400,{error:'報價資料不完整。'});
      const bytes=Buffer.from(body.pdf,'base64');
      if(bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))return reply(400,{error:'PDF 格式不正確。'});
      const id=randomUUID(),savedAt=new Date().toISOString();
      const record={id,quoteId:d.quoteId,version:savedAt.replace(/[-:TZ.]/g,'')+'-'+id.slice(0,6),savedAt,customerName:d.customer.name,address:[d.customer.estate,d.customer.block,d.customer.floor,d.customer.unit].filter(Boolean).join(' '),total:body.total,draft:d,receipt:typeof body.receipt==='string'?body.receipt:''};
      await storage.put(`${prefix}pdf/${id}.pdf`,bytes,{...options,access:'private',contentType:'application/pdf',addRandomSuffix:false,allowOverwrite:false});
      await storage.put(`${prefix}records/${id}.json`,JSON.stringify(record),{...options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
      return reply(201,{record});
    }catch{return reply(502,{error:'雲端版本未能讀取或保存，請稍後重試。'});}
  };
}
export default createHandler();
