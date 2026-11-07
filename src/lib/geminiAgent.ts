import { GoogleGenAI, Type, Schema } from "@google/genai";
import {
  ChapterLesson,
  TranslationEvaluation,
  PronunciationEvaluation,
} from "@/types/course";
import { verifyVirtualApiKey } from "@/lib/quotaManager";

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

  const geminiKeys: string[] = [];
  const groqKeys: string[] = [];
  const openRouterKeys: string[] = [];
  const siliconFlowKeys: string[] = [];

  for (const src of rawSources) {
    if (!src) continue;
    const parts = src
      .split(/[,;\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10 && !s.toUpperCase().startsWith("BM-"));

    for (const p of parts) {
      if (p.startsWith("AIza")) {
        if (!geminiKeys.includes(p)) geminiKeys.push(p);
      } else if (p.startsWith("gsk_")) {
        if (!groqKeys.includes(p)) groqKeys.push(p);
      } else if (p.startsWith("sk-or-")) {
        if (!openRouterKeys.includes(p)) openRouterKeys.push(p);
      } else if (p.startsWith("sk-")) {
        if (!siliconFlowKeys.includes(p)) siliconFlowKeys.push(p);
      }
    }
  }

  return { geminiKeys, groqKeys, openRouterKeys, siliconFlowKeys };
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
}): Promise<string> {
  const expectJson = Boolean(params.responseSchema);
  const isGroq = params.endpointUrl.includes("groq.com");
  // Groq Free Tier enforces (prompt_tokens + max_tokens <= 8,000).
  // Keeping prompt <= 7,500 chars (~2,000 tokens) + max_tokens = 3,800 (~5,800 total) guarantees Groq NEVER rejects with 413/429 TPM!
  let fullUserPrompt = isGroq
    ? params.promptText.slice(0, 7500)
    : params.promptText.slice(0, 16000);

  if (expectJson && params.responseSchema) {
    const blueprint = JSON.stringify(
      schemaToJsonBlueprint(params.responseSchema)
    );
    fullUserPrompt += `\n\n⚠️ YÊU CẦU ĐỊNH DẠNG JSON BẮT BUỘC:
Trả về DUY NHẤT 1 đối tượng JSON hợp lệ (không dùng <think>, không markdown). BẮT BUỘC có đủ tất cả các trường và mảng (overview, contentAnalysis, grammarPoints, vocabulary, clozeExercises, quizExercises, translationExercises) theo mẫu:
${blueprint}`;
  }

  const supportsVision =
    params.model.toLowerCase().includes("vl") ||
    params.model.toLowerCase().includes("vision") ||
    params.model === "openrouter/free";

  const userContent =
    params.imagesBase64.length > 0 && supportsVision
      ? [
          { type: "text", text: fullUserPrompt },
          ...params.imagesBase64.slice(0, 10).map((b64) => ({
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
          ? "You are a multilingual educational AI assistant. Respond ONLY with a valid, compact JSON object matching the requested schema. Keep explanations concise (1-2 sentences) so all arrays (including clozeExercises, quizExercises, translationExercises) are completely generated."
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
  // Omitting max_tokens on Groq allows openai/gpt-oss-120b and gpt-oss-20b to stream 2,800+ tokens in 6 seconds without 429 OTPM errors.
  if (!isGroq) {
    bodyPayload.max_tokens = 4500;
  }

  if (isGroq && params.model.toLowerCase().includes("qwen")) {
    bodyPayload.reasoning_effort = "none";
  }

  if (expectJson && isGroq && !supportsVision) {
    bodyPayload.response_format = { type: "json_object" };
  }

  // Per-provider attempt timeout (18s) so a slow upstream never hangs the whole chain
  const attemptController = new AbortController();
  const attemptTimer = setTimeout(() => attemptController.abort(), 18_000);

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
    const requestedModel = (params.model || "gemini-2.5-flash").trim();
    const { promptText, imagesBase64 } = extractPromptAndImagesFromContents(
      params.contents
    );
    const hasImages = imagesBase64.length > 0;
    const responseSchema = params.config?.responseSchema as Schema | undefined;
    const temperature = params.config?.temperature;

    type ProviderAttempt = () => Promise<string>;
    const attempts: ProviderAttempt[] = [];

    const addGroqAttempts = () => {
      for (const gKey of pool.groqKeys) {
        // Put openai/gpt-oss-120b and openai/gpt-oss-20b first as they support 3,000+ output tokens in 6s on Groq Free Tier
        const groqModels = [
          "openai/gpt-oss-120b",
          "openai/gpt-oss-20b",
          "qwen/qwen3.8-27b",
        ];
        for (const m of groqModels) {
          attempts.push(() =>
            callOpenAiCompatibleEndpoint({
              endpointUrl: "https://api.groq.com/openai/v1/chat/completions",
              apiKey: gKey,
              model: m,
              promptText,
              imagesBase64,
              responseSchema,
              temperature,
            })
          );
        }
      }
    };

    const addOpenRouterAttempts = () => {
      for (const orKey of pool.openRouterKeys) {
        const orModels = hasImages
          ? ["nvidia/nemotron-3.5-super-vl:free", "openrouter/free"]
          : ["openrouter/free", "nvidia/nemotron-3.5-super-vl:free"];
        for (const m of orModels) {
          attempts.push(() =>
            callOpenAiCompatibleEndpoint({
              endpointUrl: "https://openrouter.ai/api/v1/chat/completions",
              apiKey: orKey,
              model: m,
              promptText,
              imagesBase64,
              responseSchema,
              temperature,
            })
          );
        }
      }
    };

    const addSiliconFlowAttempts = () => {
      for (const sfKey of pool.siliconFlowKeys) {
        const sfModels = hasImages
          ? ["Qwen/Qwen3-VL-8B-Instruct", "Qwen/Qwen3.8-27B"]
          : ["Qwen/Qwen3.8-27B", "Qwen/Qwen2.5-7B-Instruct"];
        for (const m of sfModels) {
          attempts.push(() =>
            callOpenAiCompatibleEndpoint({
              endpointUrl: "https://api.siliconflow.com/v1/chat/completions",
              apiKey: sfKey,
              model: m,
              promptText,
              imagesBase64,
              responseSchema,
              temperature,
            })
          );
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
          apiKey === pool.geminiKeys[0]
            ? primaryClient
            : new GoogleGenAI({ apiKey });
        const genFn =
          apiKey === pool.geminiKeys[0]
            ? originalGenerateContent
            : clientForKey.models.generateContent.bind(clientForKey.models);

        for (const candidateModel of modelChain) {
          attempts.push(async () => {
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
            const res = await genFn({
              ...params,
              model: candidateModel,
              config: clonedConfig,
            });
            if (!res.text) {
              throw new Error("Empty response from Gemini");
            }
            return res.text;
          });
        }
      }
    };

    // Order attempts based on whether the request requires Vision (hasImages) and the user's selected provider
    // IMPORTANT: Groq models (gpt-oss-120b, gpt-oss-20b, qwen3.8-27b) are TEXT-ONLY.
    // Whenever hasImages === true (e.g. TOC Vision scan, PDF page OCR, image lesson scan), we MUST prioritize Vision-capable providers (OpenRouter Nemotron-VL & Gemini Vision) first!
    if (hasImages) {
      if (
        !requestedModel.startsWith("qwen-") &&
        pool.geminiKeys.length > 0
      ) {
        addGeminiAttempts(requestedModel);
        addOpenRouterAttempts();
        addSiliconFlowAttempts();
      } else {
        addOpenRouterAttempts();
        addGeminiAttempts(requestedModel);
        addSiliconFlowAttempts();
      }
      // Only fall back to text-only Groq if promptText itself has substantial text (> 800 chars)
      if (promptText.trim().length > 800) {
        addGroqAttempts();
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

    let lastError: unknown = null;
    for (const attemptFn of attempts) {
      try {
        const resultText = await attemptFn();
        return {
          text: resultText,
        } as Awaited<ReturnType<typeof originalGenerateContent>>;
      } catch (err: unknown) {
        lastError = err;
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

export async function generateChapterLessonWithAI(params: {
  courseTitle: string;
  chapterTitle: string;
  chapterText: string;
  pageImagesBase64?: string[];
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}): Promise<ChapterLesson> {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  // Limit text per single chapter call to ~26,000 chars for fast response without timeout
  const trimmedText = params.chapterText.slice(0, 26000);

  const hasVisionImages =
    Array.isArray(params.pageImagesBase64) &&
    params.pageImagesBase64.length > 0;

  const prompt = `Bạn là một Giáo sư Ngôn ngữ học & Gia sư Đọc hiểu Sách chuyên sâu (Multilingual Book Tutor Agent - hỗ trợ sách Tiếng Anh, Tiếng Trung 繁體/簡體 Pinyin, Tiếng Nhật, Tiếng Hàn...).
Hãy phân tích toàn diện chương sách dưới đây thuộc cuốn sách "${params.courseTitle}" và tạo ra bài học cực kỳ chi tiết bằng tiếng Việt để người học vừa nắm trọn vẹn nội dung cuốn sách, vừa giỏi từ vựng, ngữ pháp và kỹ năng dịch thuật.
${
  hasVisionImages
    ? `\n⚠️ CHÚ Ý ĐẶC BIỆT (CHẾ ĐỘ HYBRID PDF - VỪA CÓ CHỮ VỪA CÓ ẢNH):
File PDF này có phần NỘI DUNG CHÍNH nằm trong ${params.pageImagesBase64!.length} HÌNH ẢNH TRANG SÁCH đính kèm (trong khi phần văn bản thô bên dưới có thể chỉ là tiêu đề đầu trang, số trang hoặc một phần chữ).
Bạn BẮT BUỘC phải nhìn và đọc kỹ TOÀN BỘ chữ, hội thoại, bảng từ vựng, chú thích ngữ pháp và bài đọc nằm bên trong các HÌNH ẢNH TRANG SÁCH đính kèm kết hợp với văn bản để trích xuất đầy đủ 100% nội dung bài học!\n`
    : "(Nếu có hình ảnh trang sách đính kèm do PDF dạng scan, hãy đọc kỹ toàn bộ chữ trên các trang ảnh đó để soạn bài)."
}

TÊN CHƯƠNG: ${params.chapterTitle}

NỘI DUNG VĂN BẢN CHƯƠNG SÁCH (LỚP TEXT TRÍCH XUẤT TỰ ĐỘNG):
"""
${trimmedText || "(Nội dung nằm trong các hình ảnh trang sách đính kèm)"}
"""

YÊU CẦU BẮT BUỘC (Viết ngắn gọn, súc tích để đảm bảo xuất đủ 100% cả 7 phần dưới đây):
1. overview: Tóm tắt nội dung/luận điểm của chương sách, nêu 3 chủ đề chính và 3 mục tiêu học tập.
2. contentAnalysis: Chia nội dung chương thành 2-3 phần trọng tâm theo mạch sách (ví dụ Dialogue 1, Dialogue 2, Bài đọc...). Mỗi phần trích dẫn đoạn văn gốc (originalExcerpt), dịch sang tiếng Việt chuẩn xác (vietnameseTranslation), và giải thích sâu ý nghĩa nội dung, bối cảnh (deepExplanation & stylisticOrContextNotes).
3. grammarPoints: Trích xuất 3-4 cấu trúc ngữ pháp trọng tâm xuất hiện trong chương. Giải thích công thức, cách dùng và cho 1-2 ví dụ.
4. vocabulary: Trích xuất 12 đến 15 mục từ vựng quan trọng nhất xuất hiện trong bài (bao gồm từ mới Vocabulary, tên riêng Names, và cụm từ Phrases). Ở trường ipa: ghi phiên âm Pinyin có dấu (nếu tiếng Trung) hoặc IPA (nếu tiếng Anh). Cung cấp từ loại chuẩn, nghĩa tiếng Việt, câu ví dụ ngắn gọn, 1-2 collocations.
5. clozeExercises: Tạo 5 câu bài tập điền từ/ngữ pháp vào chỗ trống (dùng đúng ký hiệu "_____" tại vị trí từ bị khuyết).
6. quizExercises: Tạo 6 câu hỏi trắc nghiệm (4 lựa chọn) CHỈ KIỂM TRA TỪ VỰNG (nghĩa từ, cách dùng từ, phiên âm) VÀ NGỮ PHÁP (trật tự từ, chọn cấu trúc đúng, điền trợ từ).
7. translationExercises: Chọn 4 câu tiêu biểu sử dụng từ vựng và ngữ pháp của chương để người học luyện dịch sang tiếng Việt.`;

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
    vocabulary: Array.isArray(root?.vocabulary)
      ? root.vocabulary.map((v: any, idx: number) => ({
          id: String(v?.id || `voc-${idx + 1}`),
          word: String(v?.word || ""),
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
        }))
      : [],
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

  // Nếu model dừng sớm khiến Tab 4 hoặc Tab 5 bị rỗng, tự động gọi bổ sung ngay
  if (
    normalizedLesson.clozeExercises.length === 0 ||
    normalizedLesson.translationExercises.length === 0
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

      const supp = await generateSupplementalExercisesWithAI({
        courseTitle: params.courseTitle,
        chapterTitle: params.chapterTitle,
        chapterText: params.chapterText,
        existingLessonContext: `TỪ VỰNG ĐÃ TRÍCH XUẤT: ${vocabSummary}\nNGỮ PHÁP: ${grammarSummary}\nĐOẠN TRÍCH TRONG BÀI:\n${contentSummary}`,
        apiKey: params.apiKey,
        masterApiKey: params.masterApiKey,
        model: params.model,
      });

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
3. Trả về đầy đủ tất cả các bài học tìm thấy trong Mục lục theo đúng định dạng JSON: { "chapters": [ { "title": "Lesson 1: ...", "startPage": 12, "endPage": 26 }, ... ] }. Tuyệt đối không trả về mảng rỗng!

DỮ LIỆU TEXT TRÍCH XUẤT TỪ PDF (NẾU CÓ):
"""
${params.pageSummaries.slice(0, 12000)}
"""`;

  const contentsPayload: Array<
    string | { inlineData: { mimeType: string; data: string } }
  > = [prompt];

  if (params.tocImagesBase64 && params.tocImagesBase64.length > 0) {
    for (const base64Img of params.tocImagesBase64.slice(0, 10)) {
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
  apiKey?: string;
  masterApiKey?: string;
  model?: string;
}) {
  const ai = getClient(params.apiKey, params.masterApiKey);
  const modelName = params.model || "gemini-2.5-flash";

  const prompt = `Bạn là Chuyên gia Từ điển & Ngôn ngữ học kiêm Giảng viên cao cấp.
Nhiệm vụ của bạn là quét toàn bộ văn bản và TẤT CẢ HÌNH ẢNH TRANG SÁCH được cung cấp của bài học "${params.chapterTitle}" thuộc sách "${params.courseTitle}".
BẮT BUỘC TRÍCH XUẤT ĐẦY ĐỦ 100% TẤT CẢ CÁC MỤC TỪ VỰNG XUẤT HIỆN TRONG TOÀN BỘ BÀI HỌC (THƯỜNG CÓ TỪ 35 ĐẾN 50+ MỤC TỪ).

ĐẶC BIỆT LƯU Ý VỀ CẤU TRÚC GIÁO TRÌNH TIẾNG NGOẠI NGỮ (ĐẶC BIỆT TIẾNG TRUNG NHƯ ĐƯƠNG ĐẠI / HSK):
Mỗi bài học thường có nhiều phần đối thoại (Dialogue I, Dialogue II...) và mỗi phần đều có các bảng từ vựng độc lập được đánh số:
1. Bảng "People in the dialogue" (Tên các nhân vật: VD 1. 陳月美 Chén Yuèměi, 2. 李明華 Lǐ Mínghuá, 3. 王開文 Wáng Kāiwén...)
2. Bảng "Vocabulary" của Dialogue I (Từ mới đánh số từ 4..17...: VD 4. 你 nǐ, 5. 來 lái, 6. 是 shì, 7. 小姐 xiǎojiě, 8. 嗎 ma, 9. 接 jiē, 10. 我們 wǒmen, 11. 我 wǒ, 12. 這 zhè, 13. 先生 xiānshēng, 14. 好 hǎo, 15. 姓 xìng, 16. 叫 jiào, 17. 你們 nǐmen...)
3. Bảng "Names" của Dialogue I (Địa danh, tên riêng: VD 18. 臺灣 Táiwān...)
4. Bảng "Phrases" của Dialogue I (Cụm từ, mẫu câu: VD 19. 歡迎 huānyíng, 20. 請問 qǐngwèn, 21. 是的 shìde, 22. 謝謝 xièxie, 23. 不客氣 búkèqì, 24. 你好 nǐ hǎo...)
5. Bảng "Vocabulary" của Dialogue II (Đánh số lại từ 1..14...: VD 1. 請 qǐng, 2. 喝 hē, 3. 茶 chá, 4. 很 hěn, 5. 好喝 hǎohē, 6. 什麼 shénme, 7. 人 rén, 8. 喜歡 xǐhuān, 9. 呢 ne, 10. 他 tā, 11. 不 bù, 12. 哪 nǎ, 13. 要 yào, 14. 咖啡 kāfēi...)
6. Bảng "Names" của Dialogue II (VD 15. 烏龍茶 Wūlóng chá, 16. 日本 Rìběn, 17. 美國 Měiguó...)
7. Bảng "Phrases" của Dialogue II (VD 18. 對不起 duìbùqǐ, 19. 哪國 nǎ guó...)

BẠN PHẢI QUÉT TOÀN BỘ CÁC TRANG ẢNH VÀ VĂN BẢN ĐỂ LẤY ĐỦ TẤT CẢ CÁC MỤC TRÊN (TỔNG CỘNG 35-50+ TỪ).
TUYỆT ĐỐI KHÔNG ĐƯỢC CẮT BỚT CHỈ LẤY 10 TỪ!

Với mỗi từ, cung cấp:
- word: Chữ Hán gốc (phồn thể/giản thể theo sách, VD: 請, 喝, 烏龍茶, 陳月美, 對不起, 臺灣...)
- ipa: Phiên âm Pinyin có dấu (nếu tiếng Trung) hoặc IPA (nếu tiếng Anh)
- partOfSpeech: Từ loại chuẩn theo sách (N, V, Vs, Vst, Adv, Ptc, Det, Vaux, Phrase, Name...)
- cefrLevel: Cấp độ tương đương (A1, A2, B1, B2, C1, hoặc C2)
- vietnameseMeaning: Nghĩa tiếng Việt đầy đủ, chính xác
- explanationInContext: Giải thích ngắn gọn cách dùng từ trong câu (1-2 câu)
- quoteFromBook: Câu ví dụ có chứa từ đó
- quoteTranslation: Dịch nghĩa câu ví dụ sang tiếng Việt
- collocations: 1-2 cụm từ kết hợp phổ biến
- synonyms: Từ đồng nghĩa hoặc liên quan

NỘI DUNG CHƯƠNG SÁCH:
"""
${params.chapterText.slice(0, 35000)}
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
      responseSchema: FULL_VOCAB_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 32768,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  if (!response.text) {
    throw new Error("Không nhận được danh sách từ vựng từ AI.");
  }

  const parsed = JSON.parse(response.text);
  return parsed.vocabulary || [];
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

