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

export const DEFAULT_SETTINGS: AppSettings = {
  geminiApiKey: "",
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
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        return data.user as unknown as AppUser;
      }
    } catch {
      // Supabase fetch failed or network offline
    }
  }

  // Fallback to local profile
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(LOCAL_USER_KEY);
      if (raw) {
        return JSON.parse(raw) as AppUser;
      }
    } catch {
      return null;
    }
  }

  return null;
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
        return { user: data.user as unknown as AppUser, error: null };
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: pass,
        });
        if (error) return { user: null, error: new Error(error.message) };
        return { user: data.user as unknown as AppUser, error: null };
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
  return user;
}

export async function signOutUser(): Promise<void> {
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

export function getStudyStreak(): StudyStreak {
  if (typeof window === "undefined") {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: "", activeDates: [] };
  }
  const raw = localStorage.getItem(STREAK_KEY);
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
    localStorage.setItem(STREAK_KEY, JSON.stringify(updatedStreak));

    // Save activity log
    const user = await getCurrentUser();
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
    localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(updatedLogs));

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
    const raw = localStorage.getItem(ACTIVITIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// -------------------------------------------------------------
// COURSE & FLASHCARD STORAGE (WITH USER ISOLATION)
// -------------------------------------------------------------

export async function ensureSeeded(): Promise<void> {
  if (!db || typeof window === "undefined") return;
  const seeded = localStorage.getItem(SEEDED_KEY);
  const existingCount = await db.courses.count();
  if (!seeded && existingCount === 0) {
    await db.courses.put(SAMPLE_COURSE);
    await db.flashcards.bulkPut(SAMPLE_FLASHCARDS);
    localStorage.setItem(SEEDED_KEY, "true");
  }
}

export async function getAllCourses(): Promise<Course[]> {
  if (!db) return [];
  await ensureSeeded();

  // If Supabase is configured, try pulling remote updates
  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  const user = await getCurrentUser();

  if (supabase && settings.autoSyncCloud) {
    try {
      let query = supabase
        .from("courses")
        .select("id, user_id, data, updated_at")
        .order("updated_at", { ascending: false });

      // If user is logged in, prioritize their isolated courses
      if (user) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        for (const row of data) {
          if (row.data) {
            await db.courses.put(row.data as Course);
          }
        }
      }
    } catch {
      // Offline fallback to IndexedDB
    }
  }

  const list = await db.courses.toArray();
  // If user is logged in, filter courses belonging to user or created locally
  if (user) {
    const userCourses = list.filter((c) => !c.userId || c.userId === user.id);
    return userCourses.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  return list.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
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

  const updated: Course = {
    ...course,
    userId,
    updatedAt: new Date().toISOString(),
  };
  await db.courses.put(updated);

  // Sync flashcards from generated lessons
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
      await supabase.from("courses").upsert({
        id: updated.id,
        user_id: userId || null,
        title: updated.title,
        data: updated,
        updated_at: updated.updatedAt,
      });
    } catch {
      // Offline fallback
    }
  }
}

export async function deleteCourse(courseId: string): Promise<void> {
  if (!db) return;
  await db.courses.delete(courseId);
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
  if (courseId) {
    return db.flashcards.where("courseId").equals(courseId).toArray();
  }
  return db.flashcards.toArray();
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
