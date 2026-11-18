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
    <div className="space-y-4">
      {grammarPoints.map((gp, idx) => (
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
                    onOpenPronunciation({
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
              <strong className="flex items-center gap-1.5 mb-1 text-indigo-300">
                <BookOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span>Giải thích cấu trúc ngữ pháp:</span>
              </strong>
              {gp.detailedExplanation}
            </div>
            <div className="rounded-xl bg-slate-950/60 p-4 text-xs leading-relaxed text-slate-200">
              <strong className="flex items-center gap-1.5 mb-1 text-emerald-300">
                <Target className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>Vì sao tác giả dùng cấu trúc này trong sách?</span>
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
                    <span className="ml-2 text-slate-400">({ex.vi})</span>
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
