# LABEL STUDIO 新居屋報價工作台

React + TypeScript + Vite 報價工具，包含奶油色響應式介面、套餐分析、固定單價及備註、PDF 匯出及本機草稿。

## 本機啟動

需要 Node.js 22 或以上及 pnpm 10.17.0。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

瀏覽 http://localhost:3000 。後端使用 3001 埠。

## 建置及預覽

```sh
pnpm build
pnpm preview
```

`dist/` 可部署到靜態網站服務。靜態部署提供報價與 PDF 功能；AI 功能另需後端及 `/api` 反向代理。`pnpm start` 只啟動 AI 後端，不會提供前端網站。

## AI 設定（選用）

後端從環境變數讀取 `MANUS_API_URL`、`MANUS_API_KEY` 及選用的 `PORT`。請透過主機設定注入環境變數；程式不會自動讀取 .env。未配置 AI 不影響一般報價及 PDF 匯出。

## 資料及資產

客戶草稿儲存在瀏覽器 localStorage；不包含在 repository。Logo、條款圖像及報價資料在 `public/quote-assets` 與 `src/catalog.ts`。請在正式使用前確認公司資料及條款。所有介面價格限制屬前端控制。

PDF 使用本機中文字型繪製；保留公司 logo、封面、報價明細、付款安排與條款。Excel 匯出已取消。
