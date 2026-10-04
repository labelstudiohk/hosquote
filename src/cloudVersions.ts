import type { QuoteVersion } from './quoteVersions';
const KEY='ls-staff-sync-key-v1';
export function loadSyncKey():string {
  const incoming=new URLSearchParams(location.hash.slice(1)).get('sync');
  if(incoming&&/^[a-f0-9]{64}$/.test(incoming)) {localStorage.setItem(KEY,incoming);history.replaceState(null,'',location.pathname+location.search);return incoming;}
  return localStorage.getItem(KEY)||'';
}
export function createSyncKey():string {const key=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');localStorage.setItem(KEY,key);return key;}
async function checked(response:Response) {if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error||'雲端同步失敗，請稍後再試。');}return response;}
export async function listCloudVersions<T>(key:string):Promise<QuoteVersion<T>[]> {
  let cursor:string|null=null;const records:QuoteVersion<T>[]=[];
  do{const response=await checked(await fetch('/api/staff-versions'+(cursor?'?cursor='+encodeURIComponent(cursor):''),{headers:{Authorization:'Bearer '+key},cache:'no-store'}));const data=await response.json();records.push(...data.records);cursor=data.cursor;}while(cursor);
  return records.sort((a,b)=>b.savedAt.localeCompare(a.savedAt));
}
export async function saveCloudVersion<T>(key:string,draft:T,total:number,pdf:Blob,receipt:string):Promise<QuoteVersion<T>> {
  const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('未能讀取 PDF。'));reader.readAsDataURL(pdf);});
  const response=await checked(await fetch('/api/staff-versions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({draft,total,pdf:base64,receipt})}));
  return {...(await response.json()).record,pdf};
}
export async function getCloudPdf(key:string,id:string):Promise<Blob> {return (await checked(await fetch('/api/staff-versions?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+key},cache:'no-store'}))).blob();}
export async function deleteCloudVersion(key:string,id:string):Promise<void> {await checked(await fetch('/api/staff-versions?id='+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:'Bearer '+key}}));}
