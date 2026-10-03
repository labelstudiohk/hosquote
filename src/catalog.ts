import type { CatalogCategory, CatalogItem, PackageOption } from "./types";

export const packageOptions: PackageOption[] = [
  { id: "p400", label: "400 呎內 套餐", maxSqft: 400, price: 139800, includedFurnitureFeet: 20 },
  { id: "p500", label: "500 呎內 套餐", maxSqft: 500, price: 169800, includedFurnitureFeet: 25 },
  { id: "p600", label: "600 呎內 套餐", maxSqft: 600, price: 189800, includedFurnitureFeet: 30 },
];

export const defaultCategories: CatalogCategory[] = [
  { id: "pre", code: "00", name: "前期、管理及保險", scope: "package" },
  { id: "protect", code: "01", name: "保護、清拆及廢料", scope: "package" },
  { id: "masonry", code: "02", name: "泥水、間隔及防水", scope: "package" },
  { id: "plumbing", code: "03", name: "水喉、來去水", scope: "package" },
  { id: "paint", code: "04", name: "油漆及牆飾", scope: "package" },
  { id: "ceiling", code: "05", name: "天花工程", scope: "package" },
  { id: "carpentry", code: "06", name: "木工及訂造傢俬", scope: "package" },
  { id: "handover", code: "07", name: "安裝、清潔及移交", scope: "package" },
  { id: "x-masonry", code: "自選 01", name: "額外自選｜泥水、間隔及防水", scope: "extra" },
  { id: "x-plumbing", code: "自選 02", name: "額外自選｜水喉、來去水", scope: "extra" },
  { id: "x-door", code: "自選 03", name: "額外自選｜門窗及金工", scope: "extra" },
  { id: "x-electrical", code: "自選 04", name: "額外自選｜電力及弱電（只供參考）", scope: "extra" },
];

export const defaultCatalog: CatalogItem[] = [
  { id: "00.05", code: "00.05", categoryId: "pre", name: "工程期間第三者責任保險保障計劃", description: "套餐包括項目", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "00.06", code: "00.06", categoryId: "pre", name: "臨時水電、照明及基本工具設施", description: "套餐包括項目", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "01.01", code: "01.01", categoryId: "protect", name: "全屋保護工程", description: "大廈／公用地方保護", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "01.02", code: "01.02", categoryId: "protect", name: "清拆原有廚房工作枱", description: "廚房工程", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "01.03", code: "01.03", categoryId: "protect", name: "建築廢料裝袋、垂直運輸及合法棄置", description: "全屋工程", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "02.01", code: "02.01", categoryId: "masonry", name: "大廳、房間地台找平及新鋪地台磚", description: "瓷磚由客人提供。\n此項目只包括鋪設 800mm x 800mm 至 300mm x 300mm 尺寸範圍內之瓷磚。\n如使用其他物料或尺寸之瓷磚，將另行報價。", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "02.02", code: "02.02", categoryId: "masonry", name: "新做廚房地台磚", description: "包括灰泥／底料沙磚", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "02.03", code: "02.03", categoryId: "masonry", name: "牆腳安裝及泥水修補", description: "全屋工程", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.01", code: "03.01", categoryId: "plumbing", name: "新造浴室洗衣機來去水", description: "供應及安裝", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.02", code: "03.02", categoryId: "plumbing", name: "清拆及安裝普通座廁", description: "由客戶提供座廁及五金配件", unit: "個", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.03", code: "03.03", categoryId: "plumbing", name: "安裝廚房水龍頭及接駁來去水", description: "不包括水龍頭及五金配件", unit: "個", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.04", code: "03.04", categoryId: "plumbing", name: "安裝洗衣機喉頭及接駁來去水", description: "全屋工程", unit: "個", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.05", code: "03.05", categoryId: "plumbing", name: "安裝洗面盆及接駁來去水", description: "不包括洗面盆及五金配件", unit: "個", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.06", code: "03.06", categoryId: "plumbing", name: "安裝洗手盆龍頭及接駁冷熱來水位", description: "不包括潔具及五金配件", unit: "個", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "03.07", code: "03.07", categoryId: "plumbing", name: "安裝花灑龍頭及接駁冷熱來水", description: "不包括潔具及五金配件", unit: "個", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "04.01", code: "04.01", categoryId: "paint", name: "油漆及牆飾工程", description: "剷底、打磨原有天花及牆身；油漆修補、批盪及指定乳膠漆工序", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "05.01", code: "05.01", categoryId: "ceiling", name: "廚房及廁所鋁片假天花", description: "包括燈框 2 支；已包括於選定 套餐", unit: "項", defaultQty: 1, price: 0, pricingMode: "included", autoRule: "packageCeiling" },
  { id: "06.01", code: "06.01", categoryId: "carpentry", name: "全屋指定訂造傢俬連安裝及收口", description: "採用 ENF 實芯夾板，飾面可選富美家／德利板；傢俬位置由客戶填寫。\n400 呎實用面積包 20 呎傢俬。\n500 呎實用面積包 25 呎傢俬。\n600 呎實用面積包 30 呎傢俬。\n吊櫃、地櫃以半呎計算。\n地台每 10 平方呎以 1 呎計算。\n超出指定尺數，每橫尺按 HK$2,800／尺計算。", unit: "直尺", defaultQty: 0, price: 0, pricingMode: "included", autoRule: "packageFurniture" },
  { id: "06.02", code: "06.02", categoryId: "carpentry", name: "超出 套餐 額度的訂造衣櫃／傢俬", description: "400／500／600 呎實用面積套餐分別包括 20／25／30 呎傢俬；超出指定尺數，每橫尺按 HK$2,800／尺計算，超出部分需手動加入", unit: "橫尺", defaultQty: 0, price: 2800, pricingMode: "manual" },
  { id: "07.01", code: "07.01", categoryId: "handover", name: "全屋基本完工清潔", description: "交收前基本清潔", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "07.02", code: "07.02", categoryId: "handover", name: "更換 10mm 玻璃浴屏", description: "連工包料，指定款式；高 6 呎 × 闊 5 呎內，每多 1 呎加 HK$300", unit: "項", defaultQty: 1, price: 0, pricingMode: "included" },
  { id: "X01.02", code: "01.02", categoryId: "x-masonry", name: "廚房及廁所拆卸重鋪附加工程", description: "兩者均選擇拆卸重鋪時自動加入；包括拆卸、鋪牆身及地台磚與西卡107（Sika 107）防水工序。\n瓷磚由客人提供。\n此項目只包括鋪設 800mm x 800mm 至 300mm x 300mm 尺寸範圍內之瓷磚。\n如使用其他物料或尺寸之瓷磚，將另行報價。", unit: "項", defaultQty: 1, price: 48000, pricingMode: "optional", autoRule: "kitchenBathroom" },
  { id: "X02.01", code: "02.01", categoryId: "x-plumbing", name: "新造廁所食水喉至所需位置", description: "包括英國銅喉", unit: "項", defaultQty: 1, price: 6500, pricingMode: "optional" },
  { id: "X02.02", code: "02.02", categoryId: "x-plumbing", name: "新造廁所 PVC 去水喉至所需位置", description: "額外自選工程", unit: "項", defaultQty: 1, price: 6500, pricingMode: "optional" },
  { id: "X02.03", code: "02.03", categoryId: "x-plumbing", name: "新造廚房明喉至所需位置", description: "包括英國銅喉", unit: "點", defaultQty: 1, price: 6500, pricingMode: "optional" },
  { id: "X02.04", code: "02.04", categoryId: "x-plumbing", name: "新造廚房 PVC 去水喉延伸", description: "額外自選工程", unit: "項", defaultQty: 1, price: 6500, pricingMode: "optional" },
  { id: "X03.01", code: "03.01", categoryId: "x-door", name: "新做及安裝木制空芯掩門及門框", description: "客房；包括一套門鎖", unit: "套", defaultQty: 1, price: 7800, pricingMode: "optional" },
  { id: "X03.02", code: "03.02", categoryId: "x-door", name: "清拆舊門及新做安裝木門實芯木制掩門及門框", description: "全屋；包括一套門鎖", unit: "套", defaultQty: 1, price: 9500, pricingMode: "optional" },
  { id: "X04.01", code: "04.01", categoryId: "x-electrical", name: "燈位", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.02", code: "04.02", categoryId: "x-electrical", name: "單位燈掣", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.03", code: "04.03", categoryId: "x-electrical", name: "兩位燈掣", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1200, pricingMode: "reference" },
  { id: "X04.04", code: "04.04", categoryId: "x-electrical", name: "三位燈掣", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1350, pricingMode: "reference" },
  { id: "X04.05", code: "04.05", categoryId: "x-electrical", name: "四位燈掣", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1500, pricingMode: "reference" },
  { id: "X04.06", code: "04.06", categoryId: "x-electrical", name: "安裝燈具", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 300, pricingMode: "reference" },
  { id: "X04.07", code: "04.07", categoryId: "x-electrical", name: "13A（220V）單蘇", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.08", code: "04.08", categoryId: "x-electrical", name: "13A（220V）孖蘇", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1200, pricingMode: "reference" },
  { id: "X04.09", code: "04.09", categoryId: "x-electrical", name: "13A 接線蘇", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.10", code: "04.10", categoryId: "x-electrical", name: "20A 接線蘇", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1500, pricingMode: "reference" },
  { id: "X04.11", code: "04.11", categoryId: "x-electrical", name: "20A 燈曲", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1500, pricingMode: "reference" },
  { id: "X04.12", code: "04.12", categoryId: "x-electrical", name: "上網蘇面／電話蘇面", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.13", code: "04.13", categoryId: "x-electrical", name: "門鐘", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.14", code: "04.14", categoryId: "x-electrical", name: "TV 蘇面", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 800, pricingMode: "reference" },
  { id: "X04.15", code: "04.15", categoryId: "x-electrical", name: "HDMI 線槽（2 寸 × 1 寸）", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 1500, pricingMode: "reference" },
  { id: "X04.16", code: "04.16", categoryId: "x-electrical", name: "更換原有制面板", description: "不包括制面；電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 150, pricingMode: "reference" },
  { id: "X04.17", code: "04.17", categoryId: "x-electrical", name: "新做 63A 單相電箱", description: "電力及弱電參考價，不計總額", unit: "個", defaultQty: 0, price: 7800, pricingMode: "reference" },
];

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("zh-HK", { style: "currency", currency: "HKD", maximumFractionDigits: 0 }).format(value);

export const recommendPackage = (area: number) => packageOptions.find((option) => area > 0 && area <= option.maxSqft);

