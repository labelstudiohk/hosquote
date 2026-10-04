import type { CatalogItem, CatalogCategory } from './types';
export function normalizeNumbering<T extends {catalog:CatalogItem[];categories:CatalogCategory[]}>(draft:T):T {
  const categories:CatalogCategory[]=[];
  for(const scope of ['package','extra'] as const){
    draft.categories.filter(c=>c.scope===scope).forEach((c,index)=>categories.push({...c,code:(scope==='extra'?'自選 ':'')+String(index+(scope==='package'?0:1)).padStart(2,'0')}));
  }
  const catalog:CatalogItem[]=[];
  for(const category of categories){
    const prefix=category.code.match(/\d+/)![0];
    const members=draft.catalog.filter(i=>i.categoryId===category.id);
    // A moved row is appended; existing row order survives category renumbering.
    members.sort((a,b)=>Number(a.code==='NEW')-Number(b.code==='NEW'));
    members.forEach((item,index)=>catalog.push({...item,code:`${prefix}.${String(index+1).padStart(2,'0')}`}));
  }
  return {...draft,categories,catalog};
}
