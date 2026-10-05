import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { exportQuotePdf } from "./exportQuote";
import { calculateLines, normalizeCatalog } from "./pricing";
import { defaultCatalog, defaultCategories, formatCurrency, packageOptions, recommendPackage } from "./catalog";
import type { AiAnalysis, CatalogCategory, CatalogItem, CustomerInfo, ItemSelection } from "./types";

const STORAGE_KEY = "ls-hosquote-draft-v1";
const AUTO_MASONRY_ITEM_ID = "X01.02";

const emptyCustomer: CustomerInfo = {
  name: "",
  phone: "",
  email: "",
  estate: "",
  block: "",
  floor: "",
  unit: "",
  area: "",
  packageId: "",
  furnitureLocations: "",
  kitchenDemolition: "",
  bathroomDemolition: "",
};

type DraftState = {
  customer: CustomerInfo;
  catalog: CatalogItem[];
  categories: CatalogCategory[];
  selections: Record<string, ItemSelection>;
};


function loadDraft(): DraftState {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) throw new Error("No saved draft");
    const value = JSON.parse(saved) as Partial<DraftState>;
    const savedCatalog = Array.isArray(value.catalog) && value.catalog.length ? value.catalog : defaultCatalog;
    return {
      customer: { ...emptyCustomer, ...value.customer },
      catalog: normalizeCatalog(savedCatalog),
      categories: Array.isArray(value.categories) && value.categories.length ? value.categories : defaultCategories,
      selections: value.selections ?? {},
    };
  } catch {
    return { customer: emptyCustomer, catalog: defaultCatalog, categories: defaultCategories, selections: {} };
  }
}

function getInitialSelection(item: CatalogItem, selections: Record<string, ItemSelection>): ItemSelection {
  return selections[item.id] ?? { selected: false, qty: item.defaultQty, unitPrice: item.price };
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function pricingLabel(mode: CatalogItem["pricingMode"]) {
  if (mode === "included") return "套餐包括項目";
  if (mode === "reference") return "參考價・不計總額";
  if (mode === "manual") return "手動加入才計價";
  return "自選加項";
}

export default function App() {
  const initial = useMemo(loadDraft, []);
  const [customer, setCustomer] = useState<CustomerInfo>(initial.customer);
  const [catalog, setCatalog] = useState<CatalogItem[]>(normalizeCatalog(initial.catalog));
  const [isExporting, setIsExporting] = useState(false);
  const [categories, setCategories] = useState<CatalogCategory[]>(initial.categories);
  const [selections, setSelections] = useState<Record<string, ItemSelection>>(initial.selections);
  const [activeView, setActiveView] = useState<"details" | "catalog" | "ai">("details");
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
  const [aiError, setAiError] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const lastAutoArea = useRef("");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ customer, catalog, categories, selections }));
  }, [customer, catalog, categories, selections]);

  const area = numberValue(customer.area);
  const suggestedPackage = recommendPackage(area);
  const selectedPackage = packageOptions.find((option) => option.id === customer.packageId);
  const bothDemolitions = customer.kitchenDemolition === "yes" && customer.bathroomDemolition === "yes";
  const neitherDemolition = customer.kitchenDemolition === "no" && customer.bathroomDemolition === "no";

  useEffect(() => {
    if (!customer.area || customer.area === lastAutoArea.current) return;
    lastAutoArea.current = customer.area;
    setCustomer((current) => ({ ...current, packageId: recommendPackage(numberValue(current.area))?.id ?? "" }));
  }, [customer.area]);

  const anyDemolition = customer.kitchenDemolition === "yes" || customer.bathroomDemolition === "yes";
  const quoteLines = useMemo(() => calculateLines(catalog, selections, customer), [catalog, selections, customer]);

  const chargeableLines = quoteLines.filter((line) => line.amount > 0);
  const extrasTotal = chargeableLines.reduce((sum, line) => sum + line.amount, 0);
  const packageTotal = selectedPackage?.price ?? 0;
  const total = packageTotal + extrasTotal;
  const electricalReferenceTotal = quoteLines
    .filter((line) => line.item.pricingMode === "reference")
    .reduce((sum, line) => sum + line.effectiveQty * line.effectiveUnitPrice, 0);

  const demolitionStatus = !customer.kitchenDemolition || !customer.bathroomDemolition
    ? { type: "waiting", title: "請確認廚房及廁所拆卸安排", note: "此兩項客戶資料未完成，未能判斷泥水附加工程。" }
    : bothDemolitions
      ? { type: "included", title: "廚房＋廁所拆卸重鋪已加入", note: "自動加入 HK$48,000 泥水防水工程及 HK$26,000 水喉工程。" }
      : neitherDemolition
        ? { type: "separate", title: "廚房及廁所不拆卸｜另行報價", note: "不計入 package 或目前報價總額。" }
        : { type: "manual", title: "只拆其中一個位置｜待手動定價", note: "已加入 HK$26,000 水喉工程；單獨拆卸泥水費用須由公司另行報價。" };
  function getQuoteValidationMessage() {
    const requiredFields: Array<[string, string]> = [
      ["客戶姓名", customer.name],
      ["電話", customer.phone],
      ["電郵", customer.email],
      ["屋苑／期數", customer.estate],
      ["座數", customer.block],
      ["樓層及單位", customer.floor && customer.unit ? "已填寫" : ""],
    ];
    const missingField = requiredFields.find(([, value]) => !value.trim());
    if (missingField) return `請先填寫${missingField[0]}。`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return "請填寫有效電郵地址。";
    if (!area) return "請先填寫單位尺數。";
    if (!selectedPackage) return "請選擇適用套餐。";
    if (!customer.kitchenDemolition || !customer.bathroomDemolition) return "請確認廚房及廁所拆卸安排。";
    return "";
  }

  const completionMessage = getQuoteValidationMessage() || "報價分析資料已完成。";
  const quoteReady = !getQuoteValidationMessage();

  function updateCustomer<K extends keyof CustomerInfo>(key: K, value: CustomerInfo[K]) {
    setCustomer((current) => ({ ...current, [key]: value }));
  }

  function goToCatalog() {
    const validationMessage = getQuoteValidationMessage();
    if (validationMessage) {
      window.alert(`未能進入工程明細：${validationMessage}`);
      setActiveView("details");
      return;
    }
    setActiveView("catalog");
  }

  function updateItem(itemId: string, patch: Partial<CatalogItem>) {
    const { price: _price, unit: _unit, description: _description, pricingMode: _mode, autoRule: _rule, ...safePatch } = patch;
    setCatalog((current) => normalizeCatalog(current.map((item) => item.id === itemId ? { ...item, ...safePatch } : item)));
  }

  function updateSelection(item: CatalogItem, patch: Partial<ItemSelection>) {
    if (item.autoRule || item.pricingMode === "included" || (anyDemolition && item.categoryId === "x-plumbing")) return;
    const { unitPrice: _price, ...safePatch } = patch;
    setSelections((current) => ({ ...current, [item.id]: { ...getInitialSelection(item, current), ...safePatch, unitPrice: item.price } }));
  }

  function addItem(categoryId: string) {
    const item: CatalogItem = {
      id: `custom-${Date.now()}`,
      code: "NEW",
      categoryId,
      name: "新增工程項目",
      description: "請填寫工程內容",
      unit: "項",
      defaultQty: 1,
      price: 0,
      pricingMode: "optional",
    };
    setCatalog((current) => [...current, item]);
    setSelections((current) => ({ ...current, [item.id]: { selected: true, qty: 1, unitPrice: 0 } }));
  }

  function removeItem(itemId: string) {
    if (itemId === AUTO_MASONRY_ITEM_ID || itemId.startsWith("X02.") || itemId === "06.01") return;
    setCatalog((current) => current.filter((item) => item.id !== itemId));
    setSelections((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
  }

  function addCategory() {
    const id = `category-${Date.now()}`;
    setCategories((current) => [...current, { id, code: "新增", name: "新增工程分類", scope: "extra" }]);
  }

  function updateCategory(categoryId: string, patch: Partial<CatalogCategory>) {
    setCategories((current) => current.map((category) => (category.id === categoryId ? { ...category, ...patch } : category)));
  }

  function removeCategory(categoryId: string) {
    if (catalog.some((item) => item.categoryId === categoryId)) {
      window.alert("請先將分類內工程項目移至其他分類，才可刪除此分類。");
      return;
    }
    setCategories((current) => current.filter((category) => category.id !== categoryId));
  }

  async function handleAnalysis() {
    if (!planFile) {
      setAiError("請先上載 JPG、PNG 或 PDF 平面圖。");
      return;
    }
    setAiError("");
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("plan", planFile);
      formData.append("area", customer.area);
      formData.append("catalog", JSON.stringify(catalog.map(({ id, code, categoryId, name, unit }) => ({ id, code, categoryId, name, unit }))));
      const response = await fetch("/api/plan/analyze", { method: "POST", body: formData });
      const payload = await response.json() as { analysis?: AiAnalysis; error?: string };
      if (!response.ok || !payload.analysis) throw new Error(payload.error || "AI 暫時未能完成分析。");
      setAiAnalysis(payload.analysis);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI 暫時未能完成分析。");
    } finally {
      setIsAnalyzing(false);
    }
  }

  function applySuggestion(suggestion: AiAnalysis["suggestions"][number]) {
    const item = catalog.find((entry) => entry.id === suggestion.catalogId);
    if (!item || item.pricingMode === "included" || item.autoRule) return;
    setSelections((current) => ({
      ...current,
      [item.id]: { ...getInitialSelection(item, current), selected: true, qty: Math.max(1, Math.round(suggestion.suggestedQty)) },
    }));
    setActiveView("catalog");
  }

  function exportDraft() {
    const content = JSON.stringify({ customer, catalog, categories, selections, exportedAt: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ls-hosquote-draft.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function printQuote() {
    if (!quoteReady) {
      window.alert(`未能列印報價：${completionMessage}`);
      setActiveView("details");
      return;
    }
    setIsExporting(true);
    try {
      const customerDraft={customer,categories,packageName:selectedPackage?.label||'另行報價',packagePrice:packageTotal,notes:'',catalog:quoteLines.map(l=>({...l.item,autoRule:undefined,price:l.effectiveUnitPrice,defaultQty:l.effectiveQty,pricingMode:l.amount>0?'manual':l.item.pricingMode})),selections:Object.fromEntries(quoteLines.map(l=>[l.item.id,{selected:l.included,qty:l.effectiveQty,unitPrice:l.effectiveUnitPrice}]))};
      await exportQuotePdf({ customer, categories, lines: quoteLines, packageTotal, extrasTotal, total },{customerDraft});
      window.alert('報價副本已安全保存至公司，PDF 下載已開始。');
    }
    catch (error) { window.alert(`匯出失敗：${error instanceof Error ? error.message : "請重試"}`); }
    finally { setIsExporting(false); }
  }

  function resetDraft() {
    if (!window.confirm("確定回復 PDF 參考目錄及清空目前草稿？")) return;
    setCustomer(emptyCustomer);
    setCatalog(defaultCatalog);
    setCategories(defaultCategories);
    setSelections({});
    setAiAnalysis(null);
    setPlanFile(null);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="LS 新居屋報價工作台">
          <img className="company-logo" src="/quote-assets/logo.png" alt="LABEL DESIGN STUDIO 公司標誌" />
          <div><strong>新居屋報價</strong><small>可調校工程工作台</small></div>
        </div>
        <div className="topbar-actions">
          <span className="autosave">匯出時會將報價及客戶資料副本保存至公司</span>
          <button className="button ghost" onClick={exportDraft}>匯出草稿</button>
          <button className="button ghost" onClick={printQuote} disabled={isExporting}>{isExporting ? "正在製作及保存 PDF…" : "匯出報價 PDF"}</button>
        </div>
      </header>

      <nav className="workspace-nav" aria-label="工作台導覽">
        <button className={activeView === "details" ? "active" : ""} onClick={() => setActiveView("details")}><span>01</span> 客戶及套餐</button>
        <button className={activeView === "catalog" ? "active" : ""} onClick={() => setActiveView("catalog")}><span>02</span> 工程目錄</button>
        <button className={activeView === "ai" ? "active" : ""} onClick={() => setActiveView("ai")}><span>03</span> 平面圖 AI</button>
        <div className="nav-count"><strong>{catalog.length}</strong> 個工程條目</div>
      </nav>

      <main className="workspace">
        <section className="main-panel">
          {activeView === "details" && (
            <div className="view-stack">
              <section className="section-heading">
                <p className="eyebrow">STEP 01 · 先定範圍</p>
                <h1>客戶資料與套餐分析</h1>
                <p>單位尺數是 套餐分析基準；輸入後會自動建議最合適方案，仍可手動改選。</p>
              </section>

              <section className="paper-card customer-card">
                <div className="card-title"><h2>客戶基本資料</h2><span>草稿不會公開</span></div>
                <div className="form-grid">
                  <label>客戶姓名 <span className="required-mark">*</span><input required aria-required="true" value={customer.name} onChange={(event) => updateCustomer("name", event.target.value)} placeholder="例如：陳先生" /></label>
                  <label>電話 <span className="required-mark">*</span><input required aria-required="true" value={customer.phone} onChange={(event) => updateCustomer("phone", event.target.value)} placeholder="聯絡電話" inputMode="tel" /></label>
                  <label>電郵 <span className="required-mark">*</span><input required aria-required="true" value={customer.email} onChange={(event) => updateCustomer("email", event.target.value)} placeholder="name@example.com" type="email" /></label>
                  <label>屋苑／期數 <span className="required-mark">*</span><input required aria-required="true" value={customer.estate} onChange={(event) => updateCustomer("estate", event.target.value)} placeholder="例如：啟盈苑 第一期" /></label>
                  <label>座數 <span className="required-mark">*</span><input required aria-required="true" value={customer.block} onChange={(event) => updateCustomer("block", event.target.value)} placeholder="座" /></label>
                  <label>樓層及單位 <span className="required-mark">*</span><input required aria-required="true" value={`${customer.floor}${customer.floor && customer.unit ? " / " : ""}${customer.unit}`} onChange={(event) => {
                    const [floor = "", unit = ""] = event.target.value.split("/").map((text) => text.trim());
                    setCustomer((current) => ({ ...current, floor, unit }));
                  }} placeholder="例如：18 / B" /></label>
                </div>
              </section>

              <section className="paper-card package-card">
                <div className="card-title"><div><p className="eyebrow">必填分析欄位</p><h2>單位尺數與套餐</h2></div><span className="required-chip">尺數必填</span></div>
                <div className="package-layout">
                  <label className="area-input">單位尺數（呎） <span className="required-mark">*</span><input required aria-required="true" type="number" min="1" value={customer.area} onChange={(event) => updateCustomer("area", event.target.value)} placeholder="輸入例如 438" /><small>以客戶提供的單位面積作初步套餐分析。</small></label>
                  <div className="recommendation">
                    <span>系統建議</span>
                    <strong>{suggestedPackage ? suggestedPackage.label : area > 600 ? "超出標準套餐 範圍" : "請先輸入尺數"}</strong>
                    <small>{suggestedPackage ? `${formatCurrency(suggestedPackage.price)} · 包 ${suggestedPackage.includedFurnitureFeet} 直尺訂做傢俬` : "可在下方手動選擇或另行報價。"}</small>
                  </div>
                </div>
                <div className="package-options" role="radiogroup" aria-label="選擇套餐">
                  {packageOptions.map((option) => (
                    <button key={option.id} className={`package-option ${customer.packageId === option.id ? "selected" : ""}`} onClick={() => updateCustomer("packageId", option.id)} role="radio" aria-checked={customer.packageId === option.id}>
                      <span>{option.label}</span><strong>{formatCurrency(option.price)}</strong><small>包括 {option.includedFurnitureFeet} 直尺訂做傢俬</small>
                    </button>
                  ))}
                  <button className={`package-option ${!customer.packageId ? "selected neutral" : ""}`} onClick={() => updateCustomer("packageId", "")} role="radio" aria-checked={!customer.packageId}><span>另行報價</span><strong>—</strong><small>不套用標準套餐</small></button>
                </div>
                {!quoteReady && <p className="required-warning">報價未完成：{completionMessage}</p>}
              </section>

              <section className="paper-card demolition-card">
                <div className="card-title"><div><p className="eyebrow">泥水工程問項</p><h2>廚房及廁所會否拆卸重鋪？</h2></div><span className={`status-chip ${demolitionStatus.type}`}>{demolitionStatus.title}</span></div>
                <p className="card-intro">請由客戶分別確認。任何一個選「要」會加入全部四項水喉工程（HK$26,000）；兩者均「要」再加 HK$48,000 泥水及西卡107防水工程。</p>
                <div className="demolition-options">
                  {(["kitchenDemolition", "bathroomDemolition"] as const).map((field) => (
                    <div className="choice-block" key={field}>
                      <span>{field === "kitchenDemolition" ? "廚房" : "廁所"}是否拆卸重鋪</span>
                      <div className="binary-options">
                        <button className={customer[field] === "yes" ? "yes selected" : ""} onClick={() => updateCustomer(field, "yes")}>要</button>
                        <button className={customer[field] === "no" ? "no selected" : ""} onClick={() => updateCustomer(field, "no")}>否</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`demolition-note ${demolitionStatus.type}`}><strong>{demolitionStatus.title}</strong><span>{demolitionStatus.note}</span></div>
              </section>

              <section className="included-strip">
                <div><span>目前 套餐包括項目</span><strong>{selectedPackage ? `${selectedPackage.includedFurnitureFeet} 直尺訂做傢俬額度` : "請先選擇套餐"}</strong></div>
                <div><span>天花／衣櫃</span><strong>廚廁天花已包括・額外傢俬可選購</strong></div>
                <div><span>電力及弱電</span><strong>只列參考價・不計總額</strong></div>
                <button className="text-button" onClick={goToCatalog}>前往調校工程項目 →</button>
              </section>
            </div>
          )}

          {activeView === "catalog" && (
            <div className="view-stack">
              <section className="section-heading split-heading"><div><p className="eyebrow">STEP 02 · 可逐項調校</p><h1>工程目錄與加項</h1><p>單價由公司統一設定，客戶不可調整。拆卸廚房或廁所時，自選 02 水喉工程會全部自動加入。</p></div><button className="button primary" onClick={addCategory}>＋ 新增分類</button></section>
              <div className="catalog-legend"><span className="legend included">套餐包括項目</span><span className="legend optional">自選加項</span><span className="legend manual">手動加入</span><span className="legend reference">電力參考價・不計總額</span></div>
              {categories.map((category) => {
                const entries = catalog.filter((item) => item.categoryId === category.id);
                return (
                  <section className="catalog-section" key={category.id}>
                    <div className="catalog-section-head"><input className={`scope-tag ${category.scope} category-code`} aria-label="工程分類代碼" value={category.code} onChange={(event) => updateCategory(category.id, { code: event.target.value })} /><input aria-label="工程分類名稱" value={category.name} onChange={(event) => updateCategory(category.id, { name: event.target.value })} /><span>{entries.length} 項</span>{category.id !== "x-masonry" && <button className="text-button" onClick={() => addItem(category.id)}>＋ 加項</button>}{entries.length === 0 && <button className="text-button category-remove" onClick={() => removeCategory(category.id)}>刪除分類</button>}</div>
                    <div className="quote-table" role="table">
                      <div className="quote-row quote-head" role="row"><span>狀態</span><span>工程項目</span><span>單位</span><span>數量</span><span>單價</span><span>小計</span></div>
                      {entries.map((item) => {
                        const line = quoteLines.find((entry) => entry.item.id === item.id)!;
                        const disabledToggle = item.pricingMode === "included" || item.autoRule !== undefined || line.automatic;
                        return (
                          <div className="quote-row" role="row" key={item.id}>
                            <div className="item-state"><span className={`mode-pill ${item.pricingMode}`}>{pricingLabel(item.pricingMode)}</span>{!disabledToggle && <label className="switch"><input type="checkbox" checked={line.included} onChange={(event) => updateSelection(item, { selected: event.target.checked })} /><i /></label>}</div>
                            <div className="item-copy"><span className="code">{item.code}</span><textarea className="item-name" rows={2} aria-label={`${item.code} 項目名稱`} value={item.name} onChange={(event) => updateItem(item.id, { name: event.target.value })} /><p className="fixed-description" aria-label={`${item.code} 備註（固定）`}>{item.description}</p><select className="category-select" aria-label={`${item.code} 所屬分類`} value={item.categoryId} onChange={(event) => updateItem(item.id, { categoryId: event.target.value })}>{categories.map((option) => <option key={option.id} value={option.id}>{option.code}・{option.name}</option>)}</select>{(item.autoRule || line.automatic) && <small className="auto-note">{item.autoRule === "packageFurniture" ? "按套餐自動填入 20／25／30 直尺" : item.autoRule === "packageCeiling" ? "套餐包括項目" : item.autoRule === "kitchenBathroom" ? "廚房及廁所均拆卸時自動加入 $48,000，防水採用西卡107" : "拆卸廚房或廁所時必須加入"}</small>}</div>
                            <div className="fixed-unit" aria-label={`${item.code} 單位（固定）`}><small>單位</small><span>{item.unit}</span></div>
                            <input aria-label={`${item.code} 數量`} className="number-input" type="number" min="0" disabled={item.autoRule !== undefined || line.automatic || item.pricingMode === "included"} value={line.effectiveQty} onChange={(event) => updateSelection(item, { qty: numberValue(event.target.value) })} />
                            <div className="price-cell"><span aria-label={`${item.code} 單價（固定）`}>{item.pricingMode === "included" ? "套餐包括項目" : formatCurrency(line.effectiveUnitPrice)}</span></div>
                            <div className="line-total">{item.pricingMode === "reference" ? <span className="reference-total">參考 {formatCurrency(line.effectiveQty * line.effectiveUnitPrice)}</span> : line.automatic ? <strong>{formatCurrency(line.amount)}</strong> : <strong>{item.pricingMode === "included" ? "已包括" : line.included ? formatCurrency(line.amount) : "—"}</strong>}{item.id !== AUTO_MASONRY_ITEM_ID && !item.id.startsWith("X02.") && item.id !== "06.01" && <button className="remove-button" aria-label={`移除 ${item.name}`} onClick={() => removeItem(item.id)}>×</button>}</div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              <section className="reference-note"><strong>電力及弱電提示</strong><p>電力項目可輸入數量並顯示參考總值（目前 {formatCurrency(electricalReferenceTotal)}），但所有電力及弱電項目均不會計入右側／下方報價總額。</p></section>
            </div>
          )}

          {activeView === "ai" && (
            <div className="view-stack">
              <section className="section-heading"><p className="eyebrow">STEP 03 · 人工覆核後加入</p><h1>平面圖 AI 尺寸分析</h1><p>上載平面圖後，AI 會辨認可見的空間與尺寸，對照目前工程目錄提出建議；任何建議都要由你確認才會加入報價。</p></section>
              <section className="paper-card ai-upload-card">
                <div className="upload-panel"><div className="upload-icon">⌗</div><div><h2>上載平面圖</h2><p>接受 JPG、PNG 或 PDF，最大 10MB。檔案會安全上載作本次 AI 分析，請勿上載機密資料。</p></div><label className="file-picker">選擇檔案<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event: ChangeEvent<HTMLInputElement>) => setPlanFile(event.target.files?.[0] ?? null)} /></label></div>
                {planFile && <div className="file-summary"><span>已選擇</span><strong>{planFile.name}</strong><small>{Math.round(planFile.size / 1024)} KB</small></div>}
                <div className="ai-actions"><button className="button primary" disabled={!planFile || isAnalyzing} onClick={handleAnalysis}>{isAnalyzing ? "正在分析平面圖…" : "開始 AI 尺寸分析"}</button><small>分析不會覆寫已編輯的報價。</small></div>
                {aiError && <p className="ai-error">{aiError}</p>}
              </section>
              {aiAnalysis && <section className="ai-results"><div className="result-summary"><span>AI 分析摘要</span><h2>{aiAnalysis.summary}</h2><div className="measurements">{aiAnalysis.measurements.map((measurement) => <span key={measurement}>{measurement}</span>)}</div></div><div className="suggestion-list">{aiAnalysis.suggestions.length ? aiAnalysis.suggestions.map((suggestion) => <article className="suggestion" key={`${suggestion.catalogId}-${suggestion.title}`}><div><span className={`confidence ${suggestion.confidence}`}>{suggestion.confidence}信心</span><h3>{suggestion.title}</h3><p>{suggestion.reason}</p><small>建議數量：{suggestion.suggestedQty}</small></div><button className="button small" onClick={() => applySuggestion(suggestion)}>加入報價</button></article>) : <p className="empty-state">未有足夠清晰的項目建議；可根據摘要手動調校工程目錄。</p>}</div>{aiAnalysis.cautions.length > 0 && <div className="caution-box"><strong>覆核提醒</strong><ul>{aiAnalysis.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>}</section>}
            </div>
          )}
        </section>

        <aside className="summary-panel">
          <div className="summary-top"><p className="eyebrow">即時報價摘要</p><h2>{customer.name || "未命名客戶"}</h2><span>{customer.estate || "尚未填寫屋苑"}</span></div>
          <div className="summary-package"><span>選用方案</span><strong>{selectedPackage?.label ?? "另行報價"}</strong>{selectedPackage && <small>包括 {selectedPackage.includedFurnitureFeet} 直尺訂做傢俬</small>}</div>
          <div className="summary-lines"><div><span>套餐基準價</span><strong>{formatCurrency(packageTotal)}</strong></div><div><span>已選自選／手動加項</span><strong>{formatCurrency(extrasTotal)}</strong></div><div className="subtotal"><span>目前報價總額</span><strong>{quoteReady ? formatCurrency(total) : "待完成"}</strong></div></div>
          <div className="summary-selected"><span>已計價項目</span>{chargeableLines.length ? chargeableLines.map((line) => <div key={line.item.id}><small>{line.item.name}</small><strong>{formatCurrency(line.amount)}</strong></div>) : <p>暫未有額外計價項目。</p>}</div>
          <div className={`summary-status ${quoteReady ? demolitionStatus.type : "waiting"}`}><strong>{quoteReady ? demolitionStatus.title : "報價資料未完成"}</strong><span>{quoteReady ? demolitionStatus.note : completionMessage}</span></div>
          <div className="summary-footer">
              <button className="button primary full" onClick={goToCatalog}>下一步：工程明細 →</button>
            <button className="button ghost full" onClick={goToCatalog}>調校工程項目</button>
            <button className="button ghost full" onClick={printQuote} disabled={isExporting}>{isExporting ? "正在製作及保存 PDF…" : "匯出報價 PDF"}</button>
            <button className="text-button danger" onClick={resetDraft}>回復預設目錄</button>
          </div>
        </aside>
      </main>
    </div>
  );
}
