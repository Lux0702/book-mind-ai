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
      <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 sm:p-6 shadow-[4px_4px_0_0_#F5EFE6]">
        <h3 className="inline-flex items-center rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-0.5 text-xs font-extrabold uppercase tracking-wider text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
          Tổng quan &amp; Bối cảnh Chương sách
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-[#F5EFE6]">
          {lesson.overview.summary}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#F3C969]">
              <Target className="h-3.5 w-3.5 shrink-0" />
              <span>Chủ đề cốt lõi (Key Themes):</span>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#F5EFE6]">
              {lesson.overview.keyThemes.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#A7D7A9]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Mục tiêu đạt được sau chương này:</span>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-[#F5EFE6]">
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
          <h3 className="text-base font-extrabold text-[#F5EFE6]">
            Phân tích &amp; Diễn giải chuyên sâu theo mạch văn bản
          </h3>

          {/* View mode toggle */}
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setContentDisplayMode("full")}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                contentDisplayMode === "full"
                  ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                  : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Đầy đủ</span>
            </button>
            <button
              type="button"
              onClick={() => setContentDisplayMode("bilingual")}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-bold transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${
                contentDisplayMode === "bilingual"
                  ? "border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]"
                  : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6] hover:border-[#F5EFE6] hover:text-[#F5EFE6]"
              }`}
            >
              <Columns2 className="h-3.5 w-3.5" />
              <span>Chỉ xem Song ngữ</span>
            </button>
          </div>
        </div>

        {/* Quick Highlight Tip Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] px-3.5 py-2.5 text-xs text-[#F5EFE6]">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#F3C969]" />
            <span>
              Mẹo: <strong>Bôi đen</strong> từ hoặc câu tiếng Anh bất kỳ bên dưới để hiện thanh{" "}
              <span className="font-extrabold text-[#F3C969]">
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
            className="inline-flex min-h-[32px] shrink-0 items-center gap-1 rounded-xl border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-1 text-[11px] font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
          >
            <span>Thử ngay</span>
          </button>
        </div>

        {lesson.contentAnalysis.map((sec) => (
          <div
            key={sec.id}
            className="select-text rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 sm:p-6 space-y-4 shadow-[4px_4px_0_0_#F5EFE6]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-base font-extrabold text-[#F3C969]">
                {sec.sectionTitle}
              </h4>
              <AudioSpeakButton
                text={sec.originalExcerpt}
                label="Nghe đoạn trích"
                className="rounded-xl border-2 border-[#F5EFE6] bg-[#B8D8F8] px-3 py-1.5 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6] transition-transform active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#B8D8F8]">
                  Nguyên tác trong sách (Original Text)
                </div>
                <p className="font-serif text-sm italic leading-relaxed text-[#F5EFE6]">
                  &ldquo;{sec.originalExcerpt}&rdquo;
                </p>
              </div>

              <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
                <div className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#A7D7A9]">
                  Bản dịch nghĩa chuẩn (Vietnamese Translation)
                </div>
                <p className="text-sm leading-relaxed text-[#F5EFE6]">
                  {sec.vietnameseTranslation}
                </p>
              </div>
            </div>

            {contentDisplayMode === "full" && (
              <>
                <div className="flex items-start gap-2.5 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 text-sm leading-relaxed text-[#F5EFE6]">
                  <Lightbulb className="h-4 w-4 text-[#C8B6FF] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#C8B6FF]">
                      Diễn giải sâu nội dung:{" "}
                    </strong>
                    {sec.deepExplanation}
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3.5 text-xs leading-relaxed text-[#F5EFE6]">
                  <Feather className="h-3.5 w-3.5 text-[#F3C969] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#F3C969]">
                      Ghi chú văn phong &amp; Ngữ cảnh:{" "}
                    </strong>
                    {sec.stylisticOrContextNotes}
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Interactive Ask-the-Book AI Tutor */}
      <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 sm:p-6 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[#F5EFE6]">
          <MessageSquare className="h-4 w-4 text-[#C8B6FF]" />
          <span>
            Hỏi Gia sư AI thêm về bất kỳ câu văn hay ý nghĩa nào trong Chương này
          </span>
        </div>
        <form
          onSubmit={handleAskTutor}
          className="mt-3 flex flex-col sm:flex-row gap-2.5"
        >
          <input
            type="text"
            value={tutorQuestion}
            onChange={(e) => setTutorQuestion(e.target.value)}
            placeholder="VD: Giải thích kỹ hơn câu thứ 2 ở đoạn 1, hoặc tại sao tác giả lại dùng hình ảnh ẩn dụ đó?..."
            className="flex-1 rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-4 py-2.5 text-sm text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
          />
          <button
            type="submit"
            disabled={isAskingTutor}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-50 shrink-0 cursor-pointer"
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
          <div className="mt-4 whitespace-pre-wrap rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 text-sm leading-relaxed text-[#F5EFE6]">
            {tutorAnswer}
          </div>
        )}
      </div>
    </div>
  );
}
