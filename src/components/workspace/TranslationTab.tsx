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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-emerald-950/25 to-slate-900 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Bổ sung Câu Luyện Dịch &amp; Bài Tập Thực Hành (Giữ nguyên dữ liệu cũ)
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
          onClick={() => onSupplementExercises(currentChapter)}
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

      <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-3 text-xs text-indigo-200">
        <Target className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <strong>AI Chấm Dịch (0–100%):</strong> Dịch câu trích theo văn phong tự nhiên của bạn — AI sẽ chấm điểm ngữ nghĩa, ngữ pháp và chỉ rõ từng cụm từ cần tối ưu.
        </div>
      </div>

      {lesson.translationExercises.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
          Chưa có câu Luyện dịch cho chương này. Hãy bấm nút{" "}
          <strong className="text-emerald-300">
            &ldquo;Tạo ngay Câu Luyện Dịch &amp; Bài Tập Điền Từ&rdquo;
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
          translationInputs[tr.id] ?? tr.lastEvaluation?.userTranslation ?? "";
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
                    onOpenPronunciation({
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
                      Ngữ pháp &amp; Cấu trúc
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
                          {evalResult.wordByWordBreakdown.map((row, rIdx) => (
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
