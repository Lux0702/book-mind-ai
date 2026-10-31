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
} from "lucide-react";
import {
  Course,
  ChapterUnit,
  FlashcardSRS,
  TranslationEvaluation,
} from "@/types/course";
import { getAppSettings, saveCourse } from "@/lib/storage";
import {
  renderPdfPagesToImagesBase64,
  convertUploadedFilesToImagesBase64,
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

  const handleGenerateChapterLesson = async (
    chapter: ChapterUnit,
    pageImagesBase64?: string[]
  ) => {
    setGenError(null);
    setIsGeneratingLesson(true);
    try {
      const settings = getAppSettings();
      const textToUse =
        editableRawText.trim().length > 20
          ? editableRawText
          : chapter.rawText;

      const res = await fetch("/api/agent/chapter-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: course.title,
          chapterTitle: chapter.title,
          chapterText: textToUse,
          pageImagesBase64,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
        }),
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
    } catch (err: unknown) {
      setGenError(
        err instanceof Error
          ? err.message
          : "Lỗi khi kết nối Gemini AI. Hãy kiểm tra API Key trong Cài đặt."
      );
    } finally {
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
      const res = await fetch("/api/agent/extract-vocab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: course.title,
          chapterTitle: chapter.title,
          chapterText: chapter.rawText,
          pageImagesBase64,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
        }),
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
      const res = await fetch("/api/agent/evaluate-translation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originalSentence,
          referenceTranslation,
          contextHint,
          userTranslation,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
        }),
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
      const res = await fetch("/api/agent/ask-tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseTitle: course.title,
          chapterTitle: currentChapter.title,
          chapterText: currentChapter.rawText,
          question: tutorQuestion,
          apiKey: settings.geminiApiKey,
          model: settings.geminiModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể gửi câu hỏi.");
      }
      setTutorAnswer(data.answer);
    } catch (err: unknown) {
      setTutorAnswer(
        err instanceof Error
          ? `⚠️ ${err.message}`
          : "⚠️ Lỗi khi kết nối Gia sư AI."
      );
    } finally {
      setIsAskingTutor(false);
    }
  };

  if (!currentChapter) {
    return null;
  }

  const lesson = currentChapter.lesson;

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

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowRawText(!showRawText);
                setEditableRawText(currentChapter.rawText);
              }}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              {showRawText ? "Ẩn văn bản gốc" : "Xem / Sửa văn bản gốc chương"}
            </button>
            <button
              type="button"
              disabled={isGeneratingLesson}
              onClick={() => handleGenerateChapterLesson(currentChapter)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
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

        {/* Error banner if API key missing or error */}
        {genError && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
              <span>{genError}</span>
            </div>
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-lg bg-rose-600 px-3 py-1.5 font-semibold text-white hover:bg-rose-500"
            >
              Mở Cài đặt nhập Gemini API Key
            </button>
          </div>
        )}

        {/* If Generating Lesson */}
        {isGeneratingLesson ? (
          <LessonGeneratingLoader
            chapterIndex={currentChapter.index}
            chapterTitle={currentChapter.title}
          />
        ) : !lesson ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center animate-in fade-in duration-300">
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
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={isGeneratingLesson}
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

              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-950/30 px-5 py-3 text-xs font-semibold text-indigo-200 transition hover:bg-indigo-900/50">
                <span>
                  📷 Soạn từ Ảnh / PDF bằng Gemini Vision (Hỗ trợ nhiều trang)
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
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("content")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "content"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-4 w-4" />
                1. Nội dung & Diễn giải ({lesson.contentAnalysis.length} phần)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("grammar")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "grammar"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                2. Ngữ pháp trọng điểm ({lesson.grammarPoints.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("vocabulary")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "vocabulary"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Layers className="h-4 w-4" />
                3. Từ vựng & Flashcard SRS ({lesson.vocabulary.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("practice")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "practice"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <HelpCircle className="h-4 w-4" />
                4. Điền từ & Trắc nghiệm (
                {lesson.clozeExercises.length + lesson.quizExercises.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("translation")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                  activeTab === "translation"
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                <Languages className="h-4 w-4" />
                5. Luyện dịch & AI Chấm điểm % (
                {lesson.translationExercises.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("exam_arena")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                  activeTab === "exam_arena"
                    ? "bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow"
                    : "text-amber-300 hover:bg-slate-800"
                }`}
              >
                <Trophy className="h-4 w-4" />
                6. Phòng Thi & Ôn Tập Đa Dạng (Exam Arena)
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
                      <div className="text-xs font-semibold text-amber-300">
                        🎯 Chủ đề cốt lõi (Key Themes):
                      </div>
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-300">
                        {lesson.overview.keyThemes.map((t, i) => (
                          <li key={i}>{t}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl bg-slate-950/60 p-4">
                      <div className="text-xs font-semibold text-emerald-300">
                        ✅ Mục tiêu đạt được sau chương này:
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

                      <div className="rounded-xl bg-indigo-950/25 border border-indigo-500/20 p-4 text-sm leading-relaxed text-slate-200">
                        <strong className="text-indigo-300">
                          💡 Diễn giải sâu nội dung:{" "}
                        </strong>
                        {sec.deepExplanation}
                      </div>

                      <div className="rounded-xl bg-amber-950/20 border border-amber-500/20 p-3.5 text-xs leading-relaxed text-amber-200/90">
                        <strong>🎨 Ghi chú văn phong & Ngữ cảnh: </strong>
                        {sec.stylisticOrContextNotes}
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
                  <form onSubmit={handleAskTutor} className="mt-3 flex gap-2">
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
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
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
                        <strong className="block mb-1 text-indigo-300">
                          📐 Giải thích cấu trúc ngữ pháp:
                        </strong>
                        {gp.detailedExplanation}
                      </div>
                      <div className="rounded-xl bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-200">
                        <strong className="block mb-1 text-emerald-300">
                          🎯 Vì sao tác giả dùng cấu trúc này trong sách?
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
                        <span>📷 Quét từ Ảnh / PDF (Tất cả trang)</span>
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
                              className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              🔗 {c}
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
                {/* Part A: Fill in the blank */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white">
                    Phần A: Điền từ vào ngữ cảnh câu trong sách (Cloze Test)
                  </h3>
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
                          <div className="rounded-lg bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                            💡 Gợi ý: {cl.hint}
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
                            className="w-64 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
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
                    Phần B: Trắc nghiệm Đọc hiểu, Từ vựng & Ngữ pháp
                  </h3>
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
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 text-xs text-indigo-200">
                  <strong>🎯 Cơ chế AI Chấm Điểm Dịch Câu (Semantic Similarity Evaluation):</strong>{" "}
                  Bạn hãy dịch các câu trích từ chương sách sang tiếng Việt theo cách hiểu của bạn. AI Agent sẽ đối chiếu ngữ nghĩa, ngữ pháp và sắc thái văn phong để chấm điểm từ <strong>0% – 100%</strong>, chỉ rõ từng cụm từ bạn dịch hay hoặc cần chỉnh sửa.
                </div>

                {evalError && (
                  <div className="flex items-center justify-between rounded-xl border border-rose-500/40 bg-rose-950/30 p-3.5 text-xs text-rose-200">
                    <span>{evalError}</span>
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white"
                    >
                      Cài đặt Gemini API Key
                    </button>
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
                        <p className="mt-2 text-xs text-amber-300/90">
                          💡 <strong>Gợi ý ngữ cảnh:</strong> {tr.contextHint}
                        </p>
                        {tr.targetGrammarOrVocab &&
                          tr.targetGrammarOrVocab.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {tr.targetGrammarOrVocab.map((item, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                                >
                                  📌 {item}
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
                              <div className="font-bold text-emerald-300 mb-1.5">
                                ✅ Điểm bạn đã dịch rất tốt:
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-slate-200">
                                {evalResult.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="rounded-xl bg-amber-950/20 border border-amber-500/20 p-3.5 text-xs">
                              <div className="font-bold text-amber-300 mb-1.5">
                                🔧 Góp ý chỉnh sửa để đạt 100%:
                              </div>
                              <ul className="list-disc pl-4 space-y-1 text-slate-200">
                                {evalResult.improvements.map((imp, i) => (
                                  <li key={i}>{imp}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {/* Suggested Optimal Translation */}
                          <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3.5 text-xs">
                            <span className="font-bold text-indigo-300">
                              🌟 Bản dịch chuẩn gợi ý:{" "}
                            </span>
                            <span className="text-slate-100">
                              &ldquo;{evalResult.suggestedTranslation}&rdquo;
                            </span>
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
