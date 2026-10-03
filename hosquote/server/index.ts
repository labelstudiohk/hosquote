import { randomUUID } from "node:crypto";
import express from "express";
import { jsonrepair } from "jsonrepair";
import multer from "multer";
import type { AiAnalysis } from "../src/types";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const maxFileSize = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(["image/jpeg", "image/png", "application/pdf"]);
const analysisWindowMs = 10 * 60 * 1000;
const analysisLimit = 6;
const analysisAttempts = new Map<string, { count: number; resetAt: number }>();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileSize },
  fileFilter: (_request, file, callback) => callback(null, allowedMimeTypes.has(file.mimetype)),
});

type CatalogPromptItem = { id: string; code: string; categoryId: string; name: string; unit: string };

function runtimeConfig() {
  const baseUrl = process.env.MANUS_API_URL;
  const apiKey = process.env.MANUS_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("AI 服務暫時未設定。");
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey };
}

async function platformJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { baseUrl, apiKey } = runtimeConfig();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiKey}`, ...(init.headers ?? {}) },
  });
  const body = await response.json() as T & { error?: { message?: string } | string };
  if (!response.ok || body.error) throw new Error("平台服務暫時未能完成要求。");
  return body;
}

function extensionFor(file: Express.Multer.File) {
  if (file.mimetype === "image/jpeg") return "jpg";
  if (file.mimetype === "image/png") return "png";
  return "pdf";
}

function hasValidSignature(file: Express.Multer.File) {
  const bytes = file.buffer;
  if (file.mimetype === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === "image/png") return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isRateLimited(request: express.Request) {
  const key = request.ip || request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const current = analysisAttempts.get(key);
  if (!current || current.resetAt <= now) {
    analysisAttempts.set(key, { count: 1, resetAt: now + analysisWindowMs });
    return false;
  }
  if (current.count >= analysisLimit) return true;
  current.count += 1;
  return false;
}

function safeAnalysis(content: string, catalog: CatalogPromptItem[]): AiAnalysis {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  const jsonText = firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed;
  let parsed: Partial<AiAnalysis>;
  try {
    parsed = JSON.parse(jsonText) as Partial<AiAnalysis>;
  } catch {
    parsed = JSON.parse(jsonrepair(jsonText)) as Partial<AiAnalysis>;
  }
  const knownIds = new Set(catalog.map((item) => item.id));
  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions
      .filter((item): item is NonNullable<AiAnalysis["suggestions"]>[number] => Boolean(item && typeof item.catalogId === "string" && knownIds.has(item.catalogId)))
      .slice(0, 8)
      .map((item) => {
        const confidence: AiAnalysis["suggestions"][number]["confidence"] = item.confidence === "高" || item.confidence === "低" ? item.confidence : "中";
        const catalogItem = catalog.find((entry) => entry.id === item.catalogId);
        return {
          catalogId: item.catalogId,
          title: typeof item.title === "string" && item.title.trim() ? item.title : catalogItem?.name ?? "工程建議",
          reason: typeof item.reason === "string" ? item.reason : "請按平面圖實際情況覆核。",
          suggestedQty: Number.isFinite(Number(item.suggestedQty)) ? Math.max(1, Math.round(Number(item.suggestedQty))) : 1,
          confidence,
        };
      })
    : [];
  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "已完成初步平面圖分析，請按現場情況覆核。",
    measurements: Array.isArray(parsed.measurements) ? parsed.measurements.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
    suggestions,
    cautions: Array.isArray(parsed.cautions) ? parsed.cautions.filter((item): item is string => typeof item === "string").slice(0, 6) : ["AI 建議只作報價草稿參考，請以現場覆尺及客戶確認為準。"],
  };
}

app.get("/api/health", (_request, response) => {
  response.status(200).json({ ok: true, service: "hosquote-ai" });
});

app.post("/api/plan/analyze", upload.single("plan"), async (request, response) => {
  try {
    const file = request.file;
    if (!file) return response.status(400).json({ error: "請上載 JPG、PNG 或 PDF 平面圖。" });
    if (!allowedMimeTypes.has(file.mimetype)) return response.status(415).json({ error: "只接受 JPG、PNG 或 PDF 平面圖。" });
    if (!hasValidSignature(file)) return response.status(415).json({ error: "檔案內容與宣稱格式不符，請重新上載有效的 JPG、PNG 或 PDF。" });
    if (isRateLimited(request)) return response.status(429).json({ error: "AI 分析請求過於頻繁，請稍後再試。" });

    let catalog: CatalogPromptItem[] = [];
    try {
      const parsed = JSON.parse(String(request.body.catalog ?? "[]")) as unknown;
      if (Array.isArray(parsed)) {
        catalog = parsed
          .filter((item): item is CatalogPromptItem => Boolean(item && typeof item === "object" && typeof (item as CatalogPromptItem).id === "string" && typeof (item as CatalogPromptItem).name === "string"))
          .slice(0, 120);
      }
    } catch {
      return response.status(400).json({ error: "工程目錄資料格式無效。" });
    }
    if (!catalog.length) return response.status(400).json({ error: "未能讀取目前工程目錄。" });

    const objectKey = `floorplans/${Date.now()}-${randomUUID()}.${extensionFor(file)}`;
    const put = await platformJson<{ url: string }>(`/v1/storage/presign/put?path=${encodeURIComponent(objectKey)}`);
    const uploadResponse = await fetch(put.url, { method: "PUT", headers: { "Content-Type": file.mimetype }, body: file.buffer as unknown as BodyInit });
    if (!uploadResponse.ok) throw new Error("檔案上載失敗。");
    const get = await platformJson<{ url: string }>(`/v1/storage/presign/get?path=${encodeURIComponent(objectKey)}`);

    const area = String(request.body.area ?? "未提供");
    const catalogText = catalog.map((item) => `${item.id}｜${item.code}｜${item.name}｜單位：${item.unit}`).join("\n");
    const prompt = `你是香港室內工程報價助理。請閱讀這張新居屋平面圖，根據可見的房間、尺寸、門窗、廚廁和設備，提出「需要人工確認」的工程建議。客戶填寫的單位尺數為：${area} 呎。\n\n只可從以下工程目錄選取 catalogId：\n${catalogText}\n\n重要規則：\n1. 不要估算或編造不可見尺寸；看不清楚時說明。\n2. 電力及弱電只作參考，不能當作總額。\n3. 天花及超出 package 的衣櫃／傢俬必須標示需要手動確認。\n4. 不要自動決定廚房或廁所是否拆卸重鋪，這由客戶問項決定。\n5. 最多提出 5 項建議、5 項尺寸觀察及 3 項覆核提醒；每項理由保持一句。\n6. 回覆必須使用繁體中文及 JSON。`;
    const visualPart = file.mimetype === "application/pdf"
      ? { type: "file_url", file_url: { url: get.url, mime_type: "application/pdf" } }
      : { type: "image_url", image_url: { url: get.url, detail: "high" } };
    const llmPayload = {
      model: "gemini-3-flash-preview",
      max_tokens: 2400,
      messages: [
        { role: "system", content: "你是謹慎的香港裝修報價助理。只輸出精簡、合法的 JSON。" },
        { role: "user", content: [{ type: "text", text: prompt }, visualPart] },
      ],
      response_format: { type: "json_object" },
    };
    const llm = await platformJson<{ choices?: Array<{ message?: { content?: string } }> }>("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(llmPayload),
    });
    const content = llm.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI 沒有返回可用分析。");
    let analysis: AiAnalysis;
    try {
      analysis = safeAnalysis(content, catalog);
    } catch {
      const fallback = await platformJson<{ choices?: Array<{ message?: { content?: string } }> }>("/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...llmPayload, response_format: undefined, max_tokens: 1800, messages: [{ role: "system", content: "只輸出精簡、合法的 JSON，不要 Markdown。" }, { role: "user", content: [{ type: "text", text: prompt }, visualPart] }] }),
      });
      const fallbackContent = fallback.choices?.[0]?.message?.content;
      if (!fallbackContent) throw new Error("AI 重試後仍沒有返回可用分析。");
      analysis = safeAnalysis(fallbackContent, catalog);
    }
    return response.json({ analysis, storagePath: `/manus-storage/${objectKey}` });
  } catch (error) {
    console.error("plan analysis failed:", error instanceof Error ? error.message : "unknown error");
    return response.status(502).json({ error: "AI 分析暫時未能完成。請確認平面圖清晰後重試。" });
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") return response.status(413).json({ error: "平面圖不可超過 10MB。" });
  return response.status(400).json({ error: "上載檔案未能處理，請改用 JPG、PNG 或 PDF。" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`hosquote API listening on ${port}`);
});
