"use client";

import React, { useState } from "react";
import {
  Target,
  CheckCircle2,
  Eye,
  Columns2,
  Lightbulb,
  Feather,
  MessageSquare,
  Loader2,
  Send,
  Sparkles,
} from "lucide-react";
import { ChapterLesson } from "@/types/course";
import { getAppSettings } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import AudioSpeakButton from "@/components/AudioSpeakButton";
import TutorThinkingLoader from "@/components/loadings/TutorThinkingLoader";

interface ContentTabProps {
  courseTitle: string;
  chapterTitle: string;
  chapterRawText: string;
  lesson: ChapterLesson;
}

export default function ContentTab({
  courseTitle,
  chapterTitle,
  chapterRawText,
  lesson,
}: ContentTabProps) {
  const [contentDisplayMode, setContentDisplayMode] = useState<
    "full" | "bilingual"
  >("full");
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorAnswer, setTutorAnswer] = useState<string | null>(null);
  const [isAskingTutor, setIsAskingTutor] = useState(false);

  const handleAskTutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuestion.trim()) return;
    setIsAskingTutor(true);
    try {
      const settings = getAppSettings();
      const res = await fetchAiAgent("/api/agent/ask-tutor", {
        courseTitle,
        chapterTitle,
        chapterText: chapterRawText,
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
        err instanceof Error ? err.message : "Lỗi khi kết nối Gia sư AI."
      );
    } finally {
      setIsAskingTutor(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/30 p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400">
          Tổng quan &amp; Bối cảnh Chương sách
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
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h3 className="text-base font-bold text-white">
            Phân tích &amp; Diễn giải chuyên sâu theo mạch văn bản
          </h3>

          {/* View mode toggle to eliminate Wall of Text */}
          <div className="inline-flex items-center rounded-xl border border-white/[0.08] bg-slate-950/90 p-1">
            <button
              type="button"
              onClick={() => setContentDisplayMode("full")}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                contentDisplayMode === "full"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Đầy đủ</span>
            </button>
            <button
              type="button"
              onClick={() => setContentDisplayMode("bilingual")}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                contentDisplayMode === "bilingual"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>Chỉ xem Song ngữ</span>
            </button>
          </div>
        </div>

        {/* Quick Highlight Tip Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/25 bg-indigo-950/25 px-3.5 py-2.5 text-xs text-indigo-200">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
            <span>
              Mẹo: <strong>Bôi đen</strong> từ hoặc câu tiếng Anh bất kỳ bên dưới để hiện thanh{" "}
              <span className="font-semibold text-white">
                🔊 Nghe &amp; ✨ AI Giải thích
              </span>{" "}
              ngay.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              const firstExcerpt =
                lesson.contentAnalysis[0]?.originalExcerpt || chapterRawText || "";
              const cleanSentence = firstExcerpt
                .replace(/\s+/g, " ")
                .trim()
                .split(/(?<=[.!?])\s+/)[0]
                ?.slice(0, 120)
                .trim();
              const sample =
                cleanSentence && cleanSentence.length >= 4
                  ? cleanSentence
                  : "Practice makes progress in context.";
              window.dispatchEvent(
                new CustomEvent("bookmind:sample-selection", {
                  detail: { text: sample },
                })
              );
            }}
            className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-lg border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1 text-[11px] font-bold text-indigo-100 transition hover:bg-indigo-500/35 active:scale-95 cursor-pointer"
          >
            <span>Thử ngay</span>
          </button>
        </div>

        {lesson.contentAnalysis.map((sec) => (
          <div
            key={sec.id}
            className="select-text rounded-2xl border border-slate-800 bg-slate-900/80 p-4 sm:p-6 space-y-4 transition-colors hover:border-slate-700"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
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

            {contentDisplayMode === "full" && (
              <>
                <div className="flex items-start gap-2 rounded-xl bg-indigo-950/25 border border-indigo-500/20 p-4 text-sm leading-relaxed text-slate-200 animate-in fade-in duration-200">
                  <Lightbulb className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-indigo-300">
                      Diễn giải sâu nội dung:{" "}
                    </strong>
                    {sec.deepExplanation}
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl bg-amber-950/20 border border-amber-500/20 p-3.5 text-xs leading-relaxed text-amber-200/90 animate-in fade-in duration-200">
                  <Feather className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Ghi chú văn phong &amp; Ngữ cảnh: </strong>
                    {sec.stylisticOrContextNotes}
                  </div>
                </div>
              </>
            )}
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
        <form
          onSubmit={handleAskTutor}
          className="mt-3 flex flex-col sm:flex-row gap-2"
        >
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
  );
}
