import { GoogleGenAI, Type, Schema } from "@google/genai";
import {
  ChapterLesson,
  TranslationEvaluation,
  PronunciationEvaluation,
  VocabularyItem,
  TopicVocabGeneratedPractice,
} from "@/types/course";
import { verifyVirtualApiKey } from "@/lib/quotaManager";
import {
  getDailyLiveFreeModels,
  isModelNotFoundError,
  markModelDeadToday,
} from "@/lib/freeModelDiscovery";

const DEFAULT_GROQ_KEY =
  process.env.GROQ_API_KEY ||
  process.env.NEXT_PUBLIC_GROQ_API_KEY ||
  "";

const DEFAULT_OPENROUTER_KEY =
  process.env.OPENROUTER_API_KEY ||
  process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ||
  "";

const DEFAULT_SILICONFLOW_KEY =
  process.env.SILICONFLOW_API_KEY ||
  process.env.NEXT_PUBLIC_SILICONFLOW_API_KEY ||
  "";

interface ProviderKeysPool {
  geminiKeys: string[];
  groqKeys: string[];
  openRouterKeys: string[];
  siliconFlowKeys: string[];
}

declare global {
  // Bộ nhớ đệm phía Server lưu giữ các khóa AI hệ thống để phục vụ mọi thiết bị (đặc biệt là Mobile)
  // eslint-disable-next-line no-var
  var __bookMindServerKeysPool: ProviderKeysPool | undefined;
}

function getServerCachedPool(): ProviderKeysPool {
  if (!globalThis.__bookMindServerKeysPool) {
    globalThis.__bookMindServerKeysPool = {
      geminiKeys: [],
      groqKeys: [],
      openRouterKeys: [],
      siliconFlowKeys: [],
    };
  }
  return globalThis.__bookMindServerKeysPool;
}

function parseRawKeyStringsIntoPool(
  rawSources: string[],
  targetPool: ProviderKeysPool
): void {
  const serverCache = getServerCachedPool();
  for (const src of rawSources) {
    if (!src) continue;
    const parts = src
      .split(/[,;\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10 && !s.toUpperCase().startsWith("BM-"));

    for (const p of parts) {
      if (p.startsWith("AIza")) {
        if (!targetPool.geminiKeys.includes(p)) targetPool.geminiKeys.push(p);
        if (!serverCache.geminiKeys.includes(p)) serverCache.geminiKeys.push(p);
      } else if (p.startsWith("gsk_")) {
        if (!targetPool.groqKeys.includes(p)) targetPool.groqKeys.push(p);
        if (!serverCache.groqKeys.includes(p)) serverCache.groqKeys.push(p);
      } else if (p.startsWith("sk-or-")) {
        if (!targetPool.openRouterKeys.includes(p))
          targetPool.openRouterKeys.push(p);
        if (!serverCache.openRouterKeys.includes(p))
          serverCache.openRouterKeys.push(p);
      } else if (p.startsWith("sk-")) {
        if (!targetPool.siliconFlowKeys.includes(p))
          targetPool.siliconFlowKeys.push(p);
        if (!serverCache.siliconFlowKeys.includes(p))
          serverCache.siliconFlowKeys.push(p);
      }
    }
  }
}

async function hydratePoolFromSupabaseCloudOnServer(
  targetPool: ProviderKeysPool
): Promise<void> {
  const sbUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const sbKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!sbUrl || !sbKey) return;

  // 1. Truy vấn bảng courses với id = __bookmind_system_config__
  try {
    const url = `${sbUrl.replace(/\/$/, "")}/rest/v1/courses?id=eq.__bookmind_system_config__&select=data`;
    const res = await fetch(url, {
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
      },
      cache: "no-store",
    });
    if (res.ok) {
      const rows = await res.json();
      const aiConfig = rows?.[0]?.data?.aiConfig;
      if (aiConfig) {
        parseRawKeyStringsIntoPool(
          [
            aiConfig.masterGeminiApiKey || "",
            aiConfig.groqApiKey || "",
            aiConfig.openRouterApiKey || "",
            aiConfig.siliconFlowApiKey || "",
          ],
          targetPool
        );
      }
    }
  } catch {
    // Ignore
  }

  // 2. Fallback truy vấn từ Storage Bucket book-chapters/__system_ai_config.json
  if (
    targetPool.geminiKeys.length === 0 &&
    targetPool.groqKeys.length === 0 &&
    targetPool.openRouterKeys.length === 0 &&
    targetPool.siliconFlowKeys.length === 0
  ) {
    try {
      const storageUrl = `${sbUrl.replace(/\/$/, "")}/storage/v1/object/public/book-chapters/__system_ai_config.json`;
      const res = await fetch(storageUrl, { cache: "no-store" });
      if (res.ok) {
        const aiConfig = await res.json();
        if (aiConfig) {
          parseRawKeyStringsIntoPool(
            [
              aiConfig.masterGeminiApiKey || "",
              aiConfig.groqApiKey || "",
              aiConfig.openRouterApiKey || "",
              aiConfig.siliconFlowApiKey || "",
            ],
            targetPool
          );
        }
      }
    } catch {
      // Ignore
    }
  }
}

function extractProviderKeysPool(
  customApiKey?: string,
  masterApiKey?: string
): ProviderKeysPool {
  const inputKey = customApiKey?.trim() || "";

  if (inputKey.toUpperCase().startsWith("BM-")) {
    const check = verifyVirtualApiKey(inputKey);
    if (!check.valid) {
      throw new Error(
        "Mã BookMind API Key không hợp lệ hoặc bị sai chữ ký. Vui lòng kiểm tra lại mã Key trong Email của bạn!"
      );
    }
  }

  const serverCache = getServerCachedPool();
  const pool: ProviderKeysPool = {
    geminiKeys: [...serverCache.geminiKeys],
    groqKeys: [...serverCache.groqKeys],
    openRouterKeys: [...serverCache.openRouterKeys],
    siliconFlowKeys: [...serverCache.siliconFlowKeys],
  };

  const rawSources = [
    !inputKey.toUpperCase().startsWith("BM-") ? inputKey : "",
    masterApiKey?.trim() || "",
    process.env.MASTER_GEMINI_API_KEY || "",
    process.env.GEMINI_API_KEY || "",
    process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
    DEFAULT_GROQ_KEY,
    DEFAULT_OPENROUTER_KEY,
    DEFAULT_SILICONFLOW_KEY,
  ];

  parseRawKeyStringsIntoPool(rawSources, pool);
  return pool;
}

function schemaToJsonBlueprint(schema?: Schema): unknown {
  if (!schema) return {};
  if (schema.type === Type.OBJECT && schema.properties) {
    const obj: Record<string, unknown> = {};
    for (const [k, propSchema] of Object.entries(schema.properties)) {
      obj[k] = schemaToJsonBlueprint(propSchema);
    }
    return obj;
  }
  if (schema.type === Type.ARRAY && schema.items) {
    return [schemaToJsonBlueprint(schema.items)];
  }
  if (schema.type === Type.INTEGER || schema.type === Type.NUMBER) {
    return 1;
  }
  if (schema.type === Type.BOOLEAN) {
    return true;
  }
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum[0];
  }
  return "string";
}

function extractPromptAndImagesFromContents(contents: unknown): {
  promptText: string;
  imagesBase64: string[];
} {
  if (typeof contents === "string") {
    return { promptText: contents, imagesBase64: [] };
  }
  const textParts: string[] = [];
  const imagesBase64: string[] = [];

  if (Array.isArray(contents)) {
    for (const item of contents) {
      if (typeof item === "string") {
        textParts.push(item);
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, any>;
        if (typeof obj.text === "string") {
          textParts.push(obj.text);
        } else if (obj.inlineData?.data && String(obj.inlineData?.mimeType || "").startsWith("image/")) {
          imagesBase64.push(String(obj.inlineData.data));
        } else if (Array.isArray(obj.parts)) {
          for (const part of obj.parts) {
            if (typeof part?.text === "string") textParts.push(part.text);
            if (part?.inlineData?.data && String(part?.inlineData?.mimeType || "").startsWith("image/")) {
              imagesBase64.push(String(part.inlineData.data));
            }
          }
        }
      }
    }
  }
  return { promptText: textParts.join("\n\n"), imagesBase64 };
}

function cleanAiResponseText(raw: string, expectJson: boolean): string {
  // Strip <think>...</think> reasoning blocks emitted by Qwen3 / QwQ
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (!expectJson) return cleaned;

  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

async function callOpenAiCompatibleEndpoint(params: {
  endpointUrl: string;
  apiKey: string;
  model: string;
  promptText: string;
  imagesBase64: string[];
  responseSchema?: Schema;
  temperature?: number;
  forceVisionSupport?: boolean;
}): Promise<string> {
  const expectJson = Boolean(params.responseSchema);
  const isGroq = params.endpointUrl.includes("groq.com");
  // Groq Free/On-Demand Tier giới hạn cứng ITPM = 6,000 - 7,000 input tokens/request (~11,200 ký tự).
  // Giữ mỗi request đơn lẻ gửi lên Groq <= 11,200 ký tự để KHÔNG BAO GIỜ bị lỗi HTTP 413 (Limit 7000),
  // còn việc đọc hết 100% chương dài sẽ do bộ chia lát cắt (Sliding Chunks 7,500 ký tự/lát) ở extractAllChapterVocabWithAI xử lý!
  const maxSingleCallChars = isGroq ? 11200 : 26000;
  let fullUserPrompt =
    params.promptText.length <= maxSingleCallChars
      ? params.promptText
      : params.promptText.slice(0, maxSingleCallChars);

  if (expectJson && params.responseSchema) {
    const blueprint = JSON.stringify(
      schemaToJsonBlueprint(params.responseSchema)
    );
    fullUserPrompt += `\n\n⚠️ YÊU CẦU ĐỊNH DẠNG JSON BẮT BUỘC:
Trả về DUY NHẤT 1 đối tượng JSON hợp lệ (không dùng <think>, không markdown) khớp với mẫu:
${blueprint}`;
  }

  const lowerModel = params.model.toLowerCase();
  const supportsVision =
    params.forceVisionSupport === true ||
    lowerModel.includes("vl") ||
    lowerModel.includes("vision") ||
    lowerModel.includes("omni") ||
    lowerModel.includes("gemma-3") ||
    lowerModel.includes("gemma-4") ||
    lowerModel.includes("llama-4") ||
    lowerModel.includes("scout") ||
    lowerModel.includes("maverick") ||
    params.model === "openrouter/free";

  const hasVisionPayload = params.imagesBase64.length > 0 && supportsVision;
  const userContent = hasVisionPayload
    ? [
        { type: "text", text: fullUserPrompt },
        ...params.imagesBase64.slice(0, 6).map((b64) => ({
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${b64}` },
        })),
      ]
    : fullUserPrompt;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${params.apiKey}`,
  };

  if (params.endpointUrl.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://book-mind-ai-bice.vercel.app";
    headers["X-Title"] = "BookMind AI";
  }

  const bodyPayload: Record<string, unknown> = {
    model: params.model,
    messages: [
      {
        role: "system",
        content: expectJson
          ? "You are a multilingual educational AI assistant. Respond ONLY with a valid, compact JSON object matching the requested schema. Extract ALL vocabulary items thoroughly (do NOT truncate vocabulary to 5 items) while keeping per-item explanations concise (1 sentence) so all arrays (vocabulary, clozeExercises, quizExercises, translationExercises) are completely generated."
          : "You are a helpful multilingual educational AI assistant.",
      },
      {
        role: "user",
        content: userContent,
      },
    ],
    temperature: params.temperature ?? 0.25,
  };

  // IMPORTANT: Do NOT set max_tokens on Groq Free Tier because Groq checks (max_tokens <= 1000 OTPM) upfront when max_tokens is specified!
  // Omitting max_tokens on Groq allows openai/gpt-oss-120b and gpt-oss-20b to stream 4,500+ tokens without 429 OTPM errors.
  if (!isGroq) {
    bodyPayload.max_tokens = 8000;
  }

  if (isGroq && params.model.toLowerCase().includes("qwen")) {
    bodyPayload.reasoning_effort = "none";
  }

  if (expectJson && isGroq && !supportsVision) {
    bodyPayload.response_format = { type: "json_object" };
  }

  // Per-provider attempt timeout: fail over quickly on stalled providers so request stays well within HTTP timeout
  const timeoutMs = hasVisionPayload ? 35_000 : 16_000;
  const attemptController = new AbortController();
  const attemptTimer = setTimeout(() => attemptController.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(params.endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(bodyPayload),
      signal: attemptController.signal,
    });
  } finally {
    clearTimeout(attemptTimer);
  }

  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${rawBody.slice(0, 300)}`);
  }

  const data = JSON.parse(rawBody);
  const content = data?.choices?.[0]?.message?.content || "";
  if (!content) {
    throw new Error("Empty response from AI provider");
  }

  const cleaned = cleanAiResponseText(String(content), expectJson);
  if (expectJson) {
    // Validate JSON right here so if truncated/invalid, failover triggers automatically
    JSON.parse(cleaned);
  }
  return cleaned;
}

async function withRaceTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timerId = setTimeout(
          () =>
            reject(
              new Error(`${label} timeout after ${Math.round(timeoutMs / 1000)}s`)
            ),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
}

const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

function getClient(customApiKey?: string, masterApiKey?: string): GoogleGenAI {
  const pool = extractProviderKeysPool(customApiKey, masterApiKey);
  const dummyOrFirstGeminiKey =
    pool.geminiKeys[0] || "AIzaSyDummyKeyForQwenFallbackMode";
  const primaryClient = new GoogleGenAI({ apiKey: dummyOrFirstGeminiKey });

  const originalGenerateContent = primaryClient.models.generateContent.bind(
    primaryClient.models
  );

  // Unified 4-Provider AI Router (Google Gemini + Groq Qwen + OpenRouter Qwen + SiliconFlow Qwen)
  primaryClient.models.generateContent = async (
    params: Parameters<typeof originalGenerateContent>[0]
  ) => {
    // Nếu thiết bị (như Điện thoại) gửi request khi localStorage chưa có Key và bộ nhớ đệm Server cũng trống -> Tự động lấy từ Supabase Cloud
    if (
      pool.geminiKeys.length === 0 &&
      pool.groqKeys.length === 0 &&
      pool.openRouterKeys.length === 0 &&
      pool.siliconFlowKeys.length === 0
    ) {
      await hydratePoolFromSupabaseCloudOnServer(pool);
    }

    const requestedModel = (params.model || "gemini-2.5-flash").trim();
    const { promptText, imagesBase64 } = extractPromptAndImagesFromContents(
      params.contents
    );
    const hasImages = imagesBase64.length > 0;
    const responseSchema = params.config?.responseSchema as Schema | undefined;
    const temperature = params.config?.temperature;

    // Lấy danh sách các model miễn phí còn hoạt động hôm nay (tự động kiểm tra mỗi ngày 1 lần & loại bỏ model 404)
    const liveFreeModels = await getDailyLiveFreeModels({
      groqApiKey: pool.groqKeys[0],
    });

    type ProviderAttempt = { modelId: string; run: () => Promise<string> };
    const attempts: ProviderAttempt[] = [];

    const addGroqAttempts = () => {
      for (const gKey of pool.groqKeys) {
        const groqModels = hasImages
          ? liveFreeModels.groqVisionModels
          : liveFreeModels.groqTextModels;
        for (const m of groqModels) {
          attempts.push({
            modelId: m,
            run: () =>
              callOpenAiCompatibleEndpoint({
                endpointUrl: "https://api.groq.com/openai/v1/chat/completions",
                apiKey: gKey,
                model: m,
                promptText,
                imagesBase64,
                responseSchema,
                temperature,
                forceVisionSupport: hasImages,
              }),
          });
        }
      }
    };

    const addOpenRouterAttempts = () => {
      for (const orKey of pool.openRouterKeys) {
        const orModels = hasImages
          ? liveFreeModels.openRouterVisionFree
          : liveFreeModels.openRouterTextFree;
        for (const m of orModels) {
          attempts.push({
            modelId: m,
            run: () =>
              callOpenAiCompatibleEndpoint({
                endpointUrl: "https://openrouter.ai/api/v1/chat/completions",
                apiKey: orKey,
                model: m,
                promptText,
                imagesBase64,
                responseSchema,
                temperature,
                forceVisionSupport: hasImages,
              }),
          });
        }
      }
    };

    const addSiliconFlowAttempts = () => {
      for (const sfKey of pool.siliconFlowKeys) {
        const sfModels = hasImages
          ? ["Qwen/Qwen3-VL-8B-Instruct", "Qwen/Qwen3.8-27B"]
          : ["Qwen/Qwen3.8-27B", "Qwen/Qwen2.5-7B-Instruct"];
        for (const m of sfModels) {
          attempts.push({
            modelId: m,
            run: () =>
              callOpenAiCompatibleEndpoint({
                endpointUrl: "https://api.siliconflow.com/v1/chat/completions",
                apiKey: sfKey,
                model: m,
                promptText,
                imagesBase64,
                responseSchema,
                temperature,
              }),
          });
        }
      }
    };

    const addGeminiAttempts = (preferredGeminiModel?: string) => {
      if (pool.geminiKeys.length === 0) return;
      const startModel =
        preferredGeminiModel && preferredGeminiModel.startsWith("gemini-")
          ? preferredGeminiModel
          : "gemini-2.5-flash";
      const modelChain = [
        startModel,
        ...GEMINI_FALLBACK_MODELS.filter((m) => m !== startModel),
      ];

      for (const apiKey of pool.geminiKeys) {
        const clientForKey =
          apiKey === dummyOrFirstGeminiKey
            ? primaryClient
            : new GoogleGenAI({ apiKey });
        const genFn =
          apiKey === dummyOrFirstGeminiKey
            ? originalGenerateContent
            : clientForKey.models.generateContent.bind(clientForKey.models);

        for (const candidateModel of modelChain) {
          attempts.push({
            modelId: candidateModel,
            run: async () => {
              const clonedConfig = params.config
                ? { ...params.config }
                : undefined;
              if (
                clonedConfig &&
                "thinkingConfig" in clonedConfig &&
                !candidateModel.startsWith("gemini-2.5")
              ) {
                delete (clonedConfig as Record<string, unknown>).thinkingConfig;
              }
              const geminiTimeoutMs = hasImages ? 35_000 : 22_000;
              const res = await withRaceTimeout(
                genFn({
                  ...params,
                  model: candidateModel,
                  config: clonedConfig,
                }),
                geminiTimeoutMs,
                `Gemini ${candidateModel}`
              );
              if (!res.text) {
                throw new Error("Empty response from Gemini");
              }
              return res.text;
            },
          });
        }
      }
    };

    // Order attempts based on whether the request requires Vision (hasImages) and the user's selected provider
    // Groq now supports ultra-fast multimodal Vision via meta-llama/llama-4-scout-17b-16e-instruct & llama-4-maverick!
    if (hasImages) {
      if (
        !requestedModel.startsWith("qwen-") &&
        pool.geminiKeys.length > 0
      ) {
        addGeminiAttempts(requestedModel);
        addGroqAttempts();
        addSiliconFlowAttempts();
        addOpenRouterAttempts();
      } else {
        addGroqAttempts();
        addGeminiAttempts(requestedModel);
        addSiliconFlowAttempts();
        addOpenRouterAttempts();
      }
    } else if (requestedModel.startsWith("qwen-groq")) {
      addGroqAttempts();
      addSiliconFlowAttempts();
      addOpenRouterAttempts();
      addGeminiAttempts();
    } else if (requestedModel.startsWith("qwen-openrouter")) {
      addOpenRouterAttempts();
      addGroqAttempts();
      addSiliconFlowAttempts();
      addGeminiAttempts();
    } else if (requestedModel.startsWith("qwen-siliconflow")) {
      addSiliconFlowAttempts();
      addGroqAttempts();
      addOpenRouterAttempts();
      addGeminiAttempts();
    } else {
      // User selected Gemini -> Run Gemini first, and if Quota Exceeded (429), automatically failover to Groq -> SiliconFlow -> OpenRouter!
      addGeminiAttempts(requestedModel);
      addGroqAttempts();
      addSiliconFlowAttempts();
      addOpenRouterAttempts();
    }

    if (attempts.length === 0) {
      throw new Error(
        "Thiết bị này chưa nhận được cấu hình Master AI Key từ đám mây. Hãy mở trang chủ hoặc trang /admin trên Laptop 1 lần để hệ thống tự động đồng bộ Key lên Supabase Cloud cho điện thoại!"
      );
    }

    let lastError: unknown = null;
    const routerStartTime = Date.now();
    const maxAttempts = Math.min(attempts.length, 6);
    for (let attemptIdx = 0; attemptIdx < maxAttempts; attemptIdx++) {
      if (attemptIdx >= 2 && Date.now() - routerStartTime > 50_000) {
        break;
      }
      const currentAttempt = attempts[attemptIdx];
      try {
        const resultText = await currentAttempt.run();
        return {
          text: resultText,
        } as Awaited<ReturnType<typeof originalGenerateContent>>;
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (isModelNotFoundError(msg)) {
          // Tự động đưa model 404 / ngừng phục vụ vào danh sách đen trong ngày để các lần sau không gọi lại nữa
          markModelDeadToday(currentAttempt.modelId);
        }
        // Continue to next provider/model in the failover chain!
      }
    }

    throw (
      lastError ||
      new Error(
        "Tất cả các cổng AI (Gemini, Groq, OpenRouter, SiliconFlow) đều đang bận. Vui lòng thử lại sau giây lát!"
      )
    );
  };

  return primaryClient;
}

const CHAPTER_LESSON_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    chapterTitle: { type: Type.STRING },
    overview: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description:
            "Bản diễn giải tổng quan sâu sắc và đầy đủ toàn bộ nội dung, bối cảnh và thông điệp của chương sách bằng tiếng Việt.",
        },
        keyThemes: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        learningObjectives: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
      required: ["summary", "keyThemes", "learningObjectives"],
    },
    contentAnalysis: {
      type: Type.ARRAY,
      description:
        "Chia chương sách thành 3-5 phân đoạn liên tiếp và diễn giải tường tận nội dung từng đoạn để người học nắm trọn vẹn cuốn sách.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sectionTitle: { type: Type.STRING },
          originalExcerpt: {
            type: Type.STRING,
            description: "Đoạn trích nguyên văn tiêu biểu từ chương sách.",
          },
          vietnameseTranslation: {
            type: Type.STRING,
            description: "Bản dịch tiếng Việt chuẩn xác, mượt mà.",
          },
          deepExplanation: {
            type: Type.STRING,
            description:
              "Diễn giải chi tiết ý nghĩa nội dung, tâm lý, lập luận hoặc kiến thức chuyên môn của đoạn văn.",
          },
          stylisticOrContextNotes: {
            type: Type.STRING,
            description:
              "Ghi chú về nghệ thuật dùng từ, sắc thái văn phong hoặc ngữ cảnh ẩn ý của tác giả.",
          },
        },
        required: [
          "id",
          "sectionTitle",
          "originalExcerpt",
          "vietnameseTranslation",
          "deepExplanation",
          "stylisticOrContextNotes",
        ],
      },
    },
    grammarPoints: {
      type: Type.ARRAY,
      description:
        "3-5 cấu trúc ngữ pháp đắt giá xuất hiện trực tiếp trong chương sách.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          patternFormula: { type: Type.STRING },
          quoteFromBook: { type: Type.STRING },
          quoteTranslation: { type: Type.STRING },
          detailedExplanation: { type: Type.STRING },
          whyAuthorUsedIt: { type: Type.STRING },
          extraExamples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                en: { type: Type.STRING },
                vi: { type: Type.STRING },
              },
              required: ["en", "vi"],
            },
          },
        },
        required: [
          "id",
          "title",
          "patternFormula",
          "quoteFromBook",
          "quoteTranslation",
          "detailedExplanation",
          "whyAuthorUsedIt",
          "extraExamples",
        ],
      },
    },
    vocabulary: {
      type: Type.ARRAY,
      description:
        "Trích xuất ĐẦY ĐỦ TẤT CẢ (100%) các từ vựng (Vocabulary), cụm từ (Phrases) và danh từ riêng (Names/Proper Nouns) xuất hiện trong các bảng từ vựng của bài học (ví dụ nếu bài có 35-50 từ thì phải liệt kê đủ 35-50 từ, tuyệt đối không cắt bớt chỉ lấy 10 từ).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          word: { type: Type.STRING },
          ipa: { type: Type.STRING },
          partOfSpeech: { type: Type.STRING },
          cefrLevel: {
            type: Type.STRING,
            description: "One of A1, A2, B1, B2, C1, C2",
          },
          vietnameseMeaning: { type: Type.STRING },
          explanationInContext: {
            type: Type.STRING,
            description:
              "Giải thích ngắn gọn cách dùng từ này (1-2 câu).",
          },
          quoteFromBook: { type: Type.STRING },
          quoteTranslation: { type: Type.STRING },
          collocations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: [
          "id",
          "word",
          "ipa",
          "partOfSpeech",
          "cefrLevel",
          "vietnameseMeaning",
          "explanationInContext",
          "quoteFromBook",
          "quoteTranslation",
          "collocations",
          "synonyms",
        ],
      },
    },
    clozeExercises: {
      type: Type.ARRAY,
      description:
        "6-8 bài tập điền từ hoặc cấu trúc ngữ pháp vào chỗ trống (dùng ký hiệu _____ cho từ cần điền).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentenceWithBlank: { type: Type.STRING },
          answer: {
            type: Type.STRING,
            description: "Từ duy nhất hoặc cụm từ chính xác cần điền vào _____",
          },
          hint: { type: Type.STRING },
          fullSentenceTranslation: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "sentenceWithBlank",
          "answer",
          "hint",
          "fullSentenceTranslation",
          "explanation",
        ],
      },
    },
    quizExercises: {
      type: Type.ARRAY,
      description:
        "8-10 câu hỏi trắc nghiệm CHỈ KIỂM TRA TỪ VỰNG VÀ NGỮ PHÁP (TUYỆT ĐỐI KHÔNG hỏi nội dung tình tiết hội thoại như nhân vật tên gì, đi đâu).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          category: {
            type: Type.STRING,
            description: "vocabulary | grammar",
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctIndex: {
            type: Type.INTEGER,
            description: "0-based index of the correct option (0, 1, 2, or 3)",
          },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "question",
          "category",
          "options",
          "correctIndex",
          "explanation",
        ],
      },
    },
    translationExercises: {
      type: Type.ARRAY,
      description:
        "3-5 câu văn tiêu biểu trong chương để người học luyện dịch sang tiếng Việt và được AI chấm điểm.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          originalSentence: { type: Type.STRING },
          direction: {
            type: Type.STRING,
            description: "EN_TO_VI",
          },
          contextHint: { type: Type.STRING },
          targetGrammarOrVocab: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          referenceTranslation: { type: Type.STRING },
        },
        required: [
          "id",
          "originalSentence",
          "direction",
          "contextHint",
          "targetGrammarOrVocab",
          "referenceTranslation",
        ],
      },
    },
  },
  required: [
    "chapterTitle",
    "overview",
    "contentAnalysis",
    "grammarPoints",
    "vocabulary",
    "clozeExercises",
    "quizExercises",
    "translationExercises",
  ],
};

const TRANSLATION_EVAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.INTEGER,
      description: "Tổng điểm độ gần đúng từ 0 đến 100",
    },
    semanticAccuracy: {
      type: Type.INTEGER,
      description: "Điểm truyền tải đúng ý nghĩa câu gốc (0-100)",
    },
    grammarAndStructure: {
      type: Type.INTEGER,
      description: "Điểm ngữ pháp và cấu trúc câu dịch (0-100)",
    },
    naturalnessAndTone: {
      type: Type.INTEGER,
      description: "Điểm độ tự nhiên và giữ đúng sắc thái văn phong (0-100)",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Các điểm người học đã dịch tốt, sát nghĩa",
    },
    improvements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Các góp ý chi tiết chỗ dịch thiếu ý, lệch sắc thái hoặc chưa tự nhiên",
    },
    suggestedTranslation: {
      type: Type.STRING,
      description: "Bản dịch mẫu hoàn chỉnh và tối ưu nhất",
    },
    wordByWordBreakdown: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourcePhrase: { type: Type.STRING },
          userRendered: { type: Type.STRING },
          betterChoice: { type: Type.STRING },
          note: { type: Type.STRING },
        },
        required: ["sourcePhrase", "userRendered", "betterChoice", "note"],
      },
    },
  },
  required: [
    "overallScore",
    "semanticAccuracy",
    "grammarAndStructure",
    "naturalnessAndTone",
    "strengths",
    "improvements",
    "suggestedTranslation",
    "wordByWordBreakdown",
  ],
};

const PRONUNCIATION_EVAL_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    overallScore: {
      type: Type.INTEGER,
      description: "Điểm phần trăm độ chính xác phát âm từ 0 đến 100%",
    },
    accuracyGrade: {
      type: Type.STRING,
      description:
        "Xếp loại: Xuất sắc (Native-like) | Tốt (Good) | Khá (Fair) | Cần cải thiện (Needs Work)",
    },
    correctWords: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Danh sách các từ hoặc âm tiết phát âm chuẩn xác",
    },
    mispronouncedWords: {
      type: Type.ARRAY,
      description:
        "Danh sách các từ/âm tiết bị phát âm sai, phát âm lệch hoặc nuốt âm",
      items: {
        type: Type.OBJECT,
        properties: {
          word: {
            type: Type.STRING,
            description: "Từ bị phát âm sai hoặc chưa chuẩn",
          },
          expectedPhonetic: {
            type: Type.STRING,
            description: "Phiên âm đúng chuẩn (IPA hoặc Pinyin)",
          },
          detectedSound: {
            type: Type.STRING,
            description: "Âm thanh/thanh điệu mà người học đã đọc lệch",
          },
          issue: {
            type: Type.STRING,
            description:
              "Lỗi cụ thể (ví dụ: Sai thanh 3 thành thanh 4, thiếu âm đuôi, nuốt phụ âm...)",
          },
          tip: {
            type: Type.STRING,
            description:
              "Mẹo cụ thể cách đặt khẩu hình miệng, uốn lưỡi, nhả thanh để phát âm chuẩn",
          },
        },
        required: ["word", "issue", "tip"],
      },
    },
    fluencyScore: {
      type: Type.INTEGER,
      description: "Điểm độ lưu loát và ngắt nghỉ tự nhiên (0-100)",
    },
    completenessScore: {
      type: Type.INTEGER,
      description: "Điểm độ đọc đủ từ không bị sót từ nào (0-100)",
    },
    generalFeedback: {
      type: Type.STRING,
      description:
        "Nhận xét tổng quan, giải thích rõ sai chỗ nào và cần cải thiện gì bằng tiếng Việt",
    },
  },
  required: [
    "overallScore",
    "accuracyGrade",
    "correctWords",
    "mispronouncedWords",
    "fluencyScore",
    "completenessScore",
    "generalFeedback",
  ],
};

export function normalizeDedupeVocabKey(word: string): string {
  return String(word || "")
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[\d.\-#*•]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function generateChapterLessonWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  pageImagesBase64?: string[];
  existingCourseWords?: string[];
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<ChapterLesson> {
  const lessonStartTime = Date.now();
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  // Limit text per single chapter call to ~16,000 chars for fast, reliable single-pass response
  const trimmedText = params.chapterText.slice(0, 16000);

  const hasVisionImages =
    Array.isArray(params.pageImagesBase64) &&
    params.pageImagesBase64.length > 0;

  const existingWordsNotice =
    Array.isArray(params.existingCourseWords) &&
    params.existingCourseWords.length > 0
      ? `\n🚫 CẢNH BÁO CHỐNG TRÙNG LẶP TỪ VỰNG (ANTI-DUPLICATION RULE):
- Dưới đây là các từ vựng đã được tạo ở các bài trước hoặc đã có sẵn: [${params.existingCourseWords
          .slice(0, 180)
          .join(", ")}].
- TUYỆT ĐỐI KHÔNG tạo lặp lại một từ vựng 2 lần trong cùng bài học này, và ưu tiên trích xuất các từ vựng mới của chương hiện tại (không lặp lại từ cũ của các chương trước trừ khi mang nghĩa hoàn toàn mới)!\n`
      : `\n🚫 CẢNH BÁO CHỐNG TRÙNG LẶP TỪ VỰNG (ANTI-DUPLICATION RULE):
- TUYỆT ĐỐI KHÔNG tạo từ vựng bị trùng lặp (mỗi mục từ word trong danh sách vocabulary phải là DUY NHẤT 100%, không lặp lại từ đã xuất hiện ở mục trước dưới bất kỳ hình thức nào)!\n`;

  const prompt = `Bạn là một Giáo sư Ngôn ngữ học & Gia sư Đọc hiểu Sách chuyên sâu (Multilingual Book Tutor Agent - hỗ trợ sách Tiếng Anh, Tiếng Trung 繁體/簡體 Pinyin, Tiếng Nhật, Tiếng Hàn...).
Hãy phân tích toàn diện chương sách dưới đây thuộc cuốn sách "${params.courseTitle}" và tạo ra bài học cực kỳ chi tiết bằng tiếng Việt để người học vừa nắm trọn vẹn nội dung cuốn sách, vừa giỏi từ vựng, ngữ pháp và kỹ năng dịch thuật.
${
  hasVisionImages
    ? `\n⚠️ CHÚ Ý ĐẶC BIỆT (CHẾ ĐỘ HYBRID PDF - VỪA CÓ CHỮ VỪA CÓ ẢNH):
File PDF này có phần NỘI DUNG CHÍNH nằm trong ${params.pageImagesBase64!.length} HÌNH ẢNH TRANG SÁCH đính kèm (trong khi phần văn bản thô bên dưới có thể chỉ là tiêu đề đầu trang, số trang hoặc một phần chữ).
Bạn BẮT BUỘC phải nhìn và đọc kỹ TOÀN BỘ chữ, hội thoại, bảng từ vựng, chú thích ngữ pháp và bài đọc nằm bên trong các HÌNH ẢNH TRANG SÁCH đính kèm kết hợp với văn bản để trích xuất đầy đủ 100% nội dung bài học!\n`
    : "(Nếu có hình ảnh trang sách đính kèm do PDF dạng scan, hãy đọc kỹ toàn bộ chữ trên các trang ảnh đó để soạn bài)."
}
${existingWordsNotice}
TÊN CHƯƠNG: ${params.chapterTitle}

YÊU CẦU BẮT BUỘC (Viết súc tích, rõ ràng để đảm bảo xuất đủ 100% cả 7 phần dưới đây):
1. overview: Tóm tắt nội dung/luận điểm của chương sách, nêu 3 chủ đề chính và 3 mục tiêu học tập.
2. contentAnalysis: Chia nội dung chương thành 2-3 phần trọng tâm theo mạch sách (ví dụ Dialogue I, Dialogue II, Bài đọc...). Mỗi phần trích dẫn đoạn văn gốc (originalExcerpt), dịch sang tiếng Việt chuẩn xác (vietnameseTranslation), và giải thích sâu ý nghĩa nội dung, bối cảnh (deepExplanation & stylisticOrContextNotes).
3. grammarPoints: Trích xuất 3-5 cấu trúc ngữ pháp trọng tâm xuất hiện trong chương. Giải thích công thức, cách dùng và cho 1-2 ví dụ.
4. vocabulary: BẮT BUỘC trích xuất ĐẦY ĐỦ TẤT CẢ các mục từ vựng xuất hiện trong chương (tối thiểu 20 đến 35+ từ, bao gồm toàn bộ bảng Vocabulary I, Vocabulary II, People, Names, và Phrases — TUYỆT ĐỐI KHÔNG ĐƯỢC RÚT GỌN CHỈ CÒN 5 TỪ VÀ TUYỆT ĐỐI KHÔNG LẶP LẠI TỪ VỰNG TRÙNG NHAU!). Ở trường ipa: ghi phiên âm Pinyin có dấu (nếu tiếng Trung) hoặc IPA (nếu tiếng Anh). Cung cấp từ loại chuẩn, nghĩa tiếng Việt, câu ví dụ ngắn gọn, 1-2 collocations.
5. clozeExercises: Tạo 5 câu bài tập điền từ/ngữ pháp vào chỗ trống (dùng đúng ký hiệu "_____" tại vị trí từ bị khuyết).
6. quizExercises: Tạo 6 câu hỏi trắc nghiệm (4 lựa chọn) CHỈ KIỂM TRA TỪ VỰNG (nghĩa từ, cách dùng từ, phiên âm) VÀ NGỮ PHÁP (trật tự từ, chọn cấu trúc đúng, điền trợ từ).
7. translationExercises: Chọn 4 câu tiêu biểu sử dụng từ vựng và ngữ pháp của chương để người học luyện dịch sang tiếng Việt.

NỘI DUNG VĂN BẢN CHƯƠNG SÁCH (LỚP TEXT & OCR TRÍCH XUẤT TỰ ĐỘNG):
"""
${trimmedText || "(Nội dung nằm trong các hình ảnh trang sách đính kèm)"}
"""`;

  const contentsPayload: Array<
    string | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  if (params.pageImagesBase64 && params.pageImagesBase64.length > 0) {
    // Limit inline images in lesson generation to max 5 to prevent Gemini Vision + JSON Schema timeout
    for (const base64Img of params.pageImagesBase64.slice(0, 5)) {
      contentsPayload.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Img,
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contentsPayload,
    config: {
      responseMimeType: "application/json",
      responseSchema: CHAPTER_LESSON_SCHEMA,
      temperature: 0.25,
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("AI không trả về dữ liệu bài học. Vui lòng thử lại.");
  }

  const rawParsed = JSON.parse(response.text) as Record<string, any>;
  const root =
    rawParsed && typeof rawParsed.lesson === "object" && !rawParsed.overview
      ? rawParsed.lesson
      : rawParsed;

  const normalizedLesson: ChapterLesson = {
    chapterTitle: String(root?.chapterTitle || params.chapterTitle || "Bài học"),
    overview: {
      summary: String(
        root?.overview?.summary ||
          "Tổng quan nội dung trọng tâm của chương sách."
      ),
      keyThemes: Array.isArray(root?.overview?.keyThemes)
        ? root.overview.keyThemes.map(String)
        : [],
      learningObjectives: Array.isArray(root?.overview?.learningObjectives)
        ? root.overview.learningObjectives.map(String)
        : [],
    },
    contentAnalysis: Array.isArray(root?.contentAnalysis)
      ? root.contentAnalysis.map((sec: any, idx: number) => ({
          id: String(sec?.id || `sec-${idx + 1}`),
          sectionTitle: String(sec?.sectionTitle || `Phần ${idx + 1}`),
          originalExcerpt: String(sec?.originalExcerpt || ""),
          vietnameseTranslation: String(sec?.vietnameseTranslation || ""),
          deepExplanation: String(sec?.deepExplanation || ""),
          stylisticOrContextNotes: String(sec?.stylisticOrContextNotes || ""),
        }))
      : [],
    grammarPoints: Array.isArray(root?.grammarPoints)
      ? root.grammarPoints.map((gp: any, idx: number) => ({
          id: String(gp?.id || `gp-${idx + 1}`),
          title: String(gp?.title || `Điểm ngữ pháp ${idx + 1}`),
          patternFormula: String(gp?.patternFormula || ""),
          quoteFromBook: String(gp?.quoteFromBook || ""),
          quoteTranslation: String(gp?.quoteTranslation || ""),
          detailedExplanation: String(gp?.detailedExplanation || ""),
          whyAuthorUsedIt: String(gp?.whyAuthorUsedIt || ""),
          extraExamples: Array.isArray(gp?.extraExamples)
            ? gp.extraExamples.map((ex: any) => ({
                en: String(ex?.en || ""),
                vi: String(ex?.vi || ""),
              }))
            : [],
        }))
      : [],
    vocabulary: (() => {
      const rawVocab = Array.isArray(root?.vocabulary) ? root.vocabulary : [];
      const seenKeys = new Set<string>();
      const deduped: VocabularyItem[] = [];
      for (const v of rawVocab) {
        const word = String(v?.word || "").trim();
        const key = normalizeDedupeVocabKey(word);
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);
        deduped.push({
          id: String(v?.id || `voc-${deduped.length + 1}`),
          word,
          ipa: String(v?.ipa || ""),
          partOfSpeech: String(v?.partOfSpeech || "word"),
          cefrLevel: (["A1", "A2", "B1", "B2", "C1", "C2"].includes(
            String(v?.cefrLevel)
          )
            ? v.cefrLevel
            : "B1") as any,
          vietnameseMeaning: String(v?.vietnameseMeaning || ""),
          explanationInContext: String(v?.explanationInContext || ""),
          quoteFromBook: String(v?.quoteFromBook || ""),
          quoteTranslation: String(v?.quoteTranslation || ""),
          collocations: Array.isArray(v?.collocations)
            ? v.collocations.map(String)
            : [],
          synonyms: Array.isArray(v?.synonyms) ? v.synonyms.map(String) : [],
        });
      }
      return deduped;
    })(),
    clozeExercises: Array.isArray(root?.clozeExercises)
      ? root.clozeExercises.map((cl: any, idx: number) => ({
          id: String(cl?.id || `cloze-${idx + 1}`),
          sentenceWithBlank: String(cl?.sentenceWithBlank || ""),
          answer: String(cl?.answer || ""),
          hint: String(cl?.hint || ""),
          fullSentenceTranslation: String(cl?.fullSentenceTranslation || ""),
          explanation: String(cl?.explanation || ""),
        }))
      : [],
    quizExercises: Array.isArray(root?.quizExercises)
      ? root.quizExercises.map((qz: any, idx: number) => ({
          id: String(qz?.id || `quiz-${idx + 1}`),
          question: String(qz?.question || ""),
          category: (["comprehension", "vocabulary", "grammar", "inference"].includes(
            String(qz?.category)
          )
            ? qz.category
            : "vocabulary") as any,
          options: Array.isArray(qz?.options)
            ? qz.options.map(String)
            : ["A", "B", "C", "D"],
          correctIndex:
            typeof qz?.correctIndex === "number" ? qz.correctIndex : 0,
          explanation: String(qz?.explanation || ""),
        }))
      : [],
    translationExercises: Array.isArray(root?.translationExercises)
      ? root.translationExercises.map((tr: any, idx: number) => ({
          id: String(tr?.id || `trans-${idx + 1}`),
          originalSentence: String(tr?.originalSentence || ""),
          direction: (tr?.direction === "VI_TO_EN"
            ? "VI_TO_EN"
            : "EN_TO_VI") as "EN_TO_VI" | "VI_TO_EN",
          contextHint: String(tr?.contextHint || ""),
          targetGrammarOrVocab: Array.isArray(tr?.targetGrammarOrVocab)
            ? tr.targetGrammarOrVocab.map(String)
            : [],
          referenceTranslation: String(tr?.referenceTranslation || ""),
        }))
      : [],
    generatedAt: new Date().toISOString(),
  };

  // Chặng 2 (Time-boxed): chỉ kích hoạt quét bổ sung từ vựng khi vẫn còn quỹ thời gian (< 38s) và bước đầu mới lấy < 25 từ
  if (
    Date.now() - lessonStartTime < 38_000 &&
    normalizedLesson.vocabulary.length < 25 &&
    (params.chapterText.trim().length > 200 ||
      (params.pageImagesBase64 && params.pageImagesBase64.length > 0))
  ) {
    try {
      const fullVocab = await withRaceTimeout(
        extractAllChapterVocabWithAI({
          courseTitle: params.courseTitle,
          chapterTitle: params.chapterTitle,
          chapterText: params.chapterText,
          pageImagesBase64: params.pageImagesBase64,
          apiKey: params.apiKey,
          masterApiKey: params.masterApiKey,
          model: params.model,
        }),
        25_000,
        "Extract full chapter vocabulary"
      );
      if (Array.isArray(fullVocab) && fullVocab.length > 0) {
        const seenWords = new Set<string>();
        const mergedVocab: typeof normalizedLesson.vocabulary = [];
        for (const item of [...fullVocab, ...normalizedLesson.vocabulary]) {
          const cleanKey = String(item?.word || "")
            .trim()
            .toLowerCase();
          if (!cleanKey || seenWords.has(cleanKey)) continue;
          seenWords.add(cleanKey);
          mergedVocab.push({
            ...item,
            id: `voc-${mergedVocab.length + 1}`,
          });
        }
        if (mergedVocab.length > normalizedLesson.vocabulary.length) {
          normalizedLesson.vocabulary = mergedVocab;
        }
      }
    } catch (vocabErr) {
      console.warn("[Auto-Extract Full Chapter Vocab Failed]:", vocabErr);
    }
  }

  // Chặng 3 (Time-boxed): nếu Tab 4 hoặc Tab 5 bị rỗng và vẫn còn thời gian (< 38s), bổ sung nhanh trong tối đa 25s
  if (
    Date.now() - lessonStartTime < 38_000 &&
    (normalizedLesson.clozeExercises.length === 0 ||
      normalizedLesson.translationExercises.length === 0)
  ) {
    try {
      const vocabSummary = normalizedLesson.vocabulary
        .map((v) => `${v.word} (${v.ipa}): ${v.vietnameseMeaning}`)
        .join("; ");
      const grammarSummary = normalizedLesson.grammarPoints
        .map((g) => `${g.title} (${g.patternFormula}): ${g.quoteFromBook}`)
        .join("; ");
      const contentSummary = normalizedLesson.contentAnalysis
        .map((c) => `${c.originalExcerpt} -> ${c.vietnameseTranslation}`)
        .join("\n");

      const supp = await withRaceTimeout(
        generateSupplementalExercisesWithAI({
          courseTitle: params.courseTitle,
          chapterTitle: params.chapterTitle,
          chapterText: params.chapterText,
          existingLessonContext: `TỪ VỰNG ĐÃ TRÍCH XUẤT: ${vocabSummary}\nNGỮ PHÁP: ${grammarSummary}\nĐOẠN TRÍCH TRONG BÀI:\n${contentSummary}`,
          apiKey: params.apiKey,
          masterApiKey: params.masterApiKey,
          model: params.model,
        }),
        25_000,
        "Generate supplemental exercises"
      );

      if (normalizedLesson.clozeExercises.length === 0) {
        normalizedLesson.clozeExercises = supp.clozeExercises;
      }
      if (normalizedLesson.quizExercises.length === 0) {
        normalizedLesson.quizExercises = supp.quizExercises;
      }
      if (normalizedLesson.translationExercises.length === 0) {
        normalizedLesson.translationExercises = supp.translationExercises;
      }
    } catch (suppErr) {
      console.warn("[Auto-Supplement Exercises Failed]:", suppErr);
    }
  }

  return normalizedLesson;
}

const SUPPLEMENT_EXERCISES_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    clozeExercises: {
      type: Type.ARRAY,
      description:
        "6 bài tập điền từ hoặc cấu trúc ngữ pháp vào chỗ trống (dùng ký hiệu _____ cho từ cần điền).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentenceWithBlank: { type: Type.STRING },
          answer: { type: Type.STRING },
          hint: { type: Type.STRING },
          fullSentenceTranslation: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "sentenceWithBlank",
          "answer",
          "hint",
          "fullSentenceTranslation",
          "explanation",
        ],
      },
    },
    quizExercises: {
      type: Type.ARRAY,
      description:
        "8 câu hỏi trắc nghiệm 4 lựa chọn kiểm tra từ vựng và ngữ pháp của chương.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          category: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "question",
          "category",
          "options",
          "correctIndex",
          "explanation",
        ],
      },
    },
    translationExercises: {
      type: Type.ARRAY,
      description:
        "5 câu văn tiêu biểu sử dụng từ vựng và ngữ pháp của chương để người học luyện dịch sang tiếng Việt.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          originalSentence: { type: Type.STRING },
          direction: { type: Type.STRING },
          contextHint: { type: Type.STRING },
          targetGrammarOrVocab: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          referenceTranslation: { type: Type.STRING },
        },
        required: [
          "id",
          "originalSentence",
          "direction",
          "contextHint",
          "targetGrammarOrVocab",
          "referenceTranslation",
        ],
      },
    },
  },
  required: ["clozeExercises", "quizExercises", "translationExercises"],
};

export async function generateSupplementalExercisesWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  existingLessonContext?: string;
  existingClozeCount?: number;
  existingQuizCount?: number;
  existingTranslationCount?: number;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<{
  clozeExercises: ChapterLesson["clozeExercises"];
  quizExercises: ChapterLesson["quizExercises"];
  translationExercises: ChapterLesson["translationExercises"];
}> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";
  const trimmedText = (params.chapterText || "").slice(0, 15000);
  const contextBlock = (params.existingLessonContext || "").slice(0, 10000);

  const prompt = `Bạn là Giáo sư Ngôn ngữ học & Gia sư Sách ngoại ngữ chuyên sâu.
Nhiệm vụ của bạn là TẠO BỔ SUNG bộ bài tập thực hành cho Chương "${params.chapterTitle}" thuộc sách "${params.courseTitle}".
(Lưu ý: Chỉ tập trung sinh 3 mảng bài tập dưới đây, KHÔNG sinh lại phần tóm tắt hay danh sách từ vựng).

DỮ LIỆU BÀI HỌC ĐÃ CÓ (Từ vựng, Ngữ pháp & Nội dung Tab 1-2-3):
"""
${contextBlock || "(Chưa có dữ liệu tóm tắt)"}
"""

VĂN BẢN GỐC CỦA CHƯƠNG:
"""
${trimmedText || "(Sử dụng dữ liệu bài học phía trên)"}
"""

YÊU CẦU BẮT BUỘC (Trả về đúng định dạng JSON):
1. clozeExercises: Tạo 6 câu bài tập điền từ hoặc cấu trúc ngữ pháp vào chỗ trống (dùng ký hiệu "_____" tại vị trí từ cần điền). Có gợi ý (hint), bản dịch câu đầy đủ (fullSentenceTranslation) và giải thích chi tiết (explanation).
2. quizExercises: Tạo 8 câu hỏi trắc nghiệm (4 lựa chọn A, B, C, D) kiểm tra sâu Từ vựng (vocabulary) và Ngữ pháp (grammar) xuất hiện trong chương. Giải thích rõ vì sao đáp án đúng.
3. translationExercises: Tạo 5 câu luyện dịch tiêu biểu sát với ngữ pháp và từ vựng của chương để người học dịch sang tiếng Việt và được AI chấm điểm (direction: "EN_TO_VI", có contextHint, targetGrammarOrVocab và referenceTranslation chuẩn xác).`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: SUPPLEMENT_EXERCISES_SCHEMA,
      temperature: 0.35,
      maxOutputTokens: 16384,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("AI không trả về dữ liệu bài tập bổ sung. Vui lòng thử lại.");
  }

  const rawParsed = JSON.parse(response.text) as Record<string, any>;
  const stamp = Date.now();

  const clozeExercises: ChapterLesson["clozeExercises"] = Array.isArray(
    rawParsed?.clozeExercises
  )
    ? rawParsed.clozeExercises.map((cl: any, idx: number) => ({
        id: `cloze-${stamp}-${idx + 1}`,
        sentenceWithBlank: String(cl?.sentenceWithBlank || ""),
        answer: String(cl?.answer || ""),
        hint: String(cl?.hint || ""),
        fullSentenceTranslation: String(cl?.fullSentenceTranslation || ""),
        explanation: String(cl?.explanation || ""),
      }))
    : [];

  const quizExercises: ChapterLesson["quizExercises"] = Array.isArray(
    rawParsed?.quizExercises
  )
    ? rawParsed.quizExercises.map((qz: any, idx: number) => ({
        id: `quiz-${stamp}-${idx + 1}`,
        question: String(qz?.question || ""),
        category: (["comprehension", "vocabulary", "grammar"].includes(
          String(qz?.category)
        )
          ? qz.category
          : "vocabulary") as "vocabulary" | "grammar" | "comprehension",
        options:
          Array.isArray(qz?.options) && qz.options.length >= 2
            ? qz.options.map(String)
            : ["A", "B", "C", "D"],
        correctIndex:
          typeof qz?.correctIndex === "number" ? qz.correctIndex : 0,
        explanation: String(qz?.explanation || ""),
      }))
    : [];

  const translationExercises: ChapterLesson["translationExercises"] =
    Array.isArray(rawParsed?.translationExercises)
      ? rawParsed.translationExercises.map((tr: any, idx: number) => ({
          id: `trans-${stamp}-${idx + 1}`,
          originalSentence: String(tr?.originalSentence || ""),
          direction: (tr?.direction === "VI_TO_EN"
            ? "VI_TO_EN"
            : "EN_TO_VI") as "EN_TO_VI" | "VI_TO_EN",
          contextHint: String(tr?.contextHint || ""),
          targetGrammarOrVocab: Array.isArray(tr?.targetGrammarOrVocab)
            ? tr.targetGrammarOrVocab.map(String)
            : [],
          referenceTranslation: String(tr?.referenceTranslation || ""),
        }))
      : [];

  return {
    clozeExercises,
    quizExercises,
    translationExercises,
  };
}

export async function evaluateSentenceTranslationWithAI(params: {
  originalSentence: string;
  referenceTranslation: string;
  contextHint: string;
  userTranslation: string;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<TranslationEvaluation> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Giám khảo Chấm thi Dịch thuật Song ngữ Anh - Việt (AI Semantic Translation Evaluator).
Hãy đánh giá độ chính xác, độ gần đúng về ngữ nghĩa, cấu trúc ngữ pháp và sắc thái văn phong của câu dịch do người học thực hiện so với câu gốc trong sách.

CÂU GỐC TRONG SÁCH:
"${params.originalSentence}"

GỢI Ý NGỮ CẢNH:
"${params.contextHint}"

BẢN DỊCH THAM KHẢO:
"${params.referenceTranslation}"

BẢN DỊCH CỦA NGƯỜI HỌC:
"${params.userTranslation}"

YÊU CẦU CHẤM ĐIỂM CÔNG TÂM VÀ CHI TIẾT:
- Đánh giá xem bản dịch của người học đúng được bao nhiêu phần trăm (0 - 100%) về mặt ý nghĩa (không bắt buộc phải trùng từng chữ với bản tham khảo nếu dùng từ đồng nghĩa hợp lý và tự nhiên).
- Chỉ rõ những điểm dịch tốt (strengths) và những chỗ dịch sai nghĩa, thiếu từ hoặc chưa tự nhiên (improvements).
- Phân tích đối chiếu từng cụm từ quan trọng trong wordByWordBreakdown.`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: TRANSLATION_EVAL_SCHEMA,
      temperature: 0.2,
    },
  });

  if (!response.text) {
    throw new Error("Không nhận được phản hồi chấm điểm từ AI.");
  }

  const parsed = JSON.parse(response.text);
  return {
    ...parsed,
    userTranslation: params.userTranslation,
    evaluatedAt: new Date().toISOString(),
  };
}

export async function askBookTutorWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  question: string;
  selectedExcerpt?: string;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<string> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Gia sư AI chuyên giải đáp sách "${params.courseTitle}" (${params.chapterTitle}).
Ngữ cảnh chương sách (trích lược):
"""
${params.chapterText.slice(0, 15000)}
"""
${
  params.selectedExcerpt
    ? `\nĐoạn văn người học đang bôi đen / thắc mắc:\n"${params.selectedExcerpt}"\n`
    : ""
}
Câu hỏi của người học: "${params.question}"

Hãy trả lời thật rõ ràng, sâu sắc, dễ hiểu bằng tiếng Việt (phân tích cả ý nghĩa nội dung lẫn từ vựng/ngữ pháp nếu liên quan).`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
  });

  return response.text || "Không có phản hồi từ AI.";
}

const TOC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    chapters: {
      type: Type.ARRAY,
      description:
        "Danh sách các Chương / Bài học chính thức của sách dựa trên Mục lục và tiêu đề trang PDF (bỏ qua bìa, lời tựa, phụ lục không cần thiết).",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Tên bài học / chương (VD: Lesson 1: 歡迎你來臺灣！ Welcome to Taiwan!)",
          },
          startPage: {
            type: Type.INTEGER,
            description: "Số trang PDF bắt đầu (1-based)",
          },
          endPage: {
            type: Type.INTEGER,
            description: "Số trang PDF kết thúc (1-based)",
          },
        },
        required: ["title", "startPage", "endPage"],
      },
    },
  },
  required: ["chapters"],
};

export async function extractBookTocWithAI(params: {
  pageSummaries: string;
  tocImagesBase64?: string[];
  totalPages: number;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<{ title: string; startPage: number; endPage: number }[]> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const hasTocImages =
    Array.isArray(params.tocImagesBase64) && params.tocImagesBase64.length > 0;

  const prompt = `Bạn là Chuyên gia Phân tích Cấu trúc Sách & Mục lục (Table of Contents Vision Analyzer).
Cuốn sách PDF này có tổng cộng ${params.totalPages} trang PDF.
${
  hasTocImages
    ? `⚠️ CHÚ Ý QUAN TRỌNG: Đây là sách PDF dạng Scan/Ảnh. Mình đã đính kèm ${params.tocImagesBase64!.length} hình ảnh của các trang đầu cuốn sách (từ Trang PDF số 2 đến Trang PDF số ${params.tocImagesBase64!.length + 1}).
Hãy NHÌN TRỰC TIẾP VÀO CÁC HÌNH ẢNH ĐÍNH KÈM để tìm trang Mục lục (Table of Contents / 目錄 / Contents / 課次) và đọc danh sách toàn bộ các Bài học / Chương chính (ví dụ: Lesson 1 / 第一課 / Bài 1... cho đến bài cuối cùng).`
    : `Hãy đọc phần Mục lục (Table of Contents / 目錄 / Contents) kết hợp với tiêu đề xuất hiện trên từng trang [Page X] để xác định danh sách các Bài học / Chương chính.`
}

QUY TẮC BẮT BUỘC:
1. Loại bỏ các phần dẫn nhập không phải bài học (như Bìa, Lời nói đầu, Hướng dẫn sử dụng, Mục lục). Chỉ lấy các Bài học / Chương chính (Lessons / Units / Chapters).
2. TÍNH ĐỘ LỆCH SỐ TRANG (PAGE OFFSET):
   - Trong sách scan, số trang in trong trang Mục lục (ví dụ Lesson 1 trang 1, Lesson 2 trang 17...) thường lệch khoảng +6 đến +14 trang so với số trang thực tế của file PDF (do file PDF có thêm các trang bìa, lời nói đầu, mục lục ở đầu).
   - Hãy kiểm tra xem trong các ảnh đính kèm hoặc dữ liệu [Page X] bên dưới, Lesson 1 thực tế bắt đầu ở trang PDF số mấy (nếu không thấy trang bắt đầu của Lesson 1 trong ảnh thì cộng độ lệch ước tính khoảng +${hasTocImages ? "10" : "0"} trang vào số trang in trong mục lục), và đảm bảo trang kết thúc của bài cuối cùng không vượt quá ${params.totalPages}.
   - endPage của bài trước phải bằng (startPage của bài kế tiếp - 1).
3. BẮT BUỘC liệt kê ĐẦY ĐỦ TẤT CẢ các bài học / chương từ bài đầu tiên đến bài cuối cùng của cuốn sách (ví dụ nếu sách có 12 hoặc 15 Units/Lessons thì phải trả về đủ cả 12-15 bài cho tới trang ${params.totalPages}, TUYỆT ĐỐI KHÔNG dừng lại giữa chừng ở bài 4 hay bài 5!). Định dạng JSON: { "chapters": [ { "title": "Lesson 1: ...", "startPage": 12, "endPage": 26 }, ... ] }.

DỮ LIỆU TEXT TRÍCH XUẤT TỪ PDF (NẾU CÓ):
"""
${params.pageSummaries.slice(0, 11000)}
"""`;

  const contentsPayload: Array<
    string | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  if (params.tocImagesBase64 && params.tocImagesBase64.length > 0) {
    for (const base64Img of params.tocImagesBase64.slice(0, 8)) {
      contentsPayload.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Img,
        },
      });
    }
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contentsPayload,
    config: {
      responseMimeType: "application/json",
      responseSchema: TOC_SCHEMA,
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("AI không thể phân tích mục lục.");
  }

  const parsed = JSON.parse(response.text);
  const rawList = Array.isArray(parsed?.chapters)
    ? parsed.chapters
    : Array.isArray(parsed)
    ? parsed
    : [];

  if (rawList.length === 0) {
    throw new Error(
      "AI không tìm thấy trang Mục lục rõ ràng trong các trang đầu của PDF."
    );
  }

  return rawList.map((ch: any, idx: number) => ({
    title: String(ch?.title || `Bài ${idx + 1}`),
    startPage: Math.max(1, Math.min(Number(ch?.startPage) || 1, params.totalPages)),
    endPage: Math.max(
      1,
      Math.min(Number(ch?.endPage) || params.totalPages, params.totalPages)
    ),
  }));
}

const CUSTOM_EXAM_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    examTitle: { type: Type.STRING },
    quizQuestions: {
      type: Type.ARRAY,
      description: "8-10 câu hỏi trắc nghiệm mới đa dạng (từ vựng, ngữ pháp, tình huống đọc hiểu).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          question: { type: Type.STRING },
          category: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "question",
          "category",
          "options",
          "correctIndex",
          "explanation",
        ],
      },
    },
    clozeQuestions: {
      type: Type.ARRAY,
      description: "5-6 câu điền từ mới (dùng _____ cho chỗ trống).",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentenceWithBlank: { type: Type.STRING },
          answer: { type: Type.STRING },
          hint: { type: Type.STRING },
          fullSentenceTranslation: { type: Type.STRING },
          explanation: { type: Type.STRING },
        },
        required: [
          "id",
          "sentenceWithBlank",
          "answer",
          "hint",
          "fullSentenceTranslation",
          "explanation",
        ],
      },
    },
    translationChallenges: {
      type: Type.ARRAY,
      description: "3-4 câu thử thách dịch thuật sát với từ vựng và cấu trúc ngữ pháp vừa học.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          originalSentence: { type: Type.STRING },
          direction: { type: Type.STRING },
          contextHint: { type: Type.STRING },
          targetGrammarOrVocab: { type: Type.ARRAY, items: { type: Type.STRING } },
          referenceTranslation: { type: Type.STRING },
        },
        required: [
          "id",
          "originalSentence",
          "direction",
          "contextHint",
          "targetGrammarOrVocab",
          "referenceTranslation",
        ],
      },
    },
  },
  required: ["examTitle", "quizQuestions", "clozeQuestions", "translationChallenges"],
};

export async function generateCustomExamWithAI(params: {
  courseTitle: string;
  scopeTitle: string;
  scannedContentAndVocab: string;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}) {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Giám khảo Ra Đề Thi Ngôn Ngữ (AI Exam Generator).
Dựa trên dữ liệu văn bản đã quét (scanned data), từ vựng và ngữ pháp của "${params.scopeTitle}" trong khóa học "${params.courseTitle}", hãy sinh ra một ĐỀ THI KIỂM TRA CHƯƠNG MỚI TINH để người học làm bài kiểm tra.

QUY TẮC BẮT BUỘC:
1. quizQuestions (10 câu trắc nghiệm): CHỈ KIỂM TRA TỪ VỰNG (nghĩa, phiên âm, cách dùng từ, từ loại) VÀ NGỮ PHÁP (cấu trúc câu, sắp xếp từ, điền từ đúng ngữ pháp). TUYỆT ĐỐI KHÔNG hỏi tình tiết cốt truyện hay hội thoại (như nhân vật là ai, làm gì trong bài khóa).
2. clozeQuestions (6 câu điền từ): Tạo các câu ứng dụng mới (dùng _____ cho chỗ trống) yêu cầu điền đúng từ vựng hoặc điểm ngữ pháp của chương.
3. translationChallenges (4 câu dịch thuật): Các câu hoàn chỉnh vận dụng từ vựng và ngữ pháp của chương để người học dịch và được AI chấm điểm độ gần đúng.

DỮ LIỆU ĐÃ QUÉT & TỪ VỰNG:
"""
${params.scannedContentAndVocab.slice(0, 30000)}
"""`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: CUSTOM_EXAM_SCHEMA,
      temperature: 0.5,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("Không thể tạo đề thi mới.");
  }

  return JSON.parse(response.text);
}

const FULL_VOCAB_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    vocabulary: CHAPTER_LESSON_SCHEMA.properties!.vocabulary,
  },
  required: ["vocabulary"],
};

export async function extractAllChapterVocabWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  pageImagesBase64?: string[];
  existingWords?: string[];
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}) {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const normalizeVocabItems = (rawItems: unknown[]) => {
    const seen = new Set<string>();
    const result: Array<{
      id: string;
      word: string;
      ipa: string;
      partOfSpeech: string;
      cefrLevel: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
      vietnameseMeaning: string;
      explanationInContext: string;
      quoteFromBook: string;
      quoteTranslation: string;
      collocations: string[];
      synonyms: string[];
    }> = [];

    for (const v of rawItems) {
      const item = (v || {}) as Record<string, any>;
      const word = String(item.word || "").trim();
      const dedupeKey = normalizeDedupeVocabKey(word);
      if (!dedupeKey || seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      result.push({
        id: `voc-${result.length + 1}`,
        word,
        ipa: String(item.ipa || "").trim(),
        partOfSpeech: String(item.partOfSpeech || "word").trim(),
        cefrLevel: (["A1", "A2", "B1", "B2", "C1", "C2"].includes(
          String(item.cefrLevel)
        )
          ? item.cefrLevel
          : "A2") as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
        vietnameseMeaning: String(item.vietnameseMeaning || "").trim(),
        explanationInContext: String(item.explanationInContext || "").trim(),
        quoteFromBook: String(item.quoteFromBook || "").trim(),
        quoteTranslation: String(item.quoteTranslation || "").trim(),
        collocations: Array.isArray(item.collocations)
          ? item.collocations.map(String).filter(Boolean).slice(0, 3)
          : [],
        synonyms: Array.isArray(item.synonyms)
          ? item.synonyms.map(String).filter(Boolean).slice(0, 3)
          : [],
      });
    }
    return result;
  };

  const runVocabExtractionSlice = async (
    textSlice: string,
    imageSlice: string[],
    partLabel: string,
    excludeWords: string[] = []
  ) => {
    const excludeClause =
      excludeWords.length > 0
        ? `\n🚫 DANH SÁCH ${excludeWords.length} TỪ ĐÃ LẤY Ở LƯỢT TRƯỚC / ĐÃ CÓ TRONG BÀI (TUYỆT ĐỐI KHÔNG TẠO LẶP LẠI BẤT KỲ TỪ NÀO TRONG DANH SÁCH NÀY):\n[${excludeWords.join(", ")}]\n👉 Nhiệm vụ của bạn ở lượt này là RÀ SOÁT KỸ toàn bộ văn bản/trang sách bên dưới để LẤY HẾT 100% CÁC MỤC TỪ VỰNG MỚI CÒN SÓT LẠI (chưa nằm trong danh sách trên)!\n`
        : "";

    const prompt = `Bạn là Chuyên gia Từ điển & Ngôn ngữ học kiêm Giảng viên cao cấp.
Nhiệm vụ của bạn là quét toàn bộ văn bản và HÌNH ẢNH TRANG SÁCH (${partLabel}) của bài học "${params.chapterTitle}" thuộc sách "${params.courseTitle}".
BẮT BUỘC TRÍCH XUẤT ĐẦY ĐỦ 100% TẤT CẢ CÁC MỤC TỪ VỰNG XUẤT HIỆN TRONG PHẦN NÀY (MỖI CHƯƠNG THƯỜNG CÓ TỪ 35 ĐẾN 50+ MỤC TỪ).
🚫 CẢNH BÁO CHỐNG TRÙNG LẶP TỪ VỰNG (ANTI-DUPLICATION RULE):
- TUYỆT ĐỐI KHÔNG tạo từ vựng bị lặp lại trong danh sách trả về (không lặp lại cùng 1 từ, không lặp lại biến thể số ít/số nhiều hoặc kèm phiên âm trong ngoặc của cùng 1 từ). Mỗi mục từ (word) phải là DUY NHẤT 100%!
${excludeClause}
ĐẶC BIỆT LƯU Ý VỀ CẤU TRÚC GIÁO TRÌNH TIẾNG NGOẠI NGỮ (TIẾNG TRUNG ĐƯƠNG ĐẠI / HSK / TIẾNG ANH / NHẬT / HÀN):
Mỗi bài học thường có nhiều phần đối thoại (Dialogue I, Dialogue II, Bài đọc...) và mỗi phần đều có các bảng từ vựng độc lập được đánh số thứ tự (1, 2, 3...):
1. Bảng "People in the dialogue" (Tên các nhân vật)
2. Bảng "Vocabulary" của Dialogue I / Phần 1 (Tất cả các từ mới đánh số từ 1..25+)
3. Bảng "Names" (Địa danh, tên riêng)
4. Bảng "Phrases" / "Idioms" (Cụm từ, mẫu câu giao tiếp)
5. Bảng "Vocabulary" của Dialogue II / Bài đọc Phần 2 (Đánh số lại từ 1..25+)
6. Bảng "Names" & "Phrases" của Dialogue II / Bài đọc.
7. Nếu văn bản không chia bảng sẵn, hãy trích xuất TOÀN BỘ các từ vựng mới, từ khóa quan trọng xuất hiện trong hội thoại và bài đọc.

BẠN PHẢI LẤY ĐỦ TẤT CẢ CÁC MỤC TỪ TRONG PHẦN NÀY — KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ MỤC ĐÁNH SỐ NÀO!
(Lưu ý: Viết thật ngắn gọn, súc tích ở trường explanationInContext và quoteFromBook — mỗi trường chỉ 1 câu ngắn 6-10 chữ — để JSON nhẹ và chứa được nhiều từ vựng nhất trong 1 lần trả về!).

Với mỗi từ, cung cấp:
- word: Từ gốc theo sách (Chữ Hán phồn/giản thể, hoặc từ Tiếng Anh/Nhật/Hàn)
- ipa: Phiên âm Pinyin có dấu (nếu tiếng Trung) hoặc IPA (nếu tiếng Anh)
- partOfSpeech: Từ loại chuẩn theo sách (N, V, Vs, Vst, Adv, Ptc, Det, Vaux, M, Pron, Phrase, Name...)
- cefrLevel: Cấp độ tương đương (A1, A2, B1, B2, C1, hoặc C2)
- vietnameseMeaning: Nghĩa tiếng Việt đầy đủ, chính xác
- explanationInContext: Giải thích cực ngắn gọn (1 cụm ngắn)
- quoteFromBook: 1 câu ví dụ ngắn có chứa từ đó
- quoteTranslation: Dịch nghĩa câu ví dụ sang tiếng Việt
- collocations: 1 cụm từ kết hợp phổ biến
- synonyms: 1 từ đồng nghĩa hoặc liên quan

NỘI DUNG CHƯƠNG SÁCH (${partLabel}):
"""
${textSlice}
"""`;

    const contentsPayload: Array<
      string | { inlineData: { mimeType: string; data: string } }
    > = [prompt];

    for (const base64Img of imageSlice.slice(0, 5)) {
      contentsPayload.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Img,
        },
      });
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contentsPayload,
      config: {
        responseMimeType: "application/json",
        responseSchema: FULL_VOCAB_SCHEMA,
        temperature: 0.2,
        maxOutputTokens: 32768,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    if (!response.text) return [];
    const parsed = JSON.parse(response.text);
    return Array.isArray(parsed?.vocabulary) ? parsed.vocabulary : [];
  };

  const cleanText = (params.chapterText || "").trim();
  const images = Array.isArray(params.pageImagesBase64)
    ? params.pageImagesBase64
    : [];

  // LÝ DO TRƯỚC ĐÂY CHỈ RA 13 HOẶC 16 TỪ:
  // Mỗi đối tượng từ vựng có 10 trường (~160 output tokens/từ). Trong 1 lần gọi đơn lẻ (single call),
  // LLM trên Groq/OpenRouter chỉ sinh được tối đa ~14-16 từ (~2,500 output tokens) là tự dừng để tránh đứt gãy JSON!
  // GIẢI PHÁP TRIỆT ĐỂ ĐỂ LẤY ĐỦ 40-50+ TỪ:
  // Bước 1: Luôn chia chương sách thành 3 phân đoạn (Đầu chương / Giữa chương / Cuối chương, mỗi đoạn <= 6,500 ký tự)
  //         chạy song song để mỗi phân đoạn lấy 15-18 từ -> Tổng 3 phân đoạn đạt ngay 35-45+ từ!
  // Bước 2: Chạy thêm 1 lượt "Vét cạn từ còn sót (Completeness Sweep)" kèm danh sách từ đã lấy (excludeWords)
  //         để lấy nốt mọi từ đánh số còn sót lại cho đủ 100% (ví dụ đủ 43/43 từ trong bài)!
  const numSegments = cleanText.length > 1200 ? 3 : 1;
  const textChunks: string[] = [];

  if (numSegments === 1) {
    textChunks.push(cleanText.slice(0, 7500));
  } else {
    const targetChunkLen = Math.min(
      6800,
      Math.max(1200, Math.ceil(cleanText.length / numSegments))
    );
    let cursor = 0;
    while (cursor < cleanText.length && textChunks.length < 4) {
      let endIdx = Math.min(cursor + targetChunkLen, cleanText.length);
      if (endIdx < cleanText.length) {
        const nextNewline = cleanText.indexOf("\n", endIdx);
        const prevNewline = cleanText.lastIndexOf("\n", endIdx);
        if (prevNewline > cursor + 600) {
          endIdx = prevNewline;
        } else if (nextNewline !== -1 && nextNewline - endIdx < 400) {
          endIdx = nextNewline;
        }
      }
      const slice = cleanText.slice(cursor, endIdx).trim();
      if (slice.length > 0) {
        textChunks.push(slice);
      }
      cursor = endIdx;
    }
  }

  const initialSeedWords = Array.isArray(params.existingWords)
    ? params.existingWords.map((w) => String(w || "").trim()).filter(Boolean)
    : [];

  const chunkPromises = textChunks.map((chunkStr, idx) => {
    const imgPerChunk = Math.ceil(images.length / textChunks.length);
    const chunkImgs = images.slice(
      idx * imgPerChunk,
      (idx + 1) * imgPerChunk
    );
    return runVocabExtractionSlice(
      chunkStr,
      chunkImgs,
      `Phân đoạn ${idx + 1}/${textChunks.length} của chương`,
      initialSeedWords.slice(0, 120)
    ).catch(() => []);
  });

  const stage1Nested = await Promise.all(chunkPromises);
  let accumulated = normalizeVocabItems(stage1Nested.flat());

  // Bước 2 (Completeness Sweep): Nếu tổng số từ sau Bước 1 vẫn < 42 từ,
  // gửi danh sách từ đã lấy (excludeWords) để AI rà soát và nhặt nốt TẤT CẢ các từ còn sót trong chương!
  if (accumulated.length < 42 && cleanText.length > 400) {
    try {
      const alreadyWords = Array.from(
        new Set([...initialSeedWords, ...accumulated.map((v) => v.word)])
      );
      const sweepText =
        cleanText.length <= 7500
          ? cleanText
          : `${cleanText.slice(0, 3800)}\n...\n${cleanText.slice(-3700)}`;
      const sweepRaw = await runVocabExtractionSlice(
        sweepText,
        images.slice(0, 4),
        "Lượt rà soát vét cạn 100% các từ vựng còn sót trong chương",
        alreadyWords
      );
      if (Array.isArray(sweepRaw) && sweepRaw.length > 0) {
        accumulated = normalizeVocabItems([...accumulated, ...sweepRaw]);
      }
    } catch {
      // Ignore sweep error if stage 1 already succeeded
    }
  }

  return accumulated;
}

export async function evaluatePronunciationWithAI(params: {
  expectedText: string;
  spokenText: string;
  audioBase64?: string;
  audioMimeType?: string;
  language?: string;
  pinyinOrIpa?: string;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<PronunciationEvaluation> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Chuyên gia Ngữ âm và Gia sư Luyện Phát âm AI (AI Pronunciation & Phonetics Coach).
Nhiệm vụ của bạn là đánh giá và chấm điểm phần trăm độ chính xác phát âm của người học khi đọc một từ vựng hoặc đoạn văn trích từ sách.
${
  params.audioBase64
    ? "ĐÍNH KÈM FILE ÂM THANH GIỌNG ĐỌC THỰC TẾ CỦA NGƯỜI HỌC: Hãy lắng nghe trực tiếp sóng âm giọng nói (ngữ điệu, thanh điệu, trọng âm, âm cuối, độ trôi chảy) kết hợp với bản nhận diện Speech-to-Text bên dưới để chấm điểm chính xác nhất."
    : ""
}

VĂN BẢN MẪU CẦN ĐỌC (EXPECTED TEXT):
"${params.expectedText}"
${params.pinyinOrIpa ? `Phiên âm mẫu (IPA/Pinyin): "${params.pinyinOrIpa}"` : ""}
Ngôn ngữ: ${params.language || "Tự động nhận diện (Tiếng Trung/Tiếng Anh/v.v.)"}

VĂN BẢN THU ĐƯỢC TỪ MICRO CỦA NGƯỜI HỌC (SPOKEN TRANSCRIPT):
"${params.spokenText || "(Phân tích trực tiếp từ file âm thanh đính kèm)"}"

YÊU CẦU ĐÁNH GIÁ CHUYÊN SÂU & TẬP TRUNG VÀO 3 YẾU TỐ:
1. ĐÚNG BAO NHIÊU % (overallScore từ 0 - 100%):
   - Đánh giá độ trùng khớp ngữ âm, thanh điệu, trọng âm, và phụ âm cuối.
   - Nếu đọc hoàn hảo từng âm: 95-100%. Nếu đọc đúng hầu hết chỉ vấp 1 âm nhỏ: 80-90%. Nếu sai nhiều từ hoặc sai thanh điệu cốt lõi: 40-70%. Nếu không nói hoặc nói lung tung không liên quan: < 30%.
2. SAI CHỖ NÀO (mispronouncedWords):
   - Chỉ rõ từ nào bị đọc sai, lỗi là gì (ví dụ trong tiếng Trung: sai thanh điệu tone 1 vs tone 4, nhầm âm z/c/s, zh/ch/sh; trong tiếng Anh: nuốt ending sounds /t/, /d/, /s/, /z/, đọc sai trọng âm stress).
3. CẦN CẢI THIỆN GÌ (tip & generalFeedback):
   - Hướng dẫn cụ thể cách đặt khẩu hình miệng, đặt đầu lưỡi, bật hơi, hoặc giữ trường độ âm thanh để người học đọc lại lần sau sẽ đúng ngay.
   - Nhận xét và góp ý bằng tiếng Việt truyền cảm hứng, dễ hiểu.`;

  const contents = params.audioBase64
    ? [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                data: params.audioBase64,
                mimeType: params.audioMimeType || "audio/webm",
              },
            },
            { text: prompt },
          ],
        },
      ]
    : prompt;

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: PRONUNCIATION_EVAL_SCHEMA,
      temperature: 0.2,
    },
  });

  if (!response.text) {
    throw new Error("Không nhận được phản hồi đánh giá phát âm từ AI.");
  }

  const parsed = JSON.parse(response.text);
  return {
    ...parsed,
    expectedText: params.expectedText,
    spokenText: params.spokenText,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Lightweight, fast OCR transcription for a micro-batch of 1-3 page images.
 * Uses plain text output (no complex JSON schema) so Gemini Vision never times out or crashes.
 */
export async function ocrPageImagesWithAI(params: {
  pageImagesBase64: string[];
  startPageNum?: number;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<string> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";
  const startNum = params.startPageNum || 1;

  const prompt = `Bạn là Công cụ OCR Chuyên Nghiệp (Optical Character Recognition) cho sách giáo trình đa ngôn ngữ (Tiếng Anh, Tiếng Trung Phồn/Giản thể + Pinyin, Tiếng Nhật, Tiếng Hàn, Tiếng Việt).
Hãy đọc và trích xuất CHÍNH XÁC 100% TOÀN BỘ VĂN BẢN có trong ${params.pageImagesBase64.length} hình ảnh trang sách đính kèm (bắt đầu từ trang ${startNum}).
YÊU CẦU:
- Giữ nguyên mọi đoạn hội thoại (Dialogue), bài đọc, bảng từ vựng (Vocabulary, People, Names, Phrases), phiên âm IPA/Pinyin, nghĩa tiếng Anh/tiếng Việt, và ghi chú ngữ pháp (Grammar).
- Phân tách mỗi trang bằng dòng: --- [OCR Trang X] ---
- Trả về văn bản thuần (Plain Text) sạch đẹp, rõ ràng, tuyệt đối không bình luận thừa.`;

  const contentsPayload: Array<
    string | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  for (const base64Img of params.pageImagesBase64.slice(0, 4)) {
    contentsPayload.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64Img,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: contentsPayload,
    config: {
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  return (response.text || "").trim();
}

const TOPIC_VOCAB_ANALYZE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    topicTitle: {
      type: Type.STRING,
      description: "Tên chủ đề từ vựng bằng Tiếng Anh kèm Tiếng Việt",
    },
    topicSummary: {
      type: Type.STRING,
      description: "Mô tả ngắn gọn về bộ từ vựng chủ đề này",
    },
    vocabulary: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          word: { type: Type.STRING, description: "Từ vựng hoặc cụm từ" },
          ipa: { type: Type.STRING, description: "Phiên âm quốc tế IPA chuẩn (/.../)" },
          partOfSpeech: { type: Type.STRING, description: "Từ loại (Danh từ, Động từ, Tính từ, Cụm danh từ...)" },
          cefrLevel: { type: Type.STRING, description: "A1, A2, B1, B2, C1 hoặc C2" },
          vietnameseMeaning: { type: Type.STRING, description: "Nghĩa tiếng Việt chính xác, rõ ràng" },
          explanationInContext: { type: Type.STRING, description: "Giải thích sâu sắc thái nghĩa và ngữ cảnh sử dụng" },
          quoteFromBook: { type: Type.STRING, description: "Câu ví dụ mẫu tự nhiên bằng tiếng Anh có chứa từ vựng" },
          quoteTranslation: { type: Type.STRING, description: "Dịch nghĩa tiếng Việt của câu ví dụ" },
          collocations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-3 cụm từ đi kèm (collocations / usage patterns)",
          },
          synonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "2-4 từ đồng nghĩa (Synonyms)",
          },
          antonyms: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-3 từ trái nghĩa (Antonyms)",
          },
        },
        required: [
          "id",
          "word",
          "ipa",
          "partOfSpeech",
          "cefrLevel",
          "vietnameseMeaning",
          "explanationInContext",
          "quoteFromBook",
          "quoteTranslation",
          "collocations",
          "synonyms",
          "antonyms",
        ],
      },
    },
  },
  required: ["topicTitle", "topicSummary", "vocabulary"],
};

const TOPIC_VOCAB_PRACTICE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    sentenceFillExercises: {
      type: Type.ARRAY,
      description: "8-12 câu bài tập điền từ vào câu đúng ngữ cảnh (dùng _____ cho chỗ trống)",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          sentenceWithBlank: { type: Type.STRING, description: "Câu tiếng Anh có _____ ở vị trí từ cần điền" },
          answer: { type: Type.STRING, description: "Từ/cụm từ đáp án chính xác" },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "4 phương án lựa chọn (bao gồm đáp án đúng và 3 từ nhiễu cùng chủ đề)",
          },
          fullSentenceWithAnswer: { type: Type.STRING, description: "Câu tiếng Anh hoàn chỉnh đã điền đáp án để đọc phát âm TTS" },
          vietnameseTranslation: { type: Type.STRING, description: "Dịch nghĩa tiếng Việt của câu hoàn chỉnh" },
          explanation: { type: Type.STRING, description: "Giải thích vì sao chọn từ này theo ngữ cảnh & ngữ pháp" },
        },
        required: [
          "id",
          "sentenceWithBlank",
          "answer",
          "options",
          "fullSentenceWithAnswer",
          "vietnameseTranslation",
          "explanation",
        ],
      },
    },
    listeningExercises: {
      type: Type.ARRAY,
      description: "6-8 câu bài tập nghe phát âm chuẩn và nhận diện/điền từ",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          word: { type: Type.STRING },
          ipa: { type: Type.STRING },
          spokenSentence: { type: Type.STRING, description: "Câu hoàn chỉnh để hệ thống đọc bằng giọng chuẩn bản xứ" },
          sentenceWithBlank: { type: Type.STRING, description: "Câu có chứa _____ ở vị trí từ vựng cần nghe" },
          vietnameseTranslation: { type: Type.STRING },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "4 từ vựng lựa chọn",
          },
        },
        required: [
          "id",
          "word",
          "ipa",
          "spokenSentence",
          "sentenceWithBlank",
          "vietnameseTranslation",
          "options",
        ],
      },
    },
  },
  required: ["sentenceFillExercises", "listeningExercises"],
};

export async function analyzeTopicVocabWithAI(params: {
  topicTitle: string;
  targetLanguage?: string;
  rawInputText: string;
  existingItems?: Partial<VocabularyItem>[];
  targetCount?: number;
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<{
  topicTitle: string;
  topicSummary: string;
  vocabulary: VocabularyItem[];
}> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";
  const count = Math.min(Math.max(params.targetCount || 20, 5), 40);
  const lang = params.targetLanguage || "English";

  const langSpec =
    lang === "Chinese"
      ? `NGÔN NGỮ MỤC TIÊU: TIẾNG TRUNG (Chinese - 汉字).
- word: Từ vựng chữ Hán (ví dụ: 人工智能 hoặc 发展).
- ipa: Phiên âm Pinyin chuẩn có dấu thanh điệu (ví dụ: /rén gōng zhì néng/).
- synonyms / antonyms: Các từ đồng nghĩa (近义词) và trái nghĩa (反义词) bằng chữ Hán kèm Pinyin ngắn gọn.
- quoteFromBook: Câu ví dụ bằng chữ Hán tự nhiên.`
      : lang === "Japanese"
      ? `NGÔN NGỮ MỤC TIÊU: TIẾNG NHẬT (Japanese - 日本語).
- word: Từ vựng tiếng Nhật (Kanji/Kana).
- ipa: Cách đọc Furigana (Hiragana) kèm Romaji.
- synonyms / antonyms: Từ đồng nghĩa (類義語) và trái nghĩa (対義語) bằng tiếng Nhật.
- quoteFromBook: Câu ví dụ tiếng Nhật tự nhiên.`
      : lang === "Korean"
      ? `NGÔN NGỮ MỤC TIÊU: TIẾNG HÀN (Korean - 한국어).
- word: Từ vựng Hangul.
- ipa: Phiên âm cách đọc chuẩn.
- synonyms / antonyms: Từ đồng nghĩa (유의어) và trái nghĩa (반의어) bằng tiếng Hàn.
- quoteFromBook: Câu ví dụ tiếng Hàn tự nhiên.`
      : `NGÔN NGỮ MỤC TIÊU: TIẾNG ANH (English).
- word: Từ vựng hoặc cụm từ tiếng Anh.
- ipa: Phiên âm quốc tế IPA chuẩn (/.../).
- synonyms / antonyms: Từ đồng nghĩa (Synonyms) và trái nghĩa (Antonyms) tiếng Anh.
- quoteFromBook: Câu ví dụ tiếng Anh tự nhiên.`;

  const existingSummary =
    params.existingItems && params.existingItems.length > 0
      ? `\nDANH SÁCH TỪ VỰNG TRÍCH TỪ FILE (Hãy bổ sung đầy đủ Phiên âm IPA/Pinyin, Từ loại, Nghĩa tiếng Việt, Giải thích ngữ cảnh, Câu ví dụ song ngữ, Collocations, Từ đồng nghĩa và Từ trái nghĩa cho các từ này theo đúng ngôn ngữ ${lang}):\n${params.existingItems
          .slice(0, count)
          .map(
            (it, i) =>
              `${i + 1}. ${it.word} ${it.ipa ? `(${it.ipa})` : ""} ${
                it.partOfSpeech ? `[${it.partOfSpeech}]` : ""
              } - ${it.vietnameseMeaning || ""} | Ví dụ: ${it.quoteFromBook || ""}`
          )
          .join("\n")}\n`
      : "";

  const prompt = `Bạn là Chuyên gia Từ vựng học Đa Ngôn Ngữ & Biên soạn Giáo trình Quốc tế (CEFR / IELTS / HSK / TOCFL / JLPT / TOPIK).
Nhiệm vụ của bạn là đọc dữ liệu từ file / chủ đề "${params.topicTitle}" và biên soạn bộ từ vựng chuyên sâu theo chủ đề bằng ngôn ngữ mục tiêu (${lang}) gồm khoảng ${count} mục từ quan trọng nhất.

${langSpec}

YÊU CẦU BẮT BUỘC CHO MỖI TỪ VỰNG:
1. word: Từ vựng hoặc cụm từ chuẩn xác theo chủ đề bằng ngôn ngữ ${lang}.
2. ipa: Phiên âm chuẩn quốc tế (IPA cho tiếng Anh, Pinyin cho tiếng Trung, Furigana/Romaji cho tiếng Nhật/Hàn).
3. partOfSpeech: Từ loại rõ ràng bằng tiếng Việt (Danh từ, Động từ, Tính từ, Trạng từ, Cụm danh từ, Cụm động từ...).
4. cefrLevel: Phân loại bậc tương đương CEFR chính xác ("A1", "A2", "B1", "B2", "C1", hoặc "C2").
5. vietnameseMeaning: Nghĩa tiếng Việt chuẩn xác, tự nhiên.
6. explanationInContext: Giải thích sắc thái nghĩa, cách dùng trong câu và ngữ cảnh áp dụng.
7. quoteFromBook: 1 câu ví dụ tự nhiên bằng ngôn ngữ ${lang}.
8. quoteTranslation: Bản dịch tiếng Việt mượt mà cho câu ví dụ trên.
9. collocations: 2-3 cụm từ kết hợp (collocations) hoặc cấu trúc ngữ pháp đi kèm bằng ngôn ngữ ${lang}.
10. synonyms: 2-4 từ đồng nghĩa sát nghĩa nhất trong ngôn ngữ ${lang}.
11. antonyms: 1-3 từ trái nghĩa rõ ràng nhất trong ngôn ngữ ${lang}.

🚫 CẢNH BÁO CHỐNG TRÙNG LẶP TỪ VỰNG (ANTI-DUPLICATION RULE):
- Mỗi mục từ (word) trong danh sách trả về phải là DUY NHẤT 100%, TUYỆT ĐỐI KHÔNG tạo bất kỳ từ vựng nào bị lặp lại 2 lần hoặc trùng biến thể!
${existingSummary}
DỮ LIỆU NGUỒN / NỘI DUNG FILE CHỦ ĐỀ:
"""
${(params.rawInputText || params.topicTitle).slice(0, 22000)}
"""`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: TOPIC_VOCAB_ANALYZE_SCHEMA,
      temperature: 0.3,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("Không nhận được dữ liệu từ vựng chủ đề từ AI.");
  }

  const parsed = JSON.parse(response.text);
  const rawList: any[] = Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [];
  const seenTopicWords = new Set<string>();
  const normalized: VocabularyItem[] = [];
  for (const item of rawList) {
    const word = String(item?.word || "").trim();
    const dedupeKey = normalizeDedupeVocabKey(word);
    if (!dedupeKey || seenTopicWords.has(dedupeKey)) continue;
    seenTopicWords.add(dedupeKey);
    normalized.push({
      id: `tvoc-${Date.now()}-${normalized.length + 1}`,
      word,
      ipa: String(item.ipa || "").trim(),
      partOfSpeech: String(item.partOfSpeech || "Từ vựng").trim(),
      cefrLevel: (["A1", "A2", "B1", "B2", "C1", "C2"].includes(
        String(item.cefrLevel)
      )
        ? item.cefrLevel
        : "B2") as "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      vietnameseMeaning: String(item.vietnameseMeaning || "").trim(),
      explanationInContext: String(item.explanationInContext || "").trim(),
      quoteFromBook: String(item.quoteFromBook || "").trim(),
      quoteTranslation: String(item.quoteTranslation || "").trim(),
      collocations: Array.isArray(item.collocations)
        ? item.collocations.map(String).filter(Boolean)
        : [],
      synonyms: Array.isArray(item.synonyms)
        ? item.synonyms.map(String).filter(Boolean)
        : [],
      antonyms: Array.isArray(item.antonyms)
        ? item.antonyms.map(String).filter(Boolean)
        : [],
      topicTag: params.topicTitle,
    });
  }

  return {
    topicTitle: String(parsed.topicTitle || params.topicTitle).trim(),
    topicSummary: String(
      parsed.topicSummary || `Bộ từ vựng chuyên sâu chủ đề ${params.topicTitle}`
    ).trim(),
    vocabulary: normalized,
  };
}

export async function generateTopicVocabPracticeWithAI(params: {
  topicTitle: string;
  targetLanguage?: string;
  vocabulary: VocabularyItem[];
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<TopicVocabGeneratedPractice> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";
  const lang = params.targetLanguage || "English";

  const sampleVocab = params.vocabulary.slice(0, 30);
  const vocabSummary = sampleVocab
    .map(
      (v, i) =>
        `${i + 1}. ${v.word} (${v.ipa}) [${v.partOfSpeech}]: ${v.vietnameseMeaning} | Đồng nghĩa: ${(v.synonyms || []).join(", ")} | Trái nghĩa: ${(v.antonyms || []).join(", ")} | Ví dụ: ${v.quoteFromBook}`
    )
    .join("\n");

  const prompt = `Bạn là Chuyên gia Khảo thí Đa Ngôn ngữ AI (Ngôn ngữ mục tiêu: ${lang}).
Dựa trên danh sách từ vựng thuộc chủ đề "${params.topicTitle}" dưới đây, hãy biên soạn bộ câu hỏi ôn tập tương tác đa kỹ năng bằng ngôn ngữ ${lang}:
1. sentenceFillExercises (10 câu): Bài tập Điền từ vào câu đúng nghĩa & đúng ngữ cảnh.
   - Mỗi câu là một câu bằng ngôn ngữ ${lang} tự nhiên, học thuật, dùng "_____" ở đúng vị trí từ vựng cần điền.
   - Cung cấp 4 phương án (options) cùng chủ đề bằng ngôn ngữ ${lang} để người học chọn hoặc tự gõ từ.
   - fullSentenceWithAnswer là câu bằng ngôn ngữ ${lang} hoàn chỉnh sau khi điền đáp án để đọc phát âm giọng bản xứ.
   - vietnameseTranslation: Dịch nghĩa câu hoàn chỉnh sang tiếng Việt.
   - explanation: Giải thích ngắn gọn vì sao từ đó phù hợp ngữ cảnh và cấu trúc.
2. listeningExercises (8 câu): Bài tập Nghe giọng chuẩn và chọn/điền đúng từ vựng trong câu.
   - spokenSentence: Câu bằng ngôn ngữ ${lang} hoàn chỉnh chứa từ vựng để hệ thống phát âm thanh TTS chuẩn.
   - sentenceWithBlank: Câu đó nhưng thay từ vựng mục tiêu bằng "_____".
   - options: 4 từ vựng bằng ngôn ngữ ${lang} có cách phát âm hoặc ngữ cảnh gần nhau.

DANH SÁCH TỪ VỰNG CHỦ ĐỀ (${lang}):
"""
${vocabSummary}
"""`;

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: TOPIC_VOCAB_PRACTICE_SCHEMA,
      temperature: 0.4,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("Không thể tạo bộ câu hỏi ôn tập từ vựng chủ đề.");
  }

  const parsed = JSON.parse(response.text);

  const matchingPairs = sampleVocab.slice(0, 16).map((v, idx) => ({
    id: `match-${idx + 1}`,
    word: v.word,
    ipa: v.ipa,
    vietnameseMeaning: v.vietnameseMeaning,
    synonymOrAntonymHint:
      v.synonyms && v.synonyms.length > 0
        ? `≈ ${v.synonyms.slice(0, 2).join(", ")}`
        : undefined,
  }));

  const wordFillExercises = sampleVocab.slice(0, 15).map((v, idx) => ({
    id: `wfill-${idx + 1}`,
    vietnamesePrompt: v.vietnameseMeaning,
    ipaHint: v.ipa,
    partOfSpeech: v.partOfSpeech,
    synonymHint: (v.synonyms || []).slice(0, 2).join(", "),
    antonymHint: (v.antonyms || []).slice(0, 2).join(", "),
    answer: v.word,
    exampleSentence: v.quoteFromBook,
  }));

  return {
    matchingPairs,
    sentenceFillExercises: Array.isArray(parsed.sentenceFillExercises)
      ? parsed.sentenceFillExercises
      : [],
    listeningExercises: Array.isArray(parsed.listeningExercises)
      ? parsed.listeningExercises
      : [],
    wordFillExercises,
  };
}

