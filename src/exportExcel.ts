import type { CatalogCategory, CustomerInfo } from './types';
import type { QuoteLine } from './pricing';
import { packageOptions } from './catalog';
type QuoteData = { customer: CustomerInfo; categories: CatalogCategory[]; lines: QuoteLine[]; packageTotal: number; extrasTotal: number; total: number };
const xml = (v: unknown) => String(v).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// Uncompressed ZIP keeps the browser exporter self-contained and available offline.
function zip(files: Record<string,string>): Uint8Array {
  const enc=new TextEncoder(), parts:Uint8Array[]=[], entries:Uint8Array[]=[];let offset=0;
  const crc=(data:Uint8Array)=>{let n=0xffffffff;for(const b of data){n^=b;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;};
  for(const [name,value] of Object.entries(files)){
    const filename=enc.encode(name),data=enc.encode(value),sum=crc(data),header=new Uint8Array(30+filename.length),h=new DataView(header.buffer);
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint32(14,sum,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,filename.length,true);header.set(filename,30);
    const central=new Uint8Array(46+filename.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint32(16,sum,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);central.set(filename,46);entries.push(central);parts.push(header,data);offset+=header.length+data.length;
  }
  const size=entries.reduce((n,e)=>n+e.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);parts.push(...entries,end);const result=new Uint8Array(offset+size+22);let pos=0;for(const p of parts){result.set(p,pos);pos+=p.length;}return result;
}
export function createQuoteExcel(data:QuoteData):Uint8Array {
  const rows:string[]=[];let n=0;
  const add=(values:(string|number)[],style=0,height=26,formula?:string)=>{n++;rows.push(`<row r="${n}" ht="${height}" customHeight="1">${values.map((v,i)=>{const ref=String.fromCharCode(65+i)+n;return typeof v==='number'?`<c r="${ref}" s="${i>=5?3:style}">${formula&&i===6?`<f>${xml(formula)}</f>`:''}<v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`);return n;};
  add(['LABEL STUDIO LIMITED｜工程報價書'],1,32);
  add(['57228388｜labelstudiohk@gmail.com']);
  add(['客戶',data.customer.name,'電話',data.customer.phone]);
  add(['工程地址',[data.customer.estate,data.customer.block,data.customer.floor,data.customer.unit].filter(Boolean).join(' ')]);
  add(['套餐',packageOptions.find(p=>p.id===data.customer.packageId)?.label||'另行報價']);
  add(['報價日期',new Date().toLocaleDateString('en-GB')]);
  const packageRow=add(['套餐總額','','','','','',data.packageTotal],1);
  const extraRow=add(['額外工程總額','','','','','',data.extrasTotal],1);
  add(['報價總額','','','','','',data.total],1,30,`G${packageRow}+G${extraRow}`);
  add(['備註：電力及弱電只列參考價，不計入總額。單價、單位及備註固定。']);
  add(['編號','工程項目','備註','數量','單位','單價 (HK$)','金額 (HK$)'],1,28);
  const amountRows:number[]=[];
  for(const category of data.categories){
    const lines=data.lines.filter(l=>l.item.categoryId===category.id&&(l.included||l.item.pricingMode==='reference'));
    if(!lines.length)continue;
    add([`${category.scope==='package'?'套餐':'自選'} ${category.code}`,category.name],1);
    for(const l of lines){
      const included=l.item.pricingMode==='included',reference=l.item.pricingMode==='reference';
      const r=add([l.item.code,l.item.name,l.item.description,l.effectiveQty,l.item.unit,included?'已包括':l.effectiveUnitPrice,included?'已包括':reference?'參考，不計總額':l.amount],0,Math.max(48,l.item.description.split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil(s.length/30)),0)*16),!included&&!reference?`D${n+1}*F${n+1}`:undefined);
      if(!included&&!reference)amountRows.push(r);
    }
  }
  rows[extraRow-1]=rows[extraRow-1].replace(`<v>${data.extrasTotal}</v>`,`<f>${amountRows.length?amountRows.map(r=>'G'+r).join('+'):'0'}</f><v>${data.extrasTotal}</v>`);
  // Remarks use their own grey, wrapped style; all exported cells remain protected.
  const body=rows.join('').replace(/(<c r="C\d+" s=")0(" t="inlineStr")/g,'$12$2');
  const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  return zip({
    '[Content_Types].xml':`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="工程報價" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>`,
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':`<styleSheet xmlns="${ns}"><fonts count="3"><font><sz val="11"/><name val="Microsoft JhengHei"/></font><font><b/><sz val="11"/><name val="Microsoft JhengHei"/></font><font><sz val="10"/><color rgb="FF777777"/><name val="Microsoft JhengHei"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2EADB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
    'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}"><sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="11" topLeftCell="A12" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${[14,40,65,10,12,18,22].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData><sheetProtection sheet="1" objects="1" scenarios="1"/><mergeCells count="3"><mergeCell ref="A1:G1"/><mergeCell ref="A2:G2"/><mergeCell ref="A10:G10"/></mergeCells><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`
  });
}
export function exportQuoteExcel(data:QuoteData){const bytes=createQuoteExcel(data);const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));const a=document.createElement('a');a.href=url;a.download=`LS_${data.customer.estate||'工程'}_報價_${new Date().toISOString().slice(0,10)}.xlsx`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
