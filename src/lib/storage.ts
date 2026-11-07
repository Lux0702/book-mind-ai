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

export function saveAppSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

export function getStudyStreak(): StudyStreak {
  if (typeof window === "undefined") {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
  const scopedKey = getActiveUserScopeKey(STREAK_KEY);
  const raw = localStorage.getItem(scopedKey);
  if (!raw) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
  try {
    const data: StudyStreak = JSON.parse(raw);
    const today = getTodayString();
    const yesterday = getYesterdayString();

    // If last active was before yesterday, streak is reset to 0 unless renewed today
    if (
      data.lastActiveDate &&
      data.lastActiveDate !== today &&
      data.lastActiveDate !== yesterday
    ) {
      return {
        ...data,
        currentStreak: 0,
      };
    }
    return data;
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
}

export async function recordLearningActivity(activity: {
  type: LearningActivity["type"];
  title: string;
  details: string;
}): Promise<StudyStreak> {
  const user = await getCurrentUser();
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const currentStreakData = getStudyStreak();

  let newCurrent = currentStreakData.currentStreak;
  if (!currentStreakData.lastActiveDate) {
    newCurrent = 1;
  } else if (currentStreakData.lastActiveDate === today) {
    // Already counted today
    newCurrent = Math.max(1, newCurrent);
  } else if (currentStreakData.lastActiveDate === yesterday) {
    newCurrent += 1;
  } else {
    // Streak broken, start fresh
    newCurrent = 1;
  }

  const newLongest = Math.max(currentStreakData.longestStreak, newCurrent);
  const updatedDates = Array.from(
    new Set([...currentStreakData.activeDates, today])
  );

  const updatedStreak: StudyStreak = {
    currentStreak: newCurrent,
    longestStreak: newLongest,
    lastActiveDate: today,
    activeDates: updatedDates,
  };

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
    const updatedLogs = [newLog, ...existingLogs].slice(0, 80); // keep last 80 events
    localStorage.setItem(scopedActivitiesKey, JSON.stringify(updatedLogs));

    // Sync progress to Supabase if user is logged in
    const supabase = getSupabaseClient();
    if (supabase && user) {
      try {
        await supabase.from("user_progress").upsert({
          user_id: user.id,
          streak_data: updatedStreak,
          activity_logs: updatedLogs,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Table not ready or network offline
      }
    }
  }

  return updatedStreak;
}

export function getLearningActivities(): LearningActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const scopedActivitiesKey = getActiveUserScopeKey(ACTIVITIES_KEY);
    const raw = localStorage.getItem(scopedActivitiesKey);
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
  if (!user) return false;
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

    // Pull user's own courses from Supabase (or immediately if user switched accounts)
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
        const { data, error } = await supabase
          .from("courses")
          .select("id, user_id, data, updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (!error && data && data.length > 0) {
          for (const row of data) {
            if (row.data) {
              const courseData = row.data as Course;
              if (row.user_id && !courseData.userId) {
                courseData.userId = row.user_id;
              }
              await db.courses.put(courseData);
            }
          }
        } else if (error) {
          // Fallback nếu bảng courses chưa có cột user_id: lọc theo JSONB data.userId
          const { data: fallbackData } = await supabase
            .from("courses")
            .select("id, data, updated_at")
            .order("updated_at", { ascending: false });
          if (fallbackData && fallbackData.length > 0) {
            for (const row of fallbackData) {
              if (row.data) {
                const courseData = row.data as Course;
                if (isCourseOwnedByUser(courseData, user)) {
                  await db.courses.put(courseData);
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
      if (!c || !c.id || !c.title) continue;
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

  return uploadedAny;
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
  try {
    const { data, error } = await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .download(`${sourceId}/chapter-${chapterIndex}.json`);
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
  try {
    await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .remove([`${sourceCourseId}/chapter-${chapterIndex}.json`]);
  } catch {
    // Ignore
  }
}

export async function cleanupBookStorageOnAllChaptersGenerated(
  sourceCourseId: string,
  totalChapters: number
): Promise<void> {
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
    const pathsToRemove = new Set<string>([`${sourceCourseId}/source.pdf`]);
    for (let i = 1; i <= Math.max(totalChapters, 50); i++) {
      pathsToRemove.add(`${sourceCourseId}/chapter-${i}.json`);
    }

    const { data: listData } = await supabase.storage
      .from(BOOK_STORAGE_BUCKET)
      .list(sourceCourseId, { limit: 200 });

    if (Array.isArray(listData)) {
      for (const item of listData) {
        if (item.name) {
          pathsToRemove.add(`${sourceCourseId}/${item.name}`);
        }
      }
    }

    const allPaths = Array.from(pathsToRemove);
    if (allPaths.length > 0) {
      await supabase.storage.from(BOOK_STORAGE_BUCKET).remove(allPaths);
    }
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

      // ĐỒNG BỘ CHIA SẺ BÀI HỌC VỀ SÁCH GỐC TRÊN KHO B:
      // Nếu đây là sách được User khác Apply (có clonedFromCourseId), khi User này tạo mới bài học ở chương bất kỳ,
      // tự động cập nhật luôn bài học chương đó vào sách gốc trên Kho B để mọi User khác cùng hưởng và kiểm tra xóa Kho A!
      if (
        updated.clonedFromCourseId &&
        updated.clonedFromCourseId !== updated.id &&
        updated.chapters.some((ch) => ch.isGenerated && ch.lesson)
      ) {
        const { data: sourceRow } = await supabase
          .from("courses")
          .select("id, user_id, title, data")
          .eq("id", updated.clonedFromCourseId)
          .maybeSingle();

        if (sourceRow?.data) {
          const sourceCourse = sourceRow.data as Course;
          let sourceChanged = false;
          const mergedSourceChapters = sourceCourse.chapters.map((sch, idx) => {
            const matchingCloneCh =
              updated.chapters.find((uch) => uch.index === sch.index) ||
              updated.chapters[idx];
            if (
              (!sch.isGenerated || !sch.lesson) &&
              matchingCloneCh?.isGenerated &&
              matchingCloneCh.lesson
            ) {
              sourceChanged = true;
              const { pageImagesBase64: _unused, ...cleanSch } = sch;
              void _unused;
              return {
                ...cleanSch,
                rawText: matchingCloneCh.rawText || sch.rawText,
                isGenerated: true,
                lesson: JSON.parse(JSON.stringify(matchingCloneCh.lesson)),
              };
            }
            return sch;
          });

          if (sourceChanged) {
            const sourceAllGenerated =
              mergedSourceChapters.length > 0 &&
              mergedSourceChapters.every((ch) =>
                Boolean(ch.isGenerated && ch.lesson)
              );

            if (sourceAllGenerated) {
              void cleanupBookStorageOnAllChaptersGenerated(
                sourceCourse.id,
                mergedSourceChapters.length
              );
            }

            const updatedSourceCourse: Course = {
              ...sourceCourse,
              storageCleanedUp: sourceAllGenerated
                ? true
                : sourceCourse.storageCleanedUp,
              chapters: mergedSourceChapters,
              updatedAt: new Date().toISOString(),
            };

            await supabase.from("courses").upsert({
              id: updatedSourceCourse.id,
              user_id: sourceRow.user_id || updatedSourceCourse.userId || null,
              title: updatedSourceCourse.title,
              data: updatedSourceCourse,
              updated_at: updatedSourceCourse.updatedAt,
            });
            cachedLibraryCourses = null;
          }
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
    if (!sourceId) {
      const courseObj = await db.courses.get(courseId);
      sourceId = courseObj?.clonedFromCourseId || courseId;
    }

    if (sourceId && sourceId !== courseId) {
      const sourceEntry = await db.pdfBlobs.get(sourceId);
      if (sourceEntry?.blob) return sourceEntry.blob;
    }

    // Tự động tải file PDF từ Kho A (Supabase Storage) nếu User khác đang mở trên máy mới
    const supabase = getSupabaseClient();
    if (supabase && sourceId) {
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
