"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  MessageSquare,
  Send,
  Loader2,
  Sparkles,
  X,
  Trash2,
  BookOpen,
  Minimize2,
  HelpCircle,
} from "lucide-react";
import { ChapterLesson, VocabularyItem } from "@/types/course";
import { getAppSettings } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";

export interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  excerpt?: string;
  createdAt: string;
}

interface LearnerMemoryEntry {
  question: string;
  answerSnippet: string;
  courseTitle: string;
  chapterTitle: string;
  focusKeyword: string;
  askedAt: string;
}

const LEARNER_MEMORY_STORAGE_KEY = "bookmind_ai_learner_memory_v1";

function loadLearnerMemoryBank(): LearnerMemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEARNER_MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordToLearnerMemoryBank(entry: LearnerMemoryEntry): LearnerMemoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const current = loadLearnerMemoryBank();
    const filtered = current.filter(
      (item) =>
        item.question.trim().toLowerCase() !== entry.question.trim().toLowerCase()
    );
    const updated = [...filtered, entry].slice(-40);
    window.localStorage.setItem(
      LEARNER_MEMORY_STORAGE_KEY,
      JSON.stringify(updated)
    );
    return updated;
  } catch {
    return [];
  }
}

function buildLearnerMemorySummary(entries: LearnerMemoryEntry[]): string {
  if (!entries || entries.length === 0) return "";
  const focusWords = Array.from(
    new Set(
      entries
        .map((e) => e.focusKeyword.trim())
        .filter((w) => w.length > 0 && w.length <= 45)
    )
  ).slice(-25);

  const recentLogs = entries
    .slice(-10)
    .map(
      (e, idx) =>
        `${idx + 1}. [${e.chapterTitle}] Học viên từng hỏi: "${e.question}" -> Ghi chú đã giải đáp: ${e.answerSnippet}`
    )
    .join("\n");

  return [
    focusWords.length > 0
      ? `- Các từ vựng / chủ điểm học viên đã từng hỏi gần đây: [${focusWords.join(", ")}]`
      : "",
    `- Nhật ký ${entries.length} câu hỏi trước đó của học viên:\n${recentLogs}`,
  ]
    .filter(Boolean)
    .join("\n");
}

interface AiLessonChatWidgetProps {
  courseTitle: string;
  chapterTitle: string;
  chapterRawText?: string;
  lesson?: ChapterLesson;
  vocabularyList?: VocabularyItem[];
  selectedAiModel?: string;
  mode?: "floating" | "inline";
}

export function buildLessonDataSummary(
  lesson?: ChapterLesson,
  vocabularyList?: VocabularyItem[]
): string {
  const parts: string[] = [];

  if (lesson?.overview?.summary) {
    parts.push(`TÓM TẮT BÀI HỌC:\n${lesson.overview.summary}`);
  }

  const vocabSource =
    vocabularyList && vocabularyList.length > 0
      ? vocabularyList
      : lesson?.vocabulary || [];

  if (vocabSource.length > 0) {
    const vocabLines = vocabSource.slice(0, 60).map((v, idx) => {
      const syn =
        Array.isArray(v.synonyms) && v.synonyms.length > 0
          ? ` | Đồng nghĩa: ${v.synonyms.join(", ")}`
          : "";
      const ant =
        Array.isArray(v.antonyms) && v.antonyms.length > 0
          ? ` | Trái nghĩa: ${v.antonyms.join(", ")}`
          : "";
      const col =
        Array.isArray(v.collocations) && v.collocations.length > 0
          ? ` | Cụm từ: ${v.collocations.join(", ")}`
          : "";
      const ex = v.quoteFromBook ? ` | Ví dụ: "${v.quoteFromBook}"` : "";
      return `${idx + 1}. ${v.word} (${v.ipa || ""}) [${v.partOfSpeech}]: ${
        v.vietnameseMeaning
      } — ${v.explanationInContext || ""}${col}${syn}${ant}${ex}`;
    });
    parts.push(`DANH SÁCH TỪ VỰNG TRONG BÀI (${vocabSource.length} từ):\n${vocabLines.join("\n")}`);
  }

  if (lesson?.grammarPoints && lesson.grammarPoints.length > 0) {
    const grammarLines = lesson.grammarPoints.map(
      (g, idx) =>
        `${idx + 1}. ${g.title} [Công thức: ${g.patternFormula}]: ${
          g.detailedExplanation
        } | Ví dụ: "${g.quoteFromBook}" (${g.quoteTranslation})`
    );
    parts.push(`NGỮ PHÁP TRỌNG ĐIỂM TRONG BÀI:\n${grammarLines.join("\n")}`);
  }

  if (lesson?.contentAnalysis && lesson.contentAnalysis.length > 0) {
    const sectionLines = lesson.contentAnalysis.map(
      (s, idx) =>
        `[Phần ${idx + 1}: ${s.sectionTitle}]\nNguyên bản: "${
          s.originalExcerpt
        }"\nDịch nghĩa: "${s.vietnameseTranslation}"\nPhân tích: ${
          s.deepExplanation
        }`
    );
    parts.push(`NỘI DUNG & ĐOẠN TRÍCH BÀI HỌC:\n${sectionLines.join("\n\n")}`);
  }

  if (lesson?.clozeExercises && lesson.clozeExercises.length > 0) {
    const clozeLines = lesson.clozeExercises.map(
      (c, idx) =>
        `Điền từ #${idx + 1}: "${c.sentenceWithBlank}" -> Đáp án: "${c.answer}" (Dịch: ${c.fullSentenceTranslation} | Giải thích: ${c.explanation})`
    );
    parts.push(`CÁC CÂU BÀI TẬP ĐIỀN TỪ TRONG BÀI:\n${clozeLines.join("\n")}`);
  }

  if (lesson?.quizExercises && lesson.quizExercises.length > 0) {
    const quizLines = lesson.quizExercises.map(
      (q, idx) =>
        `Trắc nghiệm #${idx + 1}: "${q.question}" | Các lựa chọn: [${q.options.join(
          ", "
        )}] -> Đáp án đúng: "${q.options[q.correctIndex] || ""}" (${
          q.explanation
        })`
    );
    parts.push(`CÁC CÂU BÀI TẬP TRẮC NGHIỆM TRONG BÀI:\n${quizLines.join("\n")}`);
  }

  if (lesson?.translationExercises && lesson.translationExercises.length > 0) {
    const transLines = lesson.translationExercises.map(
      (t, idx) =>
        `Câu dịch #${idx + 1}: "${t.originalSentence}" -> Dịch mẫu: "${t.referenceTranslation}"`
    );
    parts.push(`CÁC CÂU BÀI TẬP LUYỆN DỊCH TRONG BÀI:\n${transLines.join("\n")}`);
  }

  return parts.join("\n\n");
}

export default function AiLessonChatWidget({
  courseTitle,
  chapterTitle,
  chapterRawText = "",
  lesson,
  vocabularyList,
  selectedAiModel,
  mode = "floating",
}: AiLessonChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(mode === "inline");
  const [mounted, setMounted] = useState(false);
  const [inputQuestion, setInputQuestion] = useState("");
  const [attachedExcerpt, setAttachedExcerpt] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [memoryEntries, setMemoryEntries] = useState<LearnerMemoryEntry[]>([]);
  const scrollBottomRef = useRef<HTMLDivElement | null>(null);

  const lessonChatStorageKey = useMemo(() => {
    const cleanKey = `${courseTitle}__${chapterTitle}`
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "_")
      .slice(0, 90);
    return `bookmind_tutor_chat_v1_${cleanKey}`;
  }, [courseTitle, chapterTitle]);

  useEffect(() => {
    setMounted(true);
    setMemoryEntries(loadLearnerMemoryBank());
  }, []);

  // Load saved chat history whenever the user opens/switches to a chapter or topic
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(lessonChatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          return;
        }
      }
      setMessages([]);
    } catch {
      setMessages([]);
    }
  }, [lessonChatStorageKey]);

  // Persist chat history for this lesson whenever messages update
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(
          lessonChatStorageKey,
          JSON.stringify(messages.slice(-30))
        );
      }
    } catch {
      // Ignore storage quota error
    }
  }, [messages, lessonChatStorageKey, mounted]);

  const activeVocabList = useMemo(
    () =>
      vocabularyList && vocabularyList.length > 0
        ? vocabularyList
        : lesson?.vocabulary || [],
    [vocabularyList, lesson?.vocabulary]
  );

  const lessonDataSummary = useMemo(
    () => buildLessonDataSummary(lesson, vocabularyList),
    [lesson, vocabularyList]
  );

  // Quick-ask prompts dynamically tailored to the current lesson's vocabulary & grammar
  const quickSuggestions = useMemo(() => {
    const list: string[] = [];
    if (activeVocabList.length > 0) {
      const sampleWords = activeVocabList
        .slice(0, 2)
        .map((v) => v.word)
        .join('", "');
      list.push(
        `Phân tích sâu cách dùng, collocations & đồng/trái nghĩa của từ "${sampleWords}"`
      );
      list.push(
        "Tổng hợp các cặp từ vựng dễ nhầm lẫn nhất trong bài này và cách phân biệt"
      );
    }
    if (lesson?.grammarPoints && lesson.grammarPoints.length > 0) {
      list.push(
        `Giải thích dễ hiểu cấu trúc ngữ pháp "${lesson.grammarPoints[0].title}" kèm ví dụ`
      );
    } else {
      list.push(
        "Đặt đoạn hội thoại ngắn ứng dụng các từ vựng quan trọng nhất trong bài này"
      );
    }
    list.push(
      "Tóm tắt các điểm kiến thức & từ vựng cốt lõi cần nhớ nhất của bài học này"
    );
    return list;
  }, [activeVocabList, lesson?.grammarPoints]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isSending, isOpen]);

  // Listen to global "bookmind:ask-ai-tutor" events (only handled by floating widget to avoid duplicate sends)
  useEffect(() => {
    if (mode !== "floating") return;
    const handleExternalAsk = (ev: Event) => {
      const customEv = ev as CustomEvent<{
        question?: string;
        excerpt?: string;
        autoSend?: boolean;
      }>;
      const detail = customEv.detail || {};
      setIsOpen(true);
      if (detail.excerpt) {
        setAttachedExcerpt(detail.excerpt);
      }
      if (detail.question) {
        if (detail.autoSend) {
          void handleSendQuestion(detail.question, detail.excerpt || undefined);
        } else {
          setInputQuestion(detail.question);
        }
      }
    };
    window.addEventListener("bookmind:ask-ai-tutor", handleExternalAsk);
    return () =>
      window.removeEventListener("bookmind:ask-ai-tutor", handleExternalAsk);
  }, [mode, lessonDataSummary, chapterRawText, courseTitle, chapterTitle]);

  const handleSendQuestion = async (
    overrideQuestion?: string,
    overrideExcerpt?: string
  ) => {
    const qText = (overrideQuestion ?? inputQuestion).trim();
    if (!qText || isSending) return;

    const excerptToUse =
      overrideExcerpt !== undefined ? overrideExcerpt : attachedExcerpt || undefined;

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: "user",
      content: qText,
      excerpt: excerptToUse,
      createdAt: new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const updatedHistory = [...messages, userTurn];
    setMessages(updatedHistory);
    if (!overrideQuestion) {
      setInputQuestion("");
    }
    setAttachedExcerpt(null);
    setIsSending(true);

    try {
      const settings = getAppSettings();
      const currentMemoryBank = loadLearnerMemoryBank();
      const learnerMemorySummary = buildLearnerMemorySummary(currentMemoryBank);

      const res = await fetchAiAgent("/api/agent/ask-tutor", {
        courseTitle,
        chapterTitle,
        chapterText: chapterRawText,
        lessonDataSummary,
        learnerMemorySummary,
        chatHistory: updatedHistory.slice(-8).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        question: qText,
        selectedExcerpt: excerptToUse,
        silentUi: true,
        apiKey: settings.geminiApiKey,
        model: selectedAiModel || settings.geminiModel,
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể kết nối với Gia sư AI.");
      }

      const answerText = String(data.answer || "Không có phản hồi từ AI.");
      const aiTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: answerText,
        createdAt: new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, aiTurn]);

      // Save this Q&A into the persistent Learner Memory Bank so AI learns from it for future questions
      const focusKeyword =
        excerptToUse?.split(":")[0]?.trim() ||
        (qText.length <= 36 ? qText : qText.slice(0, 36));
      const updatedMemory = recordToLearnerMemoryBank({
        question: qText.slice(0, 140),
        answerSnippet: answerText.replace(/\s+/g, " ").slice(0, 160),
        courseTitle,
        chapterTitle,
        focusKeyword,
        askedAt: new Date().toISOString(),
      });
      setMemoryEntries(updatedMemory);
    } catch (err: unknown) {
      const errTurn: ChatTurn = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content:
          err instanceof Error
            ? `⚠️ ${err.message}`
            : "⚠️ Lỗi khi kết nối Gia sư AI. Vui lòng thử lại.",
        createdAt: new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      setMessages((prev) => [...prev, errTurn]);
    } finally {
      setIsSending(false);
    }
  };

  const renderChatBody = (maxHeightClass: string) => (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Context Summary Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A3832] bg-[#141413] px-4 py-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-[#B8D8F8] font-bold truncate">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-[#F3C969]" />
          <span className="truncate">
            <strong className="text-[#F5EFE6]">{chapterTitle}</strong>
            {memoryEntries.length > 0
              ? ` • 🧠 Đã nhớ ${memoryEntries.length} câu hỏi`
              : activeVocabList.length > 0
              ? ` (${activeVocabList.length} từ vựng)`
              : ""}
          </span>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              if (typeof window !== "undefined") {
                window.localStorage.removeItem(lessonChatStorageKey);
              }
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[#3A3832] bg-[#1D1C19] px-2 py-0.5 text-[10px] font-bold text-[#B8B2A6] hover:border-[#FF8A8A] hover:text-[#FF8A8A] cursor-pointer shrink-0"
            title="Xóa khung chat bài này (Vẫn giữ bộ nhớ học tập của AI)"
          >
            <Trash2 className="h-3 w-3" />
            <span>Làm mới khung</span>
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div
        className={`flex-1 overflow-y-auto p-4 space-y-3.5 select-text ${maxHeightClass}`}
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3.5 text-xs leading-relaxed text-[#B8B2A6]">
              <p className="font-extrabold text-[#F5EFE6] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#F3C969] shrink-0" />
                <span>
                  Gia sư AI đã nắm toàn bộ dữ liệu từ vựng, ngữ pháp &amp; nội dung của bài học này!
                </span>
              </p>
              <p className="mt-1">
                Bạn có thể hỏi bất kỳ từ vựng nào (cách dùng, từ đồng/trái nghĩa, phân biệt từ), hỏi cấu trúc câu trong bài hoặc chọn nhanh gợi ý bên dưới:
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-[#F3C969]">
                Gợi ý câu hỏi theo bài đang học:
              </div>
              <div className="flex flex-wrap gap-2">
                {quickSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isSending}
                    onClick={() => void handleSendQuestion(sug)}
                    className="rounded-xl border-2 border-[#3A3832] bg-[#141413] px-3 py-2 text-left text-xs font-bold text-[#F5EFE6] transition-all hover:border-[#F3C969] hover:bg-[#262520] cursor-pointer"
                  >
                    💬 {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[85%] rounded-2xl border-2 px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] font-bold shadow-[2px_2px_0_0_#F5EFE6]"
                    : "border-[#3A3832] bg-[#141413] text-[#F5EFE6]"
                }`}
              >
                {msg.excerpt && (
                  <div className="mb-2 rounded-lg border border-[#141413]/30 bg-[#141413]/10 px-2.5 py-1.5 text-[11px] italic">
                    Trích đoạn / Từ đang hỏi: &ldquo;{msg.excerpt}&rdquo;
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">
                  {msg.content}
                </div>
              </div>
              <span className="mt-1 px-1 text-[10px] font-semibold text-[#8F8A7E]">
                {msg.role === "user" ? "Bạn" : "Gia sư AI BookMind"} •{" "}
                {msg.createdAt}
              </span>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-start gap-2.5">
            <div className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#3A3832] bg-[#141413] px-4 py-3 text-xs font-bold text-[#F3C969]">
              <Loader2 className="h-4 w-4 animate-spin shrink-0 text-[#F3C969]" />
              <span>
                Gia sư AI đang đối chiếu dữ liệu bài học &amp; tổng hợp câu trả lời...
              </span>
            </div>
          </div>
        )}
        <div ref={scrollBottomRef} />
      </div>

      {/* Attached Excerpt Preview */}
      {attachedExcerpt && (
        <div className="flex items-center justify-between gap-2 border-t-2 border-[#3A3832] bg-[#141413] px-3.5 py-2 text-xs text-[#C8B6FF]">
          <span className="truncate">
            Đang hỏi về: <strong>&ldquo;{attachedExcerpt}&rdquo;</strong>
          </span>
          <button
            type="button"
            onClick={() => setAttachedExcerpt(null)}
            className="text-[#B8B2A6] hover:text-[#F5EFE6] cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSendQuestion();
        }}
        className="flex items-center gap-2 border-t-2 border-[#3A3832] bg-[#1D1C19] p-3"
      >
        <input
          type="text"
          value={inputQuestion}
          onChange={(e) => setInputQuestion(e.target.value)}
          disabled={isSending}
          placeholder="Hỏi về từ vựng, cách dùng từ, ngữ pháp hoặc nội dung trong bài học..."
          className="flex-1 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:outline-none"
        />
        <button
          type="submit"
          disabled={isSending || !inputQuestion.trim()}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-40 cursor-pointer shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span>Hỏi AI</span>
        </button>
      </form>
    </div>
  );

  // INLINE MODE (rendered inside ContentTab)
  if (mode === "inline") {
    return (
      <div className="overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="flex items-center justify-between gap-2 border-b-2 border-[#3A3832] bg-[#1D1C19] px-5 py-3.5">
          <div className="flex items-center gap-2 text-sm font-extrabold text-[#F5EFE6]">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413]">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
            <span>
              Trò chuyện &amp; Hỏi đáp Bài học cùng Gia sư AI
            </span>
          </div>
          <span className="rounded-full border border-[#3A3832] bg-[#141413] px-2.5 py-0.5 text-[10px] font-extrabold text-[#A7D7A9]">
            Phân tích theo dữ liệu bài học
          </span>
        </div>
        {renderChatBody("max-h-[420px]")}
      </div>
    );
  }

  // FLOATING MODE (Rendered via Portal to document.body at bottom-right, always fixed to viewport)
  if (!mounted || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      {/* Floating Action Button (Bottom-Right, below the Scroll-to-Top button) */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 inline-flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-all hover:bg-[#d5c7ff] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
          title="Mở khung Trò chuyện & Hỏi đáp bài học cùng Gia sư AI"
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
          <span>Gia sư AI</span>
          {messages.length > 0 && (
            <span className="rounded-full bg-[#141413] px-1.5 py-0.5 text-[10px] font-black text-[#F3C969]">
              {messages.length}
            </span>
          )}
        </button>
      )}

      {/* Floating Chat Drawer / Window (Bottom-Right) */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 left-4 sm:left-auto sm:w-[430px] lg:bottom-6 lg:right-6 z-50 flex flex-col max-h-[75vh] overflow-hidden rounded-2xl border-2 border-[#F5EFE6] bg-[#1D1C19] shadow-[6px_6px_0_0_#F5EFE6] animate-in fade-in slide-in-from-bottom-4 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b-2 border-[#F5EFE6] bg-[#1D1C19] px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                <HelpCircle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xs sm:text-sm font-extrabold text-[#F5EFE6]">
                  Gia sư AI • Hỏi Đáp Bài Học
                </h3>
                <p className="truncate text-[10px] font-semibold text-[#A7D7A9]">
                  Phân tích từ vựng, ngữ pháp &amp; kiến thức tổng hợp
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#141413] text-[#F5EFE6] hover:bg-[#FF8A8A] hover:text-[#141413] transition-colors cursor-pointer"
              title="Thu gọn khung chat"
            >
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>

          {renderChatBody("max-h-[50vh]")}
        </div>
      )}
    </>,
    document.body
  );
}
