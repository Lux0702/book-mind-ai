"use client";

import React from "react";
import { BookOpen, Mic, Target } from "lucide-react";
import { ChapterLesson } from "@/types/course";
import AudioSpeakButton from "@/components/AudioSpeakButton";
import { PronunciationTargetParams } from "./types";

interface GrammarTabProps {
  grammarPoints: ChapterLesson["grammarPoints"];
  onOpenPronunciation: (params: PronunciationTargetParams) => void;
}

export default function GrammarTab({
  grammarPoints,
  onOpenPronunciation,
}: GrammarTabProps) {
  return (
    <div className="space-y-5">
      {grammarPoints.map((gp, idx) => (
        <div
          key={gp.id}
          className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 sm:p-6 space-y-4 shadow-[4px_4px_0_0_#F5EFE6]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <h3 className="text-base font-extrabold text-[#F5EFE6] flex flex-wrap items-center gap-2">
              <span className="rounded-full border-2 border-[#F5EFE6] bg-[#C8B6FF] px-2.5 py-0.5 text-xs font-extrabold text-[#141413] shadow-[2px_2px_0_0_#F5EFE6]">
                Điểm ngữ pháp #{idx + 1}
              </span>
              <span>{gp.title}</span>
            </h3>
            <code className="rounded-lg border-2 border-[#F5EFE6] bg-[#F3C969] px-3 py-1 text-xs font-extrabold text-[#141413]">
              Công thức: {gp.patternFormula}
            </code>
          </div>

          <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#B8D8F8]">
                Câu trích thực tế từ chương sách:
              </span>
              <div className="flex items-center gap-2">
                <AudioSpeakButton
                  text={gp.quoteFromBook}
                  label="Nghe câu"
                  className="rounded-lg border-2 border-[#F5EFE6] bg-[#B8D8F8] px-2.5 py-1 text-xs font-extrabold text-[#141413]"
                />
                <button
                  type="button"
                  onClick={() =>
                    onOpenPronunciation({
                      targetText: gp.quoteFromBook,
                      vietnameseMeaning: gp.quoteTranslation,
                      contextHint: `Cấu trúc: ${gp.patternFormula}`,
                    })
                  }
                  className="flex items-center gap-1 rounded-lg border-2 border-[#F5EFE6] bg-[#A7D7A9] px-2.5 py-1 text-xs font-extrabold text-[#141413] transition-transform active:translate-x-[1px] active:translate-y-[1px] cursor-pointer"
                  title="Luyện đọc câu này để AI chấm điểm"
                >
                  <Mic className="h-3 w-3" />
                  <span>Luyện đọc câu</span>
                </button>
              </div>
            </div>
            <p className="mt-2 font-serif text-sm italic text-[#F5EFE6]">
              &ldquo;{gp.quoteFromBook}&rdquo;
            </p>
            <p className="mt-1 text-xs text-[#B8B2A6]">
              → {gp.quoteTranslation}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 text-xs leading-relaxed text-[#F5EFE6]">
              <strong className="flex items-center gap-1.5 mb-1.5 text-[#C8B6FF]">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span>Giải thích cấu trúc ngữ pháp:</span>
              </strong>
              {gp.detailedExplanation}
            </div>
            <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-4 text-xs leading-relaxed text-[#F5EFE6]">
              <strong className="flex items-center gap-1.5 mb-1.5 text-[#A7D7A9]">
                <Target className="h-3.5 w-3.5 shrink-0" />
                <span>Vì sao tác giả dùng cấu trúc này trong sách?</span>
              </strong>
              {gp.whyAuthorUsedIt}
            </div>
          </div>

          {gp.extraExamples && gp.extraExamples.length > 0 && (
            <div className="rounded-xl border-2 border-[#3A3832] bg-[#141413] p-3.5">
              <div className="mb-2 text-xs font-extrabold text-[#F3C969]">
                Ví dụ ứng dụng tương tự:
              </div>
              <div className="space-y-2">
                {gp.extraExamples.map((ex, i) => (
                  <div key={i} className="text-xs">
                    <span className="font-bold text-[#F5EFE6]">• {ex.en}</span>
                    <span className="ml-2 text-[#B8B2A6]">({ex.vi})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
