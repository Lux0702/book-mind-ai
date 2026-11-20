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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-4 shadow-[4px_4px_0_0_#F5EFE6]">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-extrabold text-[#A7D7A9]">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>
              Bổ sung Bài tập Điền từ, Trắc nghiệm &amp; Luyện dịch (Không mất dữ liệu Tab 1, 2, 3)
            </span>
          </div>
          <p className="text-xs text-[#B8B2A6]">
            Hiện có{" "}
            <strong className="text-[#F5EFE6]">
              {lesson.clozeExercises.length} câu điền từ
            </strong>
            ,{" "}
            <strong className="text-[#F5EFE6]">
              {lesson.quizExercises.length} câu trắc nghiệm
            </strong>{" "}
            và{" "}
            <strong className="text-[#F5EFE6]">
              {lesson.translationExercises.length} câu luyện dịch
            </strong>
            . Bấm nút bên cạnh để AI sinh nối tiếp thêm bộ bài tập mới dựa trên từ vựng &amp; ngữ pháp của chương.
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
        <div className="rounded-xl border-2 border-[#FF8A8A] bg-[#261919] p-3.5 text-xs font-bold text-[#FF8A8A]">
          {genError}
        </div>
      )}

      {/* Part A: Fill in the blank */}
      <div className="space-y-4">
        <h3 className="text-base font-extrabold text-[#F5EFE6]">
          Phần A: Điền từ vào ngữ cảnh câu trong sách (Cloze Test) (
          {lesson.clozeExercises.length})
        </h3>
        {lesson.clozeExercises.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#3A3832] bg-[#1D1C19] p-6 text-center text-xs text-[#B8B2A6]">
            Chưa có bài tập Điền từ cho chương này. Hãy bấm nút{" "}
            <strong className="text-[#A7D7A9]">
              &ldquo;Tạo ngay Điền từ, Trắc nghiệm &amp; Luyện dịch&rdquo;
            </strong>{" "}
            phía trên để AI bổ sung ngay mà không làm mất nội dung Tab 1, 2, 3!
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
              className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 space-y-3 shadow-[4px_4px_0_0_#F5EFE6]"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
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
                  className="flex items-center gap-1 font-bold text-[#F3C969] hover:underline cursor-pointer"
                >
                  <Lightbulb className="h-3.5 w-3.5" />
                  {showClozeHint[cl.id] ? "Ẩn gợi ý" : "Xem gợi ý"}
                </button>
              </div>

              <p className="font-serif text-base leading-relaxed text-[#F5EFE6]">
                {cl.sentenceWithBlank}
              </p>

              {showClozeHint[cl.id] && (
                <div className="flex items-center gap-1.5 rounded-lg border-2 border-[#F3C969] bg-[#141413] px-3 py-2 text-xs font-semibold text-[#F3C969]">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0" />
                  <span>Gợi ý: {cl.hint}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <input
                  type="text"
                  value={userVal}
                  onChange={(e) => onClozeInputChange(cl.id, e.target.value)}
                  placeholder="Nhập từ còn thiếu..."
                  className="w-full sm:w-64 rounded-lg border-2 border-[#F5EFE6] bg-[#141413] px-3.5 py-2 text-sm text-[#F5EFE6] placeholder-[#8F8A7E] focus:border-[#F3C969] focus:shadow-[2px_2px_0_0_#F3C969] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => onCheckCloze(cl.id, cl.answer)}
                  className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                >
                  Kiểm tra đáp án
                </button>
                <button
                  type="button"
                  onClick={() => onRevealCloze(cl.id, cl.answer)}
                  className="rounded-xl border-2 border-[#F5EFE6] bg-[#141413] px-3 py-2 text-xs font-bold text-[#F5EFE6] shadow-[3px_3px_0_0_#F5EFE6] transition-transform hover:bg-[#262520] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] cursor-pointer"
                >
                  Hiện đáp án
                </button>
              </div>

              {isChecked && (
                <div
                  className={`rounded-xl border-2 p-3.5 text-xs ${
                    isCorrect
                      ? "border-[#A7D7A9] bg-[#141413] text-[#F5EFE6]"
                      : "border-[#FF8A8A] bg-[#141413] text-[#F5EFE6]"
                  }`}
                >
                  <div
                    className={`flex items-center gap-1.5 font-extrabold ${
                      isCorrect ? "text-[#A7D7A9]" : "text-[#FF8A8A]"
                    }`}
                  >
                    {isCorrect ? (
                      <>
                        <Check className="h-4 w-4" />
                        Chính xác! Đáp án: &ldquo;{cl.answer}&rdquo;
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        Chưa chính xác. Đáp án đúng là: &ldquo;{cl.answer}&rdquo;
                      </>
                    )}
                  </div>
                  <p className="mt-1.5 text-[#F5EFE6]">
                    <strong>Dịch câu:</strong> {cl.fullSentenceTranslation}
                  </p>
                  <p className="mt-1 text-[#B8B2A6]">
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
        <h3 className="text-base font-extrabold text-[#F5EFE6]">
          Phần B: Trắc nghiệm Đọc hiểu, Từ vựng &amp; Ngữ pháp (
          {lesson.quizExercises.length})
        </h3>
        {lesson.quizExercises.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-[#3A3832] bg-[#1D1C19] p-6 text-center text-xs text-[#B8B2A6]">
            Chưa có câu hỏi Trắc nghiệm cho chương này. Bấm nút{" "}
            <strong className="text-[#A7D7A9]">
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
              className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 space-y-4 shadow-[4px_4px_0_0_#F5EFE6]"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border-2 border-[#F5EFE6] bg-[#B8D8F8] px-2.5 py-0.5 text-xs font-extrabold uppercase text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                  Câu trắc nghiệm #{idx + 1} • {qz.category}
                </span>
              </div>
              <p className="text-sm font-bold text-[#F5EFE6]">{qz.question}</p>
              <div className="space-y-2.5">
                {qz.options.map((opt, optIdx) => {
                  const isPicked = selected === optIdx;
                  const isRight = qz.correctIndex === optIdx;

                  let btnStyle =
                    "border-[#3A3832] bg-[#141413] text-[#F5EFE6] hover:border-[#F5EFE6]";
                  if (submitted) {
                    if (isRight) {
                      btnStyle =
                        "border-[#F5EFE6] bg-[#A7D7A9] text-[#141413] font-extrabold";
                    } else if (isPicked && !isRight) {
                      btnStyle =
                        "border-[#F5EFE6] bg-[#FF8A8A] text-[#141413] font-extrabold";
                    }
                  } else if (isPicked) {
                    btnStyle =
                      "border-[#F5EFE6] bg-[#F3C969] text-[#141413] font-extrabold shadow-[3px_3px_0_0_#F5EFE6]";
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
                      className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left text-xs transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer ${btnStyle}`}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-current font-black">
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
                  className="rounded-xl border-2 border-[#F5EFE6] bg-[#A7D7A9] px-4 py-2 text-xs font-extrabold text-[#141413] shadow-[3px_3px_0_0_#F5EFE6] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0_0_#F5EFE6] disabled:opacity-40 cursor-pointer"
                >
                  Chốt đáp án
                </button>
              ) : (
                <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3.5 text-xs leading-relaxed text-[#F5EFE6]">
                  <strong className="text-[#C8B6FF]">
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
