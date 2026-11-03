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

class BookLearningDatabase extends Dexie {
  courses!: EntityTable<Course, "id">;
  flashcards!: EntityTable<FlashcardSRS, "id">;

  constructor() {
    super("BookLearningAgentDB");
    this.version(1).stores({
      courses: "id, title, updatedAt",
      flashcards: "id, courseId, chapterId, word, nextReviewDate",
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
  adminPasscode: "admin123",
  resendApiKey: "",
  geminiModel: "gemini-2.5-flash",
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

// Bộ nhớ đệm ngắn hạn (20s) + Chống gọi trùng lặp đồng thời (In-flight Deduplication) cho getCurrentUser()
const USER_CACHE_TTL_MS = 20_000;
let cachedUserResult: { user: AppUser | null; fetchedAt: number } | null = null;
let inFlightGetCurrentUser: Promise<AppUser | null> | null = null;

export function invalidateUserCache(): void {
  cachedUserResult = null;
  inFlightGetCurrentUser = null;
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
        const { data: sessionData, error: sessionErr } =
          await supabase.auth.getSession();
        const session = sessionData?.session;

        if (session) {
          if (typeof window !== "undefined") {
            localStorage.setItem(HAD_SUPABASE_SESSION_KEY, "1");
          }
          const expiresAtMs = (session.expires_at || 0) * 1000;
          if (expiresAtMs > 0 && expiresAtMs <= Date.now()) {
            // Thử refresh token 1 lần, nếu thất bại thì logout bắt đăng nhập lại
            const { data: refreshed, error: refreshErr } =
              await supabase.auth.refreshSession();
            if (refreshErr || !refreshed.session) {
              await triggerSessionExpiredLogout(
                "Phiên đăng nhập Supabase đã hết hạn. Vui lòng đăng nhập lại!"
              );
              return null;
            }
          }

          const { data: userData, error: userErr } =
            await supabase.auth.getUser();
          if (userErr || !userData?.user) {
            await triggerSessionExpiredLogout(
              "Phiên xác thực đã hết hạn hoặc không còn hợp lệ. Vui lòng đăng nhập lại!"
            );
            return null;
          }

          const appUser = userData.user as unknown as AppUser;
          appUser.expiresAt =
            (session.expires_at || 0) * 1000 || Date.now() + SESSION_TTL_MS;
          cachedUserResult = { user: appUser, fetchedAt: Date.now() };
          return appUser;
        } else if (
          sessionErr ||
          (typeof window !== "undefined" &&
            localStorage.getItem(HAD_SUPABASE_SESSION_KEY) === "1")
        ) {
          await triggerSessionExpiredLogout(
            "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục!"
          );
          return null;
        }
      } catch {
        // Supabase fetch failed or network offline
      }
    }

    // Fallback to local profile with strict session expiration check
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(LOCAL_USER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as AppUser;
          if (!parsed.expiresAt) {
            parsed.expiresAt = Date.now() + SESSION_TTL_MS;
            localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(parsed));
          } else if (Date.now() > parsed.expiresAt) {
            await triggerSessionExpiredLogout(
              "Phiên đăng nhập của bạn đã hết hạn (quá 12 giờ). Vui lòng đăng nhập lại để bảo mật tài khoản!"
            );
            return null;
          }
          cachedUserResult = { user: parsed, fetchedAt: Date.now() };
          return parsed;
        }
      } catch {
        return null;
      }
    }

    cachedUserResult = { user: null, fetchedAt: Date.now() };
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
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      error: new Error(
        "Chưa cấu hình Supabase URL hoặc Anon Key trong Cài đặt để dùng Google Auth."
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
          prompt: "consent",
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

export async function signInWithEmailPassword(
  email: string,
  pass: string,
  isSignUp = false
): Promise<{ user: AppUser | null; error: Error | null }> {
  invalidateUserCache();
  lastCoursesCloudSyncAt = 0;
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: {
              full_name: email.split("@")[0],
            },
          },
        });
        if (error) return { user: null, error: new Error(error.message) };
        const appUser = data.user as unknown as AppUser;
        cachedUserResult = { user: appUser, fetchedAt: Date.now() };
        return { user: appUser, error: null };
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) return { user: null, error: new Error(error.message) };
        const appUser = data.user as unknown as AppUser;
        cachedUserResult = { user: appUser, fetchedAt: Date.now() };
        return { user: appUser, error: null };
      }
    } catch (err) {
      return {
        user: null,
        error: err instanceof Error ? err : new Error("Lỗi xác thực Supabase"),
      };
    }
  }

  // If Supabase not connected, create a local session
  const localUser = signInWithLocalProfile(email.split("@")[0], email);
  return { user: localUser, error: null };
}

export function signInWithLocalProfile(
  name: string,
  email?: string
): AppUser {
  const cleanName = name.trim() || "Học viên BookMind";
  const user: AppUser = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    email: email?.trim() || `${cleanName.toLowerCase().replace(/\s+/g, "")}@local.user`,
    expiresAt: Date.now() + SESSION_TTL_MS,
    user_metadata: {
      full_name: cleanName,
      avatar_url: "",
    },
    app_metadata: {
      provider: "local",
    },
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  }
  cachedUserResult = { user, fetchedAt: Date.now() };
  return user;
}

export async function signOutUser(): Promise<void> {
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
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_USER_KEY);
    localStorage.removeItem(HAD_SUPABASE_SESSION_KEY);
  }
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

const COURSES_SYNC_TTL_MS = 20_000;
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
const LIBRARY_SYNC_TTL_MS = 20_000;
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

  const updated: Course = {
    ...course,
    userId,
    ownerEmail,
    ownerName,
    updatedAt: new Date().toISOString(),
  };
  await db.courses.put(updated);
  lastCoursesCloudSyncAt = 0;
  cachedLibraryCourses = null;

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

  // Sync to Supabase Cloud with user_id
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
    } catch {
      // Offline fallback
    }
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  if (!db) return;
  await db.courses.delete(courseId);
  lastCoursesCloudSyncAt = 0;
  cachedLibraryCourses = null;
  const cards = await db.flashcards.where("courseId").equals(courseId).toArray();
  await db.flashcards.bulkDelete(cards.map((c) => c.id));

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
