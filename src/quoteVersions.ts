export type QuoteVersion<T> = { id: string; quoteId: string; version: number | string; savedAt: string; customerName: string; address: string; total: number; draft: T; receipt: string; pdf: Blob };
const DB = 'ls-staff-quote-versions-v1';
function open(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('versions',{keyPath:'id'});
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('無法開啟版本紀錄，請檢查瀏覽器儲存設定。'));
  });
}
export async function listVersions<T>():Promise<QuoteVersion<T>[]> {
  const db=await open();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('versions','readonly');const req=tx.objectStore('versions').getAll();tx.oncomplete=()=>resolve(req.result.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));tx.onerror=()=>reject(new Error('未能讀取版本紀錄。'));tx.onabort=()=>reject(new Error('讀取版本紀錄已中止。'));});}finally{db.close();}
}
export async function saveVersion<T>(input:Omit<QuoteVersion<T>,'id'|'version'|'savedAt'>):Promise<QuoteVersion<T>> {
  const db=await open();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('versions','readwrite');const store=tx.objectStore('versions');const req=store.getAll();let record:QuoteVersion<T>;
    req.onsuccess=()=>{const version=1+Math.max(0,...req.result.filter(r=>r.quoteId===input.quoteId).map(r=>Number(r.version)||0));record={...input,id:crypto.randomUUID(),version,savedAt:new Date().toISOString()};store.add(record);};
    tx.oncomplete=()=>resolve(record);
    tx.onerror=()=>reject(new Error('版本未能保存，可能儲存空間不足。請備份草稿後再試。'));
    tx.onabort=()=>reject(new Error('版本未能保存。PDF 未開始下載，請備份草稿後再試。'));
  });}finally{db.close();}
}
export function downloadVersionPdf(record:QuoteVersion<unknown>) {
  const url=URL.createObjectURL(record.pdf);const a=document.createElement('a');a.href=url;a.download=`LS_${record.customerName}_V${record.version}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
