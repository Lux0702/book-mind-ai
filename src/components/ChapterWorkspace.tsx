"use client";

import React, { useState, useEffect, useRef } from "react";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Search,
  Star,
  Square,
  Play,
  Columns2,
  Eye,
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
  fetchChapterRawPayloadFromStorage,
  uploadCourseRawStorageToCloud,
  syncCourseLessonsWithCommunity,
  saveLastStudySession,
  getStarredVocabIds,
  toggleStarredVocabId,
  normalizeStarVocabKey,
} from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import {
  renderPdfPagesToImagesBase64,
  convertUploadedFilesToImagesBase64,
  runLocalBrowserOcrOnImages,
} from "@/lib/pdfParser";
import { speakSmart, stopAllSpeech } from "@/lib/tts";
import { runWithFeedback, showToast } from "@/lib/feedback";
import LessonGeneratingLoader from "./loadings/LessonGeneratingLoader";
import ExamArena from "./ExamArena";
import PronunciationModal from "./PronunciationModal";
import SelectionAiPopover from "./SelectionAiPopover";
import ContentTab from "./workspace/ContentTab";
import GrammarTab from "./workspace/GrammarTab";
import VocabularyTab from "./workspace/VocabularyTab";
import PracticeTab from "./workspace/PracticeTab";
import TranslationTab from "./workspace/TranslationTab";

interface ChapterWorkspaceProps {
  course: Course;
  flashcards: FlashcardSRS[];
  initialChapterId?: string;
  initialTab?: string;
  /** Gọi khi người dùng đổi chương/tab để trang cha cập nhật URL */
  onLocationChange?: (chapterId: string, tab: string) => void;
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

const isValidActiveTab = (tab?: string): tab is ActiveTab =>
  tab === "content" ||
  tab === "grammar" ||
  tab === "vocabulary" ||
  tab === "practice" ||
  tab === "translation" ||
  tab === "exam_arena";

export default function ChapterWorkspace({
  course,
  flashcards,
  initialChapterId,
  initialTab,
  onLocationChange,
  onBackToDashboard,
  onCourseUpdated,
  onOpenSettings,
}: ChapterWorkspaceProps) {
  const [selectedChapterId, setSelectedChapterId] = useState<string>(() => {
    if (
      initialChapterId &&
      course.chapters.some((c) => c.id === initialChapterId)
    ) {
      return initialChapterId;
    }
    return course.chapters[0]?.id || "";
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() =>
    isValidActiveTab(initialTab) ? initialTab : "content"
  );
  const [isMobileChapterDrawerOpen, setIsMobileChapterDrawerOpen] =
    useState<boolean>(false);
  const [isGeneratingLesson, setIsGeneratingLesson] = useState(false);
  const [isExtractingFullVocab, setIsExtractingFullVocab] = useState(false);
  const [isSupplementingExercises, setIsSupplementingExercises] = useState(false);
  const [isRedetectingToc, setIsRedetectingToc] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Cloze state
  const [clozeInputs, setClozeInputs] = useState<Record<string, string>>({});
  const [clozeChecked, setClozeChecked] = useState<Record<string, boolean>>({});

  // Quiz state
  const [quizSelected, setQuizSelected] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>(
    {}
  );

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
  >("micro_batch_ai");
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null);
  const [isRunningStandaloneOcr, setIsRunningStandaloneOcr] =
    useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    getCoursePdfBlob(course.id, course.clonedFromCourseId).then((pdfBlob) => {
      if (mounted) {
        setHasCachedPdf(Boolean(pdfBlob));
      }
    });
    // Tự động kiểm tra và đồng bộ các chương đã được User A / Cộng đồng soạn sẵn từ Thư viện
    syncCourseLessonsWithCommunity(course).then((mergedCourse) => {
      if (mounted && mergedCourse) {
        void onCourseUpdated(mergedCourse);
      }
    });
    return () => {
      mounted = false;
    };
  }, [course.id]);

  useEffect(() => {
    if (!currentChapter) return;
    const rawNoTags = currentChapter.rawText
      .replace(/(?:---\s*)?\[(?:OCR\s+)?(?:Page|Trang)\s+\d+\](?:\s*---)?/gi, "")
      .trim();
    // Mặc định TẮT tự động OCR nếu chương đã có chữ (>= 180 ký tự).
    // Chỉ tự bật gợi ý khi chương gần như trống rỗng hoàn toàn (< 180 ký tự - sách scan thuần ảnh),
    // và bạn hoàn toàn có thể bật/tắt tùy ý theo từng cuốn sách!
    setUseHybridVision(rawNoTags.length < 180);
  }, [currentChapter?.id]);

  const chapterFlashcards = flashcards.filter(
    (f) => f.chapterId === currentChapter?.id
  );

  const workspaceContentRef = useRef<HTMLDivElement | null>(null);

  // Sync external resume targets if triggered while workspace is already open
  useEffect(() => {
    if (
      initialChapterId &&
      course.chapters.some((c) => c.id === initialChapterId)
    ) {
      setSelectedChapterId(initialChapterId);
    }
    if (isValidActiveTab(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialChapterId, initialTab, course.id]);

  // Đẩy chương/tab đang chọn lên URL.
  // Dùng ref + chỉ phụ thuộc vào STATE (không phụ thuộc callback) để khi người dùng bấm
  // nút Back (URL đổi trước, state đổi sau) effect này không đẩy ngược URL cũ lên lại.
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  });
  useEffect(() => {
    if (!selectedChapterId) return;
    onLocationChangeRef.current?.(selectedChapterId, activeTab);
  }, [selectedChapterId, activeTab]);

  // Save current study position for 1-Tap "Học Tiếp Ngay" resume
  useEffect(() => {
    if (!currentChapter) return;
    saveLastStudySession({
      courseId: course.id,
      courseTitle: course.title,
      chapterId: currentChapter.id,
      chapterIndex: currentChapter.index,
      chapterTitle: currentChapter.title,
      activeTab,
    });
  }, [
    course.id,
    course.title,
    currentChapter?.id,
    currentChapter?.index,
    currentChapter?.title,
    activeTab,
  ]);

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
      showToast({
        type: "error",
        title: "Không thể xóa chương cuối cùng",
        message: "Khóa học cần có ít nhất 1 chương.",
      });
      return;
    }
    const deletedCh = course.chapters.find((c) => c.id === chapterIdToDelete);
    await runWithFeedback(
      {
        variant: "delete",
        loadingTitle: `Đang xóa "${deletedCh?.title || "chương sách"}"...`,
        loadingSubtitle: "Cập nhật lại lộ trình chương và đồng bộ Cloud",
        successTitle: "Đã xóa chương khỏi khóa học!",
        successMessage: deletedCh?.title,
      },
      async () => {
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
      }
    );
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

      // Gom toàn bộ các trang [Page X] từ tất cả các chương của cuốn sách (không cắt slice(0,3)) để AI thấy đủ từ Unit 1 đến Unit cuối cùng!
      const pageTextMap = new Map<number, string>();
      const allCombinedRaw = course.chapters.map((c) => c.rawText).join("\n\n");
      const pageBlocks = allCombinedRaw.split(/(?=\[Page \d+\])/g);
      for (const block of pageBlocks) {
        const m = block.match(/^\[Page (\d+)\]\s*([\s\S]*)$/);
        if (m) {
          const pNum = parseInt(m[1], 10);
          if (!pageTextMap.has(pNum)) {
            pageTextMap.set(pNum, m[2].trim());
          }
        }
      }

      const summaryLines: string[] = [];
      summaryLines.push("=== NỘI DUNG 15 TRANG ĐẦU (CHỨA MỤC LỤC) ===");
      for (let p = 1; p <= Math.min(15, maxPage); p++) {
        const txt = pageTextMap.get(p) || "";
        if (txt) {
          summaryLines.push(`[Page ${p}] ${txt.slice(0, 350)}`);
        }
      }
      summaryLines.push(
        `\n=== TIÊU ĐỀ ĐẦU TRANG TOÀN BỘ ${maxPage} TRANG SÁCH ===`
      );
      for (let p = 1; p <= maxPage; p++) {
        const txt = pageTextMap.get(p) || "";
        if (txt) {
          summaryLines.push(`[Page ${p}] ${txt.slice(0, 90)}`);
        }
      }
      const pageSummaries =
        summaryLines.length > 2
          ? summaryLines.join("\n").slice(0, 11000)
          : allCombinedRaw.slice(0, 11000);

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
            const slicePages: string[] = [];
            for (let p = sp; p <= ep; p++) {
              const pTxt = pageTextMap.get(p) || "";
              slicePages.push(`[Page ${p}]\n${pTxt}`);
            }
            const builtRawText = slicePages.join("\n\n").trim();
            return {
              id: `${course.id}-toc-ch-${i + 1}-${Date.now()}`,
              courseId: course.id,
              index: i + 1,
              title: ch.title || `Bài ${i + 1} (Trang ${sp}–${ep})`,
              summary: `Trang ${sp}–${ep}`,
              startPage: sp,
              endPage: ep,
              rawText: builtRawText,
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
          hasCloudPdf: pdfBlob.size <= 48 * 1024 * 1024,
          chapters: newChapterUnits,
          updatedAt: new Date().toISOString(),
        };
        await saveCourse(updatedCourse);
        void uploadCourseRawStorageToCloud(updatedCourse, pdfBlob);
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
      // 1. Ưu tiên lấy ảnh trang đã cắt sẵn của chương từ Kho A (Supabase Storage: chapter-{index}.json)
      const cloudChapter = await fetchChapterRawPayloadFromStorage(
        course,
        chapter.index
      );
      if (cloudChapter?.pageImagesBase64?.length) {
        images = cloudChapter.pageImagesBase64;
      } else {
        // 2. Nếu chưa có trong gói chương, cắt trực tiếp từ file PDF gốc
        const pdfBlob = await getCoursePdfBlob(
          course.id,
          course.clonedFromCourseId
        );
        if (pdfBlob) {
          setOcrStatusMsg(
            `Đang cắt các trang PDF (${startP}–${endP}) thành ảnh nhẹ...`
          );
          images = await renderPdfPagesToImagesBase64(pdfBlob, startP, endP, 20);
        } else if (cloudChapter?.rawText && cloudChapter.rawText.length > 20) {
          return cloudChapter.rawText;
        }
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
      .split(/\n\n=== \[NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH \([^\]]*\)\] ===/)[0]
      .trim();

    const ocrHeaderTag =
      modeToUse === "micro_batch_ai"
        ? "=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (AI VISION OCR)] ==="
        : "=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ===";

    const mergedRawText = `${baseRawWithoutOldOcr}\n\n${ocrHeaderTag}\n${extractedOcrText.trim()}`;

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
      // Kiểm tra nhanh xem chương này vừa được User khác trong cộng đồng soạn xong trên Cloud chưa (để nhận ngay miễn phí, không tốn Credit)
      if (!chapter.isGenerated || !chapter.lesson) {
        const communityMerged = await syncCourseLessonsWithCommunity(course);
        if (communityMerged) {
          const syncedCh = communityMerged.chapters.find(
            (c) => c.index === chapter.index || c.id === chapter.id
          );
          if (syncedCh?.isGenerated && syncedCh.lesson) {
            await onCourseUpdated(communityMerged);
            setActiveTab("content");
            return;
          }
        }
      }

      const settings = getAppSettings();
      let textToUse =
        editableRawText.trim().length > 20
          ? editableRawText
          : chapter.rawText;

      let cloudImagesFallback = pageImagesBase64;
      if (textToUse.trim().length < 20) {
        setOcrStatusMsg(
          "Đang tải dữ liệu chương từ Kho lưu trữ Cloud (Supabase Storage)..."
        );
        const cloudPayload = await fetchChapterRawPayloadFromStorage(
          course,
          chapter.index
        );
        if (cloudPayload?.rawText && cloudPayload.rawText.trim().length > 0) {
          textToUse = cloudPayload.rawText;
        }
        if (
          (!cloudImagesFallback || cloudImagesFallback.length === 0) &&
          cloudPayload?.pageImagesBase64?.length
        ) {
          cloudImagesFallback = cloudPayload.pageImagesBase64;
        }
      }

      const alreadyHasOcr =
        textToUse.includes("=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ===") ||
        textToUse.includes(
          "=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (AI VISION OCR)] ==="
        );

      // Step 1: CHỈ chạy đọc ảnh (OCR) khi người dùng CHỦ ĐỘNG bật tích chọn `useHybridVision` hoặc bấm tải ảnh lên!
      // Nếu người dùng không bật `useHybridVision`, gửi thẳng văn bản chữ có sẵn mà không chạy OCR.
      if (
        (pageImagesBase64 && pageImagesBase64.length > 0) ||
        (useHybridVision && !alreadyHasOcr)
      ) {
        textToUse = await extractTextFromChapterImages(
          chapter,
          cloudImagesFallback
        );
      }

      setOcrStatusMsg(
        "AI đang phân tích nội dung chương & trích xuất toàn bộ từ vựng..."
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
      showToast({
        type: "success",
        title: "Đã soạn xong bài giảng chương!",
        message: `Đã trích xuất ${data.lesson?.vocabulary?.length || 0} từ vựng, ${data.lesson?.grammarPoints?.length || 0} ngữ pháp & bộ bài tập.`,
      });
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
      let textToUse =
        editableRawText.trim().length > chapter.rawText.trim().length
          ? editableRawText
          : chapter.rawText;

      const alreadyHasOcr =
        textToUse.includes("=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (OCR)] ===") ||
        textToUse.includes(
          "=== [NỘI DUNG ĐỌC TỪ ẢNH TRANG SÁCH (AI VISION OCR)] ==="
        );

      // Chỉ chạy OCR khi bạn chủ động bấm nút "Quét từ Ảnh / PDF" (truyền pageImagesBase64)
      // hoặc khi bạn đang bật tích chọn useHybridVision mà chương chưa có OCR.
      if (
        (pageImagesBase64 && pageImagesBase64.length > 0) ||
        (useHybridVision && !alreadyHasOcr)
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
        pageImagesBase64,
        apiKey: settings.geminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể quét toàn bộ từ vựng.");
      }

      if (Array.isArray(data.vocabulary) && data.vocabulary.length > 0) {
        const existingVocab = Array.isArray(chapter.lesson.vocabulary)
          ? chapter.lesson.vocabulary
          : [];
        const seenWords = new Set<string>();
        const mergedVocab: typeof existingVocab = [];

        for (const item of [...data.vocabulary, ...existingVocab]) {
          const wKey = String(item?.word || "")
            .trim()
            .toLowerCase();
          if (!wKey || seenWords.has(wKey)) continue;
          seenWords.add(wKey);
          mergedVocab.push({
            ...item,
            id: `voc-${mergedVocab.length + 1}`,
          });
        }

        const updatedChapters = course.chapters.map((ch) =>
          ch.id === chapter.id && ch.lesson
            ? {
                ...ch,
                rawText: textToUse,
                lesson: {
                  ...ch.lesson,
                  vocabulary: mergedVocab,
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
        showToast({
          type: "success",
          title: `Đã trích xuất đủ ${mergedVocab.length} từ vựng!`,
          message: `Chương "${chapter.title}" đã được cập nhật toàn bộ bảng từ vựng & Flashcard SRS.`,
        });
      }
    } catch (err: unknown) {
      setGenError(
        err instanceof Error ? err.message : "Lỗi khi quét toàn bộ từ vựng."
      );
    } finally {
      setOcrStatusMsg(null);
      setIsExtractingFullVocab(false);
    }
  };

  const handleBatchExtractVocabForAllGeneratedChapters = async () => {
    const targetChapters = course.chapters.filter(
      (ch) =>
        ch.isGenerated &&
        ch.lesson &&
        Array.isArray(ch.lesson.vocabulary) &&
        ch.lesson.vocabulary.length < 32
    );
    if (targetChapters.length === 0) {
      showToast({
        type: "info",
        title: "Tất cả các chương đã có đủ từ vựng!",
      });
      return;
    }

    setGenError(null);
    setIsExtractingFullVocab(true);
    try {
      const settings = getAppSettings();
      let workingChapters = [...course.chapters];
      let updatedCount = 0;

      for (let i = 0; i < targetChapters.length; i++) {
        const ch = targetChapters[i];
        setOcrStatusMsg(
          `Đang quét đủ 100% từ vựng cho chương ${i + 1}/${targetChapters.length}: "${ch.title}"...`
        );
        const res = await fetchAiAgent("/api/agent/extract-vocab", {
          courseTitle: course.title,
          chapterTitle: ch.title,
          chapterText: ch.rawText,
          apiKey: settings.geminiApiKey,
          model: selectedAiModel || settings.geminiModel,
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.vocabulary) && data.vocabulary.length > 0) {
          const existingVocab = ch.lesson?.vocabulary || [];
          const seenWords = new Set<string>();
          const mergedVocab: typeof existingVocab = [];
          for (const item of [...data.vocabulary, ...existingVocab]) {
            const wKey = String(item?.word || "")
              .trim()
              .toLowerCase();
            if (!wKey || seenWords.has(wKey)) continue;
            seenWords.add(wKey);
            mergedVocab.push({
              ...item,
              id: `voc-${mergedVocab.length + 1}`,
            });
          }

          workingChapters = workingChapters.map((item) =>
            item.id === ch.id && item.lesson
              ? {
                  ...item,
                  lesson: {
                    ...item.lesson,
                    vocabulary: mergedVocab,
                  },
                }
              : item
          );
          updatedCount++;
        }
      }

      if (updatedCount > 0) {
        const updatedCourse: Course = {
          ...course,
          chapters: workingChapters,
          updatedAt: new Date().toISOString(),
        };
        await saveCourse(updatedCourse);
        await onCourseUpdated(updatedCourse);
        showToast({
          type: "success",
          title: `Đã nâng cấp từ vựng cho ${updatedCount} chương!`,
          message: "Toàn bộ các bài học đã được bổ sung đầy đủ danh sách từ vựng.",
        });
      }
    } catch (err: unknown) {
      setGenError(
        err instanceof Error
          ? err.message
          : "Lỗi khi quét hàng loạt từ vựng cho các chương."
      );
    } finally {
      setOcrStatusMsg(null);
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

  if (!currentChapter) {
    return null;
  }

  const isClonedBook = Boolean(course.clonedFromCourseId);
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

  const renderChapterListContent = (scrollAreaClassName: string) => (
    <>
      {!isClonedBook && hasCachedPdf && (
        <button
          type="button"
          disabled={isRedetectingToc}
          onClick={handleRedetectCourseTocFromSidebar}
          className="mb-3 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50 cursor-pointer"
          title="Dùng Vision AI đọc ảnh 10 trang đầu PDF để chia lại danh sách Bài học theo đúng Mục lục sách"
        >
          {isRedetectingToc ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-amber-400" />
              <span>Vision AI đang đọc ảnh Mục lục...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-400" />
              <span>AI Đọc Mục Lục (TOC) &amp; Chia Lại Bài</span>
            </>
          )}
        </button>
      )}
      <div className="mb-2 flex items-center justify-between px-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        <span>Lộ trình Chương ({course.chapters.length})</span>
        <span>
          {course.chapters.filter((c) => c.isGenerated).length}/
          {course.chapters.length} đã soạn
        </span>
      </div>
      <div className={scrollAreaClassName}>
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
                setIsMobileChapterDrawerOpen(false);
                if (typeof window !== "undefined") {
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              className={`w-full rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-indigo-500/60 bg-indigo-500/15 text-white shadow-sm"
                  : "border-white/[0.06] bg-slate-950/50 text-slate-300 hover:border-white/[0.14] hover:bg-slate-900"
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
                  {!isClonedBook && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleDeleteChapterFromCourse(ch.id, e)}
                      className="rounded p-1 text-slate-500 hover:bg-rose-950/70 hover:text-rose-400"
                      title="Xóa chương không cần thiết này"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  )}
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
    </>
  );

  const handleSelectLearningTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined" && window.scrollY > 120) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:flex-row">
      {/* MOBILE STICKY APP BAR (Chỉ ~52px, thay cho khối sidebar cồng kềnh trên mobile) */}
      <div className="sticky top-14 z-20 flex items-center gap-2 border-b border-white/[0.08] bg-[#090D16]/95 px-3 py-2 backdrop-blur-xl lg:hidden">
        <button
          type="button"
          onClick={() => {
            stopAllSpeech();
            onBackToDashboard();
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-slate-900/90 text-indigo-300 hover:border-indigo-500/40 hover:text-white transition"
          title="Quay lại Tủ sách"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setIsMobileChapterDrawerOpen(true)}
          className="flex h-10 min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 text-left text-xs font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
        >
          <span className="truncate">
            Chương {currentChapter.index}/{course.chapters.length}:{" "}
            {currentChapter.title}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-indigo-300" />
        </button>

        <button
          type="button"
          onClick={() => {
            setShowRawText(!showRawText);
            setEditableRawText(currentChapter.rawText);
          }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
            showRawText
              ? "border-indigo-500/60 bg-indigo-600 text-white"
              : "border-white/[0.08] bg-slate-900/90 text-slate-300 hover:bg-slate-800"
          }`}
          title={showRawText ? "Ẩn văn bản gốc" : "Xem văn bản gốc"}
        >
          <FileText className="h-4 w-4" />
        </button>
      </div>

      {/* MOBILE BOTTOM SHEET MODAL: Chọn Chương */}
      {isMobileChapterDrawerOpen && (
        <>
          <div
            onClick={() => setIsMobileChapterDrawerOpen(false)}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm lg:hidden"
          />
          <div className="fixed bottom-0 inset-x-0 z-50 flex max-h-[82vh] flex-col rounded-t-3xl border-t border-white/[0.12] bg-[#0F1523] p-4 shadow-2xl lg:hidden animate-in slide-in-from-bottom duration-200 pb-safe">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-700" />
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/[0.07] pb-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-white">
                  {course.title}
                </h2>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  {course.author} • CEFR {course.level}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileChapterDrawerOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-slate-900 text-slate-300 hover:text-white"
                title="Đóng danh sách chương"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderChapterListContent("flex-1 space-y-1.5 overflow-y-auto pr-1")}
          </div>
        </>
      )}

      {/* DESKTOP LEFT SIDEBAR: Course Roadmap & Chapters */}
      <aside className="hidden lg:flex lg:w-80 lg:flex-col shrink-0 border-r border-white/[0.08] bg-[#0F1523]/95">
        <div className="border-b border-white/[0.07] p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                stopAllSpeech();
                onBackToDashboard();
              }}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-white/[0.08] bg-slate-900/80 px-2.5 py-1.5 text-xs font-semibold text-indigo-300 hover:border-indigo-500/40 hover:text-white transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Quay lại Tủ sách</span>
            </button>
          </div>

          <h2 className="mt-2.5 line-clamp-2 text-base font-bold text-white">
            {course.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {course.author} • CEFR {course.level}
          </p>
          {course.sourceFileName && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-slate-950/60 px-2.5 py-1 text-[11px] text-slate-300">
              <FileText className="h-3 w-3 text-indigo-400" />
              <span className="max-w-[180px] truncate">
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

        <div className="p-3">
          {renderChapterListContent(
            "space-y-1.5 overflow-y-auto pr-1 max-h-[calc(100vh-15rem)]"
          )}
        </div>
      </aside>

      {/* MAIN CHAPTER WORKSPACE (Single-scroll trên mobile, không nested overflow) */}
      <main
        ref={workspaceContentRef}
        className="flex-1 min-w-0 p-3.5 pb-24 sm:p-5 md:p-6 lg:p-8 lg:pb-8 lg:overflow-y-auto [scrollbar-gutter:stable]"
      >
        {/* Chapter Header + Completion Progress (%) */}
        {(() => {
          const hasLesson = Boolean(lesson);
          const hasCloze = Boolean(
            lesson &&
              lesson.clozeExercises.length > 0 &&
              lesson.clozeExercises.some((ex) => Boolean(clozeChecked[ex.id]))
          );
          const hasQuiz = Boolean(
            lesson &&
              lesson.quizExercises.length > 0 &&
              lesson.quizExercises.some((q) => Boolean(quizSubmitted[q.id]))
          );
          const hasTranslation = Boolean(
            lesson &&
              lesson.translationExercises.some((tr) => Boolean(tr.lastEvaluation))
          );
          const completionPct =
            (hasLesson ? 25 : 0) +
            (hasCloze ? 25 : 0) +
            (hasQuiz ? 25 : 0) +
            (hasTranslation ? 25 : 0);

          return (
            <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-white/[0.08] bg-[#0F1523]/95 p-3.5 sm:p-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-indigo-400">
                  <Layers className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    Chương {currentChapter.index} / {course.chapters.length}
                    {currentChapter.startPage && currentChapter.endPage
                      ? ` • Trang ${currentChapter.startPage}–${currentChapter.endPage}`
                      : ""}
                  </span>
                  <span
                    className={`ml-auto sm:ml-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-normal ${
                      completionPct === 100
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                        : completionPct > 0
                        ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                        : "border-white/[0.08] bg-slate-900 text-slate-400"
                    }`}
                  >
                    Tiến độ: {completionPct}%
                  </span>
                </div>
                <h1 className="mt-1 text-base sm:text-xl font-bold text-white md:text-2xl break-words">
                  {currentChapter.title}
                </h1>
                {/* Visual Completion Progress Bar & 4 Milestones */}
                <div className="mt-2.5 space-y-1.5 max-w-md">
                  <div className="h-1.5 w-full rounded-full bg-slate-800/90 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        completionPct === 100
                          ? "bg-emerald-500"
                          : "bg-gradient-to-r from-indigo-500 to-amber-400"
                      }`}
                      style={{ width: `${completionPct}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-slate-400">
                    <span className={hasLesson ? "text-emerald-400" : ""}>
                      {hasLesson ? "✓" : "○"} Bài học
                    </span>
                    <span className={hasCloze ? "text-emerald-400" : ""}>
                      {hasCloze ? "✓" : "○"} Điền từ
                    </span>
                    <span className={hasQuiz ? "text-emerald-400" : ""}>
                      {hasQuiz ? "✓" : "○"} Trắc nghiệm
                    </span>
                    <span className={hasTranslation ? "text-emerald-400" : ""}>
                      {hasTranslation ? "✓" : "○"} Luyện dịch
                    </span>
                  </div>
                </div>
              </div>

          <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto">
            <select
              value={selectedAiModel}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedAiModel(val);
                const cur = getAppSettings();
                saveAppSettings({ ...cur, geminiModel: val });
              }}
              title="Chọn nguồn AI tạo bài học (Tự động xoay vòng dự phòng nếu hết hạn mức)"
              className="min-h-[40px] flex-1 sm:flex-initial min-w-0 rounded-xl border border-white/[0.1] bg-slate-950 px-2.5 sm:px-3 py-2 text-xs font-semibold text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="qwen-groq">
                Qwen 3 / Llama 3.3 (Groq Siêu Tốc)
              </option>
              <option value="qwen-openrouter">
                Qwen 2.5 / Nemotron VL (OpenRouter)
              </option>
              <option value="qwen-siliconflow">
                Qwen 2.5 (SiliconFlow Cloud)
              </option>
              <option value="gemini-2.5-flash">
                Google Gemini 2.5 Flash (+ Auto Failover)
              </option>
              <option value="gemini-2.0-flash">
                Google Gemini 2.0 Flash
              </option>
            </select>
            <button
              type="button"
              onClick={() => {
                setShowRawText(!showRawText);
                setEditableRawText(currentChapter.rawText);
              }}
              className="hidden lg:inline-flex min-h-[40px] items-center justify-center rounded-xl border border-white/[0.1] bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 text-center transition shrink-0"
            >
              {showRawText ? "Ẩn văn bản gốc" : "Văn bản gốc"}
            </button>
            {!lesson ? (
              <button
                type="button"
                disabled={isGeneratingLesson}
                onClick={() => handleGenerateChapterLesson(currentChapter)}
                className="flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 sm:px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:opacity-50 cursor-pointer"
              >
                {isGeneratingLesson ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>AI đang phân tích...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <span>AI Soạn Bài</span>
                  </>
                )}
              </button>
            ) : (
              <div className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span>Đã soạn</span>
              </div>
            )}
          </div>
        </div>
          );
        })()}

        {/* Raw Text Drawer */}
        {showRawText && (
          <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-indigo-300">
                Văn bản gốc trích xuất từ Sách ({editableRawText.length.toLocaleString()} ký tự)
              </span>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-slate-400">
                  Chỉnh sửa hoặc dán bổ sung nội dung chương
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await runWithFeedback(
                      {
                        variant: "edit",
                        loadingTitle: "Đang lưu văn bản gốc chương...",
                        loadingSubtitle: "Đồng bộ nội dung chương vào bộ nhớ & Cloud",
                        successTitle: "Đã lưu văn bản chương!",
                      },
                      async () => {
                        const updatedChapters = course.chapters.map((ch) =>
                          ch.id === currentChapter.id
                            ? { ...ch, rawText: editableRawText }
                            : ch
                        );
                        const updatedCourse: Course = {
                          ...course,
                          chapters: updatedChapters,
                          updatedAt: new Date().toISOString(),
                        };
                        await saveCourse(updatedCourse);
                        await onCourseUpdated(updatedCourse);
                        setShowRawText(false);
                      }
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Lưu văn bản</span>
                </button>
              </div>
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
                    Bóc chữ sạch từ ảnh (trang {currentChapter.startPage || 1}–{currentChapter.endPage || 15}) trước khi soạn bài để tránh lỗi quá tải ảnh.
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
            {/* Desktop Navigation Tabs (Hidden on mobile; Mobile uses Fixed Bottom Tab Bar) */}
            <div className="hidden lg:flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5">
              <button
                type="button"
                onClick={() => handleSelectLearningTab("content")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "content"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-4 w-4 shrink-0" />
                <span>1. Nội dung &amp; Diễn giải ({lesson.contentAnalysis.length} phần)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectLearningTab("grammar")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
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
                onClick={() => handleSelectLearningTab("vocabulary")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "vocabulary"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>3. Từ vựng &amp; Flashcard SRS ({lesson.vocabulary.length})</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectLearningTab("practice")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "practice"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <HelpCircle className="h-4 w-4 shrink-0" />
                <span>
                  4. Điền từ &amp; Trắc nghiệm (
                  {lesson.clozeExercises.length + lesson.quizExercises.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectLearningTab("translation")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "translation"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Languages className="h-4 w-4 shrink-0" />
                <span>
                  5. Luyện dịch &amp; AI Chấm điểm % (
                  {lesson.translationExercises.length})
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectLearningTab("exam_arena")}
                className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === "exam_arena"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow"
                    : "text-amber-300 hover:bg-slate-800"
                }`}
              >
                <Trophy className="h-4 w-4 shrink-0" />
                <span>6. Phòng Thi &amp; Ôn Tập Đa Dạng (Exam Arena)</span>
              </button>
            </div>

            {/* Smart Banner when a previously generated chapter has fewer than 35 vocabulary words (only in Content tab so other tabs keep exact Y alignment) */}
            {lesson.vocabulary.length < 35 && activeTab === "content" && (
              <div className="mb-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-gradient-to-r from-amber-950/35 via-slate-900 to-indigo-950/35 p-4">
                <div className="space-y-0.5 text-xs">
                  <div className="font-bold text-amber-300">
                    Chương này hiện mới có {lesson.vocabulary.length} từ vựng (do bản soạn rút gọn 12–16 từ trước đó)
                  </div>
                  <p className="text-slate-300">
                    Bấm nút bên cạnh để AI chia 3 phân đoạn + vét cạn 100% các mục từ vựng trong bài (lấy đủ 35–50+ từ cho chương này hoặc toàn bộ các chương đã soạn)!
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isExtractingFullVocab}
                    onClick={() => {
                      setActiveTab("vocabulary");
                      void handleExtractFullVocab(currentChapter);
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:from-amber-400 hover:to-indigo-500 disabled:opacity-50 cursor-pointer"
                  >
                    {isExtractingFullVocab ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Đang quét đủ 100% từ vựng...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        <span>+ Quét Đủ Từ Vựng Chương Này</span>
                      </>
                    )}
                  </button>
                  {course.chapters.filter(
                    (c) =>
                      c.isGenerated &&
                      c.lesson &&
                      (c.lesson.vocabulary?.length || 0) < 32
                  ).length > 1 && (
                    <button
                      type="button"
                      disabled={isExtractingFullVocab}
                      onClick={() => {
                        setActiveTab("vocabulary");
                        void handleBatchExtractVocabForAllGeneratedChapters();
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-950/60 px-3.5 py-2 text-xs font-bold text-indigo-200 hover:bg-indigo-900/70 disabled:opacity-50 cursor-pointer"
                    >
                      <Layers className="h-3.5 w-3.5 text-indigo-300" />
                      <span>Quét Đủ Cho Tất Cả Chương Đã Soạn</span>
                    </button>
                  )}
                </div>
              </div>
            )}

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
              <ContentTab
                key={currentChapter.id}
                courseTitle={course.title}
                chapterTitle={currentChapter.title}
                chapterRawText={currentChapter.rawText}
                lesson={lesson}
              />
            )}

            {/* TAB 2: GRAMMAR IN CONTEXT */}
            {activeTab === "grammar" && (
              <GrammarTab
                grammarPoints={lesson.grammarPoints}
                onOpenPronunciation={openPronunciationCoach}
              />
            )}

            {/* TAB 3: VOCABULARY & SRS FLASHCARDS */}
            {activeTab === "vocabulary" && (
              <VocabularyTab
                course={course}
                currentChapter={currentChapter}
                lesson={lesson}
                chapterFlashcards={chapterFlashcards}
                isExtractingFullVocab={isExtractingFullVocab}
                onSetIsExtractingFullVocab={setIsExtractingFullVocab}
                onExtractFullVocab={handleExtractFullVocab}
                onCourseUpdated={onCourseUpdated}
                onHasCachedPdf={() => setHasCachedPdf(true)}
                onOpenPronunciation={openPronunciationCoach}
              />
            )}

            {/* TAB 4: CLOZE (FILL-IN-BLANK) & MULTIPLE CHOICE QUIZZES */}
            {activeTab === "practice" && (
              <PracticeTab
                currentChapter={currentChapter}
                lesson={lesson}
                isSupplementingExercises={isSupplementingExercises}
                genError={genError}
                onSupplementExercises={handleSupplementExercises}
                clozeInputs={clozeInputs}
                clozeChecked={clozeChecked}
                onClozeInputChange={(clozeId, value) => {
                  setClozeInputs({ ...clozeInputs, [clozeId]: value });
                  setClozeChecked({ ...clozeChecked, [clozeId]: false });
                }}
                onCheckCloze={handleCheckCloze}
                onRevealCloze={(clozeId, answer) => {
                  setClozeInputs({ ...clozeInputs, [clozeId]: answer });
                  handleCheckCloze(clozeId, answer);
                }}
                quizSelected={quizSelected}
                quizSubmitted={quizSubmitted}
                onSelectQuizOption={(quizId, optIdx) =>
                  setQuizSelected({ ...quizSelected, [quizId]: optIdx })
                }
                onSubmitQuiz={handleSubmitQuiz}
              />
            )}

            {/* TAB 5: SENTENCE TRANSLATION & AI SEMANTIC EVALUATION (%) */}
            {activeTab === "translation" && (
              <TranslationTab
                course={course}
                currentChapter={currentChapter}
                lesson={lesson}
                isSupplementingExercises={isSupplementingExercises}
                genError={genError}
                onSupplementExercises={handleSupplementExercises}
                onCourseUpdated={onCourseUpdated}
                onOpenPronunciation={openPronunciationCoach}
              />
            )}
          </div>
        )}
      </main>

      {/* MOBILE FIXED BOTTOM TAB BAR (6 Tab Học Tập 1 Chạm khi Chương Đã Soạn) */}
      {lesson && (
        <nav
          aria-label="Tab bài học"
          className="fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.08] bg-[#090D16]/95 backdrop-blur-xl pb-safe lg:hidden"
        >
          <div className="mx-auto grid max-w-2xl grid-cols-6 items-center px-1 pt-1 pb-0.5">
            {(
              [
                {
                  id: "content",
                  label: "Nội dung",
                  count: lesson.contentAnalysis.length,
                  icon: BookOpen,
                  isExam: false,
                },
                {
                  id: "grammar",
                  label: "Ngữ pháp",
                  count: lesson.grammarPoints.length,
                  icon: GraduationCap,
                  isExam: false,
                },
                {
                  id: "vocabulary",
                  label: "Từ vựng",
                  count: lesson.vocabulary.length,
                  icon: Layers,
                  isExam: false,
                },
                {
                  id: "practice",
                  label: "Bài tập",
                  count:
                    lesson.clozeExercises.length + lesson.quizExercises.length,
                  icon: HelpCircle,
                  isExam: false,
                },
                {
                  id: "translation",
                  label: "Dịch câu",
                  count: lesson.translationExercises.length,
                  icon: Languages,
                  isExam: false,
                },
                {
                  id: "exam_arena",
                  label: "Phòng thi",
                  count: null,
                  icon: Trophy,
                  isExam: true,
                },
              ] as const
            ).map((tabItem) => {
              const Icon = tabItem.icon;
              const isActive = activeTab === tabItem.id;
              return (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => handleSelectLearningTab(tabItem.id)}
                  className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[10px] font-semibold transition ${
                    isActive
                      ? tabItem.isExam
                        ? "text-amber-400 bg-amber-500/10"
                        : "text-indigo-400 bg-indigo-500/10"
                      : tabItem.isExam
                      ? "text-amber-300/80 hover:text-amber-200"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <div className="relative flex items-center justify-center">
                    <Icon className="h-4 w-4 shrink-0" />
                    {tabItem.count !== null && tabItem.count > 0 && (
                      <span
                        className={`ml-0.5 rounded px-1 text-[8px] font-bold leading-tight ${
                          isActive
                            ? "bg-indigo-500/30 text-indigo-200"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {tabItem.count}
                      </span>
                    )}
                  </div>
                  <span className="truncate max-w-full leading-tight">
                    {tabItem.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Instant Text Selection Popover (Bôi đen để Nghe & AI Giải thích ngay) */}
      <SelectionAiPopover
        containerRef={workspaceContentRef}
        courseTitle={course.title}
        chapterTitle={currentChapter.title}
        chapterText={currentChapter.rawText}
        selectedAiModel={selectedAiModel}
      />

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
