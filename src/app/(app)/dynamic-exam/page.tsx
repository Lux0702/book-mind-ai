"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Sparkles,
  Upload,
  FileText,
  Layers,
  Timer,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  Trophy,
  Loader2,
  Infinity as InfinityIcon,
  Clock,
  SlidersHorizontal,
  X,
  Check,
  FileUp,
  Trash2,
  Plus,
} from "lucide-react";
import {
  QuizExercise,
  ClozeExercise,
  TranslationExercise,
  TranslationEvaluation,
} from "@/types/course";
import { ROUTES } from "@/lib/routes";
import { useAppData } from "@/components/app/AppDataProvider";
import {
  parseHeavyPdfClientSide,
  convertUploadedFilesToImagesBase64,
  runLocalBrowserOcrOnImages,
} from "@/lib/pdfParser";
import { getAppSettings, recordLearningActivity } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import { triggerChibiCelebrate } from "@/lib/chibiEvents";
import { stopAllSpeech } from "@/lib/tts";
import CustomSelect from "@/components/ui/CustomSelect";
import AudioSpeakButton from "@/components/AudioSpeakButton";
import ExamGeneratingLoader from "@/components/loadings/ExamGeneratingLoader";

interface DynamicExamQuestion {
  id: string;
  type: "quiz" | "cloze" | "translation";
  categoryLabel: string;
  sourceLabel?: string;
  promptText: string;
  subHint?: string;
  options?: string[];
  correctIndex?: number;
  correctTextAnswer?: string;
  explanation?: string;
  referenceTranslation?: string;
}

const DYNAMIC_PROMPT_PRESETS = [
  "Tập trung vào Ngữ pháp",
  "Tập trung vào Từ vựng",
  "Chỉ Trắc nghiệm & Điền từ (không dịch)",
  "Tăng độ khó nâng cao",
  "Câu hỏi vận dụng thực tế từ tài liệu",
];

function shouldShowAudioForQuestion(q: DynamicExamQuestion): boolean {
  const textToCheck = `${q.categoryLabel || ""} ${q.promptText || ""}`;
  const isListeningOrReadingRelated =
    /(nghe|đọc hiểu|luyện đọc|phát âm|âm thanh|listen|listening|audio|pronunciation|speaking|reading)/i.test(
      textToCheck
    );
  if (q.type === "quiz" || q.type === "cloze") {
    return isListeningOrReadingRelated;
  }
  return true;
}

export default function DynamicExamPage() {
  const router = useRouter();
  const { courses, flashcards } = useAppData();

  // 1. File & Text Source State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [extractedFileText, setExtractedFileText] = useState<string>("");
  const [fileStats, setFileStats] = useState<{ pages?: number; chars: number } | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [parseStatusText, setParseStatusText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");

  // 2. Optional Lesson Combination State
  const [combineWithLessons, setCombineWithLessons] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [mixExistingLessonQuestions, setMixExistingLessonQuestions] = useState(true);
  const [lessonQuestionLimit, setLessonQuestionLimit] = useState<string>("all");

  useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId) || courses[0] || null,
    [courses, selectedCourseId]
  );

  // 3. Prompt & Exam Settings
  const [customPrompt, setCustomPrompt] = useState("");
  const [appliedPrompt, setAppliedPrompt] = useState("");
  const [aiQuestionCount, setAiQuestionCount] = useState<string>("all");
  const [secondsPerQuestion, setSecondsPerQuestion] = useState<number>(30);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 4. Generated Exam & Runner State
  const [examTitle, setExamTitle] = useState("");
  const [examQuestions, setExamQuestions] = useState<DynamicExamQuestion[]>([]);
  const [examStarted, setExamStarted] = useState(false);
  const [examFinished, setExamFinished] = useState(false);
  const [examStepIndex, setExamStepIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [isQuestionLocked, setIsQuestionLocked] = useState(false);
  const [showSummaryPromptComposer, setShowSummaryPromptComposer] = useState(false);

  const [userQuizChoice, setUserQuizChoice] = useState<number | null>(null);
  const [userClozeInput, setUserClozeInput] = useState("");
  const [userTranslationInput, setUserTranslationInput] = useState("");
  const [isEvaluatingTranslation, setIsEvaluatingTranslation] = useState(false);
  const [currentTranslationEval, setCurrentTranslationEval] =
    useState<TranslationEvaluation | null>(null);
  const [examResults, setExamResults] = useState<
    {
      question: DynamicExamQuestion;
      isCorrect: boolean;
      timedOut: boolean;
      userAnswerText: string;
      translationScore?: number;
      translationEval?: TranslationEvaluation;
    }[]
  >([]);

  const lockedAtRef = useRef<number>(0);

  const currentExamQ = examQuestions[examStepIndex];
  const isCurrentQuestionUntimed =
    secondsPerQuestion === 0 || currentExamQ?.type === "translation";

  useEffect(() => {
    stopAllSpeech();
    return () => stopAllSpeech();
  }, [examStepIndex, examStarted, examFinished]);

  useEffect(() => {
    if (isQuestionLocked) {
      lockedAtRef.current = Date.now();
    }
  }, [isQuestionLocked]);

  // Press Enter after answering to jump straight to the next question
  useEffect(() => {
    if (!examStarted || examFinished || !isQuestionLocked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (Date.now() - lockedAtRef.current < 250) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      e.preventDefault();
      handleNextExamQuestion();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  // Countdown timer
  useEffect(() => {
    if (
      !examStarted ||
      examFinished ||
      isQuestionLocked ||
      !currentExamQ ||
      isCurrentQuestionUntimed
    ) {
      return;
    }
    if (timeLeft <= 0) {
      setIsQuestionLocked(true);
      setExamResults((prev) => [
        ...prev,
        {
          question: currentExamQ,
          isCorrect: false,
          timedOut: true,
          userAnswerText: "(Hết thời gian trả lời)",
        },
      ]);
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [
    examStarted,
    examFinished,
    isQuestionLocked,
    timeLeft,
    currentExamQ,
    isCurrentQuestionUntimed,
  ]);

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setParseError(null);
    setIsParsingFile(true);
    setParseStatusText(`Đang đọc tệp "${file.name}"...`);

    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".pdf")) {
        const parsed = await parseHeavyPdfClientSide(file, (info) => {
          setParseStatusText(info.statusText);
        });
        const fullText = parsed.pageTexts
          .map((t, idx) => (t.trim() ? `[Trang ${idx + 1}]\n${t.trim()}` : ""))
          .filter(Boolean)
          .join("\n\n");
        if (!fullText.trim()) {
          throw new Error(
            "File PDF này không có lớp chữ (PDF scan ảnh). Bạn có thể chụp ảnh trang tài liệu (.png/.jpg) tải lên hoặc dán nội dung vào ô văn bản bên dưới."
          );
        }
        setUploadedFileName(file.name);
        setExtractedFileText(fullText);
        setFileStats({ pages: parsed.totalPages, chars: fullText.length });
      } else if (
        lower.endsWith(".png") ||
        lower.endsWith(".jpg") ||
        lower.endsWith(".jpeg") ||
        lower.endsWith(".webp")
      ) {
        setParseStatusText("Đang nhận diện chữ từ hình ảnh (OCR)...");
        const imgs = await convertUploadedFilesToImagesBase64([file]);
        const ocrText = await runLocalBrowserOcrOnImages(imgs, 1, (msg: string) =>
          setParseStatusText(msg)
        );
        if (!ocrText.trim()) {
          throw new Error("Không trích xuất được chữ từ ảnh. Vui lòng thử ảnh rõ nét hơn.");
        }
        setUploadedFileName(file.name);
        setExtractedFileText(ocrText);
        setFileStats({ pages: 1, chars: ocrText.length });
      } else {
        // TXT, MD, CSV, JSON, etc.
        const raw = await file.text();
        if (!raw.trim()) {
          throw new Error("Tệp rỗng, không có nội dung văn bản.");
        }
        setUploadedFileName(file.name);
        setExtractedFileText(raw);
        setFileStats({ chars: raw.length });
      }
    } catch (err: unknown) {
      setParseError(
        err instanceof Error ? err.message : "Không thể đọc tệp tài liệu."
      );
    } finally {
      setIsParsingFile(false);
      setParseStatusText("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleChapterSelection = (chapterId: string) => {
    setSelectedChapterIds((prev) =>
      prev.includes(chapterId)
        ? prev.filter((id) => id !== chapterId)
        : [...prev, chapterId]
    );
  };

  const selectedChapters = useMemo(() => {
    if (!combineWithLessons || !selectedCourse) return [];
    return selectedCourse.chapters.filter((ch) =>
      selectedChapterIds.includes(ch.id)
    );
  }, [combineWithLessons, selectedCourse, selectedChapterIds]);

  const totalAvailableLessonQuestions = useMemo(() => {
    return selectedChapters.reduce(
      (sum, ch) =>
        sum +
        (ch.lesson?.quizExercises?.length || 0) +
        (ch.lesson?.clozeExercises?.length || 0) +
        (ch.lesson?.translationExercises?.length || 0),
      0
    );
  }, [selectedChapters]);

  const hasEnoughInput =
    extractedFileText.trim().length > 20 ||
    pastedText.trim().length > 20 ||
    selectedChapters.length > 0;

  const handleGenerateDynamicExam = async (overridePrompt?: string) => {
    if (!hasEnoughInput) {
      setGenerateError(
        "Vui lòng tải lên tệp tài liệu, dán nội dung văn bản, hoặc chọn ít nhất 1 bài học để kết hợp."
      );
      return;
    }

    const promptToUse = (overridePrompt ?? customPrompt).trim();
    setIsGenerating(true);
    setGenerateError(null);

    try {
      const settings = getAppSettings();

      // Build combined payload: Uploaded file + pasted text + selected lessons
      const sections: string[] = [];

      if (extractedFileText.trim()) {
        sections.push(
          `=== TÀI LIỆU TẢI LÊN (${uploadedFileName || "Tệp người dùng"}) ===\n${extractedFileText
            .trim()
            .slice(0, 55000)}`
        );
      }

      if (pastedText.trim()) {
        sections.push(
          `=== NỘI DUNG NGƯỜI HỌC DÁN THÊM ===\n${pastedText.trim().slice(0, 12000)}`
        );
      }

      if (selectedChapters.length > 0 && selectedCourse) {
        const lessonContextParts = selectedChapters.map((ch) => {
          const chCards = flashcards.filter(
            (f) => f.courseId === selectedCourse.id && f.chapterId === ch.id
          );
          const vocabLines =
            chCards.length > 0
              ? chCards
                  .slice(0, 40)
                  .map((c) => `- ${c.word} (${c.ipa}): ${c.vietnameseMeaning}`)
                  .join("\n")
              : (ch.lesson?.vocabulary || [])
                  .slice(0, 40)
                  .map((v) => `- ${v.word} (${v.ipa}): ${v.vietnameseMeaning}`)
                  .join("\n");

          const grammarLines = (ch.lesson?.grammarPoints || [])
            .map((g) => `- ${g.title} (${g.patternFormula}): ${g.detailedExplanation}`)
            .join("\n");

          return `--- Bài học: ${ch.title} ---\nTừ vựng:\n${vocabLines || "(Chưa có)"}\nNgữ pháp:\n${grammarLines || "(Chưa có)"}`;
        });

        sections.push(
          `=== KIẾN THỨC TỪ CÁC BÀI HỌC ĐÃ CHỌN TRONG "${selectedCourse.title}" ===\n${lessonContextParts
            .join("\n\n")
            .slice(0, 15000)}`
        );
      }

      const scopeTitleParts: string[] = [];
      if (uploadedFileName) scopeTitleParts.push(uploadedFileName);
      if (pastedText.trim() && !uploadedFileName) scopeTitleParts.push("Văn bản tự nhập");
      if (selectedChapters.length > 0) {
        scopeTitleParts.push(`${selectedChapters.length} bài học kết hợp`);
      }
      const scopeTitle = scopeTitleParts.join(" + ") || "Đề thi động";

      const res = await fetchAiAgent("/api/agent/generate-exam", {
        courseTitle: selectedCourse?.title || "Đề Thi Động Từ Tài Liệu",
        scopeTitle,
        scannedContentAndVocab: sections.join("\n\n"),
        customPrompt: promptToUse || undefined,
        targetQuestionCount:
          aiQuestionCount === "all" ? "all" : Number(aiQuestionCount) || 20,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể sinh đề thi động.");
      }

      const aiExam = data.exam as {
        examTitle?: string;
        quizQuestions?: QuizExercise[];
        clozeQuestions?: ClozeExercise[];
        translationChallenges?: TranslationExercise[];
      };

      const builtQuestions: DynamicExamQuestion[] = [];

      for (const q of aiExam.quizQuestions || []) {
        builtQuestions.push({
          id: `dyn-q-${q.id}-${Math.random().toString(36).slice(2, 6)}`,
          type: "quiz",
          categoryLabel: `Trắc nghiệm ${
            q.category === "grammar" ? "Ngữ pháp" : "Từ vựng"
          }`,
          sourceLabel: "AI từ tài liệu",
          promptText: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        });
      }

      for (const c of aiExam.clozeQuestions || []) {
        builtQuestions.push({
          id: `dyn-c-${c.id}-${Math.random().toString(36).slice(2, 6)}`,
          type: "cloze",
          categoryLabel: "Điền từ / Ngữ pháp vào chỗ trống",
          sourceLabel: "AI từ tài liệu",
          promptText: c.sentenceWithBlank,
          subHint: `${c.hint}${
            c.fullSentenceTranslation ? ` (Nghĩa: ${c.fullSentenceTranslation})` : ""
          }`,
          correctTextAnswer: c.answer,
          explanation: c.explanation,
        });
      }

      for (const t of aiExam.translationChallenges || []) {
        builtQuestions.push({
          id: `dyn-t-${t.id}-${Math.random().toString(36).slice(2, 6)}`,
          type: "translation",
          categoryLabel: "Dịch thuật (Không giới hạn thời gian)",
          sourceLabel: "AI từ tài liệu",
          promptText: t.originalSentence,
          subHint: t.contextHint,
          referenceTranslation: t.referenceTranslation,
        });
      }

      // Optionally mix existing questions from selected lessons
      if (combineWithLessons && mixExistingLessonQuestions && selectedChapters.length > 0) {
        const lessonPool: DynamicExamQuestion[] = [];
        for (const ch of selectedChapters) {
          (ch.lesson?.quizExercises || []).forEach((qz, idx) => {
            lessonPool.push({
              id: `les-q-${ch.id}-${idx}`,
              type: "quiz",
              categoryLabel:
                qz.category === "grammar"
                  ? "Trắc nghiệm Ngữ pháp"
                  : "Trắc nghiệm Từ vựng",
              sourceLabel: `Bài học: ${ch.title}`,
              promptText: qz.question,
              options: qz.options,
              correctIndex: qz.correctIndex,
              explanation: qz.explanation,
            });
          });
          (ch.lesson?.clozeExercises || []).forEach((cl, idx) => {
            lessonPool.push({
              id: `les-c-${ch.id}-${idx}`,
              type: "cloze",
              categoryLabel: "Điền từ & Ngữ pháp",
              sourceLabel: `Bài học: ${ch.title}`,
              promptText: cl.sentenceWithBlank,
              subHint: `${cl.hint}${
                cl.fullSentenceTranslation ? ` — (${cl.fullSentenceTranslation})` : ""
              }`,
              correctTextAnswer: cl.answer,
              explanation: cl.explanation,
            });
          });
          (ch.lesson?.translationExercises || []).forEach((tr, idx) => {
            lessonPool.push({
              id: `les-t-${ch.id}-${idx}`,
              type: "translation",
              categoryLabel: "Dịch câu (Không giới hạn thời gian)",
              sourceLabel: `Bài học: ${ch.title}`,
              promptText: tr.originalSentence,
              subHint: tr.contextHint,
              referenceTranslation: tr.referenceTranslation,
            });
          });
        }
        const shuffledLessonPool = lessonPool.sort(() => Math.random() - 0.5);
        const pickedLessonQs =
          lessonQuestionLimit === "all"
            ? shuffledLessonPool
            : shuffledLessonPool.slice(0, Math.max(1, Number(lessonQuestionLimit) || 10));
        // Keep translation challenges at the end
        const allMerged = [...builtQuestions, ...pickedLessonQs];
        const nonTrans = allMerged.filter((q) => q.type !== "translation");
        const trans = allMerged.filter((q) => q.type === "translation");
        setExamQuestions([...nonTrans, ...trans]);
      } else {
        setExamQuestions(builtQuestions);
      }

      setExamTitle(aiExam.examTitle || `Đề Thi Động: ${scopeTitle}`);
      setAppliedPrompt(promptToUse);
      setShowSummaryPromptComposer(false);
      setExamResults([]);
      setExamStepIndex(0);
      setUserQuizChoice(null);
      setUserClozeInput("");
      setUserTranslationInput("");
      setCurrentTranslationEval(null);
      setIsQuestionLocked(false);
      setTimeLeft(secondsPerQuestion);
      setExamFinished(false);
      setExamStarted(true);
    } catch (err: unknown) {
      setGenerateError(
        err instanceof Error ? err.message : "Lỗi khi gọi AI tạo đề thi động."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const restartCurrentExam = () => {
    setExamResults([]);
    setExamStepIndex(0);
    setUserQuizChoice(null);
    setUserClozeInput("");
    setUserTranslationInput("");
    setCurrentTranslationEval(null);
    setIsQuestionLocked(false);
    setTimeLeft(secondsPerQuestion);
    setExamFinished(false);
    setExamStarted(true);
  };

  const handleConfirmCloze = () => {
    if (!currentExamQ || isQuestionLocked || currentExamQ.type !== "cloze") return;
    const cleanUser = userClozeInput.trim();
    const isCorrect =
      cleanUser.toLowerCase() ===
      (currentExamQ.correctTextAnswer || "").trim().toLowerCase();
    setIsQuestionLocked(true);
    setExamResults((prev) => [
      ...prev,
      {
        question: currentExamQ,
        isCorrect,
        timedOut: false,
        userAnswerText: cleanUser || "(Bỏ trống)",
      },
    ]);
  };

  const handleEvaluateTranslation = async () => {
    if (!currentExamQ || !userTranslationInput.trim()) return;
    setIsEvaluatingTranslation(true);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/evaluate-translation", {
        originalSentence: currentExamQ.promptText,
        referenceTranslation: currentExamQ.referenceTranslation || "",
        contextHint: currentExamQ.subHint || "",
        userTranslation: userTranslationInput,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể chấm điểm dịch thuật.");
      }
      const evaluation: TranslationEvaluation = data.evaluation;
      setCurrentTranslationEval(evaluation);
      setIsQuestionLocked(true);
      setExamResults((prev) => [
        ...prev,
        {
          question: currentExamQ,
          isCorrect: evaluation.overallScore >= 70,
          timedOut: false,
          userAnswerText: userTranslationInput,
          translationScore: evaluation.overallScore,
          translationEval: evaluation,
        },
      ]);
    } catch (err: unknown) {
      window.alert(
        err instanceof Error
          ? err.message
          : "Lỗi khi chấm điểm câu dịch. Hãy kiểm tra API Key."
      );
    } finally {
      setIsEvaluatingTranslation(false);
    }
  };

  const handleNextExamQuestion = () => {
    if (examStepIndex + 1 >= examQuestions.length) {
      setExamFinished(true);
      const total = examResults.length;
      const correctCount = examResults.filter((r) => r.isCorrect).length;
      const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
      recordLearningActivity({
        type: "exam_completed",
        title: examTitle || "Đề Thi Động Từ File",
        details: `Hoàn thành đề thi động: đúng ${correctCount}/${total} câu (${pct}%)`,
      });
      if (pct >= 70) {
        triggerChibiCelebrate({
          badge: "🏆 HOÀN THÀNH ĐỀ THI ĐỘNG!",
          message: `Đạt ${pct}% (${correctCount}/${total} câu) quá đỉnh luôn!! 🎉`,
          subtext: examTitle || "Đề Thi Động AI",
        });
      }
      return;
    }
    setExamStepIndex((i) => i + 1);
    setUserQuizChoice(null);
    setUserClozeInput("");
    setUserTranslationInput("");
    setCurrentTranslationEval(null);
    setIsQuestionLocked(false);
    setTimeLeft(secondsPerQuestion);
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 space-y-5">
      {/* Unified 3-Mode Switcher at the very top */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-3.5 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 flex-1">
          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.srs);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#F5EFE6] hover:border-[#F5EFE6] transition-colors cursor-pointer"
          >
            <BookOpen className="h-4 w-4 text-[#B8D8F8] shrink-0" />
            <span className="truncate">1. Ôn &amp; Thi Theo Sách</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("bookmind:route-start"));
              router.push(ROUTES.topicVocab);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#F5EFE6] hover:border-[#F5EFE6] transition-colors cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-[#C8B6FF] shrink-0" />
            <span className="truncate">2. Từ Vựng Chủ Đề</span>
          </button>

          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
          >
            <FileUp className="h-4 w-4 shrink-0" />
            <span className="truncate">3. Đề Thi Động Từ File (AI)</span>
          </button>
        </div>
      </div>

      {/* SETUP VIEW */}
      {!examStarted && !examFinished && (
        <div className="space-y-5">
          {/* Header Banner */}
          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
                  <FileUp className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-extrabold text-[#F5EFE6]">
                    Phòng Tạo Đề Thi Động Từ File (AI)
                  </h1>
                  <p className="text-xs text-[#B8B2A6] mt-0.5">
                    Tải lên tài liệu PDF / TXT / MD / Ảnh để AI đọc và tạo bộ câu hỏi kiểm tra ngay lập tức — có thể kết hợp thêm bài học trong tủ sách của bạn.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* LEFT COLUMN: Step 1 Upload File + Paste Text */}
            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#F3C969]">
                    <Upload className="h-4 w-4" />
                    Bước 1: Gửi File Tài Liệu Cho AI Đọc
                  </h2>
                  {uploadedFileName && (
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedFileName("");
                        setExtractedFileText("");
                        setFileStats(null);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#FF8A8A] px-2.5 py-1 text-[11px] font-bold text-[#FF8A8A] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      Gỡ tệp
                    </button>
                  )}
                </div>

                {/* Dropzone */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <div
                  onClick={() => !isParsingFile && fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (!isParsingFile) {
                      handleFileSelected(e.dataTransfer.files?.[0] || null);
                    }
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
                    uploadedFileName
                      ? "border-[#A7D7A9] bg-[#141413]"
                      : "border-[#3A3832] bg-[#141413] hover:border-[#F3C969]"
                  }`}
                >
                  {isParsingFile ? (
                    <>
                      <Loader2 className="h-8 w-8 animate-spin text-[#F3C969]" />
                      <p className="text-xs font-bold text-[#F5EFE6]">
                        {parseStatusText || "Đang xử lý tệp..."}
                      </p>
                    </>
                  ) : uploadedFileName ? (
                    <>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] text-[#141413]">
                        <FileText className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-extrabold text-[#F5EFE6]">
                        {uploadedFileName}
                      </p>
                      <p className="text-xs text-[#A7D7A9] font-bold">
                        Đã đọc thành công{" "}
                        {fileStats?.pages ? `${fileStats.pages} trang • ` : ""}
                        {fileStats?.chars.toLocaleString()} ký tự (Nhấn để đổi tệp khác)
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                        <Upload className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-extrabold text-[#F5EFE6]">
                        Kéo thả hoặc nhấn để chọn file tài liệu
                      </p>
                      <p className="text-xs text-[#B8B2A6]">
                        Hỗ trợ PDF, TXT, Markdown (.md), hoặc ảnh chụp trang sách (.png, .jpg)
                      </p>
                    </>
                  )}
                </div>

                {parseError && (
                  <div className="rounded-lg border-2 border-[#FF8A8A] bg-[#141413] p-3 text-xs font-bold text-[#FF8A8A]">
                    {parseError}
                  </div>
                )}

                {/* Optional Pasted Text */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#B8B2A6]">
                    Hoặc dán nhanh đoạn ghi chú / từ vựng / văn bản muốn ra đề (Tùy chọn):
                  </label>
                  <textarea
                    rows={3}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Dán nội dung bài học, danh sách từ vựng, cấu trúc ngữ pháp hoặc đoạn văn vào đây..."
                    className="w-full rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3 text-xs text-[#F5EFE6] placeholder:text-[#8E887D] focus:border-[#F3C969] focus:outline-none"
                  />
                </div>
              </div>

              {/* Step 3: Custom AI Prompt + Timer */}
              <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#C8B6FF]">
                  <SlidersHorizontal className="h-4 w-4" />
                  Bước 3: Yêu Cầu Trọng Tâm Cho AI &amp; Thời Gian
                </h2>

                <div className="space-y-2">
                  <textarea
                    rows={2}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="VD: Tập trung vào ngữ pháp và cách chia động từ, tạo 10 câu trắc nghiệm khó hơn, không cần câu dịch..."
                    className="w-full rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3 text-xs text-[#F5EFE6] placeholder:text-[#8E887D] focus:border-[#F3C969] focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {DYNAMIC_PROMPT_PRESETS.map((preset) => {
                      const active = customPrompt
                        .toLowerCase()
                        .includes(preset.toLowerCase());
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() =>
                            setCustomPrompt((prev) =>
                              prev.trim()
                                ? prev.toLowerCase().includes(preset.toLowerCase())
                                  ? prev
                                  : `${prev.trim()}, ${preset}`
                                : preset
                            )
                          }
                          className={`rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer ${
                            active
                              ? "border-[#F3C969] bg-[#F3C969] text-[#141413]"
                              : "border-[#3A3832] bg-[#141413] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
                          }`}
                        >
                          + {preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#3A3832]">
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-[#B8B2A6]">
                      Số câu hỏi AI tạo từ file:
                    </span>
                    <CustomSelect
                      value={aiQuestionCount}
                      onChange={(v) => setAiQuestionCount(String(v))}
                      size="sm"
                      accentColor="indigo"
                      icon={<Sparkles className="h-3.5 w-3.5" />}
                      options={[
                        {
                          value: "all",
                          label: "Tất cả (Khai thác tối đa)",
                          subLabel: "AI đọc toàn bộ file, tạo tối đa ~35–55 câu",
                        },
                        { value: "10", label: "10 câu hỏi" },
                        { value: "20", label: "20 câu hỏi" },
                        { value: "30", label: "30 câu hỏi" },
                        { value: "40", label: "40 câu hỏi" },
                        { value: "50", label: "50 câu hỏi" },
                      ]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-[#B8B2A6]">
                      Thời gian mỗi câu:
                    </span>
                    <CustomSelect
                      value={secondsPerQuestion}
                      onChange={(v) => setSecondsPerQuestion(Number(v))}
                      size="sm"
                      accentColor="amber"
                      icon={<Timer className="h-3.5 w-3.5" />}
                      options={[
                        { value: 0, label: "Không giới hạn giờ" },
                        { value: 15, label: "15 giây / câu" },
                        { value: 20, label: "20 giây / câu" },
                        { value: 30, label: "30 giây / câu" },
                        { value: 45, label: "45 giây / câu" },
                        { value: 60, label: "60 giây / câu" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Step 2 Optional Lesson Combination */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-4 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#A7D7A9]">
                      <Layers className="h-4 w-4" />
                      Bước 2: Kết Hợp Bài Học (Tùy Chọn)
                    </h2>
                    <p className="text-xs text-[#B8B2A6] mt-1">
                      Bật tùy chọn này nếu bạn muốn gộp thêm câu hỏi &amp; kiến thức từ các chương sách đã học vào đề thi động.
                    </p>
                  </div>
                </div>

                {/* Toggle Switch Card */}
                <button
                  type="button"
                  onClick={() => setCombineWithLessons((v) => !v)}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                    combineWithLessons
                      ? "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                      : "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                        combineWithLessons
                          ? "border-[#141413] bg-[#141413] text-[#A7D7A9]"
                          : "border-[#B8B2A6]"
                      }`}
                    >
                      {combineWithLessons && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-extrabold">
                      Kết hợp thêm câu hỏi trong bài học
                    </span>
                  </div>
                  {selectedChapters.length > 0 && (
                    <span className="rounded-full bg-[#141413] px-2 py-0.5 text-[10px] font-black text-[#A7D7A9]">
                      Đã chọn {selectedChapters.length} chương
                    </span>
                  )}
                </button>

                {combineWithLessons && (
                  <div className="space-y-3 pt-1">
                    {courses.length === 0 ? (
                      <div className="rounded-lg border border-[#3A3832] bg-[#141413] p-3 text-xs text-[#B8B2A6]">
                        Bạn chưa có sách nào trong Tủ sách. Hãy nạp sách trước để kết hợp câu hỏi bài học.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-extrabold uppercase text-[#B8B2A6]">
                            Chọn Sách / Khóa học:
                          </label>
                          <CustomSelect
                            value={selectedCourse?.id || ""}
                            onChange={(val) => {
                              setSelectedCourseId(val);
                              setSelectedChapterIds([]);
                            }}
                            size="sm"
                            accentColor="emerald"
                            icon={<BookOpen className="h-3.5 w-3.5" />}
                            options={courses.map((c) => ({
                              value: c.id,
                              label: c.title,
                              subLabel: `${c.chapters.length} chương`,
                            }))}
                          />
                        </div>

                        {selectedCourse && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-extrabold uppercase text-[#B8B2A6]">
                                Chọn các chương muốn gộp ({selectedChapterIds.length}/{selectedCourse.chapters.length}):
                              </span>
                              <div className="flex items-center gap-2 text-[11px] font-bold">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedChapterIds(
                                      selectedCourse.chapters.map((c) => c.id)
                                    )
                                  }
                                  className="text-[#A7D7A9] hover:underline cursor-pointer"
                                >
                                  Chọn hết
                                </button>
                                <span className="text-[#3A3832]">|</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedChapterIds([])}
                                  className="text-[#FF8A8A] hover:underline cursor-pointer"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            </div>

                            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                              {selectedCourse.chapters.map((ch) => {
                                const checked = selectedChapterIds.includes(ch.id);
                                const qCount =
                                  (ch.lesson?.quizExercises?.length || 0) +
                                  (ch.lesson?.clozeExercises?.length || 0);
                                return (
                                  <button
                                    key={ch.id}
                                    type="button"
                                    onClick={() => toggleChapterSelection(ch.id)}
                                    className={`w-full flex items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                                      checked
                                        ? "border-[#A7D7A9] bg-[#141413] text-[#F5EFE6]"
                                        : "border-[#3A3832] bg-[#141413]/60 text-[#B8B2A6] hover:border-[#F5EFE6]"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                          checked
                                            ? "border-[#A7D7A9] bg-[#A7D7A9] text-[#141413]"
                                            : "border-[#6B675E]"
                                        }`}
                                      >
                                        {checked && <Check className="h-3 w-3 stroke-[3]" />}
                                      </span>
                                      <span className="truncate font-bold">
                                        Chương {ch.index}: {ch.title}
                                      </span>
                                    </div>
                                    <span className="shrink-0 rounded bg-[#262520] px-1.5 py-0.5 text-[10px] font-bold text-[#B8D8F8]">
                                      {qCount > 0 ? `${qCount} câu` : ch.isGenerated ? "Có bài" : "Thô"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="space-y-2 rounded-lg border border-[#3A3832] bg-[#141413] p-3">
                              <label className="flex items-center gap-2 text-xs text-[#F5EFE6] cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={mixExistingLessonQuestions}
                                  onChange={(e) =>
                                    setMixExistingLessonQuestions(e.target.checked)
                                  }
                                  className="h-3.5 w-3.5 accent-[#A7D7A9]"
                                />
                                <span className="font-bold">
                                  Trộn thêm câu hỏi có sẵn từ các chương đã chọn
                                  {totalAvailableLessonQuestions > 0
                                    ? ` (${totalAvailableLessonQuestions} câu)`
                                    : ""}
                                </span>
                              </label>

                              {mixExistingLessonQuestions && (
                                <div className="pt-1">
                                  <CustomSelect
                                    value={lessonQuestionLimit}
                                    onChange={(v) => setLessonQuestionLimit(String(v))}
                                    size="sm"
                                    accentColor="emerald"
                                    icon={<Layers className="h-3.5 w-3.5" />}
                                    options={[
                                      {
                                        value: "all",
                                        label: `Lấy tất cả (${totalAvailableLessonQuestions} câu)`,
                                      },
                                      { value: "6", label: "Lấy tối đa 6 câu" },
                                      { value: "10", label: "Lấy tối đa 10 câu" },
                                      { value: "20", label: "Lấy tối đa 20 câu" },
                                      { value: "30", label: "Lấy tối đa 30 câu" },
                                    ]}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Generate CTA */}
              <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6] space-y-3">
                {generateError && (
                  <div className="rounded-lg border-2 border-[#FF8A8A] bg-[#141413] p-3 text-xs font-bold text-[#FF8A8A]">
                    {generateError}
                  </div>
                )}

                {isGenerating ? (
                  <ExamGeneratingLoader />
                ) : (
                  <button
                    type="button"
                    disabled={!hasEnoughInput || isParsingFile}
                    onClick={() => handleGenerateDynamicExam()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-3.5 text-sm font-extrabold text-[#141413] shadow-[4px_4px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-40 cursor-pointer"
                  >
                    <Sparkles className="h-4.5 w-4.5" />
                    <span>AI Đọc Tài Liệu &amp; Tạo Đề Thi Động Ngay</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE EXAM RUNNER VIEW */}
      {examStarted && !examFinished && currentExamQ && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-3.5">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-xs font-extrabold text-[#141413]">
                Câu {examStepIndex + 1} / {examQuestions.length}
              </span>
              <span className="text-xs font-bold text-[#F5EFE6]">
                {currentExamQ.categoryLabel}
              </span>
              {currentExamQ.sourceLabel && (
                <span className="rounded-md border border-[#3A3832] bg-[#1D1C19] px-2 py-0.5 text-[10px] font-bold text-[#B8D8F8]">
                  {currentExamQ.sourceLabel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isCurrentQuestionUntimed ? (
                <div className="flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] bg-[#A7D7A9] px-3 py-0.5 text-xs font-extrabold text-[#141413]">
                  <InfinityIcon className="h-3.5 w-3.5" />
                  <span>Không giới hạn giờ</span>
                </div>
              ) : (
                <div
                  className={`flex items-center gap-1.5 rounded-full border-2 border-[#F5EFE6] px-3 py-0.5 text-xs font-extrabold text-[#141413] ${
                    timeLeft <= 5
                      ? "bg-[#FF8A8A] animate-pulse"
                      : timeLeft <= 10
                      ? "bg-[#F3C969]"
                      : "bg-[#B8D8F8]"
                  }`}
                >
                  <Timer className="h-3.5 w-3.5" />
                  <span>{timeLeft}s</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setExamStarted(false);
                  setExamFinished(false);
                }}
                className="rounded-lg border border-[#3A3832] px-2.5 py-1 text-[11px] font-bold text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6] cursor-pointer"
              >
                Thoát đề
              </button>
            </div>
          </div>

          {!isCurrentQuestionUntimed && (
            <div className="h-2 w-full overflow-hidden rounded-full border border-[#F5EFE6] bg-[#141413]">
              <div
                className={`h-full transition-all duration-1000 ${
                  timeLeft <= 5
                    ? "bg-[#FF8A8A]"
                    : timeLeft <= 10
                    ? "bg-[#F3C969]"
                    : "bg-[#B8D8F8]"
                }`}
                style={{
                  width: `${Math.max(
                    0,
                    Math.round((timeLeft / secondsPerQuestion) * 100)
                  )}%`,
                }}
              />
            </div>
          )}

          {/* Question Box */}
          <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm sm:text-base font-extrabold leading-relaxed text-[#F5EFE6]">
                {currentExamQ.promptText}
              </h4>
              {shouldShowAudioForQuestion(currentExamQ) && (
                <AudioSpeakButton
                  text={currentExamQ.promptText}
                  showLabel={false}
                  className="shrink-0 rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] p-2 text-[#141413]"
                />
              )}
            </div>
            {currentExamQ.subHint && (
              <p className="flex items-center gap-1.5 text-xs text-[#F3C969]">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 text-[#F3C969]" />
                <span>{currentExamQ.subHint}</span>
              </p>
            )}
          </div>

          {/* Options / Cloze / Translation */}
          {currentExamQ.type === "quiz" && currentExamQ.options && (
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {currentExamQ.options.map((opt, oIdx) => {
                const isPicked = userQuizChoice === oIdx;
                const isRight = currentExamQ.correctIndex === oIdx;
                let cls =
                  "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]";
                if (isQuestionLocked) {
                  if (isRight)
                    cls =
                      "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] font-extrabold";
                  else if (isPicked)
                    cls =
                      "border-[#F5EFE6] bg-[#FF8A8A] text-[#141413] font-extrabold";
                } else if (isPicked) {
                  cls =
                    "border-[#F5EFE6] bg-[#F3C969] text-[#141413] font-extrabold shadow-[3px_3px_0_0_#F5EFE6]";
                }

                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={isQuestionLocked}
                    onClick={() => {
                      if (isQuestionLocked) return;
                      setUserQuizChoice(oIdx);
                      const isCorrect = oIdx === currentExamQ.correctIndex;
                      setIsQuestionLocked(true);
                      setExamResults((prev) => [
                        ...prev,
                        {
                          question: currentExamQ,
                          isCorrect,
                          timedOut: false,
                          userAnswerText:
                            currentExamQ.options?.[oIdx] || "Đã chọn đáp án",
                        },
                      ]);
                    }}
                    className={`rounded-xl border-2 px-3.5 py-3 text-left text-sm transition-colors cursor-pointer ${cls}`}
                  >
                    <span className="mr-2 font-black">
                      {String.fromCharCode(65 + oIdx)}.
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {currentExamQ.type === "cloze" && (
            <input
              type="text"
              disabled={isQuestionLocked}
              value={userClozeInput}
              onChange={(e) => setUserClozeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && userClozeInput.trim() && !isQuestionLocked) {
                  e.preventDefault();
                  handleConfirmCloze();
                }
              }}
              placeholder="Nhập từ vựng / cấu trúc ngữ pháp còn thiếu vào đây (Nhấn Enter để chốt)..."
              className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-4 py-2.5 text-sm text-[#F5EFE6] focus:border-[#F3C969] focus:outline-none"
            />
          )}

          {currentExamQ.type === "translation" && (
            <textarea
              rows={3}
              disabled={isQuestionLocked || isEvaluatingTranslation}
              value={userTranslationInput}
              onChange={(e) => setUserTranslationInput(e.target.value)}
              placeholder="Nhập bản dịch tiếng Việt của bạn..."
              className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] p-3 text-sm text-[#F5EFE6] focus:border-[#F3C969] focus:outline-none"
            />
          )}

          {/* Submit or Sticky Instant Feedback */}
          {!isQuestionLocked ? (
            currentExamQ.type !== "quiz" && (
              <div className="flex justify-end">
                {currentExamQ.type === "translation" ? (
                  <button
                    type="button"
                    disabled={
                      isEvaluatingTranslation || !userTranslationInput.trim()
                    }
                    onClick={handleEvaluateTranslation}
                    className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] disabled:opacity-40 cursor-pointer"
                  >
                    {isEvaluatingTranslation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        AI đang chấm điểm câu dịch...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Nộp Câu Dịch &amp; Chấm Điểm AI
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!userClozeInput.trim()}
                    onClick={handleConfirmCloze}
                    className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] disabled:opacity-40 cursor-pointer"
                  >
                    Chốt Đáp Án (Enter)
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="sticky bottom-2 sm:bottom-3 z-30 rounded-xl border-2 border-[#F5EFE6] bg-[#141413]/95 backdrop-blur-md p-3.5 shadow-[4px_4px_0_0_#F5EFE6] animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {timeLeft <= 0 && !isCurrentQuestionUntimed ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FF8A8A] px-2 py-0.5 text-[11px] font-black text-[#141413]">
                        <XCircle className="h-3.5 w-3.5" />
                        Hết giờ
                      </span>
                    ) : examResults[examResults.length - 1]?.isCorrect ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#A7D7A9] px-2 py-0.5 text-[11px] font-black text-[#141413]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Chính xác!
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-[#FF8A8A] px-2 py-0.5 text-[11px] font-black text-[#141413]">
                        <XCircle className="h-3.5 w-3.5" />
                        Chưa đúng
                      </span>
                    )}

                    {currentExamQ.type === "cloze" && (
                      <span className="text-xs text-[#A7D7A9]">
                        Đáp án đúng:{" "}
                        <strong className="text-[#F5EFE6] underline decoration-[#A7D7A9]">
                          {currentExamQ.correctTextAnswer}
                        </strong>
                      </span>
                    )}
                  </div>

                  {currentExamQ.explanation && (
                    <p className="flex items-start gap-1.5 text-xs leading-snug text-[#F5EFE6]">
                      <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#F3C969]" />
                      <span>{currentExamQ.explanation}</span>
                    </p>
                  )}

                  {currentTranslationEval && (
                    <div className="space-y-1 text-xs">
                      <div className="font-extrabold text-[#B8D8F8]">
                        Điểm AI:{" "}
                        <span className="text-[#A7D7A9]">
                          {currentTranslationEval.overallScore}%
                        </span>{" "}
                        (Sát nghĩa: {currentTranslationEval.semanticAccuracy}% • Ngữ pháp:{" "}
                        {currentTranslationEval.grammarAndStructure}%)
                      </div>
                      <p className="flex items-start gap-1.5 text-[#A7D7A9]">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>Gợi ý: {currentTranslationEval.suggestedTranslation}</span>
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleNextExamQuestion}
                  className="shrink-0 flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] cursor-pointer"
                >
                  <span>
                    {examStepIndex + 1 >= examQuestions.length
                      ? "Xem Tổng Kết"
                      : "Câu Tiếp Theo (Enter)"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUMMARY VIEW */}
      {examFinished && (
        <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6] space-y-6">
          <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-6 text-center space-y-3">
            <Trophy className="mx-auto h-12 w-12 text-[#F3C969]" />
            <h3 className="text-2xl font-extrabold text-[#F5EFE6]">
              Kết Quả: {examTitle}
            </h3>
            {appliedPrompt && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[#F5EFE6] bg-[#C8B6FF] px-3 py-0.5 text-[11px] font-extrabold text-[#141413]">
                <Sparkles className="h-3 w-3" />
                <span>Yêu cầu AI: {appliedPrompt}</span>
              </div>
            )}
            <p className="text-sm text-[#B8B2A6]">
              Hoàn thành đúng:{" "}
              <strong className="text-[#A7D7A9]">
                {examResults.filter((r) => r.isCorrect).length} / {examResults.length}
              </strong>{" "}
              (
              {examResults.length > 0
                ? Math.round(
                    (examResults.filter((r) => r.isCorrect).length /
                      examResults.length) *
                      100
                  )
                : 0}
              %)
            </p>

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={restartCurrentExam}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" />
                Làm Lại Đề Này
              </button>
              <button
                type="button"
                disabled={isGenerating}
                onClick={() => setShowSummaryPromptComposer((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                AI Tạo Đề Khác Từ Tài Liệu Này
              </button>
              <button
                type="button"
                onClick={() => {
                  setExamStarted(false);
                  setExamFinished(false);
                }}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] px-4 py-2.5 text-xs font-extrabold text-[#F5EFE6] hover:border-[#F5EFE6] cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Chọn File / Bài Học Khác
              </button>
            </div>

            {isGenerating && (
              <div className="pt-3">
                <ExamGeneratingLoader />
              </div>
            )}

            {showSummaryPromptComposer && !isGenerating && (
              <div className="mx-auto mt-3 max-w-2xl rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 text-left space-y-3 shadow-[4px_4px_0_0_#F3C969]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#F5EFE6]">
                    Nhắn yêu cầu mới cho AI (VD: tập trung ngữ pháp, từ vựng...)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSummaryPromptComposer(false)}
                    className="rounded-lg p-1 text-[#B8B2A6] hover:text-[#F5EFE6] cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Nhập yêu cầu trọng tâm mới..."
                  className="w-full rounded-lg border-2 border-[#3A3832] bg-[#141413] px-3 py-2 text-xs text-[#F5EFE6] focus:border-[#F3C969] focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleGenerateDynamicExam()}
                    className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Tạo Đề Mới Ngay
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-extrabold text-[#F5EFE6]">
              Chi tiết từng câu trong bài thi:
            </h4>
            {examResults.map((res, i) => (
              <div
                key={i}
                className={`rounded-xl border-2 p-4 text-xs space-y-1.5 bg-[#141413] ${
                  res.isCorrect ? "border-[#A7D7A9]" : "border-[#FF8A8A]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 font-bold">
                  <span className="text-[#F5EFE6]">
                    Câu {i + 1} ({res.question.categoryLabel}): {res.question.promptText}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 font-extrabold ${
                      res.isCorrect ? "text-[#A7D7A9]" : "text-[#FF8A8A]"
                    }`}
                  >
                    {res.timedOut ? (
                      <>
                        <Clock className="h-3.5 w-3.5" />
                        <span>Hết giờ</span>
                      </>
                    ) : res.translationScore !== undefined ? (
                      `Điểm dịch AI: ${res.translationScore}%`
                    ) : res.isCorrect ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Đúng</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Sai</span>
                      </>
                    )}
                  </span>
                </div>
                <p className="text-[#B8B2A6]">
                  Câu trả lời của bạn:{" "}
                  <strong className="text-[#F5EFE6]">{res.userAnswerText}</strong>
                </p>
                {res.question.type === "cloze" && res.question.correctTextAnswer && (
                  <p className="text-[#A7D7A9]">
                    Đáp án chuẩn: <strong>{res.question.correctTextAnswer}</strong>
                  </p>
                )}
                {res.question.explanation && (
                  <p className="flex items-start gap-1.5 text-[#B8D8F8]">
                    <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#F3C969]" />
                    <span>Giải thích: {res.question.explanation}</span>
                  </p>
                )}
                {res.translationEval && (
                  <p className="flex items-start gap-1.5 text-[#A7D7A9]">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#A7D7A9]" />
                    <span>Bản dịch gợi ý: {res.translationEval.suggestedTranslation}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
