export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface ContentBreakdownSection {
  id: string;
  sectionTitle: string;
  originalExcerpt: string;
  vietnameseTranslation: string;
  deepExplanation: string;
  stylisticOrContextNotes: string;
}

export interface GrammarPoint {
  id: string;
  title: string;
  patternFormula: string;
  quoteFromBook: string;
  quoteTranslation: string;
  detailedExplanation: string;
  whyAuthorUsedIt: string;
  extraExamples: {
    en: string;
    vi: string;
  }[];
}

export interface VocabularyItem {
  id: string;
  word: string;
  ipa: string;
  partOfSpeech: string;
  cefrLevel: CEFRLevel;
  vietnameseMeaning: string;
  explanationInContext: string;
  quoteFromBook: string;
  quoteTranslation: string;
  collocations: string[];
  synonyms: string[];
}

export interface ClozeExercise {
  id: string;
  sentenceWithBlank: string; // Use "_____" for the blank
  answer: string;
  hint: string;
  fullSentenceTranslation: string;
  explanation: string;
}

export interface QuizExercise {
  id: string;
  question: string;
  category: "vocabulary" | "grammar" | "comprehension";
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TranslationEvaluation {
  overallScore: number; // 0 - 100
  semanticAccuracy: number; // 0 - 100
  grammarAndStructure: number; // 0 - 100
  naturalnessAndTone: number; // 0 - 100
  userTranslation: string;
  strengths: string[];
  improvements: string[];
  suggestedTranslation: string;
  wordByWordBreakdown: {
    sourcePhrase: string;
    userRendered: string;
    betterChoice: string;
    note: string;
  }[];
  evaluatedAt: string;
}

export interface TranslationExercise {
  id: string;
  originalSentence: string;
  direction: "EN_TO_VI" | "VI_TO_EN";
  contextHint: string;
  targetGrammarOrVocab: string[];
  referenceTranslation: string;
  lastEvaluation?: TranslationEvaluation;
}

export interface ChapterLesson {
  chapterTitle: string;
  overview: {
    summary: string;
    keyThemes: string[];
    learningObjectives: string[];
  };
  contentAnalysis: ContentBreakdownSection[];
  grammarPoints: GrammarPoint[];
  vocabulary: VocabularyItem[];
  clozeExercises: ClozeExercise[];
  quizExercises: QuizExercise[];
  translationExercises: TranslationExercise[];
  generatedAt: string;
}

export interface ChapterUnit {
  id: string;
  courseId: string;
  index: number;
  title: string;
  summary: string;
  startPage?: number;
  endPage?: number;
  rawText: string;
  isScannedPages?: boolean;
  pageImagesBase64?: string[]; // Used if PDF pages are scanned images without selectable text
  isGenerated: boolean;
  lesson: ChapterLesson | null;
  completedClozeIds: string[];
  completedQuizIds: string[];
  completedTranslationIds: string[];
}

export interface FlashcardSRS {
  id: string;
  userId?: string;
  courseId: string;
  chapterId: string;
  word: string;
  ipa: string;
  partOfSpeech: string;
  cefrLevel: CEFRLevel;
  vietnameseMeaning: string;
  explanationInContext: string;
  quoteFromBook: string;
  quoteTranslation: string;
  collocations: string[];
  // SM-2 Spaced Repetition fields
  interval: number; // in days
  repetition: number;
  efactor: number; // default 2.5
  nextReviewDate: string; // ISO date
  lastReviewedAt?: string;
}

export interface Course {
  id: string;
  userId?: string;
  ownerEmail?: string;
  ownerName?: string;
  clonedFromCourseId?: string;
  isLibrarySample?: boolean;
  title: string;
  author: string;
  description: string;
  targetLanguage: string;
  level: string;
  coverGradient: string;
  sourceFileName?: string;
  sourceFileSizeMB?: number;
  totalPages?: number;
  hasCloudPdf?: boolean;
  storageCleanedUp?: boolean;
  chapters: ChapterUnit[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyStreak {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD
  activeDates: string[]; // List of YYYY-MM-DD dates with learning activities
}

export interface LearningActivity {
  id: string;
  userId?: string;
  type: "vocab_review" | "exam_completed" | "lesson_generated" | "translation_practice" | "check_in";
  title: string;
  details: string;
  timestamp: string;
}

export type PlanTier = "free" | "pro" | "unlimited";

export type UserRole = "user" | "admin";

export interface UserQuotaAccount {
  userId: string;
  email: string;
  name: string;
  role?: UserRole; // Phân quyền: "user" (Học viên) hoặc "admin" (Quản trị viên)
  plan: PlanTier;
  issuedApiKey: string; // Mã định danh gói dịch vụ (Subscription Reference Code) gắn tự động vào tài khoản
  activatedApiKey: string;
  isKeyActivated: boolean;
  usedCalls: number; // Số AI Credit đã sử dụng trong ngày hôm nay
  totalCalls?: number; // Tổng số AI Credit đã tiêu thụ tích lũy từ khi tạo tài khoản
  maxCalls: number; // 30 Credit/ngày (free), 120 Credit/ngày (pro), 500 Credit/ngày (VIP Fair Usage Policy)
  fupDailyLimit?: number; // Ngưỡng Fair Usage Policy cho gói VIP (mặc định 500 Credit/ngày)
  lastResetDate?: string; // YYYY-MM-DD để tự động reset Credit mỗi ngày
  isLocked?: boolean; // Admin có thể khóa/mở khóa quyền gọi AI của user
  createdAt: string;
  updatedAt: string;
}

export interface AiUsageLogItem {
  id: string;
  idempotencyKey: string;
  userEmail: string;
  endpoint: string;
  taskLabel: string;
  creditsCharged: number;
  status: "success" | "failed_refunded" | "rate_limited";
  refunded: boolean;
  retryCount: number;
  latencyMs: number;
  errorMessage?: string;
  createdAt: string;
}

export interface PaymentTransaction {
  id: string;
  orderCode: string;
  userEmail: string;
  userName: string;
  plan: PlanTier;
  amountVnd: number;
  amountFormatted: string;
  paymentMethod: "momo" | "vnpay";
  assignedApiKey: string;
  createdAt: string;
}

export interface VirtualEmailItem {
  id: string;
  toEmail: string;
  toName: string;
  subject: string;
  plan: PlanTier;
  apiKey: string;
  maxCalls: number;
  createdAt: string;
  isRead: boolean;
  paymentMethod?: "register" | "momo" | "vnpay";
  amountFormatted?: string;
  orderCode?: string;
  realEmailSent?: boolean;
}

export interface AppSettings {
  geminiApiKey: string; // Mã BookMind Virtual Key (BM-FREE-..., BM-PRO-..., BM-VIP-...)
  masterGeminiApiKey?: string; // Master Google Gemini API Key (AIzaSy...) của chủ hệ thống
  groqApiKey?: string; // Groq Cloud API Key (gsk_...)
  openRouterApiKey?: string; // OpenRouter API Key (sk-or-v1-...)
  siliconFlowApiKey?: string; // SiliconFlow API Key (sk-...)
  adminPasscode?: string; // Mật khẩu bảo vệ trang Quản trị /admin (mặc định: admin123)
  resendApiKey?: string; // Resend API Key (tùy chọn để gửi email thật)
  geminiModel: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSyncCloud: boolean;
}

export interface PronunciationEvaluation {
  expectedText: string;
  spokenText: string;
  overallScore: number; // 0 - 100%
  accuracyGrade: "Xuất sắc (Native-like)" | "Tốt (Good)" | "Khá (Fair)" | "Cần cải thiện (Needs Work)";
  correctWords: string[];
  mispronouncedWords: {
    word: string;
    expectedPhonetic?: string;
    detectedSound?: string;
    issue: string;
    tip: string;
  }[];
  fluencyScore: number;
  completenessScore: number;
  generalFeedback: string;
  evaluatedAt: string;
}
