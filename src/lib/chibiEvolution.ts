import { Course, FlashcardSRS, LearningActivity, StudyStreak } from "@/types/course";

export interface ChibiTier {
  level: number;
  id: "sprout" | "bookworm" | "scholar" | "professor" | "royal";
  title: string;
  subtitle: string;
  minXp: number;
  nextXp: number | null;
  badgeColor: string;
  perkLabel: string;
}

export const CHIBI_TIERS: ChibiTier[] = [
  {
    level: 1,
    id: "sprout",
    title: "Chibi Mầm Non",
    subtitle: "Mới gieo hạt tri thức",
    minXp: 0,
    nextXp: 150,
    badgeColor: "#A7D7A9",
    perkLabel: "Phụ kiện: Mầm xanh",
  },
  {
    level: 2,
    id: "bookworm",
    title: "Chibi Mọt Sách",
    subtitle: "Đọc sách chăm chỉ mỗi ngày",
    minXp: 150,
    nextXp: 400,
    badgeColor: "#B8D8F8",
    perkLabel: "Phụ kiện: Kính tri thức",
  },
  {
    level: 3,
    id: "scholar",
    title: "Chibi Học Giả",
    subtitle: "Thông thạo từ vựng & ngữ pháp",
    minXp: 400,
    nextXp: 800,
    badgeColor: "#C8B6FF",
    perkLabel: "Phụ kiện: Mũ cử nhân",
  },
  {
    level: 4,
    id: "professor",
    title: "Chibi Giáo Sư",
    subtitle: "Bậc thầy luyện dịch & phát âm",
    minXp: 800,
    nextXp: 1500,
    badgeColor: "#F3C969",
    perkLabel: "Phụ kiện: Kính vàng + Nơ đỏ",
  },
  {
    level: 5,
    id: "royal",
    title: "Chibi Hoàng Gia",
    subtitle: "Huyền thoại kỷ luật BookMind",
    minXp: 1500,
    nextXp: null,
    badgeColor: "#F3C969",
    perkLabel: "Phụ kiện: Vương miện kim cương",
  },
];

export interface DailyQuestItem {
  id: "check_in" | "vocab_review" | "study_practice";
  title: string;
  description: string;
  rewardXp: number;
  completed: boolean;
  actionLabel: string;
}

export interface ChibiProgressionState {
  totalXp: number;
  tier: ChibiTier;
  nextTier: ChibiTier | null;
  progressPct: number;
  xpIntoCurrentTier: number;
  xpNeededForNextTier: number;
  dailyQuests: DailyQuestItem[];
  completedQuestCount: number;
  allQuestsDone: boolean;
  bonusClaimedToday: boolean;
}

const CLAIMED_CHESTS_STORAGE_KEY = "bookmind_daily_quest_claimed_dates_v1";

export function getLocalTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getClaimedDailyQuestDates(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CLAIMED_CHESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function claimDailyQuestBonusToday(): string[] {
  if (typeof window === "undefined") return [];
  const today = getLocalTodayIso();
  const existing = getClaimedDailyQuestDates();
  if (existing.includes(today)) return existing;
  const updated = [...existing, today].slice(-365);
  try {
    localStorage.setItem(CLAIMED_CHESTS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
  return updated;
}

function isSameLocalDay(isoTimestamp: string, targetDateStr: string): boolean {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}` === targetDateStr;
}

export function computeChibiProgression(params: {
  streak: StudyStreak;
  activities: LearningActivity[];
  courses: Course[];
  flashcards: FlashcardSRS[];
  claimedDates: string[];
}): ChibiProgressionState {
  const { streak, activities, courses, flashcards, claimedDates } = params;
  const todayStr = getLocalTodayIso();

  // Compute deterministic XP from existing synced progress + claimed daily quest chests
  const masteredVocab = flashcards.filter((f) => f.repetition >= 2).length;
  const completedExercises = courses.reduce(
    (sum, c) =>
      sum +
      c.chapters.reduce(
        (chSum, ch) =>
          chSum +
          ch.completedClozeIds.length +
          ch.completedQuizIds.length +
          ch.completedTranslationIds.length,
        0
      ),
    0
  );

  const totalXp =
    streak.activeDates.length * 40 +
    streak.currentStreak * 25 +
    activities.length * 15 +
    masteredVocab * 5 +
    completedExercises * 10 +
    claimedDates.length * 50;

  let tier = CHIBI_TIERS[0];
  for (const t of CHIBI_TIERS) {
    if (totalXp >= t.minXp) {
      tier = t;
    }
  }
  const tierIdx = CHIBI_TIERS.findIndex((t) => t.id === tier.id);
  const nextTier = tierIdx < CHIBI_TIERS.length - 1 ? CHIBI_TIERS[tierIdx + 1] : null;

  const xpIntoCurrentTier = totalXp - tier.minXp;
  const xpNeededForNextTier = nextTier ? nextTier.minXp - tier.minXp : 0;
  const progressPct = nextTier
    ? Math.min(100, Math.round((xpIntoCurrentTier / Math.max(1, xpNeededForNextTier)) * 100))
    : 100;

  // Evaluate 3 Daily Quests for today
  const todayActivities = activities.filter((a) => isSameLocalDay(a.timestamp, todayStr));
  const checkedInToday =
    streak.activeDates.includes(todayStr) ||
    todayActivities.some((a) => a.type === "check_in");
  const didVocabToday = todayActivities.some((a) => a.type === "vocab_review");
  const didPracticeToday = todayActivities.some(
    (a) =>
      a.type === "lesson_generated" ||
      a.type === "translation_practice" ||
      a.type === "exam_completed"
  );

  const dailyQuests: DailyQuestItem[] = [
    {
      id: "check_in",
      title: "Điểm danh giữ lửa hôm nay",
      description: "Bấm điểm danh hoặc học 1 hoạt động bất kỳ để nối chuỗi",
      rewardXp: 20,
      completed: checkedInToday,
      actionLabel: "Điểm danh",
    },
    {
      id: "vocab_review",
      title: "Ôn tập Flashcard SRS",
      description: "Đánh giá ít nhất 1 thẻ từ vựng trong phòng Ôn tập SRS",
      rewardXp: 30,
      completed: didVocabToday,
      actionLabel: "Ôn Flashcard",
    },
    {
      id: "study_practice",
      title: "Thực chiến Bài học / Dịch / Thi",
      description: "Soạn bài chương mới, luyện dịch AI hoặc làm bài thi",
      rewardXp: 50,
      completed: didPracticeToday,
      actionLabel: "Vào học",
    },
  ];

  const completedQuestCount = dailyQuests.filter((q) => q.completed).length;
  const allQuestsDone = completedQuestCount === dailyQuests.length;
  const bonusClaimedToday = claimedDates.includes(todayStr);

  return {
    totalXp,
    tier,
    nextTier,
    progressPct,
    xpIntoCurrentTier,
    xpNeededForNextTier,
    dailyQuests,
    completedQuestCount,
    allQuestsDone,
    bonusClaimedToday,
  };
}
