"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  GraduationCap,
  Layers,
  CheckCircle2,
  HelpCircle,
  Languages,
  Volume2,
  Send,
  Loader2,
  AlertCircle,
  Lightbulb,
  Check,
  XCircle,
  MessageSquare,
  FileText,
  Trash2,
  Trophy,
  Mic,
  Camera,
  Target,
  Feather,
  Link2,
  Tag,
  Wrench,
  Plus,
} from "lucide-react";
import {
  Course,
  ChapterUnit,
  FlashcardSRS,
  TranslationEvaluation,
} from "@/types/course";
import {
  getAppSettings,
  saveAppSettings,
  saveCourse,
  getCoursePdfBlob,
  saveCoursePdfBlob,
} from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import {
  renderPdfPagesToImagesBase64,
  convertUploadedFilesToImagesBase64,
  runLocalBrowserOcrOnImages,
} from "@/lib/pdfParser";
import { speakSmart, stopAllSpeech } from "@/lib/tts";
import AudioSpeakButton from "./AudioSpeakButton";
import LessonGeneratingLoader from "./loadings/LessonGeneratingLoader";
import TutorThinkingLoader from "./loadings/TutorThinkingLoader";
import TranslationEvaluatingLoader from "./loadings/TranslationEvaluatingLoader";
import VocabScanningLoader from "./loadings/VocabScanningLoader";
import FlashcardArena from "./FlashcardArena";
import ExamArena from "./ExamArena";
import PronunciationModal from "./PronunciationModal";

interface ChapterWorkspaceProps {
  course: Course;
  flashcards: FlashcardSRS[];
  onBackToDashboard: () => void;
  onCourseUpdated: (updated: Course) => Promise<void>;
  onOpenSettings: () => void;
}

type ActiveTab =
  | "content"
  | "grammar"
  | "vocabulary"
  | "practice"
  | "translation"
  | "exam_arena";

export default function ChapterWorkspace({
  course,
  flashcards,
  onBackToDashboard,
  onCourseUpdated,
  onOpenSettings,
}: ChapterWorkspaceProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(
    course.chapters[0]?.id || ""
  );
  const [activeTab, setActiveTab] = useState<ActiveTab>("content");
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [isExtractingFullVocab, setIsExtractingFullVocab] = useState(false);
  const [isSupplementingExercises, setIsSupplementingExercises] = useState(false);
  const [isRedetectingToc, setIsRedetectingToc] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Cloze state
  const [clozeInputs, setClozeInputs] = useState<Record<string, string>>({});
  const [clozeChecked, setClozeChecked] = useState<Record<string, boolean>>({});
  const [showClozeHint, setShowClozeHint] = useState<Record<string, boolean>>(
    {}
  );

  // Quiz state
  const [quizSelected, setQuizSelected] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>(
    {}
  );

  // Translation state
  const [translationInputs, setTranslationInputs] = useState<
    Record<string, string>
  >({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Ask Tutor state
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorAnswer, setTutorAnswer] = useState<string | null>(null);
  const [isAskingTutor, setIsAskingTutor] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [editableRawText, setEditableRawText] = useState("");

  // Pronunciation Coach Modal state
  const [pronounceModalData, setPronounceModalData] = useState<{
    isOpen: boolean;
    targetText: string;
    phonetic?: string;
    vietnameseMeaning?: string;
    contextHint?: string;
  }>({
    isOpen: false,
    targetText: "",
  });

  const currentChapter: ChapterUnit | undefined =
    course.chapters.find((c) => c.id === selectedChapterId) ||
    course.chapters[0];

  const [useHybridVision, setUseHybridVision] = useState<boolean>(true);
  const [hasCachedPdf, setHasCachedPdf] = useState<boolean>(false);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(() => {
    if (typeof window === "undefined") return "qwen-groq";
    return getAppSettings().geminiModel || "qwen-groq";
  });
  const [ocrEngineMode, setOcrEngineMode] = useState<
    "local_tesseract" | "micro_batch_ai"
  >("local_tesseract");
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [isRunningStandaloneOcr, setIsRunningStandaloneOcr] =
    useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    getCoursePdfBlob(course.id).then((pdfBlob) => {
      if (mounted) {
        setHasCachedPdf(Boolean(pdfBlob));
      }
    });
    return () => {
      mounted = false;
    };
  }, [course.id]);

  useEffect(() => {
    if (!currentChapter) return;
    const rawNoTags = currentChapter.rawText
      .replace(/--- \[Page \d+\] ---/g, "")
      .trim();
    // Only auto-enable OCR pre-scan if the chapter has almost no text (< 180 chars)
    setUseHybridVision(rawNoTags.length < 180);
  }, [currentChapter?.id]);

  const chapterFlashcards = flashcards.filter(
    (f) => f.chapterId === currentChapter?.id
  );

  // Automatically stop speech when switching learning tabs, chapters, or leaving
  useEffect(() => {
    stopAllSpeech();
    return () => {
      stopAllSpeech();
    };
  }, [activeTab, selectedChapterId]);

  const speakEnglish = (text: string) => {
    speakSmart(text);
  };

  const openPronunciationCoach = (params: {
    targetText: string;
    phonetic?: string;
    vietnameseMeaning?: string;
    contextHint?: string;
  }) => {
    stopAllSpeech();
    setPronounceModalData({
      isOpen: true,
      ...params,
    });
  };

  const handleDeleteChapterFromCourse = async (
    chapterIdToDelete: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    if (course.chapters.length <= 1) {
      window.alert("Khóa học cần có ít nhất 1 chương.");
      return;
    }
    const remaining = course.chapters
      .filter((c) => c.id !== chapterIdToDelete)
      .map((c, idx) => ({ ...c, index: idx + 1 }));

    const updatedCourse: Course = {
      ...course,
      chapters: remaining,
      updatedAt: new Date().toISOString(),
    };
    await saveCourse(updatedCourse);
    await onCourseUpdated(updatedCourse);
    if (selectedChapterId === chapterIdToDelete) {
      setSelectedChapterId(remaining[0]?.id || "");
    }
  };

  const handleRedetectCourseTocFromSidebar = async () => {
    setIsRedetectingToc(true);
    setGenError(null);
    try {
      const pdfBlob = await getCoursePdfBlob(course.id);
      if (!pdfBlob) {
        throw new Error(
          "Không tìm thấy file PDF gốc trong bộ nhớ trình duyệt. Hãy tạo lại khóa học hoặc chọn lại file PDF."
        );
      }

      const maxPage =
        course.totalPages ||
        Math.max(...course.chapters.map((c) => c.endPage || 15), 30);
      const startTocPage = maxPage > 2 ? 2 : 1;
      const endTocPage = Math.min(startTocPage + 9, maxPage);

      const tocImagesBase64 = await renderPdfPagesToImagesBase64(
        pdfBlob,
        startTocPage,
        endTocPage,
        10
      );

      const pageSummaries = course.chapters
        .slice(0, 3)
        .map((c) => c.rawText)
        .join("\n\n")
        .slice(0, 8000);

      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/detect-toc", {
        pageSummaries,
        tocImagesBase64,
        totalPages: maxPage,
        apiKey: settings.geminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể đọc Mục lục từ ảnh PDF.");
      }

      if (Array.isArray(data.chapters) && data.chapters.length > 0) {
        const newChapterUnits: ChapterUnit[] = data.chapters.map(
          (
            ch: { title: string; startPage: number; endPage: number },
            i: number
          ) => {
            const sp = Math.max(1, Math.min(Number(ch.startPage) || 1, maxPage));
            const ep = Math.max(
              sp,
              Math.min(Number(ch.endPage) || sp + 10, maxPage)
            );
            return {
              id: `${course.id}-toc-ch-${i + 1}-${Date.now()}`,
              courseId: course.id,
              index: i + 1,
              title: ch.title || `Bài ${i + 1} (Trang ${sp}–${ep})`,
              summary: `Trang ${sp}–${ep}`,
              startPage: sp,
              endPage: ep,
              rawText: "",
              isScannedPages: true,
              isGenerated: false,
              lesson: null,
              completedClozeIds: [],
              completedQuizIds: [],
              completedTranslationIds: [],
            };
          }
        );

        const updatedCourse: Course = {
          ...course,
          chapters: newChapterUnits,
          updatedAt: new Date().toISOString(),
        };
        await saveCourse(updatedCourse);
        await onCourseUpdated(updatedCourse);
        if (newChapterUnits[0]) {
          setSelectedChapterId(newChapterUnits[0].id);
        }
      } else {
        throw new Error(
          "Vision AI không tìm thấy trang Mục lục trong 11 trang đầu của PDF."
        );
      }
    } catch (err: unknown) {
      setGenError(
        err instanceof Error
          ? err.message
          : "Lỗi khi đọc Mục lục bằng Vision AI."
      );
    } finally {
      setIsRedetectingToc(false);
    }
  };

  /**
   * Step 1: Converts PDF pages or uploaded images into pure text BEFORE generating the lesson
   * so Gemini Vision never crashes or times out with 413/504!
   * Supports:
   * - "local_tesseract": 100% Client-side Browser OCR (Tesseract.js WebAssembly, eng+vie, zero API calls)
   * - "micro_batch_ai": Splits into tiny 2-page batches for fast plain-text OCR, with automatic fallback to Tesseract.js
   */
  const extractTextFromChapterImages = async (
    chapter: ChapterUnit,
    providedImages?: string[],
    forceMode?: "local_tesseract" | "micro_batch_ai"
  ): Promise<string> => {
    const startP = chapter.startPage || 1;
    const endP = chapter.endPage || startP + 14;
    let images = providedImages;

    if (!images || images.length === 0) {
      const pdfBlob = await getCoursePdfBlob(course.id);
      if (pdfBlob) {
        setOcrStatusMsg(
          `Đang cắt các trang PDF (${startP}–${endP}) thành ảnh nhẹ...`
        );
        images = await renderPdfPagesToImagesBase64(pdfBlob, startP, endP, 20);
      }
    }

    if (!images || images.length === 0) {
      return chapter.rawText;
    }

    const modeToUse = forceMode || ocrEngineMode;
    let extractedOcrText = "";

    if (modeToUse === "local_tesseract") {
      extractedOcrText = await runLocalBrowserOcrOnImages(
        images,
        startP,
        (msg) => setOcrStatusMsg(msg)
      );
    } else {
      // Micro-batch 2 pages per request to prevent Vision timeout / payload limit
      const settings = getAppSettings();
      const batchParts: string[] = [];
      const batchSize = 2;

      for (let i = 0; i < images.length; i += batchSize) {
        const slice = images.slice(i, i + batchSize);
        const batchStartPage = startP + i;
        const batchEndPage = batchStartPage + slice.length - 1;
        setOcrStatusMsg(
          `Bước 1/2: Đang đọc chữ trong ảnh trang ${batchStartPage}–${batchEndPage} (cụm ${Math.floor(i / batchSize) + 1}/${Math.ceil(images.length / batchSize)})...`
        );
        try {
          const ocrRes = await fetchAiAgent("/api/agent/ocr-pages", {
            pageImagesBase64: slice,
            startPageNum: batchStartPage,
            apiKey: settings.geminiApiKey,
            model: settings.geminiModel,
          });
          const ocrData = await ocrRes.json();
          if (ocrRes.ok && ocrData.extractedText) {
            batchParts.push(ocrData.extractedText);
          } else {
            throw new Error(ocrData.error || "AI OCR batch failed");
          }
        } catch {
          // Automatic fallback to Local Browser OCR (Tesseract.js) so it NEVER dies!
          const fallbackText = await runLocalBrowserOcrOnImages(
            slice,
            batchStartPage,
            (msg) => setOcrStatusMsg(`${msg} (Tự động chuyển sang OCR Trình duyệt)`)
          );
          if (fallbackText) {
            batchParts.push(fallbackText);
          }
        }
      }
      extractedOcrText = batchParts.join("\n\n");
    }

    setOcrStatusMsg(null);

    if (!extractedOcrText.trim()) {
      return chapter.rawText;
    }

    const baseRawWithoutOldOcr = chapter.rawText
      .split("\n\n=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ===")[0]
      .trim();

    const mergedRawText = `${baseRawWithoutOldOcr}\n\n=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ===\n${extractedOcrText.trim()}`;

    // Persist the OCR-enriched rawText into the chapter immediately so the user never has to re-OCR
    const updatedChapters = course.chapters.map((ch) =>
      ch.id === chapter.id
        ? { ...ch, rawText: mergedRawText, isScannedPages: false }
        : ch
    );
    const updatedCourse: Course = {
      ...course,
      chapters: updatedChapters,
      updatedAt: new Date().toISOString(),
    };
    await saveCourse(updatedCourse);
    await onCourseUpdated(updatedCourse);
    setEditableRawText(mergedRawText);

    return mergedRawText;
  };

  const handleGenerateChapterLesson = async (
    chapter: ChapterUnit,
    pageImagesBase64?: string[]
  ) => {
    setGenError(null);
    setActiveTab("content");
    setIsGeneratingLesson(true);
    try {
      const settings = getAppSettings();
      let textToUse =
        editableRawText.trim().length > 20
          ? editableRawText
          : chapter.rawText;

      const alreadyHasOcr = textToUse.includes(
        "=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ==="
      );

      // Step 1: If Hybrid/Scanned mode is enabled or images were uploaded, convert images to text first!
      if (
        (pageImagesBase64 && pageImagesBase64.length > 0) ||
        ((useHybridVision || chapter.isScannedPages) && !alreadyHasOcr)
      ) {
        textToUse = await extractTextFromChapterImages(
          chapter,
          pageImagesBase64
        );
      }

      setOcrStatusMsg(
        "Bước 2/2: Đã lấy đủ chữ từ ảnh! AI đang soạn bài giảng chuyên sâu..."
      );

      // Step 2: Send pure enriched text (no heavy 20-image payload!) so Gemini/Qwen never dies or times out
      const res = await fetchAiAgent("/api/agent/chapter-lesson", {
        courseTitle: course.title,
        chapterTitle: chapter.title,
        chapterText: textToUse,
        apiKey: settings.geminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể tạo bài học với AI.");
      }

      const updatedChapters = course.chapters.map((ch) =>
        ch.id === chapter.id
          ? {
              ...ch,
              rawText: textToUse,
              isGenerated: true,
              lesson: data.lesson,
            }
          : ch
      );

      const updatedCourse: Course = {
        ...course,
        chapters: updatedChapters,
        updatedAt: new Date().toISOString(),
      };

      await saveCourse(updatedCourse);
      await onCourseUpdated(updatedCourse);
      setActiveTab("content");
    } catch (err: unknown) {
      setGenError(
        err instanceof Error
          ? err.message
          : "Lỗi khi kết nối Gemini AI. Hãy kiểm tra API Key trong Cài đặt."
      );
    } finally {
      setOcrStatusMsg(null);
      setIsGeneratingLesson(false);
    }
  };

  const handleExtractFullVocab = async (
    chapter: ChapterUnit,
    pageImagesBase64?: string[]
  ) => {
    if (!chapter.lesson) return;
    setGenError(null);
    setIsExtractingFullVocab(true);
    try {
      const settings = getAppSettings();
      let textToUse = chapter.rawText;
      const alreadyHasOcr = textToUse.includes(
        "=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ==="
      );

      if (
        (pageImagesBase64 && pageImagesBase64.length > 0) ||
        ((useHybridVision || chapter.isScannedPages) && !alreadyHasOcr)
      ) {
        textToUse = await extractTextFromChapterImages(
          chapter,
          pageImagesBase64
        );
      }

      const res = await fetchAiAgent("/api/agent/extract-vocab", {
        courseTitle: course.title,
        chapterTitle: chapter.title,
        chapterText: textToUse,
        apiKey: settings.geminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể quét toàn bộ từ vựng.");
      }

      if (Array.isArray(data.vocabulary) && data.vocabulary.length > 0) {
        const updatedChapters = course.chapters.map((ch) =>
          ch.id === chapter.id && ch.lesson
            ? {
                ...ch,
                lesson: {
                  ...ch.lesson,
                  vocabulary: data.vocabulary,
                },
              }
            : ch
        );
        const updatedCourse: Course = {
          ...course,
          chapters: updatedChapters,
          updatedAt: new Date().toISOString(),
        };
        await saveCourse(updatedCourse);
        await onCourseUpdated(updatedCourse);
      }
    } catch (err: unknown) {
      setGenError(
        err instanceof Error ? err.message : "Lỗi khi quét toàn bộ từ vựng."
      );
    } finally {
      setIsExtractingFullVocab(false);
    }
  };

  const handleSupplementExercises = async (chapter: ChapterUnit) => {
    if (!chapter.lesson) return;
    setIsSupplementingExercises(true);
    setGenError(null);
    try {
      const settings = getAppSettings();
      const l = chapter.lesson;

      const vocabSummary = Array.isArray(l.vocabulary)
        ? l.vocabulary
            .map((v) => `${v.word} (${v.ipa}): ${v.vietnameseMeaning}`)
            .join("; ")
        : "";
      const grammarSummary = Array.isArray(l.grammarPoints)
        ? l.grammarPoints
            .map(
              (g) =>
                `${g.title} [${g.patternFormula}]: ${g.quoteFromBook} (${g.quoteTranslation})`
            )
            .join("; ")
        : "";
      const contentSummary = Array.isArray(l.contentAnalysis)
        ? l.contentAnalysis
            .map(
              (c) =>
                `[${c.sectionTitle}] ${c.originalExcerpt} -> ${c.vietnameseTranslation}`
            )
            .join("\n")
        : "";
      const existingClozeList = Array.isArray(l.clozeExercises)
        ? l.clozeExercises.map((c) => c.sentenceWithBlank).join(" | ")
        : "";
      const existingTransList = Array.isArray(l.translationExercises)
        ? l.translationExercises.map((t) => t.originalSentence).join(" | ")
        : "";

      const existingLessonContext = [
        `TÓM TẮT CHƯƠNG: ${l.overview?.summary || ""}`,
        `NỘI DUNG ĐOẠN TRÍCH (TAB 1):\n${contentSummary}`,
        `NGỮ PHÁP TRỌNG ĐIỂM (TAB 2): ${grammarSummary}`,
        `TỪ VỰNG TRONG BÀI (TAB 3): ${vocabSummary}`,
        existingClozeList
          ? `CÁC CÂU ĐIỀN TỪ ĐÃ CÓ (KHÔNG TRÙNG LẶP): ${existingClozeList}`
          : "",
        existingTransList
          ? `CÁC CÂU LUYỆN DỊCH ĐÃ CÓ (KHÔNG TRÙNG LẶP): ${existingTransList}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetchAiAgent("/api/agent/supplement-exercises", {
        courseTitle: course.title,
        chapterTitle: chapter.title,
        chapterText: editableRawText.trim() || chapter.rawText || "",
        existingLessonContext,
        apiKey: settings.geminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(
          data.error ||
            "Không thể tạo bổ sung bài tập Điền từ, Trắc nghiệm & Luyện dịch."
        );
      }

      const newCloze = Array.isArray(data.exercises?.clozeExercises)
        ? data.exercises.clozeExercises
        : [];
      const newQuiz = Array.isArray(data.exercises?.quizExercises)
        ? data.exercises.quizExercises
        : [];
      const newTrans = Array.isArray(data.exercises?.translationExercises)
        ? data.exercises.translationExercises
        : [];

      const updatedChapters = course.chapters.map((ch) =>
        ch.id === chapter.id && ch.lesson
          ? {
              ...ch,
              lesson: {
                ...ch.lesson,
                clozeExercises: [
                  ...(Array.isArray(ch.lesson.clozeExercises)
                    ? ch.lesson.clozeExercises
                    : []),
                  ...newCloze,
                ],
                quizExercises: [
                  ...(Array.isArray(ch.lesson.quizExercises)
                    ? ch.lesson.quizExercises
                    : []),
                  ...newQuiz,
                ],
                translationExercises: [
                  ...(Array.isArray(ch.lesson.translationExercises)
                    ? ch.lesson.translationExercises
                    : []),
                  ...newTrans,
                ],
              },
            }
          : ch
      );

      const updatedCourse: Course = {
        ...course,
        chapters: updatedChapters,
        updatedAt: new Date().toISOString(),
      };
      await saveCourse(updatedCourse);
      await onCourseUpdated(updatedCourse);
    } catch (err: unknown) {
      setGenError(
        err instanceof Error
          ? err.message
          : "Lỗi khi tạo bổ sung bài tập Điền từ & Luyện dịch."
      );
    } finally {
      setIsSupplementingExercises(false);
    }
  };

  const handleCheckCloze = async (clozeId: string, correctAnswer: string) => {
    setClozeChecked({ ...clozeChecked, [clozeId]: true });
    const userVal = (clozeInputs[clozeId] || "").trim().toLowerCase();
    if (
      userVal === correctAnswer.trim().toLowerCase() &&
      currentChapter &&
      !currentChapter.completedClozeIds.includes(clozeId)
    ) {
      const updatedChapters = course.chapters.map((ch) =>
        ch.id === currentChapter.id
          ? {
              ...ch,
              completedClozeIds: [...ch.completedClozeIds, clozeId],
            }
          : ch
      );
      const updatedCourse = { ...course, chapters: updatedChapters };
      await saveCourse(updatedCourse);
      await onCourseUpdated(updatedCourse);
    }
  };

  const handleSubmitQuiz = async (quizId: string, correctIndex: number) => {
    setQuizSubmitted({ ...quizSubmitted, [quizId]: true });
    if (
      quizSelected[quizId] === correctIndex &&
      currentChapter &&
      !currentChapter.completedQuizIds.includes(quizId)
    ) {
      const updatedChapters = course.chapters.map((ch) =>
        ch.id === currentChapter.id
          ? {
              ...ch,
              completedQuizIds: [...ch.completedQuizIds, quizId],
            }
          : ch
      );
      const updatedCourse = { ...course, chapters: updatedChapters };
      await saveCourse(updatedCourse);
      await onCourseUpdated(updatedCourse);
    }
  };

  const handleEvaluateTranslation = async (
    exerciseId: string,
    originalSentence: string,
    referenceTranslation: string,
    contextHint: string
  ) => {
    const userTranslation = (translationInputs[exerciseId] || "").trim();
    if (!userTranslation) return;

    setEvaluatingId(exerciseId);
    setEvalError(null);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/evaluate-translation", {
        originalSentence,
        referenceTranslation,
        contextHint,
        userTranslation,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể chấm điểm câu dịch.");
      }

      const evaluation: TranslationEvaluation = data.evaluation;

      if (currentChapter && currentChapter.lesson) {
        const updatedTranslations =
          currentChapter.lesson.translationExercises.map((t) =>
            t.id === exerciseId ? { ...t, lastEvaluation: evaluation } : t
          );

        const completedIds = currentChapter.completedTranslationIds.includes(
          exerciseId
        )
          ? currentChapter.completedTranslationIds
          : [...currentChapter.completedTranslationIds, exerciseId];

        const updatedChapters = course.chapters.map((ch) =>
          ch.id === currentChapter.id
            ? {
                ...ch,
                completedTranslationIds: completedIds,
                lesson: {
                  ...ch.lesson!,
                  translationExercises: updatedTranslations,
                },
              }
            : ch
        );

        const updatedCourse = { ...course, chapters: updatedChapters };
        await saveCourse(updatedCourse);
        await onCourseUpdated(updatedCourse);
      }
    } catch (err: unknown) {
      setEvalError(
        err instanceof Error
          ? err.message
          : "Lỗi khi gọi AI chấm điểm dịch câu."
      );
    } finally {
      setEvaluatingId(null);
    }
  };

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuestion.trim() || !currentChapter) return;
    setIsAskingTutor(true);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/ask-tutor", {
        courseTitle: course.title,
        chapterTitle: currentChapter.title,
        chapterText: currentChapter.rawText,
        question: tutorQuestion,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể gửi câu hỏi.");
      }
      setTutorAnswer(data.answer);
    } catch (err: unknown) {
      setTutorAnswer(
        err instanceof Error
          ? err.message
          : "Lỗi khi kết nối Gia sư AI."
      );
    } finally {
      setIsAskingTutor(false);
    }
  };

  if (!currentChapter) {
    return null;
  }

  const rawLesson = currentChapter.lesson;
  const lesson = rawLesson
    ? {
        ...rawLesson,
        overview: {
          summary: rawLesson.overview?.summary || "",
          keyThemes: Array.isArray(rawLesson.overview?.keyThemes)
            ? rawLesson.overview.keyThemes
            : [],
          learningObjectives: Array.isArray(
            rawLesson.overview?.learningObjectives
          )
            ? rawLesson.overview.learningObjectives
            : [],
        },
        contentAnalysis: Array.isArray(rawLesson.contentAnalysis)
          ? rawLesson.contentAnalysis
          : [],
        grammarPoints: Array.isArray(rawLesson.grammarPoints)
          ? rawLesson.grammarPoints.map((gp) => ({
              ...gp,
              extraExamples: Array.isArray(gp?.extraExamples)
                ? gp.extraExamples
                : [],
            }))
          : [],
        vocabulary: Array.isArray(rawLesson.vocabulary)
          ? rawLesson.vocabulary.map((v) => ({
              ...v,
              collocations: Array.isArray(v?.collocations)
                ? v.collocations
                : [],
              synonyms: Array.isArray(v?.synonyms) ? v.synonyms : [],
            }))
          : [],
        clozeExercises: Array.isArray(rawLesson.clozeExercises)
          ? rawLesson.clozeExercises
          : [],
        quizExercises: Array.isArray(rawLesson.quizExercises)
          ? rawLesson.quizExercises.map((qz) => ({
              ...qz,
              options: Array.isArray(qz?.options) ? qz.options : [],
            }))
          : [],
        translationExercises: Array.isArray(rawLesson.translationExercises)
          ? rawLesson.translationExercises.map((tr) => ({
              ...tr,
              targetGrammarOrVocab: Array.isArray(tr?.targetGrammarOrVocab)
                ? tr.targetGrammarOrVocab
                : [],
            }))
          : [],
      }
    : undefined;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* LEFT SIDEBAR: Course Roadmap & Chapters */}
      <aside className="w-full shrink-0 border-b border-slate-800 bg-slate-900/70 lg:w-80 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-800 p-4">
          <button
            type="button"
            onClick={() => {
              stopAllSpeech();
              onBackToDashboard();
            }}
            className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Quay lại Danh sách Khóa học (Courses)
          </button>
          <h2 className="line-clamp-2 text-base font-bold text-white">
            {course.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {course.author} • Cấp độ {course.level}
          </p>
          {course.sourceFileName && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-800/90 px-2.5 py-1 text-[11px] text-slate-300">
              <FileText className="h-3 w-3 text-indigo-400" />
              <span className="max-w-[200px] truncate">
                {course.sourceFileName}
              </span>
              {course.sourceFileSizeMB && (
                <span className="text-indigo-300">
                  ({course.sourceFileSizeMB} MB)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Chapters Roadmap List */}
        <div className="p-3">
          {hasCachedPdf && (
            <button
              type="button"
              disabled={isRedetectingToc}
              onClick={handleRedetectCourseTocFromSidebar}
              className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3 py-2 text-xs font-bold text-white shadow-md shadow-amber-600/20 transition hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 cursor-pointer"
              title="Dùng Vision AI đọc ảnh 10 trang đầu PDF để chia lại danh sách Bài học theo đúng Mục lục sách"
            >
              {isRedetectingToc ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span>Vision AI đang đọc ảnh Mục lục...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 shrink-0" />
                  <span>AI Đọc Mục Lục (TOC) & Chia Lại Bài</span>
                </>
              )}
            </button>
          )}
          <div className="mb-2 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Lộ trình Chương ({course.chapters.length})</span>
            <span>
              {course.chapters.filter((c) => c.isGenerated).length}/
              {course.chapters.length} đã soạn
            </span>
          </div>
          <div className="max-h-[38vh] space-y-1.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-15rem)]">
            {course.chapters.map((ch) => {
              const isSelected = ch.id === currentChapter.id;
              const doneExercisesCount =
                ch.completedClozeIds.length +
                ch.completedQuizIds.length +
                ch.completedTranslationIds.length;

              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setSelectedChapterId(ch.id);
                    setActiveTab("content");
                    setGenError(null);
                    setTutorAnswer(null);
                  }}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-950/40 text-white shadow"
                      : "border-slate-800/80 bg-slate-950/40 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-xs font-semibold leading-snug">
                      {ch.title}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {ch.isGenerated ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-slate-500" />
                      )}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeleteChapterFromCourse(ch.id, e)}
                        className="rounded p-1 text-slate-500 hover:bg-rose-950/70 hover:text-rose-400"
                        title="Xóa chương không cần thiết này"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {ch.startPage && ch.endPage
                        ? `Trang ${ch.startPage}–${ch.endPage}`
                        : `Chương ${ch.index}`}
                    </span>
                    {ch.isGenerated ? (
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                        {doneExercisesCount > 0
                          ? `Đã làm ${doneExercisesCount} bài`
                          : "Sẵn sàng học"}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        Bấm để AI soạn bài
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* MAIN CHAPTER WORKSPACE */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {/* Chapter Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400">
              <Layers className="h-3.5 w-3.5" />
              <span>
                Chương {currentChapter.index} / {course.chapters.length}
                {currentChapter.startPage && currentChapter.endPage
                  ? ` • Trang ${currentChapter.startPage} – ${currentChapter.endPage}`
                  : ""}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-white md:text-2xl">
              {currentChapter.title}
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            <select
              value={selectedAiModel}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAiModel(val);
                const cur = getAppSettings();
                saveAppSettings({ ...cur, geminiModel: val });
              }}
              title="Chọn nguồn AI tạo bài học (Tự động xoay vòng dự phòng nếu hết hạn mức)"
              className="rounded-xl border border-indigo-500/40 bg-slate-950 px-3 py-2 text-xs font-semibold text-indigo-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="qwen-groq">
                ⚡ Qwen 3 32B (Groq Cloud Siêu Tốc - Free)
              </option>
              <option value="qwen-openrouter">
                🟢 Qwen 2.5 72B / VL (OpenRouter - Free)
              </option>
              <option value="qwen-siliconflow">
                🔵 Qwen 2.5 (SiliconFlow Cloud - Free)
              </option>
              <option value="gemini-2.5-flash">
                🟣 Google Gemini 2.5 Flash (+ Auto Qwen)
              </option>
              <option value="gemini-2.0-flash">
                🟣 Google Gemini 2.0 Flash
              </option>
            </select>
            <button
              type="button"
              onClick={() => {
                setShowRawText(!showRawText);
                setEditableRawText(currentChapter.rawText);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 text-center"
            >
              {showRawText ? "Ẩn văn bản gốc" : "Xem / Sửa văn bản gốc chương"}
            </button>
            <button
              type="button"
              disabled={isGeneratingLesson}
              onClick={() => handleGenerateChapterLesson(currentChapter)}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
            >
              {isGeneratingLesson ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI đang phân tích chương sách (10-15s)...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {lesson ? "Tạo lại Bài học bằng AI" : "AI Soạn Bài Học Chương Này"}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Raw Text Drawer */}
        {showRawText && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300">
                Văn bản gốc trích xuất từ Sách ({currentChapter.rawText.length.toLocaleString()} ký tự)
              </span>
              <span className="text-xs text-slate-400">
                Bạn có thể chỉnh sửa hoặc dán bổ sung nội dung trước khi bấm &ldquo;AI Soạn Bài Học&rdquo;
              </span>
            </div>
            <textarea
              rows={7}
              value={editableRawText}
              onChange={(e) => setEditableRawText(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        )}

        {/* Error banner */}
        {genError && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{genError}</span>
            </div>
          </div>
        )}

        {/* Live OCR Progress Status Banner */}
        {ocrStatusMsg && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-indigo-500/40 bg-indigo-950/40 p-4 text-xs font-semibold text-indigo-200 animate-pulse">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-400" />
            <span>{ocrStatusMsg}</span>
          </div>
        )}

        {/* If Generating Lesson */}
        {isGeneratingLesson ? (
          <LessonGeneratingLoader
            chapterIndex={currentChapter.index}
            chapterTitle={currentChapter.title}
          />
        ) : !lesson ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 sm:p-10 text-center animate-in fade-in duration-300">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-bold text-white">
              Chương này đã sẵn sàng để AI phân tích chuyên sâu!
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
              Hệ thống đã trích xuất sẵn{" "}
              <strong>{currentChapter.rawText.length.toLocaleString()} ký tự</strong>{" "}
              của chương này. Bấm nút bên dưới để AI Agent tự động diễn giải toàn bộ nội dung, bóc tách ngữ pháp, tạo bộ Flashcard từ vựng, bài tập điền từ, trắc nghiệm và câu luyện dịch.
            </p>
            <div className="mx-auto mt-4 max-w-2xl rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-left font-serif text-xs italic leading-relaxed text-slate-400">
              &ldquo;{currentChapter.rawText.slice(0, 450)}...&rdquo;
            </div>

            {/* Dual-Engine OCR & Hybrid PDF Configuration Card */}
            <div className="mx-auto mt-5 max-w-2xl rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-left space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={useHybridVision}
                  onChange={(e) => setUseHybridVision(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <div className="text-xs leading-relaxed flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-bold text-indigo-300">
                    <span>
                      Tự động Đọc Chữ Trong Ảnh (OCR) trước khi Soạn Bài Học
                    </span>
                    {hasCachedPdf ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                        Đã lưu sẵn file PDF gốc
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Chọn file PDF/Ảnh ở nút bên dưới nếu chưa có
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-slate-400">
                    Thay vì gửi nguyên tệp ảnh nặng khiến Gemini Vision bị quá tải (die/timeout), hệ thống sẽ <strong>bóc toàn bộ chữ trong ảnh ra thành văn bản thuần</strong> (ghép vào văn bản gốc trang {currentChapter.startPage || 1}–{currentChapter.endPage || 15}) rồi mới gửi cho AI soạn bài!
                  </p>
                </div>
              </label>

              {useHybridVision && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-indigo-500/20 text-xs">
                  <button
                    type="button"
                    onClick={() => setOcrEngineMode("local_tesseract")}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      ocrEngineMode === "local_tesseract"
                        ? "border-emerald-500 bg-emerald-950/40 text-emerald-200"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>1. OCR Trình Duyệt (Khuyên dùng)</span>
                      {ocrEngineMode === "local_tesseract" && (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-80">
                      Quét chữ bằng Tesseract.js ngay trên máy, không gọi AI Vision, <strong>không bao giờ bị die</strong>.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOcrEngineMode("micro_batch_ai")}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      ocrEngineMode === "micro_batch_ai"
                        ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
                        : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span>2. AI OCR Chia Cụm 2 Trang</span>
                      {ocrEngineMode === "micro_batch_ai" && (
                        <Check className="h-3.5 w-3.5 text-indigo-400" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-80">
                      Chia nhỏ từng 2 trang nhẹ để đọc chữ (tự động chuyển sang OCR Trình duyệt nếu lỗi).
                    </p>
                  </button>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isGeneratingLesson || isRunningStandaloneOcr}
                onClick={() => handleGenerateChapterLesson(currentChapter)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
              >
                {isGeneratingLesson ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Đang đọc chương sách & soạn bài giảng chi tiết...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Bắt đầu Tạo Bài Học Chương {currentChapter.index}
                  </>
                )}
              </button>

              {hasCachedPdf && (
                <button
                  type="button"
                  disabled={isRunningStandaloneOcr || isGeneratingLesson}
                  onClick={async () => {
                    setIsRunningStandaloneOcr(true);
                    setGenError(null);
                    try {
                      await extractTextFromChapterImages(currentChapter);
                      setShowRawText(true);
                    } catch (err: unknown) {
                      setGenError(
                        err instanceof Error ? err.message : "Lỗi khi OCR trang PDF"
                      );
                    } finally {
                      setIsRunningStandaloneOcr(false);
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-900/50 disabled:opacity-50"
                >
                  {isRunningStandaloneOcr ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                  <span>
                    Chỉ Quét Chữ Từ Ảnh PDF Vào Văn Bản Gốc (Xem trước chữ)
                  </span>
                </button>
              )}

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/30 px-5 py-3 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-900/50">
                <Camera className="h-4 w-4 text-indigo-400 shrink-0" />
                <span>
                  Chọn File PDF / Ảnh Từ Máy Để Quét Chữ & Tạo Bài
                </span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setIsGeneratingLesson(true);
                    try {
                      const firstPdf = Array.from(files).find(
                        (f) =>
                          f.type === "application/pdf" ||
                          f.name.toLowerCase().endsWith(".pdf")
                      );
                      if (firstPdf) {
                        await saveCoursePdfBlob(
                          course.id,
                          firstPdf,
                          firstPdf.name
                        );
                        setHasCachedPdf(true);
                      }
                      const imgs = await convertUploadedFilesToImagesBase64(
                        files,
                        currentChapter.startPage,
                        currentChapter.endPage,
                        20
                      );
                      await handleGenerateChapterLesson(currentChapter, imgs);
                    } catch (err: unknown) {
                      setGenError(
                        err instanceof Error ? err.message : "Lỗi quét ảnh / PDF"
                      );
                      setIsGeneratingLesson(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          /* Lesson Exists -> Show 5 Learning Tabs */
          <div className="space-y-6">
            {/* Navigation Tabs (Swipeable horizontally on mobile, wrapped on desktop) */}
            <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 sm:gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold transition ${
                  activeTab === "content"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>1. Nội dung & Diễn giải ({lesson.contentAnalysis.length} phần)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("grammar")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold transition ${
                  activeTab === "grammar"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <GraduationCap className="h-4 w-4 shrink-0" />
                <span>2. Ngữ pháp trọng điểm ({lesson.grammarPoints.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vocabulary")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold transition ${
                  activeTab === "vocabulary"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>3. Từ vựng & Flashcard SRS ({lesson.vocabulary.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("practice")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold transition ${
                  activeTab === "practice"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>
                  4. Điền từ & Trắc nghiệm (
                  {lesson.clozeExercises.length + lesson.quizExercises.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("translation")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-semibold transition ${
                  activeTab === "translation"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Languages className="h-4 w-4 shrink-0" />
                <span>
                  5. Luyện dịch & AI Chấm điểm % (
                  {lesson.translationExercises.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("exam_arena")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs font-bold transition ${
                  activeTab === "exam_arena"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow"
                    : "text-amber-300 hover:bg-slate-800"
                }`}
              >
                <Trophy className="h-4 w-4 shrink-0" />
                <span>6. Phòng Thi & Ôn Tập Đa Dạng (Exam Arena)</span>
              </button>
            </div>

            {/* TAB 6: EXAM & REVIEW ARENA */}
            {activeTab === "exam_arena" && (
              <ExamArena
                course={course}
                currentChapter={currentChapter}
                courseFlashcards={flashcards}
              />
            )}

            {/* TAB 1: DEEP CONTENT & COMMENTARY */}
            {activeTab === "content" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Overview Card */}
                <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
                    Tổng quan & Bối cảnh Chương sách
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-200">
                    {lesson.overview.summary}
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="rounded-xl bg-slate-950/60 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <Target className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Chủ đề cốt lõi (Key Themes):</span>
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                        {lesson.overview.keyThemes.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-slate-950/60 p-4">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Mục tiêu đạt được sau chương này:</span>
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                        {lesson.overview.learningObjectives.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Section-by-Section Deep Breakdown */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Phân tích & Diễn giải chuyên sâu theo mạch văn bản
                  </h3>
                  {lesson.contentAnalysis.map((sec) => (
                    <div
                      key={sec.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-indigo-300">
                          {sec.sectionTitle}
                        </h4>
                        <AudioSpeakButton
                          text={sec.originalExcerpt}
                          label="Nghe đoạn trích"
                          className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-slate-700"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            Nguyên tác trong sách (Original Text)
                          </div>
                          <p className="font-serif text-sm italic leading-relaxed text-slate-100">
                            &ldquo;{sec.originalExcerpt}&rdquo;
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                            Bản dịch nghĩa chuẩn (Vietnamese Translation)
                          </div>
                          <p className="text-sm leading-relaxed text-slate-200">
                            {sec.vietnameseTranslation}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-indigo-950/25 border border-indigo-500/20 p-4 text-sm leading-relaxed text-slate-200">
                        <Lightbulb className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-indigo-300">
                            Diễn giải sâu nội dung:{" "}
                          </strong>
                          {sec.deepExplanation}
                        </div>
                      </div>

                      <div className="flex items-start gap-2 rounded-xl bg-amber-950/20 border border-amber-500/20 p-3.5 text-xs leading-relaxed text-amber-200/90">
                        <Feather className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong>Ghi chú văn phong & Ngữ cảnh: </strong>
                          {sec.stylisticOrContextNotes}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Interactive Ask-the-Book AI Tutor */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <MessageSquare className="h-4 w-4 text-indigo-400" />
                    <span>
                      Hỏi Gia sư AI thêm về bất kỳ câu văn hay ý nghĩa nào trong Chương này
                    </span>
                  </div>
                  <form onSubmit={handleAskTutor} className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={tutorQuestion}
                      onChange={(e) => setTutorQuestion(e.target.value)}
                      placeholder="VD: Giải thích kỹ hơn câu thứ 2 ở đoạn 1, hoặc tại sao tác giả lại dùng hình ảnh ẩn dụ đó?..."
                      className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isAskingTutor}
                      className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 shrink-0"
                    >
                      {isAskingTutor ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Hỏi AI
                    </button>
                  </form>
                  {isAskingTutor && <TutorThinkingLoader />}
                  {tutorAnswer && !isAskingTutor && (
                    <div className="mt-4 whitespace-pre-wrap rounded-xl border border-indigo-500/30 bg-slate-950 p-4 text-sm leading-relaxed text-slate-200 animate-in fade-in duration-300">
                      {tutorAnswer}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: GRAMMAR IN CONTEXT */}
            {activeTab === "grammar" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {lesson.grammarPoints.map((gp, idx) => (
                  <div
                    key={gp.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-white">
                        <span className="mr-2 rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300">
                          Điểm ngữ pháp #{idx + 1}
                        </span>
                        {gp.title}
                      </h3>
                      <code className="rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-semibold text-indigo-200">
                        Công thức: {gp.patternFormula}
                      </code>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Câu trích thực tế từ chương sách:
                        </span>
                        <div className="flex items-center gap-2">
                          <AudioSpeakButton
                            text={gp.quoteFromBook}
                            label="Nghe câu"
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              openPronunciationCoach({
                                targetText: gp.quoteFromBook,
                                vietnameseMeaning: gp.quoteTranslation,
                                contextHint: `Cấu trúc: ${gp.patternFormula}`,
                              })
                            }
                            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30 transition cursor-pointer"
                            title="Luyện đọc câu này để AI chấm điểm"
                          >
                            <Mic className="h-3 w-3" />
                            <span>Luyện đọc câu</span>
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 font-serif text-sm italic text-white">
                        &ldquo;{gp.quoteFromBook}&rdquo;
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        → {gp.quoteTranslation}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-xl bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-200">
                        <strong className="flex items-center gap-1.5 mb-1 text-indigo-300">
                          <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                          <span>Giải thích cấu trúc ngữ pháp:</span>
                        </strong>
                        {gp.detailedExplanation}
                      </div>
                      <div className="rounded-xl bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-200">
                        <strong className="flex items-center gap-1.5 mb-1 text-emerald-300">
                          <Target className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          <span>Vì sao tác giả dùng cấu trúc này trong sách?</span>
                        </strong>
                        {gp.whyAuthorUsedIt}
                      </div>
                    </div>

                    {gp.extraExamples && gp.extraExamples.length > 0 && (
                      <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3.5">
                        <div className="mb-2 text-xs font-semibold text-slate-400">
                          Ví dụ ứng dụng tương tự:
                        </div>
                        <div className="space-y-2">
                          {gp.extraExamples.map((ex, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-medium text-slate-200">
                                • {ex.en}
                              </span>
                              <span className="ml-2 text-slate-400">
                                ({ex.vi})
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* TAB 3: VOCABULARY & SRS FLASHCARDS */}
            {activeTab === "vocabulary" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Interactive SRS Flashcard Deck for this chapter */}
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-white">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                    Luyện lật thẻ nhớ từ vựng thông minh (Spaced Repetition SRS)
                  </h3>
                  <FlashcardArena
                    cards={chapterFlashcards}
                    onCardsUpdated={() => onCourseUpdated(course)}
                  />
                </div>

                {/* Detailed Vocabulary Table / Cards */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
                    <div>
                      <h3 className="text-base font-bold text-white">
                        Bảng phân tích toàn bộ Từ vựng, Danh từ riêng & Cụm từ (
                        {lesson.vocabulary.length} từ)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Nếu chương sách có nhiều từ vựng hơn (VD: 35–50 từ), bấm nút bên phải để AI quét lấy đủ 100% không sót từ nào!
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isExtractingFullVocab}
                        onClick={() => handleExtractFullVocab(currentChapter)}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
                      >
                        {isExtractingFullVocab ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            AI đang quét đủ 100% từ vựng...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Quét Đủ 100% Từ Vựng Trong Chương
                          </>
                        )}
                      </button>

                      <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-950/30 px-3.5 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-900/50">
                        <Camera className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                        <span>Quét từ Ảnh / PDF (Tất cả trang)</span>
                        <input
                          type="file"
                          accept=".pdf,image/png,image/jpeg,image/webp"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files || files.length === 0) return;
                            setIsExtractingFullVocab(true);
                            try {
                              const firstPdf = Array.from(files).find(
                                (f) =>
                                  f.type === "application/pdf" ||
                                  f.name.toLowerCase().endsWith(".pdf")
                              );
                              if (firstPdf) {
                                await saveCoursePdfBlob(
                                  course.id,
                                  firstPdf,
                                  firstPdf.name
                                );
                                setHasCachedPdf(true);
                              }
                              const imgs = await convertUploadedFilesToImagesBase64(
                                files,
                                currentChapter.startPage,
                                currentChapter.endPage,
                                20
                              );
                              await handleExtractFullVocab(
                                currentChapter,
                                imgs
                              );
                            } catch {
                              setIsExtractingFullVocab(false);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Unique Vocab Scanning Loader */}
                  {isExtractingFullVocab && (
                    <div className="mb-6">
                      <VocabScanningLoader />
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {lesson.vocabulary.map((voc) => (
                      <div
                        key={voc.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3 hover:border-slate-700 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-lg font-bold text-white">
                                {voc.word}
                              </h4>
                              <AudioSpeakButton
                                text={voc.word}
                                showLabel={false}
                                className="rounded-lg bg-slate-800 p-1.5 text-indigo-400 hover:bg-indigo-600 hover:text-white"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  openPronunciationCoach({
                                    targetText: voc.word,
                                    phonetic: voc.ipa,
                                    vietnameseMeaning: voc.vietnameseMeaning,
                                    contextHint: `Ví dụ: ${voc.quoteFromBook}`,
                                  })
                                }
                                className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/30 transition cursor-pointer"
                                title="Luyện đọc từ này để AI chấm điểm"
                              >
                                <Mic className="h-3 w-3" />
                                <span>Luyện nói</span>
                              </button>
                            </div>
                            <span className="font-mono text-xs text-indigo-300">
                              {voc.ipa} • {voc.partOfSpeech}
                            </span>
                          </div>
                          <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300">
                            {voc.cefrLevel}
                          </span>
                        </div>

                        <div className="text-sm font-bold text-emerald-300">
                          {voc.vietnameseMeaning}
                        </div>

                        <p className="text-xs leading-relaxed text-slate-300">
                          {voc.explanationInContext}
                        </p>

                        <div className="rounded-xl bg-slate-950 p-3 text-xs">
                          <p className="italic text-slate-200">
                            &ldquo;{voc.quoteFromBook}&rdquo;
                          </p>
                          <p className="mt-1 text-slate-400">
                            → {voc.quoteTranslation}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {voc.collocations.map((c, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              <Link2 className="h-3 w-3 text-slate-400" />
                              <span>{c}</span>
                            </span>
                          ))}
                          {voc.synonyms.map((s, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-indigo-950/60 px-2 py-0.5 text-[11px] text-indigo-300"
                            >
                              ≈ {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CLOZE (FILL-IN-BLANK) & MULTIPLE CHOICE QUIZZES */}
            {activeTab === "practice" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Supplemental Exercises Generator Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-emerald-950/25 to-slate-900 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        Bổ sung Bài tập Điền từ, Trắc nghiệm & Luyện dịch (Không mất dữ liệu Tab 1, 2, 3)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Hiện có{" "}
                      <strong className="text-white">
                        {lesson.clozeExercises.length} câu điền từ
                      </strong>
                      ,{" "}
                      <strong className="text-white">
                        {lesson.quizExercises.length} câu trắc nghiệm
                      </strong>{" "}
                      và{" "}
                      <strong className="text-white">
                        {lesson.translationExercises.length} câu luyện dịch
                      </strong>
                      . Bấm nút bên cạnh để AI sinh nối tiếp thêm bộ bài tập mới dựa trên từ vựng & ngữ pháp của chương.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSupplementingExercises}
                    onClick={() => handleSupplementExercises(currentChapter)}
                    className="inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 cursor-pointer"
                  >
                    {isSupplementingExercises ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI đang tạo bổ sung bài tập...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>
                          {lesson.clozeExercises.length === 0 &&
                          lesson.quizExercises.length === 0
                            ? "Tạo ngay Điền từ, Trắc nghiệm & Luyện dịch"
                            : "Tạo bổ sung thêm Bài tập (+6 Điền từ, +8 Quiz, +5 Dịch)"}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {genError && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200">
                    {genError}
                  </div>
                )}

                {/* Part A: Fill in the blank */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Phần A: Điền từ vào ngữ cảnh câu trong sách (Cloze Test) ({lesson.clozeExercises.length})
                  </h3>
                  {lesson.clozeExercises.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
                      Chưa có bài tập Điền từ cho chương này. Hãy bấm nút{" "}
                      <strong className="text-emerald-300">
                        &ldquo;Tạo ngay Điền từ, Trắc nghiệm & Luyện dịch&rdquo;
                      </strong>{" "}
                      màu xanh phía trên để AI bổ sung ngay mà không làm mất nội dung Tab 1, 2, 3!
                    </div>
                  )}
                  {lesson.clozeExercises.map((cl, idx) => {
                    const userVal = clozeInputs[cl.id] || "";
                    const isChecked = clozeChecked[cl.id];
                    const isCorrect =
                      userVal.trim().toLowerCase() ===
                      cl.answer.trim().toLowerCase();

                    return (
                      <div
                        key={cl.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span className="font-semibold text-indigo-300">
                            Câu điền từ #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setShowClozeHint({
                                ...showClozeHint,
                                [cl.id]: !showClozeHint[cl.id],
                              })
                            }
                            className="flex items-center gap-1 text-amber-400 hover:underline"
                          >
                            <Lightbulb className="h-3.5 w-3.5" />
                            {showClozeHint[cl.id] ? "Ẩn gợi ý" : "Xem gợi ý"}
                          </button>
                        </div>

                        <p className="font-serif text-base leading-relaxed text-white">
                          {cl.sentenceWithBlank}
                        </p>

                        {showClozeHint[cl.id] && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                            <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                            <span>Gợi ý: {cl.hint}</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2.5 pt-1">
                          <input
                            type="text"
                            value={userVal}
                            onChange={(e) => {
                              setClozeInputs({
                                ...clozeInputs,
                                [cl.id]: e.target.value,
                              });
                              setClozeChecked({
                                ...clozeChecked,
                                [cl.id]: false,
                              });
                            }}
                            placeholder="Nhập từ còn thiếu..."
                            className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleCheckCloze(cl.id, cl.answer)}
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                          >
                            Kiểm tra đáp án
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setClozeInputs({
                                ...clozeInputs,
                                [cl.id]: cl.answer,
                              });
                              handleCheckCloze(cl.id, cl.answer);
                            }}
                            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
                          >
                            Hiện đáp án
                          </button>
                        </div>

                        {isChecked && (
                          <div
                            className={`rounded-xl border p-3.5 text-xs ${
                              isCorrect
                                ? "border-emerald-500/30 bg-emerald-950/25 text-emerald-200"
                                : "border-rose-500/30 bg-rose-950/25 text-rose-200"
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-bold">
                              {isCorrect ? (
                                <>
                                  <Check className="h-4 w-4 text-emerald-400" />
                                  Chính xác! Đáp án: &ldquo;{cl.answer}&rdquo;
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 text-rose-400" />
                                  Chưa chính xác. Đáp án đúng là: &ldquo;{cl.answer}&rdquo;
                                </>
                              )}
                            </div>
                            <p className="mt-1 text-slate-300">
                              <strong>Dịch câu:</strong>{" "}
                              {cl.fullSentenceTranslation}
                            </p>
                            <p className="mt-1 text-slate-400">
                              <strong>Giải thích:</strong> {cl.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Part B: Multiple Choice Quizzes */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Phần B: Trắc nghiệm Đọc hiểu, Từ vựng & Ngữ pháp ({lesson.quizExercises.length})
                  </h3>
                  {lesson.quizExercises.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
                      Chưa có câu hỏi Trắc nghiệm cho chương này. Bấm nút{" "}
                      <strong className="text-emerald-300">
                        &ldquo;Tạo ngay Điền từ, Trắc nghiệm & Luyện dịch&rdquo;
                      </strong>{" "}
                      phía trên để AI bổ sung ngay!
                    </div>
                  )}
                  {lesson.quizExercises.map((qz, idx) => {
                    const selected = quizSelected[qz.id];
                    const submitted = quizSubmitted[qz.id];

                    return (
                      <div
                        key={qz.id}
                        className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold uppercase text-indigo-400">
                            Câu trắc nghiệm #{idx + 1} • {qz.category}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-white">
                          {qz.question}
                        </p>
                        <div className="space-y-2">
                          {qz.options.map((opt, optIdx) => {
                            const isPicked = selected === optIdx;
                            const isRight = qz.correctIndex === optIdx;

                            let btnStyle =
                              "border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700";
                            if (submitted) {
                              if (isRight) {
                                btnStyle =
                                  "border-emerald-500 bg-emerald-950/30 text-emerald-200 font-semibold";
                              } else if (isPicked && !isRight) {
                                btnStyle =
                                  "border-rose-500 bg-rose-950/30 text-rose-200";
                              }
                            } else if (isPicked) {
                              btnStyle =
                                "border-indigo-500 bg-indigo-950/40 text-white font-semibold";
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => {
                                  if (!submitted) {
                                    setQuizSelected({
                                      ...quizSelected,
                                      [qz.id]: optIdx,
                                    });
                                  }
                                }}
                                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-xs transition ${btnStyle}`}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-800 font-bold text-slate-300">
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {!submitted ? (
                          <button
                            type="button"
                            disabled={selected === undefined}
                            onClick={() =>
                              handleSubmitQuiz(qz.id, qz.correctIndex)
                            }
                            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
                          >
                            Chốt đáp án
                          </button>
                        ) : (
                          <div className="rounded-xl border border-indigo-500/20 bg-slate-950 p-3.5 text-xs leading-relaxed text-slate-300">
                            <strong className="text-indigo-300">
                              Giải thích đáp án:{" "}
                            </strong>
                            {qz.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 5: SENTENCE TRANSLATION & AI SEMANTIC EVALUATION (%) */}
            {activeTab === "translation" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Supplemental Exercises Generator Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-emerald-950/25 to-slate-900 p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                      <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        Bổ sung Câu Luyện Dịch & Bài Tập Thực Hành (Giữ nguyên dữ liệu cũ)
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">
                      Hiện có{" "}
                      <strong className="text-white">
                        {lesson.translationExercises.length} câu luyện dịch
                      </strong>{" "}
                      trong chương này. Bạn có thể bấm nút bên cạnh để AI tạo bổ sung thêm câu luyện dịch và bài tập điền từ mới bất cứ lúc nào.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSupplementingExercises}
                    onClick={() => handleSupplementExercises(currentChapter)}
                    className="inline-flex items-center justify-center gap-2 shrink-0 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 cursor-pointer"
                  >
                    {isSupplementingExercises ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>AI đang tạo bổ sung câu luyện dịch...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        <span>
                          {lesson.translationExercises.length === 0
                            ? "Tạo ngay Câu Luyện Dịch & Bài Tập Điền Từ"
                            : "Tạo bổ sung thêm (+5 Câu Dịch & Bài Tập)"}
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {genError && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200">
                    {genError}
                  </div>
                )}

                <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-xs text-indigo-200">
                  <Target className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Cơ chế AI Chấm Điểm Dịch Câu (Semantic Similarity Evaluation):</strong>{" "}
                    Bạn hãy dịch các câu trích từ chương sách sang tiếng Việt theo cách hiểu của bạn. AI Agent sẽ đối chiếu ngữ nghĩa, ngữ pháp và sắc thái văn phong để chấm điểm từ <strong>0% – 100%</strong>, chỉ rõ từng cụm từ bạn dịch hay hoặc cần chỉnh sửa.
                  </div>
                </div>

                {lesson.translationExercises.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
                    Chưa có câu Luyện dịch cho chương này. Hãy bấm nút{" "}
                    <strong className="text-emerald-300">
                      &ldquo;Tạo ngay Câu Luyện Dịch & Bài Tập Điền Từ&rdquo;
                    </strong>{" "}
                    màu xanh phía trên để AI bổ sung ngay mà không mất dữ liệu các tab khác!
                  </div>
                )}

                {evalError && (
                  <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200">
                    <span>{evalError}</span>
                  </div>
                )}

                {lesson.translationExercises.map((tr, idx) => {
                  const userText =
                    translationInputs[tr.id] ??
                    tr.lastEvaluation?.userTranslation ??
                    "";
                  const evalResult = tr.lastEvaluation;
                  const isEvaluating = evaluatingId === tr.id;

                  return (
                    <div
                      key={tr.id}
                      className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="rounded-lg bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
                          Bài luyện dịch #{idx + 1} ({tr.direction})
                        </span>
                        <div className="flex items-center gap-2">
                          <AudioSpeakButton
                            text={tr.originalSentence}
                            label="Nghe câu gốc"
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              openPronunciationCoach({
                                targetText: tr.originalSentence,
                                vietnameseMeaning: tr.referenceTranslation,
                                contextHint: tr.contextHint,
                              })
                            }
                            className="flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-2 py-0.5 rounded-lg border border-emerald-500/30 transition cursor-pointer"
                            title="Luyện đọc câu gốc này để AI chấm điểm"
                          >
                            <Mic className="h-3 w-3" />
                            <span>Luyện phát âm</span>
                          </button>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                        <p className="font-serif text-base italic leading-relaxed text-white">
                          &ldquo;{tr.originalSentence}&rdquo;
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-300/90">
                          <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span>
                            <strong>Gợi ý ngữ cảnh:</strong> {tr.contextHint}
                          </span>
                        </p>
                        {tr.targetGrammarOrVocab &&
                          tr.targetGrammarOrVocab.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {tr.targetGrammarOrVocab.map((item, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                                >
                                  <Tag className="h-3 w-3 text-indigo-400" />
                                  <span>{item}</span>
                                </span>
                              ))}
                            </div>
                          )}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                          Bản dịch của bạn:
                        </label>
                        <textarea
                          rows={3}
                          value={userText}
                          onChange={(e) =>
                            setTranslationInputs({
                              ...translationInputs,
                              [tr.id]: e.target.value,
                            })
                          }
                          placeholder="Nhập bản dịch tiếng Việt của bạn tại đây..."
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={isEvaluating || !userText.trim()}
                          onClick={() =>
                            handleEvaluateTranslation(
                              tr.id,
                              tr.originalSentence,
                              tr.referenceTranslation,
                              tr.contextHint
                            )
                          }
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40"
                        >
                          {isEvaluating ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              AI đang đối chiếu & chấm điểm độ gần đúng...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4" />
                              AI Chấm Điểm Độ Gần Đúng (%)
                            </>
                          )}
                        </button>
                      </div>

                      {/* AI Evaluation Loading & Result Breakdown */}
                      {isEvaluating && <TranslationEvaluatingLoader />}
                      {evalResult && !isEvaluating && (
                        <div className="mt-4 space-y-4 rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-5 animate-in fade-in duration-300">
                          {/* Score Gauges */}
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/30 p-3 text-center">
                              <div className="text-[11px] text-indigo-300">
                                Tổng điểm Độ gần đúng
                              </div>
                              <div className="mt-1 text-2xl font-extrabold text-white">
                                {evalResult.overallScore}%
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                              <div className="text-[11px] text-slate-400">
                                Độ chính xác nghĩa
                              </div>
                              <div className="mt-1 text-xl font-bold text-emerald-400">
                                {evalResult.semanticAccuracy}%
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                              <div className="text-[11px] text-slate-400">
                                Ngữ pháp & Cấu trúc
                              </div>
                              <div className="mt-1 text-xl font-bold text-sky-400">
                                {evalResult.grammarAndStructure}%
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
                              <div className="text-[11px] text-slate-400">
                                Độ tự nhiên văn phong
                              </div>
                              <div className="mt-1 text-xl font-bold text-amber-400">
                                {evalResult.naturalnessAndTone}%
                              </div>
                            </div>
                          </div>

                          {/* Strengths & Improvements */}
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3.5 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-emerald-300 mb-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                <span>Điểm bạn đã dịch rất tốt:</span>
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-slate-200">
                                {evalResult.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-xl bg-amber-950/20 border border-amber-500/20 p-3.5 text-xs">
                              <div className="flex items-center gap-1.5 font-bold text-amber-300 mb-1.5">
                                <Wrench className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                <span>Góp ý chỉnh sửa để đạt 100%:</span>
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-slate-200">
                                {evalResult.improvements.map((imp, i) => (
                                  <li key={i}>{imp}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Suggested Optimal Translation */}
                          <div className="flex items-start gap-2 rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5 text-xs">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-indigo-300">
                                Bản dịch chuẩn gợi ý:{" "}
                              </span>
                              <span className="text-slate-100">
                                &ldquo;{evalResult.suggestedTranslation}&rdquo;
                              </span>
                            </div>
                          </div>

                          {/* Phrase-by-Phrase Comparison */}
                          {evalResult.wordByWordBreakdown &&
                            evalResult.wordByWordBreakdown.length > 0 && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-800 text-slate-400">
                                      <th className="py-2 pr-3">Cụm từ gốc</th>
                                      <th className="py-2 pr-3">Bạn dịch</th>
                                      <th className="py-2 pr-3">Gợi ý tối ưu</th>
                                      <th className="py-2">Nhận xét</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60">
                                    {evalResult.wordByWordBreakdown.map(
                                      (row, rIdx) => (
                                        <tr key={rIdx}>
                                          <td className="py-2 pr-3 font-medium text-indigo-300">
                                            {row.sourcePhrase}
                                          </td>
                                          <td className="py-2 pr-3 text-slate-300">
                                            {row.userRendered}
                                          </td>
                                          <td className="py-2 pr-3 font-medium text-emerald-300">
                                            {row.betterChoice}
                                          </td>
                                          <td className="py-2 text-slate-400">
                                            {row.note}
                                          </td>
                                        </tr>
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* AI Pronunciation Coach Modal */}
      <PronunciationModal
        isOpen={pronounceModalData.isOpen}
        onClose={() =>
          setPronounceModalData((prev) => ({ ...prev, isOpen: false }))
        }
        targetText={pronounceModalData.targetText}
        phonetic={pronounceModalData.phonetic}
        vietnameseMeaning={pronounceModalData.vietnameseMeaning}
        contextHint={pronounceModalData.contextHint}
      />
    </div>
  );
}
