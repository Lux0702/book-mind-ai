import Dexie, { type EntityTable } from "dexie";
import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import {
  AppSettings,
  Course,
  FlashcardSRS,
  StudyStreak,
  LearningActivity,
} from "@/types/course";
import { SAMPLE_COURSE, SAMPLE_FLASHCARDS } from "./sampleData";

export interface AppUser {
  id: string;
  email?: string;
  expiresAt?: number; // Thời điểm hết hạn phiên đăng nhập (epoch ms)
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
  app_metadata?: {
    provider?: string;
    [key: string]: any;
  };
}

export interface StoredPdfBlob {
  courseId: string;
  blob: Blob;
  fileName?: string;
  updatedAt: string;
}

class BookLearningDatabase extends Dexie {
  courses!: EntityTable<Course, "id">;
  flashcards!: EntityTable<FlashcardSRS, "id">;
  pdfBlobs!: EntityTable<StoredPdfBlob, "courseId">;

  constructor() {
    super("BookLearningAgentDB");
    this.version(1).stores({
      courses: "id, title, updatedAt",
      flashcards: "id, courseId, chapterId, word, nextReviewDate",
    });
    this.version(2).stores({
      courses: "id, title, updatedAt",
      flashcards: "id, courseId, chapterId, word, nextReviewDate",
      pdfBlobs: "courseId, updatedAt",
    });
  }
}

export const db =
  typeof window !== "undefined" ? new BookLearningDatabase() : null;

const SETTINGS_KEY = "book_agent_settings_v1";
const SEEDED_KEY = "book_agent_seeded_v1";
const STREAK_KEY = "book_agent_streak_v1";
const ACTIVITIES_KEY = "book_agent_activities_v1";
const LOCAL_USER_KEY = "book_agent_local_user_v1";
const SESSION_EXPIRED_NOTICE_KEY = "book_agent_session_expired_notice_v1";
const HAD_SUPABASE_SESSION_KEY = "book_agent_had_sb_session_v1";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // Phiên đăng nhập có hiệu lực 12 giờ

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: "",
  masterGeminiApiKey: "",
  groqApiKey: process.env.NEXT_PUBLIC_GROQ_API_KEY || "",
  openRouterApiKey: process.env.NEXT_PUBLIC_OPENROUTER_API_KEY || "",
  siliconFlowApiKey: process.env.NEXT_PUBLIC_SILICONFLOW_API_KEY || "",
  adminPasscode: "admin123",
  resendApiKey: "",
  geminiModel: "qwen-groq",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  autoSyncCloud: true,
};

export function getAppSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as AppSettings;
    parsed.supabaseUrl =
      parsed.supabaseUrl?.trim() || DEFAULT_SETTINGS.supabaseUrl;
    parsed.supabaseAnonKey =
      parsed.supabaseAnonKey?.trim() || DEFAULT_SETTINGS.supabaseAnonKey;
    parsed.groqApiKey =
      parsed.groqApiKey?.trim() || DEFAULT_SETTINGS.groqApiKey;
    parsed.openRouterApiKey =
      parsed.openRouterApiKey?.trim() || DEFAULT_SETTINGS.openRouterApiKey;
    parsed.siliconFlowApiKey =
      parsed.siliconFlowApiKey?.trim() || DEFAULT_SETTINGS.siliconFlowApiKey;
    // Tự động chuyển key Google gốc (AIza...) đã lưu trước đó sang Master Key của hệ thống
    // để geminiApiKey đóng vai trò là BookMind Virtual API Key (BM-FREE / BM-PRO / BM-VIP) của User
    if (
      parsed.geminiApiKey &&
      parsed.geminiApiKey.trim().startsWith("AIza") &&
      !parsed.masterGeminiApiKey
    ) {
      parsed.masterGeminiApiKey = parsed.geminiApiKey.trim();
      parsed.geminiApiKey = "";
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const SYSTEM_AI_CONFIG_COURSE_ID = "__bookmind_system_config__";
const SYSTEM_AI_CONFIG_STORAGE_PATH = "__system_ai_config.json";
const STORAGE_BUCKET_CONFIG = "book-chapters";

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  if (
    settings.masterGeminiApiKey?.trim() ||
    settings.groqApiKey?.trim() ||
    settings.openRouterApiKey?.trim() ||
    settings.siliconFlowApiKey?.trim()
  ) {
    void syncSystemAiKeysToCloud(settings);
  }
}

export interface CloudSystemAiConfig {
  masterGeminiApiKey?: string;
  groqApiKey?: string;
  openRouterApiKey?: string;
  siliconFlowApiKey?: string;
  geminiModel?: AppSettings["geminiModel"];
  updatedAt: string;
}

export async function syncSystemAiKeysToCloud(
  customSettings?: AppSettings
): Promise<boolean> {
  const settings = customSettings || getAppSettings();
  const payload: CloudSystemAiConfig = {
    masterGeminiApiKey: settings.masterGeminiApiKey?.trim() || "",
    groqApiKey: settings.groqApiKey?.trim() || "",
    openRouterApiKey: settings.openRouterApiKey?.trim() || "",
    siliconFlowApiKey: settings.siliconFlowApiKey?.trim() || "",
    geminiModel: settings.geminiModel || "qwen-groq",
    updatedAt: new Date().toISOString(),
  };

  if (
    !payload.masterGeminiApiKey &&
    !payload.groqApiKey &&
    !payload.openRouterApiKey &&
    !payload.siliconFlowApiKey
  ) {
    return false;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return false;

  let synced = false;

  // 1. Lưu lên Kho B (Supabase Storage: book-chapters/__system_ai_config.json)
  try {
    const blob = new Blob([JSON.stringify(payload)], {
      type: "application/json;charset=utf-8",
    });
    const { error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET_CONFIG)
      .upload(SYSTEM_AI_CONFIG_STORAGE_PATH, blob, {
        upsert: true,
        contentType: "application/json;charset=utf-8",
      });
    if (!uploadErr) synced = true;
  } catch {
    // Ignore storage error
  }

  // 2. Lưu dự phòng vào Kho A (public.courses với id = __bookmind_system_config__)
  try {
    const { error: dbErr } = await supabase.from("courses").upsert({
      id: SYSTEM_AI_CONFIG_COURSE_ID,
      title: "__SYSTEM_AI_CONFIG__",
      data: {
        id: SYSTEM_AI_CONFIG_COURSE_ID,
        title: "__SYSTEM_AI_CONFIG__",
        isSystemConfig: true,
        aiConfig: payload,
        updatedAt: payload.updatedAt,
      },
      updated_at: payload.updatedAt,
    });
    if (!dbErr) synced = true;
  } catch {
    // Ignore db error
  }

  return synced;
}

let lastPulledAiConfigAt = 0;
let inFlightPullAiConfig: Promise<AppSettings> | null = null;

export async function pullSystemAiKeysFromCloud(
  forceRefresh = false
): Promise<AppSettings> {
  const current = getAppSettings();
  const hasLocalKeys = Boolean(
    current.masterGeminiApiKey?.trim() ||
      current.groqApiKey?.trim() ||
      current.openRouterApiKey?.trim() ||
      current.siliconFlowApiKey?.trim()
  );

  if (
    !forceRefresh &&
    hasLocalKeys &&
    Date.now() - lastPulledAiConfigAt < 300_000
  ) {
    return current;
  }

  if (!forceRefresh && inFlightPullAiConfig) {
    return inFlightPullAiConfig;
  }

  const run = (async (): Promise<AppSettings> => {
    lastPulledAiConfigAt = Date.now();
    const supabase = getSupabaseClient();
    if (!supabase) return current;

    let remoteConfig: CloudSystemAiConfig | null = null;

    // 1. Thử đọc từ bảng courses (__bookmind_system_config__) vì truy vấn JSONB nhanh và không bị CDN cache
    try {
      const { data } = await supabase
        .from("courses")
        .select("data")
        .eq("id", SYSTEM_AI_CONFIG_COURSE_ID)
        .maybeSingle();
      if (data?.data?.aiConfig) {
        remoteConfig = data.data.aiConfig as CloudSystemAiConfig;
      }
    } catch {
      // Ignore
    }

    // 2. Fallback đọc từ Storage Bucket (book-chapters/__system_ai_config.json)
    if (
      !remoteConfig ||
      (!remoteConfig.masterGeminiApiKey &&
        !remoteConfig.groqApiKey &&
        !remoteConfig.openRouterApiKey &&
        !remoteConfig.siliconFlowApiKey)
    ) {
      try {
        const { data: blobData, error: dlErr } = await supabase.storage
          .from(STORAGE_BUCKET_CONFIG)
          .download(SYSTEM_AI_CONFIG_STORAGE_PATH);
        if (!dlErr && blobData) {
          const text = await blobData.text();
          remoteConfig = JSON.parse(text) as CloudSystemAiConfig;
        }
      } catch {
        // Ignore
      }
    }

    const remoteHasKeys = Boolean(
      remoteConfig &&
        (remoteConfig.masterGeminiApiKey?.trim() ||
          remoteConfig.groqApiKey?.trim() ||
          remoteConfig.openRouterApiKey?.trim() ||
          remoteConfig.siliconFlowApiKey?.trim())
    );

    // Nếu máy hiện tại (ví dụ: Laptop của Admin) đang có sẵn bộ Key trong localStorage mà trên Cloud chưa có -> tự động đẩy lên Cloud!
    if (hasLocalKeys && !remoteHasKeys) {
      void syncSystemAiKeysToCloud(current);
      return current;
    }

    // Nếu tìm thấy bộ Key trên Cloud -> hợp nhất vào localStorage của thiết bị hiện tại (đặc biệt cho Điện thoại!)
    if (remoteConfig && remoteHasKeys) {
      const merged: AppSettings = {
        ...current,
        masterGeminiApiKey:
          current.masterGeminiApiKey?.trim() ||
          remoteConfig.masterGeminiApiKey?.trim() ||
          "",
        groqApiKey:
          current.groqApiKey?.trim() || remoteConfig.groqApiKey?.trim() || "",
        openRouterApiKey:
          current.openRouterApiKey?.trim() ||
          remoteConfig.openRouterApiKey?.trim() ||
          "",
        siliconFlowApiKey:
          current.siliconFlowApiKey?.trim() ||
          remoteConfig.siliconFlowApiKey?.trim() ||
          "",
        geminiModel:
          current.geminiModel || remoteConfig.geminiModel || "qwen-groq",
      };
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
      }
      return merged;
    }

    return current;
  })();

  inFlightPullAiConfig = run;
  try {
    return await run;
  } finally {
    inFlightPullAiConfig = null;
  }
}

let cachedSupabaseClient: SupabaseClient | null = null;
let cachedClientUrl = "";
let cachedClientKey = "";

export function getSupabaseClient(): SupabaseClient | null {
  const settings = getAppSettings();
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null;
  if (
    cachedSupabaseClient &&
    cachedClientUrl === settings.supabaseUrl &&
    cachedClientKey === settings.supabaseAnonKey
  ) {
    return cachedSupabaseClient;
  }
  try {
    cachedSupabaseClient = createClient(
      settings.supabaseUrl,
      settings.supabaseAnonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      }
    );
    cachedClientUrl = settings.supabaseUrl;
    cachedClientKey = settings.supabaseAnonKey;
    return cachedSupabaseClient;
  } catch {
    return null;
  }
}

export async function triggerSessionExpiredLogout(
  reason = "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục!"
): Promise<void> {
  cachedUserResult = null;
  inFlightGetCurrentUser = null;
  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, reason);
    localStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(HAD_SUPABASE_SESSION_KEY);
  }
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signout error
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("bookmind:session-expired", { detail: { reason } })
    );
  }
}

export function consumeSessionExpiredNotice(): string | null {
  if (typeof window === "undefined") return null;
  const msg = sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY);
  if (msg) {
    sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  }
  return msg;
}

export async function getSessionAuthHeaders(): Promise<Record<string, string>> {
  const settings = getAppSettings();
  const headers: Record<string, string> = {};

  if (settings.supabaseUrl && settings.supabaseAnonKey) {
    headers["X-Supabase-Url"] = settings.supabaseUrl;
    headers["X-Supabase-Anon-Key"] = settings.supabaseAnonKey;
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (session?.access_token) {
        const expiresAtMs = (session.expires_at || 0) * 1000;
        headers["Authorization"] = `Bearer ${session.access_token}`;
        headers["X-User-Email"] = session.user?.email || "";
        headers["X-Session-Expires-At"] = String(
          expiresAtMs || Date.now() + SESSION_TTL_MS
        );
        return headers;
      }
    } catch {
      // Fall through to local check
    }
  }

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) {
        const localUser = JSON.parse(raw) as AppUser;
        headers["X-User-Email"] = localUser.email || localUser.id;
        headers["X-Session-Expires-At"] = String(
          localUser.expiresAt || Date.now() + SESSION_TTL_MS
        );
      }
    } catch {
      // Ignore
    }
  }

  return headers;
}

// Bộ nhớ đệm (2 phút) + Chống gọi trùng lặp đồng thời (In-flight Deduplication) cho getCurrentUser()
const USER_CACHE_TTL_MS = 120_000;
let cachedUserResult: { user: AppUser; fetchedAt: number } | null = null;
let inFlightGetCurrentUser: Promise<AppUser | null> | null = null;

export function invalidateUserCache(): void {
  cachedUserResult = null;
  inFlightGetCurrentUser = null;
}

export function setCachedAuthenticatedUser(user: AppUser | null): void {
  inFlightGetCurrentUser = null;
  if (user) {
    cachedUserResult = { user, fetchedAt: Date.now() };
  } else {
    cachedUserResult = null;
  }
}

export async function getCurrentUser(forceRefresh = false): Promise<AppUser | null> {
  if (
    !forceRefresh &&
    cachedUserResult &&
    Date.now() - cachedUserResult.fetchedAt < USER_CACHE_TTL_MS
  ) {
    return cachedUserResult.user;
  }

  if (!forceRefresh && inFlightGetCurrentUser) {
    return inFlightGetCurrentUser;
  }

  const fetchPromise = (async (): Promise<AppUser | null> => {
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        let session = sessionData?.session || null;

        if (session) {
          const expiresAtMs = (session.expires_at || 0) * 1000;
          if (expiresAtMs > 0 && expiresAtMs <= Date.now()) {
            const { data: refreshed, error: refreshErr } =
              await supabase.auth.refreshSession();
            if (!refreshErr && refreshed?.session) {
              session = refreshed.session;
            } else {
              session = null;
            }
          }

          if (session?.user) {
            const appUser = session.user as unknown as AppUser;
            appUser.expiresAt =
              (session.expires_at || 0) * 1000 || Date.now() + SESSION_TTL_MS;
            cachedUserResult = { user: appUser, fetchedAt: Date.now() };
            return appUser;
          }
        }
      } catch {
        // Ignore network errors
      }
    }

    // Không cache kết quả null để tránh trường hợp Google OAuth đang xử lý mã code/hash trên URL
    cachedUserResult = null;
    return null;
  })();

  inFlightGetCurrentUser = fetchPromise;
  try {
    return await fetchPromise;
  } finally {
    inFlightGetCurrentUser = null;
  }
}

export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  invalidateUserCache();
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_USER_KEY);
    sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      error: new Error(
        "Chưa cấu hình kết nối Supabase / Google Auth trên hệ thống."
      ),
    };
  }
  try {
    const redirectUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://book-mind-2vmdrg1ur-lux0702s-projects.vercel.app";

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    return { error: error ? new Error(error.message) : null };
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err : new Error("Lỗi khi kết nối Google Auth"),
    };
  }
}

export async function signOutUser(): Promise<void> {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(HAD_SUPABASE_SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  }
  cachedUserResult = null;
  inFlightGetCurrentUser = null;
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
  }
  cachedUserResult = null;
}

// -------------------------------------------------------------
// STREAK & LEARNING ACTIVITY TRACKING
// -------------------------------------------------------------

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayString(): string {
  const now = new Date();
  now.setDate(now.getDate() - 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getActiveUserScopeKey(baseKey: string): string {
  const uid = cachedUserResult?.user?.id;
  if (uid) return `${baseKey}_${uid}`;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppUser;
        if (parsed?.id) return `${baseKey}_${parsed.id}`;
      }
    } catch {
      // Ignore
    }
  }
  return baseKey;
}

function parseDateStrToUtcMs(dateStr: string): number {
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return 0;
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

export function recalculateStreakFromDates(
  rawDates: string[],
  previousLongest = 0
): StudyStreak {
  const validDates = Array.from(
    new Set(
      (rawDates || []).filter(
        (d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())
      )
    )
  ).sort();

  if (validDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: previousLongest || 0,
      lastActiveDate: "",
      activeDates: [],
    };
  }

  const today = getTodayString();
  const yesterday = getYesterdayString();
  const lastActiveDate = validDates[validDates.length - 1];

  // Tính chuỗi dài nhất (longestStreak) từ danh sách các ngày liên tiếp
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 1; i < validDates.length; i++) {
    const prevMs = parseDateStrToUtcMs(validDates[i - 1]);
    const currMs = parseDateStrToUtcMs(validDates[i]);
    const diffDays = Math.round((currMs - prevMs) / 86_400_000);
    if (diffDays === 1) {
      currentRun += 1;
      if (currentRun > maxRun) maxRun = currentRun;
    } else if (diffDays > 1) {
      currentRun = 1;
    }
  }

  // Tính chuỗi hiện tại (currentStreak) đếm lùi từ hôm nay hoặc hôm qua
  const dateSet = new Set(validDates);
  let activeCurrent = 0;
  if (dateSet.has(today) || dateSet.has(yesterday)) {
    const startAnchor = dateSet.has(today) ? today : yesterday;
    const anchorParts = startAnchor.split("-").map(Number);
    const cursor = new Date(
      anchorParts[0],
      anchorParts[1] - 1,
      anchorParts[2]
    );
    while (true) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, "0");
      const d = String(cursor.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      if (dateSet.has(key)) {
        activeCurrent += 1;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const longestStreak = Math.max(previousLongest || 0, maxRun, activeCurrent);

  return {
    currentStreak: activeCurrent,
    longestStreak,
    lastActiveDate,
    activeDates: validDates,
  };
}

export function getStudyStreak(): StudyStreak {
  if (typeof window === "undefined") {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
  const scopedKey = getActiveUserScopeKey(STREAK_KEY);
  const raw = localStorage.getItem(scopedKey) || localStorage.getItem(STREAK_KEY);
  if (!raw) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
  try {
    const data: StudyStreak = JSON.parse(raw);
    const dates = Array.isArray(data.activeDates) ? [...data.activeDates] : [];
    if (data.lastActiveDate && !dates.includes(data.lastActiveDate)) {
      dates.push(data.lastActiveDate);
    }
    return recalculateStreakFromDates(dates, data.longestStreak || 0);
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
}

function deduplicateAndSortActivities(
  lists: LearningActivity[][]
): LearningActivity[] {
  const byKey = new Map<string, LearningActivity>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || !item.title || !item.timestamp) continue;
      const dedupeKey =
        item.id || `${item.type}_${item.title}_${item.timestamp.slice(0, 16)}`;
      if (!byKey.has(dedupeKey)) {
        byKey.set(dedupeKey, item);
      }
    }
  }
  return Array.from(byKey.values())
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 80);
}

async function pushAttendanceToSupabaseCloud(
  user: AppUser,
  streak: StudyStreak,
  activities: LearningActivity[]
): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !user) return false;
  const nowIso = new Date().toISOString();
  let synced = false;

  // 1. Lưu trực tiếp vào bảng public.user_quotas (cột JSONB data, khóa chính là email - KHÔNG có cột id)
  const normalizedEmail = (user.email || user.id || "").trim().toLowerCase();
  if (normalizedEmail) {
    try {
      const { data: quotaRow } = await supabase
        .from("user_quotas")
        .select("email, role, plan, issued_api_key, used_calls, max_calls, data")
        .ilike("email", normalizedEmail)
        .maybeSingle();

      if (quotaRow && quotaRow.data) {
        const updatedData = {
          ...quotaRow.data,
          streakData: streak,
          activityLogs: activities,
          updatedAt: nowIso,
        };
        const { error: upErr } = await supabase
          .from("user_quotas")
          .upsert(
            {
              email: quotaRow.email || normalizedEmail,
              role: quotaRow.role || "user",
              plan: quotaRow.plan || "free",
              issued_api_key: quotaRow.issued_api_key || "BM-FREE-INIT00-0000",
              used_calls: quotaRow.used_calls ?? 0,
              max_calls: quotaRow.max_calls ?? 30,
              data: updatedData,
              updated_at: nowIso,
            },
            { onConflict: "email" }
          );
        if (!upErr) synced = true;
      } else {
        const fallbackPayload = {
          userId: user.id || normalizedEmail,
          email: normalizedEmail,
          name:
            user.user_metadata?.full_name ||
            normalizedEmail.split("@")[0] ||
            "Học viên",
          role: "user",
          plan: "free",
          issuedApiKey: "BM-FREE-INIT00-0000",
          activatedApiKey: "BM-FREE-INIT00-0000",
          isKeyActivated: true,
          usedCalls: 0,
          maxCalls: 30,
          streakData: streak,
          activityLogs: activities,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        const { error: insertErr } = await supabase
          .from("user_quotas")
          .upsert(
            {
              email: normalizedEmail,
              role: "user",
              plan: "free",
              issued_api_key: "BM-FREE-INIT00-0000",
              used_calls: 0,
              max_calls: 30,
              data: fallbackPayload,
              updated_at: nowIso,
            },
            { onConflict: "email" }
          );
        if (!insertErr) synced = true;
      }
    } catch {
      // Ignore user_quotas error
    }
  }

  // 2. Đồng thời upsert vào bảng public.user_progress (nếu đã khởi tạo trong Supabase)
  try {
    const { error: progErr } = await supabase.from("user_progress").upsert({
      user_id: user.id,
      streak_data: streak,
      activity_logs: activities,
      updated_at: nowIso,
    });
    if (!progErr) synced = true;
  } catch {
    // Table not ready or network offline
  }

  return synced;
}

const ATTENDANCE_SYNC_TTL_MS = 45_000;
let lastAttendanceSyncAt = 0;
let inFlightAttendanceSync: Promise<{
  streak: StudyStreak;
  activities: LearningActivity[];
  syncedWithCloud: boolean;
}> | null = null;

export async function syncAttendanceWithSupabase(
  forceRefresh = false
): Promise<{
  streak: StudyStreak;
  activities: LearningActivity[];
  syncedWithCloud: boolean;
}> {
  if (typeof window === "undefined") {
    return {
      streak: getStudyStreak(),
      activities: getLearningActivities(),
      syncedWithCloud: false,
    };
  }

  if (
    !forceRefresh &&
    inFlightAttendanceSync
  ) {
    return inFlightAttendanceSync;
  }

  if (
    !forceRefresh &&
    Date.now() - lastAttendanceSyncAt < ATTENDANCE_SYNC_TTL_MS
  ) {
    return {
      streak: getStudyStreak(),
      activities: getLearningActivities(),
      syncedWithCloud: true,
    };
  }

  const run = (async () => {
    const user = await getCurrentUser();
    const localStreak = getStudyStreak();
    const localActivities = getLearningActivities();

    // Đọc thêm dữ liệu unscoped cũ (nếu có trước khi định danh userId)
    let unscopedDates: string[] = [];
    let unscopedLongest = 0;
    let unscopedActivities: LearningActivity[] = [];
    try {
      const rawUnscopedStreak = localStorage.getItem(STREAK_KEY);
      if (rawUnscopedStreak) {
        const parsed = JSON.parse(rawUnscopedStreak) as StudyStreak;
        unscopedDates = parsed.activeDates || [];
        unscopedLongest = parsed.longestStreak || 0;
      }
      const rawUnscopedActs = localStorage.getItem(ACTIVITIES_KEY);
      if (rawUnscopedActs) {
        unscopedActivities = JSON.parse(rawUnscopedActs) as LearningActivity[];
      }
    } catch {
      // Ignore
    }

    const supabase = getSupabaseClient();
    if (!supabase || !user) {
      return {
        streak: localStreak,
        activities: localActivities,
        syncedWithCloud: false,
      };
    }

    lastAttendanceSyncAt = Date.now();
    let cloudQuotaStreak: StudyStreak | null = null;
    let cloudQuotaActivities: LearningActivity[] = [];
    let cloudProgressStreak: StudyStreak | null = null;
    let cloudProgressActivities: LearningActivity[] = [];
    let cloudReachable = false;

    const normalizedEmail = (user.email || user.id || "").trim().toLowerCase();

    // 1. Tải dữ liệu điểm danh từ bảng public.user_quotas (cột data JSONB)
    if (normalizedEmail) {
      try {
        const { data: quotaRow, error: qErr } = await supabase
          .from("user_quotas")
          .select("data")
          .ilike("email", normalizedEmail)
          .maybeSingle();
        if (!qErr) {
          cloudReachable = true;
          if (quotaRow?.data) {
            if (quotaRow.data.streakData) {
              cloudQuotaStreak = quotaRow.data.streakData as StudyStreak;
            }
            if (Array.isArray(quotaRow.data.activityLogs)) {
              cloudQuotaActivities =
                quotaRow.data.activityLogs as LearningActivity[];
            }
          }
        }
      } catch {
        // Ignore
      }
    }

    // 2. Tải dữ liệu điểm danh từ bảng public.user_progress (nếu có)
    try {
      const { data: progRow, error: pErr } = await supabase
        .from("user_progress")
        .select("streak_data, activity_logs")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!pErr) {
        cloudReachable = true;
        if (progRow?.streak_data) {
          cloudProgressStreak = progRow.streak_data as StudyStreak;
        }
        if (Array.isArray(progRow?.activity_logs)) {
          cloudProgressActivities =
            progRow.activity_logs as LearningActivity[];
        }
      }
    } catch {
      // Ignore
    }

    // 3. Hợp nhất toàn bộ ngày hoạt động & nhật ký từ Local + Cloud
    const mergedActivities = deduplicateAndSortActivities([
      localActivities,
      cloudQuotaActivities,
      cloudProgressActivities,
      unscopedActivities.filter((a) => !a.userId || a.userId === user.id),
    ]);

    // Trích xuất thêm ngày YYYY-MM-DD từ chính các activityLogs để không bao giờ sót ngày điểm danh
    const activityDates = mergedActivities
      .map((act) => {
        if (!act.timestamp) return "";
        const d = new Date(act.timestamp);
        if (isNaN(d.getTime())) return "";
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      })
      .filter(Boolean);

    const allDates = [
      ...(localStreak.activeDates || []),
      ...(cloudQuotaStreak?.activeDates || []),
      ...(cloudProgressStreak?.activeDates || []),
      ...unscopedDates,
      ...activityDates,
    ];
    if (localStreak.lastActiveDate) allDates.push(localStreak.lastActiveDate);
    if (cloudQuotaStreak?.lastActiveDate)
      allDates.push(cloudQuotaStreak.lastActiveDate);
    if (cloudProgressStreak?.lastActiveDate)
      allDates.push(cloudProgressStreak.lastActiveDate);

    const maxLongest = Math.max(
      localStreak.longestStreak || 0,
      cloudQuotaStreak?.longestStreak || 0,
      cloudProgressStreak?.longestStreak || 0,
      unscopedLongest
    );

    const mergedStreak = recalculateStreakFromDates(allDates, maxLongest);

    // 4. Lưu bản hợp nhất vào localStorage theo scope của user
    const scopedStreakKey = getActiveUserScopeKey(STREAK_KEY);
    const scopedActivitiesKey = getActiveUserScopeKey(ACTIVITIES_KEY);
    localStorage.setItem(scopedStreakKey, JSON.stringify(mergedStreak));
    localStorage.setItem(scopedActivitiesKey, JSON.stringify(mergedActivities));

    // 5. Nếu Cloud chưa có đủ dữ liệu như bản hợp nhất -> Đẩy ngược lên Cloud
    const cloudDatesCount = cloudQuotaStreak?.activeDates?.length || 0;
    const cloudActsCount = cloudQuotaActivities.length;
    let pushed = false;
    if (
      mergedStreak.activeDates.length !== cloudDatesCount ||
      mergedActivities.length !== cloudActsCount ||
      mergedStreak.currentStreak !== (cloudQuotaStreak?.currentStreak ?? -1) ||
      forceRefresh
    ) {
      pushed = await pushAttendanceToSupabaseCloud(
        user,
        mergedStreak,
        mergedActivities
      );
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bookmind:attendance-updated", {
          detail: { streak: mergedStreak, activities: mergedActivities },
        })
      );
    }

    return {
      streak: mergedStreak,
      activities: mergedActivities,
      syncedWithCloud: cloudReachable || pushed,
    };
  })();

  inFlightAttendanceSync = run;
  try {
    return await run;
  } finally {
    inFlightAttendanceSync = null;
  }
}

export async function recordLearningActivity(activity: {
  type: LearningActivity["type"];
  title: string;
  details: string;
}): Promise<StudyStreak> {
  const user = await getCurrentUser();
  const today = getTodayString();
  const currentStreakData = getStudyStreak();

  const updatedDates = Array.from(
    new Set([...(currentStreakData.activeDates || []), today])
  );
  const updatedStreak = recalculateStreakFromDates(
    updatedDates,
    currentStreakData.longestStreak || 0
  );

  if (typeof window !== "undefined") {
    const scopedStreakKey = getActiveUserScopeKey(STREAK_KEY);
    const scopedActivitiesKey = getActiveUserScopeKey(ACTIVITIES_KEY);
    localStorage.setItem(scopedStreakKey, JSON.stringify(updatedStreak));

    // Save activity log
    const newLog: LearningActivity = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: user?.id,
      type: activity.type,
      title: activity.title,
      details: activity.details,
      timestamp: new Date().toISOString(),
    };

    const existingLogs = getLearningActivities();
    const updatedLogs = deduplicateAndSortActivities([[newLog], existingLogs]);
    localStorage.setItem(scopedActivitiesKey, JSON.stringify(updatedLogs));

    window.dispatchEvent(
      new CustomEvent("bookmind:attendance-updated", {
        detail: { streak: updatedStreak, activities: updatedLogs },
      })
    );

    if (user) {
      await pushAttendanceToSupabaseCloud(user, updatedStreak, updatedLogs);
    }
  }

  return updatedStreak;
}

export function getLearningActivities(): LearningActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const scopedActivitiesKey = getActiveUserScopeKey(ACTIVITIES_KEY);
    const raw =
      localStorage.getItem(scopedActivitiesKey) ||
      localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// COURSE & FLASHCARD STORAGE (WITH STRICT PER-USER ISOLATION & COMMUNITY LIBRARY)
// -------------------------------------------------------------

export function isCourseOwnedByUser(
  course: Course,
  user: AppUser | null
): boolean {
  if (!user || !course || course.id === SYSTEM_AI_CONFIG_COURSE_ID) return false;
  if (!Array.isArray(course.chapters)) return false;
  if (course.userId && course.userId === user.id) return true;
  if (
    course.ownerEmail &&
    user.email &&
    course.ownerEmail.toLowerCase() === user.email.toLowerCase()
  ) {
    return true;
  }
  return false;
}

export async function ensureSeeded(): Promise<void> {
  if (!db || typeof window === "undefined") return;
  const seeded = localStorage.getItem(SEEDED_KEY);
  const existingSample = await db.courses.get(SAMPLE_COURSE.id);
  if (!seeded || !existingSample) {
    await db.courses.put({
      ...SAMPLE_COURSE,
      isLibrarySample: true,
      ownerName: "BookMind Official",
    });
    localStorage.setItem(SEEDED_KEY, "true");
  }
}

const COURSES_SYNC_TTL_MS = 180_000;
let lastCoursesCloudSyncAt = 0;
let lastSyncedCoursesUserId: string | null = null;
let inFlightGetAllCourses: Promise<Course[]> | null = null;

/**
 * Kiểm tra 2 bản khóa học có cùng gốc (cùng cuốn sách từ Thư viện / cùng sourceId hoặc cùng tên + số chương) hay không.
 */
function isSameSharedBook(a: Course, b: Course): boolean {
  if (!a || !b || !Array.isArray(a.chapters) || !Array.isArray(b.chapters)) {
    return false;
  }
  if (a.id === SYSTEM_AI_CONFIG_COURSE_ID || b.id === SYSTEM_AI_CONFIG_COURSE_ID) {
    return false;
  }
  const sourceA = a.clonedFromCourseId || a.id;
  const sourceB = b.clonedFromCourseId || b.id;
  if (sourceA === sourceB || a.id === sourceB || b.id === sourceA) {
    return true;
  }
  const titleA = (a.title || "").trim().toLowerCase();
  const titleB = (b.title || "").trim().toLowerCase();
  return (
    Boolean(titleA) &&
    titleA === titleB &&
    a.chapters.length > 0 &&
    a.chapters.length === b.chapters.length
  );
}

/**
 * Gộp bài giảng (lesson) đã soạn & phần "Soạn thêm" (từ vựng, ngữ pháp, điền từ, trắc nghiệm, luyện dịch)
 * từ một bản sách cộng đồng (donorCourse) sang bản sách đích (targetCourse) mà vẫn giữ nguyên tiến độ làm bài cá nhân của targetCourse.
 */
function mergeSharedBookChapters(
  targetCourse: Course,
  donorCourse: Course
): { mergedCourse: Course; changed: boolean } {
  if (!isSameSharedBook(targetCourse, donorCourse)) {
    return { mergedCourse: targetCourse, changed: false };
  }

  let changed = false;
  const mergedChapters = targetCourse.chapters.map((tch, idx) => {
    const dch =
      donorCourse.chapters.find((c) => c.index === tch.index) ||
      donorCourse.chapters[idx];
    if (!dch || !dch.isGenerated || !dch.lesson) {
      return tch;
    }

    // Trường hợp 1: Chương bên target chưa soạn bài, nhưng bên donor đã soạn xong -> Đồng bộ nguyên bài giảng sang!
    if (!tch.isGenerated || !tch.lesson) {
      changed = true;
      const { pageImagesBase64: _unused, ...cleanTch } = tch;
      void _unused;
      return {
        ...cleanTch,
        rawText:
          (dch.rawText || "").length > (tch.rawText || "").length
            ? dch.rawText
            : tch.rawText,
        isGenerated: true,
        lesson: JSON.parse(JSON.stringify(dch.lesson)),
      };
    }

    // Trường hợp 2: Cả 2 bên đều đã soạn bài, kiểm tra nếu donor có "Soạn thêm" nhiều từ vựng/bài tập hơn -> Gộp bổ sung!
    const tLesson = tch.lesson;
    const dLesson = dch.lesson;
    let lessonExtended = false;

    const mergedVocab = [...(tLesson.vocabulary || [])];
    const existingWords = new Set(
      mergedVocab.map((v) => (v.word || "").trim().toLowerCase())
    );
    for (const dv of dLesson.vocabulary || []) {
      const key = (dv.word || "").trim().toLowerCase();
      if (key && !existingWords.has(key)) {
        existingWords.add(key);
        mergedVocab.push(JSON.parse(JSON.stringify(dv)));
        lessonExtended = true;
      }
    }

    const mergedCloze = [...(tLesson.clozeExercises || [])];
    const existingClozeSents = new Set(
      mergedCloze.map((c) => (c.sentenceWithBlank || "").trim().toLowerCase())
    );
    for (const dc of dLesson.clozeExercises || []) {
      const key = (dc.sentenceWithBlank || "").trim().toLowerCase();
      if (key && !existingClozeSents.has(key)) {
        existingClozeSents.add(key);
        mergedCloze.push(JSON.parse(JSON.stringify(dc)));
        lessonExtended = true;
      }
    }

    const mergedQuiz = [...(tLesson.quizExercises || [])];
    const existingQuizQuestions = new Set(
      mergedQuiz.map((q) => (q.question || "").trim().toLowerCase())
    );
    for (const dq of dLesson.quizExercises || []) {
      const key = (dq.question || "").trim().toLowerCase();
      if (key && !existingQuizQuestions.has(key)) {
        existingQuizQuestions.add(key);
        mergedQuiz.push(JSON.parse(JSON.stringify(dq)));
        lessonExtended = true;
      }
    }

    const mergedTrans = [...(tLesson.translationExercises || [])];
    const existingTransSents = new Set(
      mergedTrans.map((tr) => (tr.originalSentence || "").trim().toLowerCase())
    );
    for (const dtr of dLesson.translationExercises || []) {
      const key = (dtr.originalSentence || "").trim().toLowerCase();
      if (key && !existingTransSents.has(key)) {
        existingTransSents.add(key);
        mergedTrans.push(JSON.parse(JSON.stringify(dtr)));
        lessonExtended = true;
      }
    }

    if (!lessonExtended) return tch;
    changed = true;
    return {
      ...tch,
      lesson: {
        ...tLesson,
        vocabulary: mergedVocab,
        clozeExercises: mergedCloze,
        quizExercises: mergedQuiz,
        translationExercises: mergedTrans,
      },
    };
  });

  if (!changed) {
    return { mergedCourse: targetCourse, changed: false };
  }

  return {
    mergedCourse: {
      ...targetCourse,
      chapters: mergedChapters,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
  };
}

export async function getAllCourses(forceRefresh = false): Promise<Course[]> {
  if (!db) return [];
  if (!forceRefresh && inFlightGetAllCourses) {
    return inFlightGetAllCourses;
  }

  const run = (async (): Promise<Course[]> => {
    await ensureSeeded();

    const supabase = getSupabaseClient();
    const settings = getAppSettings();
    const user = await getCurrentUser();
    const currentUserId = user?.id || null;

    if (!user) {
      return [];
    }

    // Pull user's own courses + shared library courses from Supabase to auto-merge any chapters generated by other users
    if (
      supabase &&
      settings.autoSyncCloud &&
      (forceRefresh ||
        currentUserId !== lastSyncedCoursesUserId ||
        Date.now() - lastCoursesCloudSyncAt > COURSES_SYNC_TTL_MS)
    ) {
      lastCoursesCloudSyncAt = Date.now();
      lastSyncedCoursesUserId = currentUserId;
      try {
        const { data: allCloudRows } = await supabase
          .from("courses")
          .select("id, data, updated_at")
          .order("updated_at", { ascending: false })
          .limit(120);

        const cloudCourses: Course[] = [];
        if (allCloudRows && allCloudRows.length > 0) {
          for (const row of allCloudRows) {
            if (row.data && row.id !== SYSTEM_AI_CONFIG_COURSE_ID) {
              const courseData = row.data as Course;
              cloudCourses.push(courseData);
              if (isCourseOwnedByUser(courseData, user)) {
                await db.courses.put(courseData);
              }
            }
          }
        }

        // Tự động đồng bộ bài giảng từ Sách gốc / Cộng đồng sang các sách mà user hiện tại đang sở hữu
        const localAll = await db.courses.toArray();
        const myLocalCourses = localAll.filter((c) => isCourseOwnedByUser(c, user));
        for (const myCourse of myLocalCourses) {
          let currentMerged = myCourse;
          let anyMerged = false;
          for (const donor of cloudCourses) {
            if (donor.id === currentMerged.id) continue;
            const res = mergeSharedBookChapters(currentMerged, donor);
            if (res.changed) {
              currentMerged = res.mergedCourse;
              anyMerged = true;
            }
          }
          if (anyMerged) {
            await db.courses.put(currentMerged);
            // Tạo bổ sung Flashcard SRS cho các từ vựng mới được đồng bộ từ cộng đồng
            for (const ch of currentMerged.chapters) {
              if (ch.lesson?.vocabulary) {
                for (const vocab of ch.lesson.vocabulary) {
                  const cardId = `fc-${currentMerged.id}-${ch.id}-${vocab.id}`;
                  const existingCard = await db.flashcards.get(cardId);
                  if (!existingCard) {
                    await db.flashcards.put({
                      id: cardId,
                      userId: user.id,
                      courseId: currentMerged.id,
                      chapterId: ch.id,
                      word: vocab.word,
                      ipa: vocab.ipa,
                      partOfSpeech: vocab.partOfSpeech,
                      cefrLevel: vocab.cefrLevel,
                      vietnameseMeaning: vocab.vietnameseMeaning,
                      explanationInContext: vocab.explanationInContext,
                      quoteFromBook: vocab.quoteFromBook,
                      quoteTranslation: vocab.quoteTranslation,
                      collocations: vocab.collocations || [],
                      interval: 0,
                      repetition: 0,
                      efactor: 2.5,
                      nextReviewDate: new Date().toISOString(),
                    });
                  }
                }
              }
            }
          }
        }
      } catch {
        // Offline fallback to IndexedDB
      }
    }

    const list = await db.courses.toArray();
    // CÔ LẬP TUYỆT ĐỐI THEO TÀI KHOẢN: Chỉ trả về sách thuộc quyền sở hữu của user hiện tại
    const userCourses = list.filter((c) => isCourseOwnedByUser(c, user));
    return userCourses.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  })();

  inFlightGetAllCourses = run;
  try {
    return await run;
  } finally {
    inFlightGetAllCourses = null;
  }
}

// Bộ nhớ đệm ngắn hạn cho Thư viện sách cộng đồng
const LIBRARY_SYNC_TTL_MS = 180_000;
let lastLibrarySyncAt = 0;
let cachedLibraryCourses: Course[] | null = null;
let inFlightGetLibraryCourses: Promise<Course[]> | null = null;

export async function getLibraryCourses(
  forceRefresh = false
): Promise<Course[]> {
  if (!db) return [];
  if (
    !forceRefresh &&
    cachedLibraryCourses &&
    Date.now() - lastLibrarySyncAt < LIBRARY_SYNC_TTL_MS
  ) {
    return cachedLibraryCourses;
  }
  if (!forceRefresh && inFlightGetLibraryCourses) {
    return inFlightGetLibraryCourses;
  }

  const run = (async (): Promise<Course[]> => {
    await ensureSeeded();
    const supabase = getSupabaseClient();
    const settings = getAppSettings();
    const remoteCourses: Course[] = [];

    if (supabase && settings.autoSyncCloud) {
      try {
        const { data, error } = await supabase
          .from("courses")
          .select("id, user_id, title, data, updated_at")
          .order("updated_at", { ascending: false })
          .limit(100);

        if (!error && data && data.length > 0) {
          for (const row of data) {
            if (row.data) {
              const c = row.data as Course;
              if (row.user_id && !c.userId) {
                c.userId = row.user_id;
              }
              remoteCourses.push(c);
            }
          }
        } else if (error) {
          const { data: fallbackData } = await supabase
            .from("courses")
            .select("id, title, data, updated_at")
            .order("updated_at", { ascending: false })
            .limit(100);
          if (fallbackData && fallbackData.length > 0) {
            for (const row of fallbackData) {
              if (row.data) {
                remoteCourses.push(row.data as Course);
              }
            }
          }
        }
      } catch {
        // Ignore network error, use local courses + sample
      }
    }

    const localCourses = await db.courses.toArray();
    const sampleEntry: Course = {
      ...SAMPLE_COURSE,
      isLibrarySample: true,
      ownerName: "BookMind Official",
    };

    // Gộp sách từ Supabase (của mọi user đã tải lên) + sách local + sách mẫu
    const combined = [...remoteCourses, ...localCourses, sampleEntry];

    // Chỉ hiển thị các sách gốc được tải lên (loại bỏ các bản clone có clonedFromCourseId để tránh trùng lặp trong Thư viện)
    const canonicalById = new Map<string, Course>();
    for (const c of combined) {
      if (
        !c ||
        !c.id ||
        c.id === SYSTEM_AI_CONFIG_COURSE_ID ||
        !c.title ||
        !Array.isArray(c.chapters)
      )
        continue;
      if (c.clonedFromCourseId) continue;

      const existing = canonicalById.get(c.id);
      if (!existing) {
        canonicalById.set(c.id, c);
      } else {
        const existingGen = existing.chapters.filter((ch) => ch.isGenerated).length;
        const currentGen = c.chapters.filter((ch) => ch.isGenerated).length;
        if (
          currentGen > existingGen ||
          new Date(c.updatedAt).getTime() > new Date(existing.updatedAt).getTime()
        ) {
          canonicalById.set(c.id, c);
        }
      }
    }

    // Lọc trùng theo (title + author + số chương) nếu cùng 1 sách được đẩy lên nhiều lần
    const uniqueBySignature = new Map<string, Course>();
    for (const c of canonicalById.values()) {
      const sig = `${c.title.trim().toLowerCase()}__${(c.author || "")
        .trim()
        .toLowerCase()}__${c.chapters.length}`;
      const prev = uniqueBySignature.get(sig);
      if (!prev) {
        uniqueBySignature.set(sig, c);
      } else {
        const prevGen = prev.chapters.filter((ch) => ch.isGenerated).length;
        const currGen = c.chapters.filter((ch) => ch.isGenerated).length;
        if (currGen > prevGen) {
          uniqueBySignature.set(sig, c);
        }
      }
    }

    const result = Array.from(uniqueBySignature.values()).sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    cachedLibraryCourses = result;
    lastLibrarySyncAt = Date.now();
    return result;
  })();

  inFlightGetLibraryCourses = run;
  try {
    return await run;
  } finally {
    inFlightGetLibraryCourses = null;
  }
}

const BOOK_STORAGE_BUCKET = "book-chapters";
let storageBucketChecked = false;

async function ensureBookStorageBucket(): Promise<void> {
  if (storageBucketChecked) return;
  const supabase = getSupabaseClient();
  if (!supabase) return;
  storageBucketChecked = true;
  try {
    await supabase.storage.createBucket(BOOK_STORAGE_BUCKET, {
      public: true,
    });
  } catch {
    // Bucket đã tồn tại hoặc được tạo qua SQL
  }
}

export function getCanonicalSourceCourseId(course: Course): string {
  return course.clonedFromCourseId || course.id;
}

export async function uploadCourseRawStorageToCloud(
  course: Course,
  pdfBlob?: Blob | null
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (!supabase || !settings.autoSyncCloud) return false;

  await ensureBookStorageBucket();
  const sourceId = getCanonicalSourceCourseId(course);
  let uploadedAny = false;

  // 1. Đẩy nội dung thô đã trích xuất (bao gồm cả ảnh chụp từng trang nếu là PDF Scan) của từng chương chưa tạo bài học lên Kho A (Storage)
  const { renderPdfPagesToImagesBase64 } = await import("@/lib/pdfParser");

  for (const ch of course.chapters) {
    if (ch.isGenerated && ch.lesson) continue;
    try {
      let chapterImages = ch.pageImagesBase64 || [];
      const textWithoutTags = (ch.rawText || "")
        .replace(/\[Page \d+\]/g, "")
        .trim();

      // Nếu là chương sách Scan (chưa có chữ trong rawText) và có file PDF gốc, tự động cắt trang startPage..endPage thành ảnh nén lưu vào chapter-{index}.json!
      if (
        pdfBlob &&
        chapterImages.length === 0 &&
        (ch.isScannedPages || textWithoutTags.length < 300)
      ) {
        const sp = ch.startPage || 1;
        const ep = ch.endPage || sp + 14;
        chapterImages = await renderPdfPagesToImagesBase64(
          pdfBlob,
          sp,
          ep,
          22
        );
      }

      const payload = JSON.stringify({
        courseId: sourceId,
        chapterIndex: ch.index,
        title: ch.title,
        startPage: ch.startPage,
        endPage: ch.endPage,
        rawText: ch.rawText || "",
        isScannedPages: Boolean(ch.isScannedPages),
        pageImagesBase64: chapterImages,
      });
      const blob = new Blob([payload], { type: "application/json" });
      const { error } = await supabase.storage
        .from(BOOK_STORAGE_BUCKET)
        .upload(`${sourceId}/chapter-${ch.index}.json`, blob, {
          upsert: true,
          contentType: "application/json",
        });
      if (!error) {
        uploadedAny = true;
      }
    } catch {
      // Ignore single chapter upload error
    }
  }

  // 2. Nếu có file PDF gốc (<= 48MB), đẩy lên Kho A (Storage) để user khác máy có thể đọc Vision/OCR các chương chưa tạo
  if (pdfBlob && pdfBlob.size <= 48 * 1024 * 1024) {
    try {
      const { error } = await supabase.storage
        .from(BOOK_STORAGE_BUCKET)
        .upload(`${sourceId}/source.pdf`, pdfBlob, {
          upsert: true,
          contentType: "application/pdf",
        });
      if (!error) {
        uploadedAny = true;
      }
    } catch {
      // Ignore PDF upload error
    }
  }

  invalidateStorageFolderCache(sourceId);
  return uploadedAny;
}

const storageFolderFilesCache = new Map<
  string,
  { files: Set<string>; fetchedAt: number }
>();
const STORAGE_FOLDER_CACHE_TTL_MS = 60_000;

function invalidateStorageFolderCache(sourceId: string): void {
  storageFolderFilesCache.delete(sourceId);
}

/**
 * Kiểm tra danh sách file thực tế đang tồn tại trong thư mục `${sourceId}` trên Supabase Storage (luôn trả về HTTP 200 OK).
 * Giúp ngăn chặn triệt để lỗi đỏ `400 (Bad Request)` trên Console khi gọi `.download(".../source.pdf")` lúc file chưa được tải lên hoặc đã được dọn dẹp.
 */
async function listCourseStorageFiles(sourceId: string): Promise<Set<string>> {
  if (!sourceId || sourceId === "course-sample-habits") return new Set();
  const cached = storageFolderFilesCache.get(sourceId);
  if (cached && Date.now() - cached.fetchedAt < STORAGE_FOLDER_CACHE_TTL_MS) {
    return cached.files;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return new Set();

  try {
    const { data, error } = await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .list(sourceId, { limit: 200 });
    if (error || !Array.isArray(data)) {
      return new Set();
    }
    const files = new Set<string>(
      data.map((item) => item?.name).filter(Boolean) as string[]
    );
    storageFolderFilesCache.set(sourceId, {
      files,
      fetchedAt: Date.now(),
    });
    return files;
  } catch {
    return new Set();
  }
}

export async function fetchChapterRawPayloadFromStorage(
  course: Course,
  chapterIndex: number
): Promise<{
  rawText?: string;
  pageImagesBase64?: string[];
  startPage?: number;
  endPage?: number;
  isScannedPages?: boolean;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const sourceId = getCanonicalSourceCourseId(course);
  const fileName = `chapter-${chapterIndex}.json`;
  try {
    const existingFiles = await listCourseStorageFiles(sourceId);
    if (!existingFiles.has(fileName)) return null;

    const { data, error } = await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .download(`${sourceId}/${fileName}`);
    if (error || !data) return null;
    const text = await data.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function deleteSingleChapterFromStorage(
  sourceCourseId: string,
  chapterIndex: number
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  invalidateStorageFolderCache(sourceCourseId);
  try {
    const existingFiles = await listCourseStorageFiles(sourceCourseId);
    const fileName = `chapter-${chapterIndex}.json`;
    if (!existingFiles.has(fileName)) return;
    await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .remove([`${sourceCourseId}/${fileName}`]);
    invalidateStorageFolderCache(sourceCourseId);
  } catch {
    // Ignore
  }
}

export async function cleanupBookStorageOnAllChaptersGenerated(
  sourceCourseId: string,
  totalChapters: number
): Promise<void> {
  void totalChapters;
  invalidateStorageFolderCache(sourceCourseId);
  if (db) {
    try {
      await db.pdfBlobs.delete(sourceCourseId);
    } catch {
      // Ignore
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    const { data: listData } = await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .list(sourceCourseId, { limit: 200 });

    const pathsToRemove: string[] = [];
    if (Array.isArray(listData)) {
      for (const item of listData) {
        if (item.name) {
          pathsToRemove.push(`${sourceCourseId}/${item.name}`);
        }
      }
    }

    if (pathsToRemove.length > 0) {
      await supabase.storage.from(BOOK_STORAGE_BUCKET).remove(pathsToRemove);
    }
    storageFolderFilesCache.set(sourceCourseId, {
      files: new Set(),
      fetchedAt: Date.now(),
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function applyLibraryCourseToUser(
  libraryCourse: Course
): Promise<Course> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Vui lòng đăng nhập để thêm sách từ Thư viện vào tài khoản!");
  }

  // Kiểm tra xem user đã sở hữu cuốn sách này hoặc đã Apply trước đó chưa
  const myCourses = await getAllCourses();
  const sourceId = libraryCourse.clonedFromCourseId || libraryCourse.id;
  const alreadyOwned = myCourses.find(
    (c) =>
      c.id === libraryCourse.id ||
      c.clonedFromCourseId === sourceId ||
      (c.title.trim().toLowerCase() ===
        libraryCourse.title.trim().toLowerCase() &&
        c.chapters.length === libraryCourse.chapters.length)
  );
  if (alreadyOwned) {
    // Đồng bộ bổ sung các chương đã được cộng đồng tạo mới từ sách thư viện sang bản của user
    let hasNewLessonMerged = false;
    const mergedChapters = alreadyOwned.chapters.map((ch, idx) => {
      if (ch.isGenerated && ch.lesson) return ch;
      const libMatch =
        libraryCourse.chapters.find((lch) => lch.index === ch.index) ||
        libraryCourse.chapters[idx];
      if (libMatch?.isGenerated && libMatch.lesson) {
        hasNewLessonMerged = true;
        return {
          ...ch,
          isGenerated: true,
          lesson: JSON.parse(JSON.stringify(libMatch.lesson)),
        };
      }
      return ch;
    });
    if (hasNewLessonMerged) {
      const syncedCourse: Course = {
        ...alreadyOwned,
        chapters: mergedChapters,
        updatedAt: new Date().toISOString(),
      };
      await saveCourse(syncedCourse);
      return syncedCourse;
    }
    return alreadyOwned;
  }

  const nowIso = new Date().toISOString();
  const newCourseId = `course-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const clonedChapters = libraryCourse.chapters.map((ch, idx) => {
    const newChapterId = `ch-${newCourseId}-${ch.index || idx + 1}`;
    return {
      ...ch,
      id: newChapterId,
      courseId: newCourseId,
      lesson: ch.lesson
        ? JSON.parse(JSON.stringify(ch.lesson))
        : null,
      // Reset tiến độ bài tập để user mới tự làm trên tài khoản của mình
      completedClozeIds: [],
      completedQuizIds: [],
      completedTranslationIds: [],
    };
  });

  const clonedCourse: Course = {
    ...libraryCourse,
    id: newCourseId,
    userId: user.id,
    ownerEmail: user.email,
    ownerName:
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Học viên BookMind",
    clonedFromCourseId: sourceId,
    isLibrarySample: false,
    chapters: clonedChapters,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await saveCourse(clonedCourse);
  // Nếu máy có sẵn file PDF gốc trong IndexedDB, liên kết sang khóa học vừa Apply
  if (db) {
    try {
      const existingPdf = await db.pdfBlobs.get(sourceId);
      if (existingPdf) {
        await db.pdfBlobs.put({
          courseId: newCourseId,
          blob: existingPdf.blob,
          fileName: existingPdf.fileName,
          updatedAt: nowIso,
        });
      }
    } catch {
      // Ignore
    }
  }
  await recordLearningActivity({
    type: "lesson_generated",
    title: `Thêm sách từ Thư viện: ${clonedCourse.title}`,
    details: `Đã kiểm tra và Apply sách (${clonedCourse.chapters.length} chương) vào Tủ sách cá nhân.`,
  });

  return clonedCourse;
}

export async function getCourseById(id: string): Promise<Course | undefined> {
  if (!db) return undefined;
  await ensureSeeded();
  return db.courses.get(id);
}

/**
 * Đồng bộ trực tiếp bài giảng đã soạn của 1 cuốn sách từ Sách gốc / Cộng đồng trên Supabase
 * ngay khi người dùng mở cuốn sách đó trong ChapterWorkspace.
 */
export async function syncCourseLessonsWithCommunity(
  course: Course
): Promise<Course | null> {
  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (!supabase || !settings.autoSyncCloud || !db) return null;

  try {
    const { data: rows } = await supabase
      .from("courses")
      .select("id, data, updated_at")
      .order("updated_at", { ascending: false })
      .limit(120);

    if (!Array.isArray(rows) || rows.length === 0) return null;

    let currentMerged = course;
    let anyChanged = false;

    for (const row of rows) {
      if (
        !row?.data ||
        row.id === course.id ||
        row.id === SYSTEM_AI_CONFIG_COURSE_ID
      ) {
        continue;
      }
      const donor = row.data as Course;
      const res = mergeSharedBookChapters(currentMerged, donor);
      if (res.changed) {
        currentMerged = res.mergedCourse;
        anyChanged = true;
      }
    }

    if (!anyChanged) return null;

    await saveCourse(currentMerged);
    return currentMerged;
  } catch {
    return null;
  }
}

export async function saveCourse(course: Course): Promise<void> {
  if (!db) return;
  const user = await getCurrentUser();
  const userId = user?.id || course.userId;
  const ownerEmail = user?.email || course.ownerEmail;
  const ownerName =
    course.ownerName ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Học viên BookMind";

  const sourceId = getCanonicalSourceCourseId(course);
  const allChaptersGenerated =
    course.chapters.length > 0 &&
    course.chapters.every((ch) => Boolean(ch.isGenerated && ch.lesson));

  // Nếu một chương vừa tạo xong bài học, xóa file nguyên liệu của chương đó trên Storage;
  // Đặc biệt: Nếu TẤT CẢ các chương của sách đã tạo xong bài học -> tự động xóa toàn bộ file sách/chương khỏi Storage!
  if (allChaptersGenerated && !course.storageCleanedUp) {
    void cleanupBookStorageOnAllChaptersGenerated(
      sourceId,
      course.chapters.length
    );
    try {
      await db.pdfBlobs.delete(course.id);
    } catch {
      // Ignore
    }
  } else {
    for (const ch of course.chapters) {
      if (ch.isGenerated && ch.lesson) {
        void deleteSingleChapterFromStorage(sourceId, ch.index);
      }
    }
  }

  const cleanedChapters = course.chapters.map((ch) => {
    if (ch.isGenerated && ch.lesson) {
      // Khi chương đã tạo xong bài học hoàn chỉnh, gỡ bỏ mảng ảnh base64 nặng để Kho B (Database) luôn siêu nhẹ
      const { pageImagesBase64: _unusedImages, ...restChapter } = ch;
      void _unusedImages;
      return restChapter;
    }
    return ch;
  });

  const updated: Course = {
    ...course,
    userId,
    ownerEmail,
    ownerName,
    storageCleanedUp: allChaptersGenerated ? true : course.storageCleanedUp,
    chapters: cleanedChapters,
    updatedAt: new Date().toISOString(),
  };
  await db.courses.put(updated);
  if (cachedLibraryCourses && !updated.clonedFromCourseId) {
    const idx = cachedLibraryCourses.findIndex((c) => c.id === updated.id);
    if (idx !== -1) {
      cachedLibraryCourses[idx] = updated;
    } else {
      cachedLibraryCourses = [updated, ...cachedLibraryCourses];
    }
  }

  // Sync flashcards from generated lessons (strictly scoped to userId)
  for (const ch of updated.chapters) {
    if (ch.lesson && ch.lesson.vocabulary) {
      for (const vocab of ch.lesson.vocabulary) {
        const cardId = `fc-${updated.id}-${ch.id}-${vocab.id}`;
        const existing = await db.flashcards.get(cardId);
        if (!existing) {
          await db.flashcards.put({
            id: cardId,
            userId,
            courseId: updated.id,
            chapterId: ch.id,
            word: vocab.word,
            ipa: vocab.ipa,
            partOfSpeech: vocab.partOfSpeech,
            cefrLevel: vocab.cefrLevel,
            vietnameseMeaning: vocab.vietnameseMeaning,
            explanationInContext: vocab.explanationInContext,
            quoteFromBook: vocab.quoteFromBook,
            quoteTranslation: vocab.quoteTranslation,
            collocations: vocab.collocations || [],
            interval: 0,
            repetition: 0,
            efactor: 2.5,
            nextReviewDate: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Record study activity
  await recordLearningActivity({
    type: "lesson_generated",
    title: `Cập nhật khóa học: ${updated.title}`,
    details: `Đã lưu tiến độ ${updated.chapters.length} chương sách.`,
  });

  // Sync to Supabase Cloud (Kho B: Database)
  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (supabase && settings.autoSyncCloud) {
    try {
      const { error } = await supabase.from("courses").upsert({
        id: updated.id,
        user_id: userId || null,
        title: updated.title,
        data: updated,
        updated_at: updated.updatedAt,
      });
      if (error) {
        // Fallback nếu bảng courses trên Supabase chưa có cột user_id
        await supabase.from("courses").upsert({
          id: updated.id,
          title: updated.title,
          data: updated,
          updated_at: updated.updatedAt,
        });
      }

      // ĐỒNG BỘ CHIA SẺ BÀI HỌC 2 CHIỀU GIỮA SÁCH GỐC THƯ VIỆN & CÁC BẢN SÁCH USER ĐÃ THÊM VÀO:
      // Bất kể User A (chủ sách gốc) hay User B (người thêm sách từ Thư viện) soạn bài mới hoặc "Soạn thêm" từ vựng/bài tập,
      // hệ thống đều tự động đồng bộ bài giảng đó sang Sách gốc VÀ mọi bản sách tương ứng của các User khác trên Supabase!
      if (updated.chapters.some((ch) => ch.isGenerated && ch.lesson)) {
        const { data: allRows } = await supabase
          .from("courses")
          .select("id, data")
          .limit(120);

        if (Array.isArray(allRows)) {
          for (const row of allRows) {
            if (
              !row?.data ||
              row.id === updated.id ||
              row.id === SYSTEM_AI_CONFIG_COURSE_ID
            ) {
              continue;
            }
            const peerCourse = row.data as Course;
            const mergedRes = mergeSharedBookChapters(peerCourse, updated);
            if (mergedRes.changed) {
              const peerAllGenerated =
                mergedRes.mergedCourse.chapters.length > 0 &&
                mergedRes.mergedCourse.chapters.every((ch) =>
                  Boolean(ch.isGenerated && ch.lesson)
                );

              if (peerAllGenerated && !peerCourse.clonedFromCourseId) {
                void cleanupBookStorageOnAllChaptersGenerated(
                  peerCourse.id,
                  mergedRes.mergedCourse.chapters.length
                );
              }

              const updatedPeerCourse: Course = {
                ...mergedRes.mergedCourse,
                storageCleanedUp: peerAllGenerated
                  ? true
                  : peerCourse.storageCleanedUp,
                updatedAt: new Date().toISOString(),
              };

              const { error: peerUpErr } = await supabase
                .from("courses")
                .upsert({
                  id: updatedPeerCourse.id,
                  user_id: updatedPeerCourse.userId || null,
                  title: updatedPeerCourse.title,
                  data: updatedPeerCourse,
                  updated_at: updatedPeerCourse.updatedAt,
                });
              if (peerUpErr) {
                await supabase.from("courses").upsert({
                  id: updatedPeerCourse.id,
                  title: updatedPeerCourse.title,
                  data: updatedPeerCourse,
                  updated_at: updatedPeerCourse.updatedAt,
                });
              }
            }
          }
          cachedLibraryCourses = null;
        }
      }
    } catch {
      // Offline fallback
    }
  }
}

export async function saveCoursePdfBlob(
  courseId: string,
  blob: Blob,
  fileName?: string
): Promise<void> {
  if (!db) return;
  try {
    await db.pdfBlobs.put({
      courseId,
      blob,
      fileName,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Ignore storage quota errors
  }
}

export async function getCoursePdfBlob(
  courseId: string,
  fallbackSourceCourseId?: string
): Promise<Blob | null> {
  if (!db) return null;
  try {
    const entry = await db.pdfBlobs.get(courseId);
    if (entry?.blob) return entry.blob;

    let sourceId = fallbackSourceCourseId;
    let storageCleanedUp = false;
    if (!sourceId) {
      const courseObj = await db.courses.get(courseId);
      sourceId = courseObj?.clonedFromCourseId || courseId;
      storageCleanedUp = Boolean(courseObj?.storageCleanedUp);
    }

    if (sourceId && sourceId !== courseId) {
      const sourceEntry = await db.pdfBlobs.get(sourceId);
      if (sourceEntry?.blob) return sourceEntry.blob;
    }

    if (storageCleanedUp || !sourceId || sourceId === "course-sample-habits") {
      return null;
    }

    // Kiểm tra trước xem file source.pdf có tồn tại trên Kho A (Supabase Storage) không rồi mới tải (tránh lỗi 400 Bad Request trên Console)
    const supabase = getSupabaseClient();
    if (supabase && sourceId) {
      const existingFiles = await listCourseStorageFiles(sourceId);
      if (!existingFiles.has("source.pdf")) {
        return null;
      }

      const { data, error } = await supabase.storage
        .from(BOOK_STORAGE_BUCKET)
        .download(`${sourceId}/source.pdf`);
      if (!error && data) {
        await db.pdfBlobs.put({
          courseId,
          blob: data,
          fileName: `${sourceId}.pdf`,
          updatedAt: new Date().toISOString(),
        });
        return data;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  if (!db) return;
  const existingCourse = await db.courses.get(courseId);
  await db.courses.delete(courseId);
  try {
    await db.pdfBlobs.delete(courseId);
  } catch {
    // Ignore
  }
  lastCoursesCloudSyncAt = 0;
  cachedLibraryCourses = null;
  const cards = await db.flashcards.where("courseId").equals(courseId).toArray();
  await db.flashcards.bulkDelete(cards.map((c) => c.id));

  // Nếu xóa sách gốc, dọn luôn Kho A (Storage) của sách đó
  if (!existingCourse?.clonedFromCourseId) {
    void cleanupBookStorageOnAllChaptersGenerated(
      courseId,
      existingCourse?.chapters.length || 30
    );
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from("courses").delete().eq("id", courseId);
    } catch {
      // Ignore
    }
  }
}

export async function getCourseFlashcards(
  courseId?: string
): Promise<FlashcardSRS[]> {
  if (!db) return [];
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) return [];

  if (courseId) {
    const cards = await db.flashcards.where("courseId").equals(courseId).toArray();
    return cards.filter((f) => !f.userId || f.userId === user.id);
  }

  // Chỉ lấy Flashcards thuộc về các khóa học trong Tủ sách của đúng user hiện tại
  const userCourses = await getAllCourses();
  const ownedCourseIds = new Set(userCourses.map((c) => c.id));
  const allCards = await db.flashcards.toArray();
  return allCards.filter(
    (f) =>
      ownedCourseIds.has(f.courseId) && (!f.userId || f.userId === user.id)
  );
}

export async function updateFlashcard(card: FlashcardSRS): Promise<void> {
  if (!db) return;
  const user = await getCurrentUser();
  const userId = user?.id || card.userId;
  const updatedCard: FlashcardSRS = { ...card, userId };

  await db.flashcards.put(updatedCard);

  // Record streak activity when reviewing flashcards
  await recordLearningActivity({
    type: "vocab_review",
    title: `Ôn từ vựng: ${card.word}`,
    details: `Nghĩa: ${card.vietnameseMeaning} (Chu kỳ nhớ: ${card.interval} ngày)`,
  });

  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (supabase && settings.autoSyncCloud) {
    try {
      await supabase.from("flashcards").upsert({
        id: updatedCard.id,
        user_id: userId || null,
        course_id: updatedCard.courseId,
        data: updatedCard,
        next_review_date: updatedCard.nextReviewDate,
      });
    } catch {
      // Ignore
    }
  }
}

export async function exportAllDataJSON(): Promise<string> {
  const courses = await getAllCourses();
  const flashcards = await getCourseFlashcards();
  const streak = getStudyStreak();
  const activities = getLearningActivities();
  return JSON.stringify(
    {
      version: 2,
      exportedAt: new Date().toISOString(),
      streak,
      activities,
      courses,
      flashcards,
    },
    null,
    2
  );
}

export async function importAllDataJSON(jsonString: string): Promise<number> {
  if (!db) return 0;
  const parsed = JSON.parse(jsonString);
  const courses: Course[] = parsed.courses || (parsed.id ? [parsed] : []);
  const flashcards: FlashcardSRS[] = parsed.flashcards || [];

  if (parsed.streak) {
    localStorage.setItem(STREAK_KEY, JSON.stringify(parsed.streak));
  }
  if (parsed.activities) {
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(parsed.activities));
  }

  for (const c of courses) {
    await saveCourse(c);
  }
  if (flashcards.length > 0) {
    await db.flashcards.bulkPut(flashcards);
  }
  return courses.length;
}
