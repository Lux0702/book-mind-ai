"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Target,
  Mic,
  Lightbulb,
  Tag,
  CheckCircle2,
  Wrench,
} from "lucide-react";
import {
  Course,
  ChapterUnit,
  ChapterLesson,
  TranslationEvaluation,
} from "@/types/course";
import { getAppSettings, saveCourse } from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";
import { triggerChibiCelebrate } from "@/lib/chibiEvents";
import AudioSpeakButton from "@/components/AudioSpeakButton";
import TranslationEvaluatingLoader from "@/components/loadings/TranslationEvaluatingLoader";
import { PronunciationTargetParams } from "./types";

interface TranslationTabProps {
  course: Course;
  currentChapter: ChapterUnit;
  lesson: ChapterLesson;
  isSupplementingExercises: boolean;
  genError: string | null;
  onSupplementExercises: (chapter: ChapterUnit) => void;
  onCourseUpdated: (updated: Course) => Promise<void>;
  onOpenPronunciation: (params: PronunciationTargetParams) => void;
}

export default function TranslationTab({
  course,
  currentChapter,
  lesson,
  isSupplementingExercises,
  genError,
  onSupplementExercises,
  onCourseUpdated,
  onOpenPronunciation,
}: TranslationTabProps) {
  const [translationInputs, setTranslationInputs] = useState<
    Record<string, string>
  >({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

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

      if (currentChapter.lesson) {
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

        if (evaluation.overallScore >= 75) {
          triggerChibiCelebrate({
            badge: "🌟 DỊCH QUÁ ĐỈNH!",
            message: `WOOHOO!! Bản dịch đạt ${evaluation.overallScore}% luôn!! La la la~ 🎵✨`,
            subtext: `Chương ${currentChapter.index}: ${currentChapter.title}`,
          });
        }
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

  return (
    <div className="space-y-6">
      {/* Supplemental Exercises Generator Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#A7D7A9]">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Bổ sung Câu Luyện Dịch &amp; Bài Tập Thực Hành (Giữ nguyên dữ liệu cũ)
            </span>
          </div>
          <p className="text-xs text-[#B8B2A6]">
            Hiện có{" "}
            <strong className="text-[#F5EFE6]">
              {lesson.translationExercises.length} câu luyện dịch
            </strong>{" "}
            trong chương này. Bạn có thể bấm nút bên cạnh để AI tạo bổ sung thêm câu luyện dịch và bài tập điền từ mới bất cứ lúc nào.
          </p>
        </div>
        <button
          type="button"
          disabled={isSupplementingExercises}
          onClick={() => onSupplementExercises(currentChapter)}
          className="inline-flex items-center justify-center gap-2 shrink-0 rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-50 cursor-pointer"
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
        <div className="rounded-xl border-2 border-[#FF8A8A] bg-[#261919] p-3.5 text-xs font-bold text-[#FF8A8A]">
          {genError}
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] px-4 py-3 text-xs text-[#F5EFE6]">
        <Target className="h-4 w-4 text-[#F3C969] shrink-0 mt-0.5" />
        <div>
          <strong className="text-[#F3C969]">AI Chấm Dịch (0–100%):</strong>{" "}
          Dịch câu trích theo văn phong tự nhiên của bạn — AI sẽ chấm điểm ngữ nghĩa, ngữ pháp và chỉ rõ từng cụm từ cần tối ưu.
        </div>
      </div>

      {lesson.translationExercises.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-[#3A3832] bg-[#1D1C19] p-6 text-center text-xs text-[#B8B2A6]">
          Chưa có câu Luyện dịch cho chương này. Hãy bấm nút{" "}
          <strong className="text-[#A7D7A9]">
            &ldquo;Tạo ngay Câu Luyện Dịch &amp; Bài Tập Điền Từ&rdquo;
          </strong>{" "}
          phía trên để AI bổ sung ngay mà không mất dữ liệu các tab khác!
        </div>
      )}

      {evalError && (
        <div className="flex items-center justify-between rounded-xl border-2 border-[#FF8A8A] bg-[#261919] p-3.5 text-xs font-bold text-[#FF8A8A]">
          <span>{evalError}</span>
        </div>
      )}

      {lesson.translationExercises.map((tr, idx) => {
        const userText =
          translationInputs[tr.id] ?? tr.lastEvaluation?.userTranslation ?? "";
        const evalResult = tr.lastEvaluation;
        const isEvaluating = evaluatingId === tr.id;

        return (
          <div
            key={tr.id}
            className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 sm:p-6 space-y-4 shadow-[4px_4px_0_0_#F5EFE6]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-3 py-0.5 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                Bài luyện dịch #{idx + 1} ({tr.direction})
              </span>
              <div className="flex items-center gap-2">
                <AudioSpeakButton
                  text={tr.originalSentence}
                  label="Nghe câu gốc"
                  className="rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] px-2.5 py-1 text-xs font-extrabold text-[#141413]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onOpenPronunciation({
                      targetText: tr.originalSentence,
                      vietnameseMeaning: tr.referenceTranslation,
                      contextHint: tr.contextHint,
                    })
                  }
                  className="flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-1 text-xs font-extrabold text-[#141413] transition-transform active:translate-y-[1px] cursor-pointer"
                  title="Luyện đọc câu gốc này để AI chấm điểm"
                >
                  <Mic className="h-3 w-3" />
                  <span>Luyện phát âm</span>
                </button>
              </div>
            </div>

            <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
              <p className="font-serif text-base italic leading-relaxed text-[#F5EFE6]">
                &ldquo;{tr.originalSentence}&rdquo;
              </p>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-[#F3C969]">
                <Lightbulb className="h-3.5 w-3.5 shrink-0" />
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
                        className="inline-flex items-center gap-1 rounded-lg border-2 border-[#3A3832] bg-[#1D1C19] px-2 py-0.5 text-[11px] font-bold text-[#F5EFE6]"
                      >
                        <Tag className="h-3 w-3 text-[#C8B6FF]" />
                        <span>{item}</span>
                      </span>
                    ))}
                  </div>
                )}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-extrabold text-[#F5EFE6]">
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
                className="w-full rounded-lg border-2 border-[#F5EFE6] bg-[#141413] p-3.5 text-sm text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
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
                className="flex items-center gap-2 rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] px-5 py-2.5 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-40 cursor-pointer"
              >
                {isEvaluating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI đang đối chiếu &amp; chấm điểm độ gần đúng...
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
              <div className="mt-4 space-y-4 rounded-xl border-2 border-[#F5EFE6] bg-[#141413] p-5">
                {/* Score Gauges */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] p-3 text-center text-[#141413]">
                    <div className="text-[11px] font-bold">
                      Tổng điểm Độ gần đúng
                    </div>
                    <div className="mt-1 text-2xl font-black">
                      {evalResult.overallScore}%
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] p-3 text-center">
                    <div className="text-[11px] font-bold text-[#B8B2A6]">
                      Độ chính xác nghĩa
                    </div>
                    <div className="mt-1 text-xl font-black text-[#A7D7A9]">
                      {evalResult.semanticAccuracy}%
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] p-3 text-center">
                    <div className="text-[11px] font-bold text-[#B8B2A6]">
                      Ngữ pháp &amp; Cấu trúc
                    </div>
                    <div className="mt-1 text-xl font-black text-[#B8D8F8]">
                      {evalResult.grammarAndStructure}%
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] p-3 text-center">
                    <div className="text-[11px] font-bold text-[#B8B2A6]">
                      Độ tự nhiên văn phong
                    </div>
                    <div className="mt-1 text-xl font-black text-[#F3C969]">
                      {evalResult.naturalnessAndTone}%
                    </div>
                  </div>
                </div>

                {/* Strengths & Improvements */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border-2 border-[#A7D7A9] bg-[#1D1C19] p-3.5 text-xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-[#A7D7A9] mb-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>Điểm bạn đã dịch rất tốt:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[#F5EFE6]">
                      {evalResult.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-xl border-2 border-[#F3C969] bg-[#1D1C19] p-3.5 text-xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-[#F3C969] mb-1.5">
                      <Wrench className="h-3.5 w-3.5 shrink-0" />
                      <span>Góp ý chỉnh sửa để đạt 100%:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[#F5EFE6]">
                      {evalResult.improvements.map((imp, i) => (
                        <li key={i}>{imp}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Suggested Optimal Translation */}
                <div className="flex items-start gap-2 rounded-xl border-2 border-[#C8B6FF] bg-[#1D1C19] p-3.5 text-xs">
                  <Sparkles className="h-3.5 w-3.5 text-[#C8B6FF] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[#C8B6FF]">
                      Bản dịch chuẩn gợi ý:{" "}
                    </span>
                    <span className="text-[#F5EFE6]">
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
                          <tr className="border-b-2 border-[#3A3832] text-[#B8B2A6]">
                            <th className="py-2 pr-3">Cụm từ gốc</th>
                            <th className="py-2 pr-3">Bạn dịch</th>
                            <th className="py-2 pr-3">Gợi ý tối ưu</th>
                            <th className="py-2">Nhận xét</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#3A3832]">
                          {evalResult.wordByWordBreakdown.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td className="py-2 pr-3 font-bold text-[#C8B6FF]">
                                {row.sourcePhrase}
                              </td>
                              <td className="py-2 pr-3 text-[#F5EFE6]">
                                {row.userRendered}
                              </td>
                              <td className="py-2 pr-3 font-bold text-[#A7D7A9]">
                                {row.betterChoice}
                              </td>
                              <td className="py-2 text-[#B8B2A6]">
                                {row.note}
                              </td>
                            </tr>
                          ))}
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
  );
}
