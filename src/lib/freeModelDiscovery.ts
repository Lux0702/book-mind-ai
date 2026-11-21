/**
 * Daily Live Free Model Discovery & Auto-Blacklist Registry
 * - Automatically queries OpenRouter's public catalog (`GET /api/v1/models`) and Groq's active model list
 *   once per calendar day (YYYY-MM-DD) to ensure we NEVER route to retired/404 free models.
 * - Also supports instant runtime auto-blacklisting if any model returns HTTP 404 / "no longer available".
 */

export interface DailyFreeModelsSnapshot {
  date: string; // YYYY-MM-DD
  checkedAt: string; // ISO timestamp
  openRouterTextFree: string[];
  openRouterVisionFree: string[];
  groqTextModels: string[];
  groqVisionModels: string[];
  deadModelsToday: string[];
  source: "live_api" | "fallback";
}

declare global {
  // eslint-disable-next-line no-var
  var __bookMindDailyFreeModels: DailyFreeModelsSnapshot | undefined;
  // eslint-disable-next-line no-var
  var __bookMindDeadModelsMap:
    | { date: string; ids: Set<string> }
    | undefined;
}

const FALLBACK_OPENROUTER_TEXT = ["openrouter/free"];
const FALLBACK_OPENROUTER_VISION = ["openrouter/free"];

const PREFERRED_GROQ_TEXT = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
  "qwen/qwen3-32b",
  "llama-3.1-8b-instant",
];

const PREFERRED_GROQ_VISION = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "meta-llama/llama-4-maverick-17b-128e-instruct",
];

function getTodayUtcOrLocalDate(): string {
  // Use Vietnam UTC+7 date string so daily check aligns with user's day
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

function getDeadModelsSet(): Set<string> {
  const today = getTodayUtcOrLocalDate();
  if (
    !globalThis.__bookMindDeadModelsMap ||
    globalThis.__bookMindDeadModelsMap.date !== today
  ) {
    globalThis.__bookMindDeadModelsMap = {
      date: today,
      ids: new Set<string>(),
    };
  }
  return globalThis.__bookMindDeadModelsMap.ids;
}

/**
 * Mark a model ID as dead/unavailable for the rest of today (e.g. HTTP 404 / decommissioned).
 */
export function markModelDeadToday(modelId: string): void {
  if (!modelId || modelId === "openrouter/free") return;
  const dead = getDeadModelsSet();
  dead.add(modelId);
  if (globalThis.__bookMindDailyFreeModels) {
    globalThis.__bookMindDailyFreeModels.openRouterTextFree =
      globalThis.__bookMindDailyFreeModels.openRouterTextFree.filter(
        (m) => m !== modelId
      );
    globalThis.__bookMindDailyFreeModels.openRouterVisionFree =
      globalThis.__bookMindDailyFreeModels.openRouterVisionFree.filter(
        (m) => m !== modelId
      );
    globalThis.__bookMindDailyFreeModels.groqTextModels =
      globalThis.__bookMindDailyFreeModels.groqTextModels.filter(
        (m) => m !== modelId
      );
    globalThis.__bookMindDailyFreeModels.groqVisionModels =
      globalThis.__bookMindDailyFreeModels.groqVisionModels.filter(
        (m) => m !== modelId
      );
    globalThis.__bookMindDailyFreeModels.deadModelsToday = Array.from(dead);
  }
}

export function isModelNotFoundError(errMessage: string): boolean {
  const lower = errMessage.toLowerCase();
  return (
    lower.includes("http 404") ||
    lower.includes("no longer available") ||
    lower.includes("no provider serves this model") ||
    lower.includes("model_not_found") ||
    lower.includes("decommissioned") ||
    lower.includes("does not exist")
  );
}

function scoreOpenRouterModel(
  id: string,
  contextLength: number,
  isVision: boolean
): number {
  const lower = id.toLowerCase();
  let score = 0;

  // Prefer strong multilingual & structured-JSON families
  if (lower.includes("qwen")) score += 45;
  if (lower.includes("gemma-3-27b") || lower.includes("gemma-4")) score += 42;
  if (lower.includes("llama-4") || lower.includes("llama-3.3-70b")) score += 40;
  if (lower.includes("nemotron") && isVision) score += 38;
  if (lower.includes("mistral") || lower.includes("deepseek")) score += 30;
  if (lower.includes("gemma-3-12b") || lower.includes("gemma-3")) score += 28;
  if (lower.includes("72b") || lower.includes("70b")) score += 15;
  if (lower.includes("32b") || lower.includes("27b") || lower.includes("24b"))
    score += 10;

  // Avoid tiny/experimental/thinking-only slow models when better ones exist
  if (lower.includes("1b") || lower.includes("2b") || lower.includes("3b"))
    score -= 20;
  if (lower.includes("guard") || lower.includes("embed")) score -= 100;

  // Bonus for larger context window (up to +15)
  score += Math.min(15, Math.floor(contextLength / 16000));
  return score;
}

async function fetchOpenRouterLiveFreeModels(): Promise<{
  text: string[];
  vision: string[];
} | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: Array<{
        id?: string;
        context_length?: number;
        pricing?: { prompt?: string; completion?: string };
        architecture?: {
          modality?: string;
          input_modalities?: string[];
        };
      }>;
    };

    const items = Array.isArray(json?.data) ? json.data : [];
    const dead = getDeadModelsSet();

    const textCandidates: Array<{ id: string; score: number }> = [];
    const visionCandidates: Array<{ id: string; score: number }> = [];

    for (const m of items) {
      const id = String(m?.id || "").trim();
      if (!id || dead.has(id)) continue;

      const isExplicitFree = id.endsWith(":free");
      const isZeroPrice =
        m?.pricing?.prompt === "0" && m?.pricing?.completion === "0";
      if (!isExplicitFree && !isZeroPrice) continue;

      // Skip router meta-ids except openrouter/free which we add explicitly
      if (id === "openrouter/free" || id === "openrouter/auto") continue;

      const ctx = Number(m?.context_length || 0);
      const inputMods = Array.isArray(m?.architecture?.input_modalities)
        ? m.architecture.input_modalities
        : [];
      const modalityStr = String(m?.architecture?.modality || "").toLowerCase();
      const supportsImage =
        inputMods.includes("image") || modalityStr.includes("image");

      if (supportsImage) {
        const s = scoreOpenRouterModel(id, ctx, true);
        if (s > 0) visionCandidates.push({ id, score: s });
      }
      const textScore = scoreOpenRouterModel(id, ctx, false);
      if (textScore > 0) {
        textCandidates.push({ id, score: textScore });
      }
    }

    visionCandidates.sort((a, b) => b.score - a.score);
    textCandidates.sort((a, b) => b.score - a.score);

    const topVision = visionCandidates.slice(0, 4).map((x) => x.id);
    if (!topVision.includes("openrouter/free")) {
      topVision.push("openrouter/free");
    }

    const topText = ["openrouter/free", ...textCandidates.slice(0, 3).map((x) => x.id)];

    return {
      text: Array.from(new Set(topText)),
      vision: Array.from(new Set(topVision)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchGroqLiveModels(
  groqApiKey?: string
): Promise<{ text: string[]; vision: string[] } | null> {
  const key =
    groqApiKey ||
    process.env.GROQ_API_KEY ||
    process.env.NEXT_PUBLIC_GROQ_API_KEY ||
    "";
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      data?: Array<{ id?: string; active?: boolean }>;
    };
    const activeIds = new Set(
      (json?.data || [])
        .filter((m) => m?.id && m.active !== false)
        .map((m) => String(m.id))
    );
    if (activeIds.size === 0) return null;

    const dead = getDeadModelsSet();
    const isAlive = (id: string) => activeIds.has(id) && !dead.has(id);

    const text = PREFERRED_GROQ_TEXT.filter(isAlive);
    // Add any other live llama/qwen/gpt-oss models if preferred ones were retired
    if (text.length < 2) {
      for (const id of activeIds) {
        if (dead.has(id) || text.includes(id)) continue;
        const lower = id.toLowerCase();
        if (
          (lower.includes("llama") ||
            lower.includes("qwen") ||
            lower.includes("gpt-oss")) &&
          !lower.includes("whisper") &&
          !lower.includes("guard") &&
          !lower.includes("tts")
        ) {
          text.push(id);
          if (text.length >= 4) break;
        }
      }
    }

    const vision = PREFERRED_GROQ_VISION.filter(isAlive);
    if (vision.length === 0) {
      for (const id of activeIds) {
        if (dead.has(id)) continue;
        const lower = id.toLowerCase();
        if (lower.includes("llama-4") || lower.includes("vision")) {
          vision.push(id);
          if (vision.length >= 2) break;
        }
      }
    }

    return {
      text: text.length > 0 ? text : PREFERRED_GROQ_TEXT.filter((m) => !dead.has(m)),
      vision:
        vision.length > 0
          ? vision
          : PREFERRED_GROQ_VISION.filter((m) => !dead.has(m)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns today's verified live free models.
 * Automatically refreshes once per day (YYYY-MM-DD) or when `forceRefresh` is true.
 */
export async function getDailyLiveFreeModels(options?: {
  groqApiKey?: string;
  forceRefresh?: boolean;
}): Promise<DailyFreeModelsSnapshot> {
  const today = getTodayUtcOrLocalDate();
  const cached = globalThis.__bookMindDailyFreeModels;

  if (
    cached &&
    cached.date === today &&
    !options?.forceRefresh &&
    cached.source === "live_api"
  ) {
    return cached;
  }

  const [orLive, groqLive] = await Promise.all([
    fetchOpenRouterLiveFreeModels(),
    fetchGroqLiveModels(options?.groqApiKey),
  ]);

  const dead = getDeadModelsSet();
  const snapshot: DailyFreeModelsSnapshot = {
    date: today,
    checkedAt: new Date().toISOString(),
    openRouterTextFree: orLive?.text?.length
      ? orLive.text
      : FALLBACK_OPENROUTER_TEXT,
    openRouterVisionFree: orLive?.vision?.length
      ? orLive.vision
      : FALLBACK_OPENROUTER_VISION,
    groqTextModels: groqLive?.text?.length
      ? groqLive.text
      : PREFERRED_GROQ_TEXT.filter((m) => !dead.has(m)),
    groqVisionModels: groqLive?.vision?.length
      ? groqLive.vision
      : PREFERRED_GROQ_VISION.filter((m) => !dead.has(m)),
    deadModelsToday: Array.from(dead),
    source: orLive || groqLive ? "live_api" : "fallback",
  };

  globalThis.__bookMindDailyFreeModels = snapshot;
  return snapshot;
}
