# 員工版

入口 `/staff.html`。正式版匯出前需先啟用雲端同步。私人連結是存取憑證，請加書籤並另外備份，只在自己的裝置開啟。雲端版本保存在私人 Vercel Blob，清除瀏覽器資料不會刪除版本；重新開啟原私人連結即可恢復。沒有密碼或公開客戶索引。若連結及所有備份遺失，需由管理員在 Vercel 保留資料中處理復原。

每次匯出會保存新的報價快照與原版 PDF，可按客戶或地址搜尋、載入修改並另存新版。跨裝置修改保留為獨立版本，不覆蓋舊版。版本以時間及隨機識別碼標記。

沿用 QUOTE_APP_ORIGIN 和 BLOB_STORE_ID（或 BLOB_READ_WRITE_TOKEN）。新增 API api/staff-versions.mjs。Vercel Root Directory 為 hosquote。

localhost 預覽只保存本機版本，不會上傳公司副本。正式版的「備份本機舊版本」只能讀取該網站同一瀏覽器的舊版本，不能讀取另一個 localhost 網址的資料。
