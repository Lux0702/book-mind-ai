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
  title: string;
  author: string;
  description: string;
  targetLanguage: string;
  level: string;
  coverGradient: string;
  sourceFileName?: string;
  sourceFileSizeMB?: number;
  totalPages?: number;
  chapters: ChapterUnit[];
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  autoSyncCloud: boolean;
}
