import { put, list, get } from '@vercel/blob';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';
const MAX=4*1024*1024;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const text=(v,max=2000)=>typeof v==='string'&&v.length<=max;
const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e10;
function validDraft(d){
 if(!d||!d.customer||!Object.values(d.customer).every(v=>text(v))||!text(d.customer.name)||!number(d.packagePrice)||!text(d.packageName)||!text(d.notes)||!Array.isArray(d.categories)||d.categories.length>100||!Array.isArray(d.catalog)||d.catalog.length>1000||!d.selections)return false;
 const categories=new Set();for(const c of d.categories){if(!text(c.id,100)||categories.has(c.id)||!text(c.code,50)||!text(c.name,200)||!['package','extra'].includes(c.scope))return false;categories.add(c.id);}
 const ids=new Set();for(const i of d.catalog){const s=d.selections[i.id];if(!text(i.id,100)||ids.has(i.id)||!categories.has(i.categoryId)||!text(i.code,50)||!text(i.name,500)||!text(i.description,10000)||!text(i.unit,50)||!number(i.price)||!number(i.defaultQty)||!['included','reference','manual','optional'].includes(i.pricingMode)||!s||typeof s.selected!=='boolean'||!number(s.qty)||!number(s.unitPrice))return false;ids.add(i.id);}
 return true;
}
export function createHandler(storage={put,list,get},env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const reply=(code,value)=>res.status(code).json(value);
 if(!['GET','POST'].includes(req.method))return reply(405,{error:'Method not allowed'});
 if(!env.QUOTE_APP_ORIGIN||(!env.BLOB_STORE_ID&&!env.BLOB_READ_WRITE_TOKEN))return reply(503,{error:'報價儲存尚未設定。'});
 if((req.method==='POST'&&req.headers.origin!==env.QUOTE_APP_ORIGIN)||(req.headers.origin&&req.headers.origin!==env.QUOTE_APP_ORIGIN))return reply(403,{error:'不允許此來源。'});
 const options=env.BLOB_READ_WRITE_TOKEN?{token:env.BLOB_READ_WRITE_TOKEN}:{storeId:env.BLOB_STORE_ID};
 const read=async(path)=>{const r=await storage.get(path,{...options,access:'private'});if(!r||r.statusCode!==200)throw Error('missing');return new Response(r.stream);};
 try{
  if(req.method==='GET'){
   if(!/^[a-f0-9]{64}$/.test(env.STAFF_INBOX_KEY_HASH||''))return reply(503,{error:'客人報價收件箱未連接管理員。請設定 STAFF_INBOX_KEY_HASH。'});
   const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
   if(!token||!timingSafeEqual(createHash('sha256').update(token).digest(),Buffer.from(env.STAFF_INBOX_KEY_HASH,'hex')))return reply(403,{error:'此私人連結沒有客人報價收件箱權限。請使用公司管理員連結。'});
   const url=new URL(req.url,'https://local.invalid');const id=url.searchParams.get('id'),legacy=url.searchParams.get('path');
   if(id||legacy){let path=legacy;if(id){if(!uuid.test(id))return reply(400,{error:'報價編號不正確。'});const record=await(await read(`customer-quotes/records/${id}.json`)).json();path=record.pdfPath;}
    if(!/^quotes\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.pdf$/.test(path||''))return reply(400,{error:'PDF 路徑不正確。'});
    const pdf=await read(path);res.setHeader('Content-Type','application/pdf');return res.status(200).send(Buffer.from(await pdf.arrayBuffer()));}
   const old=url.searchParams.get('legacy')==='1';const prefix=old?'quotes/':'customer-quotes/records/';const page=await storage.list({...options,prefix,limit:50,cursor:url.searchParams.get('cursor')||undefined});
   const records=old?page.blobs.filter(b=>/^quotes\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.pdf$/.test(b.pathname)).map(b=>({path:b.pathname,savedAt:b.uploadedAt,size:b.size})):await Promise.all(page.blobs.map(async b=>{if(!b.pathname.startsWith(prefix))throw Error('scope');const record=await(await read(b.pathname)).json();const {pdfPath,...safe}=record;return safe;}));
   return reply(200,{records,cursor:page.hasMore?page.cursor:null});
  }
  if(req.headers['content-type']?.split(';')[0]!=='application/json')return reply(415,{error:'只接受報價資料。'});
  if(Number(req.headers['content-length'])>MAX)return reply(413,{error:'報價超過 4 MB，請聯絡公司。'});
  let body=req.body;if(body===undefined){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>MAX)return reply(413,{error:'報價過大。'});chunks.push(Buffer.from(chunk));}body=JSON.parse(Buffer.concat(chunks).toString());}else if(typeof body==='string'||Buffer.isBuffer(body))body=JSON.parse(body.toString());
  if(Buffer.byteLength(JSON.stringify(body))>MAX)return reply(413,{error:'報價過大。'});
  if(!validDraft(body?.draft)||typeof body.pdf!=='string')return reply(400,{error:'報價資料不完整，請重新整理後再試。'});
  const bytes=Buffer.from(body.pdf,'base64');if(bytes.subarray(0,5).toString()!=='%PDF-'||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))return reply(400,{error:'PDF 格式不正確。'});
  const id=randomUUID(),savedAt=new Date().toISOString(),d=body.draft;const draft={...d,quoteId:id,sourceSubmissionId:id};
  const total=d.packagePrice+d.catalog.reduce((sum,i)=>sum+(d.selections[i.id].selected&&!['included','reference'].includes(i.pricingMode)?Math.round(i.price*d.selections[i.id].qty*100)/100:0),0);
  const pdfPath=`quotes/${savedAt.slice(0,10)}/${id}.pdf`;const record={id,savedAt,customerName:d.customer.name||'未填姓名',address:[d.customer.estate,d.customer.block,d.customer.floor,d.customer.unit].filter(Boolean).join(' '),total,draft,pdfPath};
  await storage.put(pdfPath,bytes,{...options,access:'private',contentType:'application/pdf',addRandomSuffix:false,allowOverwrite:false});
  await storage.put(`customer-quotes/records/${id}.json`,JSON.stringify(record),{...options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false});
  return reply(201,{saved:true,receipt:id});
 }catch{return reply(502,{error:'報價未能讀取或保存，請稍後再試。'});}
};}
export default createHandler();
