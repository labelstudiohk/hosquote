# 報價 PDF 私人副本

匯出時先 POST 原始 PDF 到 `/api/quote-copy`。伺服器確認私人 Blob 已保存後，瀏覽器才開始下載並提示成功。失敗會顯示錯誤，不會聲稱已保存。每份上限 4 MiB；逾時後重試可能產生另一份副本。

## 正式啟用前

1. 在 Vercel 的 Storage 建立 **Private** Blob store，連接 hosquote 的 Production 環境。不可選 Public。
2. 確認 Vercel 已注入 `BLOB_STORE_ID` 並授權 Production 使用 OIDC；SDK 會自動取得部署身分。亦相容舊版 `BLOB_READ_WRITE_TOKEN`。不要將任何憑證放入 GitHub 或 VITE_ 環境變數。
3. 加入 Production 環境變數 `QUOTE_APP_ORIGIN=https://hosquote.vercel.app`（沒有最後的斜線）。自訂域名要同步更新。
4. 在 Vercel Firewall 對 POST `/api/quote-copy` 設定每 IP 速率限制，例如每 10 分鐘 10 次。來源檢查只防一般跨站瀏覽器請求，不能阻止偽造 Origin 的程式；公開上傳端點必須配合平台防濫用及用量限制。
5. 部署新版本，實際匯出一份測試 PDF，核實 Storage 的 `quotes/日期/` 中出現同一份檔案，再下載比對。檔案 URL 不應可匿名讀取。

## 公司如何取副本

登入公司 Vercel 帳戶 → Storage → 已連接的私人 Blob store → `quotes` → 日期資料夾 → PDF，使用儲存介面下載。此版本利用 Vercel 登入保護管理介面，沒有額外建立網站 `/admin` 登入頁。客戶姓名及地址在 PDF 內，檔案路徑只用日期及隨機 ID。

尚未設定儲存時 API 回傳 503，匯出會停止。不要在未完成上述設定時部署這次前端更改。Vite 本機 preview 不提供 Vercel API，端到端驗證需要 Vercel 部署環境。

PDF 是客戶端提交資料；標記、單價限制及來源檢查不構成防偽機制，副本應視作客戶提出的報價草稿。不要作為已簽訂合約。公司應按實際需要制定保存及刪除期限。
