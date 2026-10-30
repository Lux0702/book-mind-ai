import Dexie, { type EntityTable } from "dexie";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { AppSettings, Course, FlashcardSRS } from "@/types/course";
import { SAMPLE_COURSE, SAMPLE_FLASHCARDS } from "./sampleData";

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

function getSupabaseClient(): SupabaseClient | null {
  const settings = getAppSettings();
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null;
  try {
    return createClient(settings.supabaseUrl, settings.supabaseAnonKey);
  } catch {
    return null;
  }
}

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

  // If Supabase is configured, try pulling remote updates first
  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (supabase && settings.autoSyncCloud) {
    try {
      const { data, error } = await supabase
        .from("courses")
        .select("id, data, updated_at")
        .order("updated_at", { ascending: false });
      if (!error && data && data.length > 0) {
        for (const row of data) {
          if (row.data) {
            await db.courses.put(row.data as Course);
          }
        }
      }
    } catch {
      // Offline or table not created yet — fallback seamlessly to IndexedDB
    }
  }

  const list = await db.courses.toArray();
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
  const updated: Course = {
    ...course,
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

  // Sync to Supabase Cloud if enabled
  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (supabase && settings.autoSyncCloud) {
    try {
      await supabase.from("courses").upsert({
        id: updated.id,
        title: updated.title,
        data: updated,
        updated_at: updated.updatedAt,
      });
    } catch {
      // Ignore network/table error so local experience never breaks
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
  await db.flashcards.put(card);

  const supabase = getSupabaseClient();
  const settings = getAppSettings();
  if (supabase && settings.autoSyncCloud) {
    try {
      await supabase.from("flashcards").upsert({
        id: card.id,
        course_id: card.courseId,
        data: card,
        next_review_date: card.nextReviewDate,
      });
    } catch {
      // Ignore
    }
  }
}

export async function exportAllDataJSON(): Promise<string> {
  const courses = await getAllCourses();
  const flashcards = await getCourseFlashcards();
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
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

  for (const c of courses) {
    await saveCourse(c);
  }
  if (flashcards.length > 0) {
    await db.flashcards.bulkPut(flashcards);
  }
  return courses.length;
}
