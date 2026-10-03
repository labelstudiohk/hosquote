import type { CatalogItem, CatalogCategory } from './types';
import { defaultCatalog } from './catalog';
const compare=(a:string,b:string)=>a.localeCompare(b,'en',{numeric:true});
export function normalizeNumbering<T extends {catalog:CatalogItem[];categories:CatalogCategory[]}>(draft:T):T {
  const categories=draft.categories.map(c=>({...c}));
  for(const scope of ['package','extra'] as const){
    const used=new Set<number>();let next=scope==='package'?0:1;
    for(const c of categories.filter(c=>c.scope===scope)){
      let n=Number(c.code.match(/\d+/)?.[0]);
      if(!Number.isFinite(n)||used.has(n)){while(used.has(next))next++;n=next;}
      used.add(n);c.code=(scope==='extra'?'自選 ':'')+String(n).padStart(2,'0');
    }
  }
  categories.sort((a,b)=>(a.scope===b.scope?compare(a.code,b.code):a.scope==='package'?-1:1));
  const catalog:CatalogItem[]=[];
  for(const category of categories){
    const prefix=category.code.match(/\d+/)![0];const used=new Set<number>();
    const members=draft.catalog.filter(i=>i.categoryId===category.id).map(i=>({...i}));
    // Keep established catalogue references, then repair added or moved rows.
    const ordered=[...members].sort((a,b)=>Number(defaultCatalog.some(i=>i.id===b.id&&i.categoryId===category.id))-Number(defaultCatalog.some(i=>i.id===a.id&&i.categoryId===category.id)));
    let next=Math.max(0,...members.map(i=>Number(i.code.match(new RegExp('^'+prefix+'\\.(\\d+)$'))?.[1])||0))+1;
    for(const item of ordered){
      const original=defaultCatalog.find(i=>i.id===item.id&&i.categoryId===category.id);
      let n=Number((original?.code||item.code).match(new RegExp('^'+prefix+'\\.(\\d+)$'))?.[1]);
      if(!Number.isFinite(n)||n<1||used.has(n)){while(used.has(next))next++;n=next++;}
      used.add(n);item.code=`${prefix}.${String(n).padStart(2,'0')}`;
    }
    catalog.push(...members.sort((a,b)=>compare(a.code,b.code)));
  }
  return {...draft,categories,catalog};
}
