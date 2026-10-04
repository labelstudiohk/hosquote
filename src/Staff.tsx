import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { defaultCatalog, defaultCategories, packageOptions, formatCurrency } from './catalog';
import type { CatalogItem, CatalogCategory, CustomerInfo, ItemSelection } from './types';
import { staffLines } from './staffPricing';
import { exportQuotePdf } from './exportQuote';
import { listVersions, saveVersion, downloadVersionPdf, type QuoteVersion } from './quoteVersions';
import { loadSyncKey, createSyncKey, listCloudVersions, saveCloudVersion, getCloudPdf, deleteCloudVersion } from './cloudVersions';
import { normalizeNumbering } from './staffNumbering';
import { inboxFingerprint,listCustomerQuotes,downloadCustomerPdf,type CustomerSubmission,type LegacyPdf } from './customerInbox';
import './staff.css';

const KEY = 'ls-hosquote-staff-v1';
const fixedIds=new Set(defaultCatalog.filter(i=>i.pricingMode==='included').map(i=>i.id));
const units=['項','個','套','件','組','幅','樘','盞','點','直尺','橫尺','平方呎','米','平方米'];
const num = (s: string) => Math.max(0, Number(s) || 0);
const blank: CustomerInfo = { name:'',phone:'',email:'',estate:'',block:'',floor:'',unit:'',area:'',packageId:'',furnitureLocations:'',kitchenDemolition:'',bathroomDemolition:'' };
type Draft = { quoteId: string; customer: CustomerInfo; catalog: CatalogItem[]; categories: CatalogCategory[]; selections: Record<string,ItemSelection>; packageName: string; packagePrice: number; notes: string };
const miscCategory: CatalogCategory = {id:'x-misc',code:'自選 05',name:'額外自選｜其他及雜項',scope:'extra'};
function withMisc(draft: Draft): Draft {
  return draft.categories.some(c=>c.id===miscCategory.id || (c.scope==='extra' && c.name.includes('其他及雜項'))) ? draft : {...draft,categories:[...draft.categories,{...miscCategory}]};
}
const fresh = (): Draft => ({ quoteId:crypto.randomUUID(), customer:{...blank}, catalog:structuredClone(defaultCatalog), categories:structuredClone([...defaultCategories,miscCategory]), selections:{},packageName:'另行報價',packagePrice:0,notes:'' });
function load(): Draft {
  try { const d=JSON.parse(localStorage.getItem(KEY)||'null'); if(d && Array.isArray(d.catalog)&&Array.isArray(d.categories)&&d.customer&&d.selections) return {...fresh(),...d}; } catch { /* use clean draft */ }
  return fresh();
}
export default function Staff() {
  const customerNameRef=useRef<HTMLInputElement>(null);
  const localPreview=['127.0.0.1','localhost','[::1]'].includes(window.location.hostname);
  const [draft,setRawDraft]=useState<Draft>(()=>normalizeNumbering(withMisc(load())));
  const setDraft=(action:SetStateAction<Draft>)=>setRawDraft(old=>normalizeNumbering(typeof action==='function'?action(old):action));
  const [syncKey,setSyncKey]=useState(loadSyncKey);
  const [showSyncLink,setShowSyncLink]=useState(false);
  const [versions,setVersions]=useState<QuoteVersion<Draft>[]>([]);
  const [inboxOpen,setInboxOpen]=useState(false);
  const [inbox,setInbox]=useState<CustomerSubmission<Draft>[]>([]);
  const [legacyPdfs,setLegacyPdfs]=useState<LegacyPdf[]>([]);
  const [inboxSearch,setInboxSearch]=useState('');
  const [inboxError,setInboxError]=useState('');
  const [fingerprint,setFingerprint]=useState('');
  useEffect(()=>{setInbox([]);setLegacyPdfs([]);setFingerprint('');if(syncKey)inboxFingerprint(syncKey).then(setFingerprint);},[syncKey]);
  async function refreshInbox(legacy=false){setBusy(true);setInboxError('');try{if(!syncKey)throw Error('請先開啟公司的私人同步連結。');if(legacy)setLegacyPdfs(await listCustomerQuotes<LegacyPdf>(syncKey,true));else setInbox((await listCustomerQuotes<CustomerSubmission<Draft>>(syncKey)).sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));}catch(e){setInboxError(e instanceof Error?e.message:'讀取失敗');}finally{setBusy(false);}}
  const [historySearch,setHistorySearch]=useState('');
  const [historyOpen,setHistoryOpen]=useState(false);
  useEffect(()=>{let active=true;const request=syncKey?listCloudVersions<Draft>(syncKey):listVersions<Draft>();request.then(v=>{if(active)setVersions(v);}).catch(e=>{if(active)setStatus(e.message);});return()=>{active=false;};},[syncKey]);
  const [search,setSearch]=useState('');
  const [categoryFilter,setCategoryFilter]=useState('all');
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>(()=>Object.fromEntries(defaultCategories.map(c=>[c.id,true])));
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState('');
  const [storageError,setStorageError]=useState('');
  const [newItem,setNewItem]=useState({ name:'',description:'',unit:'項',qty:'1',price:'0',categoryId:'',code:'' });
  useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(draft));setStorageError('');}catch{setStorageError('本機草稿未能儲存，請匯出草稿備份。');}},[draft]);
  const patch=(p:Partial<Draft>)=>setDraft(d=>({...d,...p}));
  const lines=staffLines(draft.catalog,draft.selections);
  const matches=(l:typeof lines[number])=>!search.trim() || [l.item.code,l.item.name,l.item.description].join(' ').toLowerCase().includes(search.trim().toLowerCase());
  const visibleCategories=draft.categories.filter(c=>(categoryFilter==='all'||categoryFilter===c.id)&&(!search.trim()||lines.some(l=>l.item.categoryId===c.id&&matches(l))));
  const extras=lines.reduce((s,l)=>s+l.amount,0);
  const update=(id:string,p:Partial<CatalogItem>)=>setDraft(d=>({...d,catalog:d.catalog.map(i=>i.id===id?{...i,...p,...(p.categoryId&&p.categoryId!==i.categoryId?{code:'NEW'}:{})}:i)}));
  const select=(item:CatalogItem,p:Partial<ItemSelection>)=>setDraft(d=>({...d,selections:{...d.selections,[item.id]:{...(d.selections[item.id] ?? {selected:item.pricingMode==='included',qty:item.defaultQty,unitPrice:item.price}),...p}}}));
  function applyPackage(id:string) {
    const option=packageOptions.find(p=>p.id===id);
    if(!option) {patch({packageName:'另行報價',packagePrice:0,customer:{...draft.customer,packageId:''}});return;}
    patch({packageName:option.label,packagePrice:option.price,customer:{...draft.customer,packageId:id},selections:{...draft.selections,'06.01':{selected:true,qty:option.includedFurnitureFeet,unitPrice:0}}});
  }
  function nextCode(categoryId:string) {
    const category=draft.categories.find(c=>c.id===categoryId);
    const prefix=category?.code.match(/\d+/)?.[0]||category?.code||'NEW';
    const numbers=draft.catalog.filter(i=>i.categoryId===categoryId).map(i=>Number(i.code.match(/\.(\d+)$/)?.[1])||0);
    return `${prefix}.${String(Math.max(0,...numbers)+1).padStart(2,'0')}`;
  }
  const addCategory=newItem.categoryId||draft.categories[0]?.id||'';
  const autoCode=nextCode(addCategory);
  function addItem() {
    if(!newItem.name.trim()) {setStatus('請填寫新增項目名稱。');return;}
    const categoryId=newItem.categoryId||draft.categories[0]?.id;
    if(!categoryId) {setStatus('請先新增分類。');return;}
    const id=crypto.randomUUID();
    setDraft(d=>({...d,catalog:[...d.catalog,{id,code:nextCode(categoryId),categoryId,name:newItem.name,description:newItem.description,unit:newItem.unit,defaultQty:num(newItem.qty),price:num(newItem.price),pricingMode:'manual'}],selections:{...d.selections,[id]:{selected:true,qty:num(newItem.qty),unitPrice:num(newItem.price)}}}));
    setCategoryFilter(categoryId);setSearch('');setCollapsed(v=>({...v,[categoryId]:false}));
    setNewItem({...newItem,name:'',description:'',code:''});setStatus('已加入手動項目並計入總額。');
  }
  function backup() {
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='LS-員工報價草稿.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function restoreVersion(record:QuoteVersion<Draft>) {
    if(!confirm(`載入 ${record.customerName} V${record.version}？現時未匯出的改動會被取代，請先匯出草稿備份。`)) return;
    setDraft(withMisc(structuredClone(record.draft)));setSearch('');setCategoryFilter('all');setStatus(`已載入 ${record.customerName} V${record.version}，下次匯出會另存新版本。`);
  }
  async function removeCloudVersion(record:QuoteVersion<Draft>) {
    if(!syncKey) return;
    if(!confirm(`確定刪除「${record.customerName} · V${record.version}」？此動作不能復原。`)) return;
    setBusy(true);setStatus('正在刪除雲端版本…');
    try { await deleteCloudVersion(syncKey,record.id); setVersions(v=>v.filter(x=>x.id!==record.id)); setStatus(`已刪除 ${record.customerName} · V${record.version}。`); }
    catch(e){setStatus(e instanceof Error?e.message:'刪除失敗');} finally {setBusy(false);}
  }
  async function exportPdf() {
    if(!localPreview&&!syncKey){setHistoryOpen(true);setStatus('請先啟用雲端同步，確保報價不會因清除網站資料而遺失。');window.scrollTo({top:0,behavior:'smooth'});return;}
    if(!draft.customer.name.trim()) {setStatus('請填寫客戶姓名。');customerNameRef.current?.focus();customerNameRef.current?.scrollIntoView({behavior:'smooth',block:'center'});return;}
    if(!lines.some(l=>l.included)&&draft.packagePrice===0) {setStatus('請選擇工程項目或填寫套餐金額。');return;}
    setBusy(true);setStatus('正在製作及保存 PDF…');
    const snapshot=structuredClone(draft);
    const printable=normalizeNumbering({categories:draft.categories,catalog:lines.filter(l=>l.included).map(l=>l.item)});
    const printLines=lines.filter(l=>l.included).map(l=>({...l,item:printable.catalog.find(i=>i.id===l.item.id)!}));
    let savedNumber:number|string=0;
    try {await exportQuotePdf({customer:draft.customer,categories:draft.categories,lines:printLines,packageTotal:draft.packagePrice,extrasTotal:extras,total:draft.packagePrice+extras,packageLabel:draft.packageName,notes:draft.notes},{localPreview,beforeDownload:async(pdf,receipt)=>{const record=syncKey?await saveCloudVersion(syncKey,snapshot,snapshot.packagePrice+extras,pdf,receipt):await saveVersion({quoteId:snapshot.quoteId,customerName:snapshot.customer.name,address:[snapshot.customer.estate,snapshot.customer.block,snapshot.customer.floor,snapshot.customer.unit].filter(Boolean).join(' '),total:snapshot.packagePrice+extras,draft:snapshot,receipt,pdf});savedNumber=record.version;setVersions(v=>[record,...v]);}});setStatus(`V${savedNumber} 已保存至${syncKey?'雲端':'此瀏覽器'}，PDF 下載已開始。${localPreview?'本機預覽未保存公司副本。':'公司 PDF 副本已保存。'}`);}
    catch(e){setStatus(`匯出失敗：${e instanceof Error?e.message:'請重試'}`);} finally{setBusy(false);}
  }
  return <div className="staff-shell">
    <header className="staff-top"><img src="/quote-assets/logo.png" alt="LABEL STUDIO"/><div><h1>員工報價工作台</h1><p>自由編輯・手動加項・私人 PDF 副本</p></div><a href="/">客人版</a></header>
    <div className="staff-toolbar"><button className="button ghost" disabled={busy} onClick={()=>{setInboxOpen(v=>!v);if(!inboxOpen)void refreshInbox();}}>客人提交報價</button><button className="button ghost" onClick={()=>setHistoryOpen(v=>!v)}>客戶報價版本（{versions.length}）</button><button className="button ghost" onClick={backup}>匯出草稿</button><button className="button ghost" onClick={()=>{if(confirm('開始另一份客戶報價？目前未匯出的改動會被取代，已保存版本會保留。')){setDraft(fresh());setStatus('');}}}>新增客戶報價</button><button className="button primary" disabled={busy} onClick={exportPdf}>{busy?'正在匯出…':'匯出報價 PDF'}</button></div>
    <p className="staff-notice">員工版沒有密碼。欄位改動只影響這份報價；匯出時會將 PDF 及客戶資料副本保存至公司。</p>
    <p>{storageError}</p>
    {inboxOpen&&<section className="paper-card"><h2>客人提交報價</h2><p>客人匯出時保存的原始報價。載入後修改，會另存員工版本，保留客人原單。</p><div className="staff-toolbar"><button className="button ghost" disabled={busy} onClick={()=>refreshInbox()}>重新讀取客人報價</button><button className="button ghost" disabled={busy} onClick={()=>refreshInbox(true)}>讀取舊 PDF 副本</button></div>{inboxError&&<p role="alert">{inboxError}</p>}{inboxError.includes('STAFF_INBOX_KEY_HASH')&&fingerprint&&<label>管理員連結識別碼（設定至 Vercel 的 STAFF_INBOX_KEY_HASH）<textarea readOnly value={fingerprint}/></label>}<label>搜尋客人／地址<input type="search" value={inboxSearch} onChange={e=>setInboxSearch(e.target.value)}/></label>{inbox.filter(v=>`${v.customerName} ${v.address}`.includes(inboxSearch.trim())).map(v=><div className="staff-version" key={v.id}><div><strong>{v.customerName}</strong><p>{v.address} · {new Date(v.savedAt).toLocaleString('zh-HK')} · {formatCurrency(v.total)}</p></div><button className="button primary" disabled={busy} onClick={()=>{if(confirm('載入此客人報價？目前未保存的改動會被取代。')){setDraft(withMisc(structuredClone(v.draft)));setCategoryFilter('all');setSearch('');setStatus('已載入客人報價，修改後匯出會保存為員工版本。');}}}>載入客人報價</button><button className="button ghost" onClick={()=>downloadCustomerPdf(syncKey,{id:v.id}).catch(e=>setInboxError(e.message))}>下載客人原單</button></div>)}{!busy&&!inboxError&&!inbox.length&&<p>暫未有新版客人提交紀錄。</p>}{legacyPdfs.length>0&&<><h3>PDF 副本（包括舊版，未必有可編輯資料）</h3>{legacyPdfs.map(v=><div className="staff-version" key={v.path}><div><p>{new Date(v.savedAt).toLocaleString('zh-HK')} · {Math.round(v.size/1024)} KB</p><small>{v.path.split('/').pop()}</small></div><button className="button ghost" onClick={()=>downloadCustomerPdf(syncKey,{path:v.path}).catch(e=>setInboxError(e.message))}>下載 PDF</button></div>)}</>}</section>}
    {historyOpen&&<section className="paper-card"><h2>客戶報價版本</h2><p>{syncKey?'已連接私人雲端紀錄。手機開啟同一條私人同步連結，即可載入同一批報價。':'尚未啟用雲端同步。正式版匯出前必須先啟用，確保版本存於雲端。'}</p><p>每次匯出保留獨立版本，舊版本不會被覆蓋。</p><div className="staff-toolbar">{!syncKey?<button className="button primary" disabled={localPreview||busy} onClick={()=>{try{setSyncKey(createSyncKey());setVersions([]);setShowSyncLink(true);}catch{setStatus('瀏覽器未能保存同步設定。');}}}>啟用雲端同步</button>:<><button className="button ghost" onClick={()=>setShowSyncLink(v=>!v)}>顯示私人同步連結</button><button className="button ghost" disabled={busy} onClick={async()=>{setBusy(true);try{const local=await listVersions<Draft>();const remote=await listCloudVersions<Draft>(syncKey);for(const v of local){if(!remote.some(r=>(r.draft as Draft & {migratedFrom?:string}).migratedFrom===v.id))await saveCloudVersion(syncKey,{...v.draft,migratedFrom:v.id},v.total,v.pdf,v.receipt);}setVersions(await listCloudVersions<Draft>(syncKey));setStatus("本機舊版本已備份至雲端。");}catch(e){setStatus(e instanceof Error?e.message:"備份失敗");}finally{setBusy(false);}}}>備份本機舊版本</button><button className="button ghost" disabled={busy} onClick={()=>listCloudVersions<Draft>(syncKey).then(setVersions).catch(e=>setStatus(e.message))}>重新整理紀錄</button></>}</div>{localPreview&&!syncKey&&<p>跨裝置同步需要先上載新版至正式網站；本機預覽只儲存本機版本。</p>}{showSyncLink&&syncKey&&<label>私人同步連結（請自行保存，只傳到自己的裝置）<textarea readOnly value={location.origin+location.pathname+'#sync='+syncKey}/><small>持有此連結即可讀取整批客戶報價。請將連結加書籤及另外備份。清除網站資料不會刪除雲端報價；重新開啟這條連結即可恢復存取。</small></label>}<label>搜尋客戶／地址<input type="search" value={historySearch} onChange={e=>setHistorySearch(e.target.value)} placeholder="客戶姓名或工程地址"/></label>{versions.filter(v=>`${v.customerName} ${v.address}`.toLowerCase().includes(historySearch.trim().toLowerCase())).map(v=><div className="staff-version" key={v.id}><div><strong>{v.customerName} · V{v.version}</strong><p>{v.address||'未填地址'} · {new Date(v.savedAt).toLocaleString('zh-HK')} · {formatCurrency(v.total)}</p><small>報價 {v.quoteId.slice(0,8)}</small></div><button className="button ghost" disabled={busy} onClick={()=>restoreVersion(v)}>載入修改</button><button className="button ghost" onClick={async()=>{try{downloadVersionPdf(syncKey?{...v,pdf:await getCloudPdf(syncKey,v.id)}:v);}catch(e){setStatus(e instanceof Error?e.message:'下載失敗');}}}>下載原版 PDF</button></div>)}{!versions.length&&<p>未有版本，第一次匯出 PDF 後會自動加入。</p>}</section>}

    <section className="paper-card"><h2>客戶資料</h2><div className="form-grid">{([['name','客戶姓名'],['phone','電話'],['email','電郵'],['estate','屋苑／工程地址'],['block','座數'],['floor','樓層'],['unit','單位'],['area','實用面積（呎）']] as const).map(([key,label])=><label key={key}>{label}<input ref={key==='name'?customerNameRef:undefined} required={key==='name'} value={draft.customer[key]} onChange={e=>patch({customer:{...draft.customer,[key]:e.target.value}})}/></label>)}</div></section>
    <section className="paper-card"><h2>套餐及報價備註</h2><div className="form-grid"><label>套用預設套餐<select value={draft.customer.packageId} onChange={e=>applyPackage(e.target.value)}><option value="">另行報價</option>{packageOptions.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label><label>套餐名稱<input value={draft.packageName} onChange={e=>patch({packageName:e.target.value})}/></label><label>套餐金額（HK$）<input type="number" min="0" value={draft.packagePrice} onChange={e=>patch({packagePrice:num(e.target.value)})}/></label></div><label>報價備註（會印於 PDF）<textarea rows={3} value={draft.notes} onChange={e=>patch({notes:e.target.value})}/></label><p>套餐原有包括項目已鎖定，不可修改或刪除。額外工程及手動項目可自由編輯。</p></section>
    <section className="paper-card staff-add"><h2>手動新增項目</h2><div className="form-grid"><label>分類<select value={newItem.categoryId||draft.categories[0]?.id||''} onChange={e=>setNewItem({...newItem,categoryId:e.target.value})}>{draft.categories.map(c=><option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</select></label>{([['code','項目編號'],['name','工程名稱'],['unit','單位'],['qty','數量'],['price','單價（HK$）']] as const).map(([key,label])=><label key={key}>{label}{key==='unit'?<select value={newItem.unit} onChange={e=>setNewItem({...newItem,unit:e.target.value})}>{units.map(u=><option key={u}>{u}</option>)}</select>:<input type={key==='qty'||key==='price'?'number':'text'} min="0" readOnly={key==='code'} value={key==='code'?autoCode:newItem[key]} onChange={e=>setNewItem({...newItem,[key]:e.target.value})}/>}</label>)}</div><label>備註<textarea rows={2} value={newItem.description} onChange={e=>setNewItem({...newItem,description:e.target.value})}/></label><button className="button primary" onClick={addItem}>＋ 新增並計入報價</button></section>
    <div className="staff-section-title"><h2>工程項目</h2><button className="button ghost" onClick={()=>patch({categories:[...draft.categories,{id:crypto.randomUUID(),code:'新增',name:'新增分類',scope:'extra'}]})}>＋ 新增分類</button></div>
    <div className="paper-card staff-filters"><label>搜尋工程<input type="search" placeholder="輸入編號、工程名稱或備註" value={search} onChange={e=>setSearch(e.target.value)}/></label><label>小分類<select value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setCollapsed(v=>({...v,[e.target.value]:false}));}}><option value="all">全部小分類</option>{(['package','extra'] as const).map(scope=><optgroup key={scope} label={scope==='package'?'套餐工程':'額外工程'}>{draft.categories.filter(c=>c.scope===scope).map(c=><option key={c.id} value={c.id}>{c.code} {c.name}</option>)}</optgroup>)}</select></label><div className="staff-filter-actions"><button className="button ghost" onClick={()=>setCollapsed(Object.fromEntries(draft.categories.map(c=>[c.id,false])))}>全部展開</button><button className="button ghost" onClick={()=>setCollapsed(Object.fromEntries(draft.categories.map(c=>[c.id,true])))}>全部收合</button></div></div>
    {!visibleCategories.length&&<p>沒有符合的工程項目。</p>}
    {visibleCategories.map(c=><section className="paper-card staff-group" key={c.id}><button className="staff-group-toggle" aria-expanded={(!collapsed[c.id]||!!search.trim())} onClick={()=>setCollapsed(v=>({...v,[c.id]:!v[c.id]}))}><span><small>{c.scope==='package'?'套餐工程':'額外工程'}</small><strong>{c.code} {c.name}</strong></span><span>{lines.filter(l=>l.item.categoryId===c.id&&matches(l)).length} 項 {collapsed[c.id]?'＋':'－'}</span></button>{(!collapsed[c.id]||!!search.trim())&&<><details className="staff-category-settings"><summary>修改分類名稱及範圍</summary><div className="staff-category"><input aria-label="分類編號（自動）" readOnly value={c.code}/><input aria-label="分類名稱" value={c.name} onChange={e=>patch({categories:draft.categories.map(x=>x.id===c.id?{...x,name:e.target.value}:x)})}/><select aria-label="分類範圍" value={c.scope} onChange={e=>patch({categories:draft.categories.map(x=>x.id===c.id?{...x,scope:e.target.value as 'package'|'extra'}:x)})}><option value="package">套餐工程</option><option value="extra">額外工程</option></select><button className="text-button danger" onClick={()=>{if(draft.catalog.some(i=>i.categoryId===c.id)){setStatus('請先移走或刪除分類內項目。');return;}patch({categories:draft.categories.filter(x=>x.id!==c.id)});}}>刪除分類</button></div></details>
      {lines.filter(l=>l.item.categoryId===c.id&&matches(l)).map(l=>{const i=l.item;const locked=fixedIds.has(i.id);return <article className="staff-item" key={i.id}><h3 className="staff-item-title">{i.code} · {i.name}{locked&&<small>　套餐包括・已鎖定</small>}</h3><fieldset disabled={locked} className="staff-fields"><div className="staff-item-head"><label><input type="checkbox" checked={l.included} onChange={e=>select(i,{selected:e.target.checked})}/> 計入報價</label><strong>{i.pricingMode==='included'?'套餐包括':i.pricingMode==='reference'?`參考 ${formatCurrency(l.effectiveQty*l.effectiveUnitPrice)}`:formatCurrency(l.amount)}</strong><button className="text-button danger" onClick={()=>{if(confirm(`刪除「${i.name}」？`))patch({catalog:draft.catalog.filter(x=>x.id!==i.id)});}}>刪除</button></div><div className="form-grid">
        <label>編號（自動）<input readOnly value={i.code}/></label><label>工程名稱<input value={i.name} onChange={e=>update(i.id,{name:e.target.value})}/></label><label>單位<select value={i.unit} onChange={e=>update(i.id,{unit:e.target.value})}>{Array.from(new Set([i.unit,...units])).map(u=><option key={u}>{u}</option>)}</select></label><label>數量<input type="number" min="0" step="any" value={l.effectiveQty} onChange={e=>select(i,{qty:num(e.target.value)})}/></label><label>單價（HK$）<input type="number" min="0" step="any" value={i.price} onChange={e=>update(i.id,{price:num(e.target.value)})}/></label><label>計價方式<select value={i.pricingMode} onChange={e=>update(i.id,{pricingMode:e.target.value as CatalogItem['pricingMode']})}><option value="included">套餐包括</option><option value="manual">手動計價</option><option value="optional">自選計價</option><option value="reference">參考價（不計總額）</option></select></label><label>所屬分類<select value={i.categoryId} onChange={e=>update(i.id,{categoryId:e.target.value})}>{draft.categories.map(x=><option key={x.id} value={x.id}>{x.code} {x.name}</option>)}</select></label>
      </div><label>備註<textarea rows={3} value={i.description} onChange={e=>update(i.id,{description:e.target.value})}/></label></fieldset></article>;})}</>}</section>)}
    <footer className="staff-total">{status&&<div className="staff-export-status" role="status" aria-live="polite">{status}</div>}<span>套餐 {formatCurrency(draft.packagePrice)} ＋ 工程 {formatCurrency(extras)}</span><strong>總額 {formatCurrency(draft.packagePrice+extras)}</strong><button className="button primary" disabled={busy} onClick={exportPdf}>{busy?'正在匯出…':'匯出 PDF'}</button></footer>
  </div>;
}
