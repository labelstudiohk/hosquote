import type { CatalogCategory, CustomerInfo } from './types';
import type { QuoteLine } from './pricing';
import { packageOptions } from './catalog';

type PdfDoc = { embedPng: (data: string) => Promise<unknown>; addPage: (size: number[]) => { drawImage: (image: unknown, options: object) => void }; save: () => Promise<Uint8Array> };
declare global { interface Window { PDFLib: { PDFDocument: { create: () => Promise<PdfDoc> } } } }
type QuoteData = { customer: CustomerInfo; categories: CatalogCategory[]; lines: QuoteLine[]; packageTotal: number; extrasTotal: number; total: number };
const W = 1240, H = 1754, M = 64;
const cash = (n: number) => 'HK$' + n.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => reject(new Error('未能載入報價範本')); i.src = src; });

export async function createQuotePdf(data: QuoteData): Promise<Uint8Array> {
  await document.fonts.ready;
  const [logo, terms] = await Promise.all([loadImage('/quote-assets/logo.png'), loadImage('/quote-assets/terms.png')]);
  if (!window.PDFLib) throw new Error('PDF 元件尚未載入，請重新整理');
  const pdf = await window.PDFLib.PDFDocument.create();
  const pages: HTMLCanvasElement[] = [];
  let canvas!: HTMLCanvasElement, ctx!: CanvasRenderingContext2D, y = 0;
  const date = new Date();
  const dateText = date.toLocaleDateString('en-GB');
  const quoteId = `Q-${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${date.getTime().toString().slice(-6)}`;
  const address = [data.customer.estate, data.customer.block && data.customer.block+'座', data.customer.floor && data.customer.floor+'樓', data.customer.unit && data.customer.unit+'室'].filter(Boolean).join(' ');
  const font = (size = 18, bold = false) => { ctx.font = `${bold ? '700' : '400'} ${size}px "Microsoft JhengHei", "Noto Sans TC", sans-serif`; ctx.fillStyle = '#202020'; ctx.textBaseline = 'top'; };
  const text = (s: string, x: number, yy: number, size = 18, bold = false) => { font(size,bold); ctx.fillText(s,x,yy); };
  const right = (s: string, x: number, yy: number, size=18, bold=false) => { font(size,bold); ctx.fillText(s,x-ctx.measureText(s).width,yy); };
  const rule = (yy: number, color='#cfc4b3') => { ctx.strokeStyle=color; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(M,yy); ctx.lineTo(W-M,yy); ctx.stroke(); };
  const wrapped = (s: string, width: number, size = 18) => {
    font(size); const result: string[] = [];
    for (const paragraph of s.split('\n')) { let line=''; for (const char of paragraph) { if (ctx.measureText(line+char).width > width && line) { result.push(line); line=char; } else line+=char; } result.push(line); }
    return result;
  };
  const block = (s: string, x: number, yy: number, width: number, size=18) => { const lines=wrapped(s,width,size); lines.forEach((l,i)=>text(l,x,yy+i*(size+8),size)); return lines.length*(size+8); };
  const newPage = (title: string, header=true) => {
    canvas=document.createElement('canvas'); canvas.width=W; canvas.height=H; ctx=canvas.getContext('2d')!; ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H); pages.push(canvas);
    if (header) {
      ctx.drawImage(logo,M,52,224,80);
      right('LABEL STUDIO LIMITED',W-M,55,21,true);
      right('香港銅鑼灣禮頓道77號禮頓中心13樓1318',W-M,91,15);
      right('57228388  |  labelstudiohk@gmail.com',W-M,117,15);
      rule(151);
      text(title,M,178,27,true);
      right(dateText,W-M,181,17);
      text(quoteId,M,218,15);
      y=246;
    }
  };
  newPage('QUOTATION  工程報價書',false);
  ctx.fillStyle='#fcfaf5';ctx.fillRect(0,0,W,H);
  ctx.drawImage(logo,M,90,310,111);
  right('LABEL STUDIO LIMITED',W-M,101,19,true);
  right('INTERIOR DESIGN / RENOVATION',W-M,133,13);
  rule(245);
  text('RESIDENTIAL PROJECT',M,363,17);
  text('工程報價書',M,425,64,true);
  text('QUOTATION',M,520,28);
  ctx.fillStyle='#aa9066';ctx.fillRect(M,590,76,4);
  y=672;
  y+=block(address || '工程地址待確認',M,y,W-2*M,32)+42;
  rule(y);y+=35;
  const meta = (label:string,value:string,x:number,yy:number,width:number) => {
    text(label,x,yy,15);return 30+block(value,x,yy+30,width,21);
  };
  const leftWidth=550, rightX=M+650;
  y+=Math.max(meta('PREPARED FOR / 客戶',data.customer.name||'待填寫',M,y,leftWidth),meta('REFERENCE / 報價編號',quoteId,rightX,y,W-M-rightX))+25;
  y+=Math.max(meta('CONTACT / 聯絡電話',data.customer.phone||'—',M,y,leftWidth),meta('ISSUED / 報價日期',dateText,rightX,y,W-M-rightX))+25;
  y+=Math.max(meta('EMAIL / 電郵',data.customer.email||'—',M,y,leftWidth),meta('PACKAGE / 選用套餐',packageOptions.find(p=>p.id===data.customer.packageId)?.label||'另行報價',rightX,y,W-M-rightX))+40;
  if(y>1380) { newPage('報價摘要'); }
  y=Math.max(y,1320);rule(y);y+=36;
  text('TOTAL INVESTMENT / 報價總額',M,y,17);
  right(cash(data.total),W-M,y+38,46,true);
  text('57228388  /  labelstudiohk@gmail.com',M,1590,17);
  text('香港銅鑼灣禮頓道77號禮頓中心13樓1318',M,1622,16);

  const cols=[M,M+82,M+660,M+740,M+815,M+955,W-M];
  const row = (cells: string[], height: number, fill='#fff', bold=false) => {
    ctx.fillStyle=fill;ctx.fillRect(M,y,W-2*M,height);ctx.strokeStyle='#d5cdc0';ctx.lineWidth=1;
    for(let i=0;i<cells.length;i++) { ctx.strokeRect(cols[i],y,cols[i+1]-cols[i],height); const lines=wrapped(cells[i],cols[i+1]-cols[i]-20,15);lines.forEach((l,j)=> i>=2 ? right(l,cols[i+1]-10,y+10+j*20,15,bold) : text(l,cols[i]+10,y+10+j*20,15,bold)); }
    y+=height;
  };
  const tableHead = () => row(['項目','Description 工程內容','數量','單位','單價','金額'],44,'#eee8dd',true);
  const section = (name: string) => {ctx.fillStyle='#eee8dd';ctx.fillRect(M,y,W-2*M,40);text(name,M+10,y+9,18,true);y+=40;};
  const continuation = (title:string) => {newPage(title+'（續）');tableHead();};
  const table = (scope:'package'|'extra', title:string) => {
    newPage(title);y+=block(`客戶：${data.customer.name||'—'}    工程地址：${address||'—'}`,M,y,W-2*M,17)+18;tableHead();
    for (const category of data.categories.filter(c=>c.scope===scope)) {
      const lines=data.lines.filter(l=>l.item.categoryId===category.id && (scope==='package' ? l.item.pricingMode==='included' || l.included : l.included || l.item.pricingMode==='reference'));
      if(!lines.length)continue;
      if(y>1440)continuation(title);section(category.code+' '+category.name.replace('額外自選｜',''));
      for(const line of lines) {
        const detail=line.item.name+'\n'+line.item.description;
        const height=Math.max(42,wrapped(detail,cols[2]-cols[1]-20,15).length*20+20);
        if(y+height>1580){continuation(title);section(category.code+' '+category.name+'（續）');}
        const rowY=y;
        row([line.item.code,'',String(line.effectiveQty),line.item.unit,line.item.pricingMode==='included'?'已包括':cash(line.effectiveUnitPrice),line.item.pricingMode==='included'?'包括':line.item.pricingMode==='reference'?'參考 '+cash(line.effectiveQty*line.effectiveUnitPrice):cash(line.amount)],height);
        let detailY=rowY+10;
        for(const l of wrapped(line.item.name,cols[2]-cols[1]-20,15)){text(l,cols[1]+10,detailY,15,true);detailY+=20;}
        for(const l of wrapped(line.item.description,cols[2]-cols[1]-20,15)){font(15);ctx.fillStyle='#777777';ctx.fillText(l,cols[1]+10,detailY);detailY+=20;}
      }
    }
    if(y+58>1640)continuation(title);
    y+=18;section(scope==='package'?'套餐總額：'+cash(data.packageTotal):'額外工程總額：'+cash(data.extrasTotal));
    if(scope==='extra')y+=block('電力及弱電只列參考價格，不計入報價總額。未選項目不計入本報價。',M,y+15,W-2*M,17)+15;
  };
  table('package','套餐包括項目');table('extra','額外自選項目');
  newPage('總額、付款安排及確認');section('Total Amount  報價總額：'+cash(data.total));y+=28;
  const stages=[['第 1 期付款：工程費之訂金',15],['第 2 期付款：清拆前 7 天',15],['第 3 期付款：水電開工前',30],['第 4 期付款：訂做傢俬前',35],['第 5 期付款：完工後 7 天內清付',5]] as const;
  for(const [label,pct] of stages){ctx.strokeStyle='#333';ctx.strokeRect(M,y,W-2*M,66);text(`${label}（${pct}%）`,M+16,y+21,20);right(cash(Math.round(data.total*pct)/100),W-M-16,y+21,20);y+=66;}
  y+=40;section('公司戶口資料  Bank Account Details');
  for(const s of ['銀行名稱：渣打銀行（003）','戶口名稱：LABEL STUDIO LIMITED','銀行帳戶號碼：47413900689']){text(s,M,y+20,21);y+=52;}
  y+=30;y+=block('備註：本報價只包括以上明列之「計入」項目。未列明項目及任何加減工程須另行書面確認。報價有效期為發出日起 30 日。',M,y,W-2*M,19);
  y+=25;y+=block('工程開始日期及預計完工日期：雙方另行書面確認。',M,y,W-2*M,19);
  y+=180;text('承包商簽署 Contractor Signature',M,y,20);text('客戶簽署 Customer Signature',700,y,20);
  ctx.beginPath();ctx.moveTo(M,y+70);ctx.lineTo(530,y+70);ctx.moveTo(700,y+70);ctx.lineTo(W-M,y+70);ctx.stroke();
  text('日期：____________________',M,y+98,19);text('日期：____________________',700,y+98,19);
  newPage('條款及細則',false);ctx.drawImage(terms,0,0,W,H);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,150);
  ctx.drawImage(logo,M,52,224,80);
  right('LABEL STUDIO LIMITED',W-M,55,21,true);
  right('香港銅鑼灣禮頓道77號禮頓中心13樓1318',W-M,91,15);
  right('57228388  |  labelstudiohk@gmail.com',W-M,117,15);
  text('報價編號：'+quoteId,66,190,12,true);block('工程地址：'+address,665,190,505,12);
  for(let i=0;i<pages.length;i++) {
    canvas=pages[i];ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#fff';ctx.fillRect(0,H-58,W,58);
    text('LABEL STUDIO LIMITED  |  報價書及條款',M,H-35,14);right(`第 ${i+1} 頁／共 ${pages.length} 頁`,W-M,H-35,14);
    const img=await pdf.embedPng(canvas.toDataURL('image/png'));pdf.addPage([595.28,841.89]).drawImage(img,{x:0,y:0,width:595.28,height:841.89});
  }
  return pdf.save();
}

export async function exportQuotePdf(data: QuoteData) {
  const bytes=await createQuotePdf(data);const blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`LS_${data.customer.estate||'工程'}_報價_${new Date().toISOString().slice(0,10)}.pdf`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}


