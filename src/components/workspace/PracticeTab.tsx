"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  Plus,
  Lightbulb,
  Check,
  XCircle,
} from "lucide-react";
import { ChapterUnit, ChapterLesson } from "@/types/course";

interface PracticeTabProps {
  currentChapter: ChapterUnit;
  lesson: ChapterLesson;
  isSupplementingExercises: boolean;
  genError: string | null;
  onSupplementExercises: (chapter: ChapterUnit) => void;
  clozeInputs: Record<string, string>;
  clozeChecked: Record<string, boolean>;
  onClozeInputChange: (clozeId: string, value: string) => void;
  onCheckCloze: (clozeId: string, correctAnswer: string) => void;
  onRevealCloze: (clozeId: string, answer: string) => void;
  quizSelected: Record<string, number>;
  quizSubmitted: Record<string, boolean>;
  onSelectQuizOption: (quizId: string, optIdx: number) => void;
  onSubmitQuiz: (quizId: string, correctIndex: number) => void;
}

export default function PracticeTab({
  currentChapter,
  lesson,
  isSupplementingExercises,
  genError,
  onSupplementExercises,
  clozeInputs,
  clozeChecked,
  onClozeInputChange,
  onCheckCloze,
  onRevealCloze,
  quizSelected,
  quizSubmitted,
  onSelectQuizOption,
  onSubmitQuiz,
}: PracticeTabProps) {
  const [showClozeHint, setShowClozeHint] = useState<Record<string, boolean>>(
    {}
  );

  return (
    <div className="space-y-8">
      {/* Supplemental Exercises Generator Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-slate-900 via-emerald-950/25 to-slate-900 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
            <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>
              Bổ sung Bài tập Điền từ, Trắc nghiệm &amp; Luyện dịch (Không mất dữ liệu Tab 1, 2, 3)
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
            . Bấm nút bên cạnh để AI sinh nối tiếp thêm bộ bài tập mới dựa trên từ vựng &amp; ngữ pháp của chương.
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
          Phần A: Điền từ vào ngữ cảnh câu trong sách (Cloze Test) (
          {lesson.clozeExercises.length})
        </h3>
        {lesson.clozeExercises.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
            Chưa có bài tập Điền từ cho chương này. Hãy bấm nút{" "}
            <strong className="text-emerald-300">
              &ldquo;Tạo ngay Điền từ, Trắc nghiệm &amp; Luyện dịch&rdquo;
            </strong>{" "}
            màu xanh phía trên để AI bổ sung ngay mà không làm mất nội dung Tab 1, 2, 3!
          </div>
        )}
        {lesson.clozeExercises.map((cl, idx) => {
          const userVal = clozeInputs[cl.id] || "";
          const isChecked = clozeChecked[cl.id];
          const isCorrect =
            userVal.trim().toLowerCase() === cl.answer.trim().toLowerCase();

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
                  onChange={(e) => onClozeInputChange(cl.id, e.target.value)}
                  placeholder="Nhập từ còn thiếu..."
                  className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onCheckCloze(cl.id, cl.answer)}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
                >
                  Kiểm tra đáp án
                </button>
                <button
                  type="button"
                  onClick={() => onRevealCloze(cl.id, cl.answer)}
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
                    <strong>Dịch câu:</strong> {cl.fullSentenceTranslation}
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
          Phần B: Trắc nghiệm Đọc hiểu, Từ vựng &amp; Ngữ pháp (
          {lesson.quizExercises.length})
        </h3>
        {lesson.quizExercises.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center text-xs text-slate-400">
            Chưa có câu hỏi Trắc nghiệm cho chương này. Bấm nút{" "}
            <strong className="text-emerald-300">
              &ldquo;Tạo ngay Điền từ, Trắc nghiệm &amp; Luyện dịch&rdquo;
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
              <p className="text-sm font-semibold text-white">{qz.question}</p>
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
                      btnStyle = "border-rose-500 bg-rose-950/30 text-rose-200";
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
                          onSelectQuizOption(qz.id, optIdx);
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
                  onClick={() => onSubmitQuiz(qz.id, qz.correctIndex)}
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
  );
}
