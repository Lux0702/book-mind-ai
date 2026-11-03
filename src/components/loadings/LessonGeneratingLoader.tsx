"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Sparkles, Brain, Check, Layers } from "lucide-react";

interface LessonGeneratingLoaderProps {
  chapterIndex: number;
  chapterTitle: string;
}

const STEPS = [
  {
    icon: BookOpen,
    label: "Đang đọc & bóc tách cấu trúc nội dung toàn bộ chương sách...",
    sub: "Quét từng đoạn văn bản, xác định ngữ cảnh và phân đoạn trọng tâm",
  },
  {
    icon: Brain,
    label: "Phân tích ngữ pháp chuyên sâu & trích xuất câu văn mẫu...",
    sub: "Giải thích công thức, vị trí ngữ pháp và lý do tác giả sử dụng",
  },
  {
    icon: Sparkles,
    label: "Đóng gói kho từ vựng kèm phiên âm, cấp độ CEFR & cụm từ...",
    sub: "Tạo thẻ Flashcard SRS thông minh để ghi nhớ dài hạn",
  },
  {
    icon: Layers,
    label: "Thiết kế bộ bài tập điền từ, trắc nghiệm & câu luyện dịch...",
    sub: "Tối ưu hóa các câu hỏi thực chiến bám sát nội dung cuốn sách",
  },
];

export default function LessonGeneratingLoader({
  chapterIndex,
  chapterTitle,
}: LessonGeneratingLoaderProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Progressively cycle through informative steps every 3.5s
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl">
      {/* Background radial glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-indigo-600/20 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 w-80 h-80 rounded-full bg-purple-600/15 blur-[80px]" />

      {/* Animated Center Orb */}
      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
        {/* Pulsing rings */}
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping duration-1000" />
        <div className="absolute -inset-2 rounded-full border border-indigo-400/30 animate-[spin_6s_linear_infinite]" />
        <div className="absolute -inset-4 rounded-full border border-purple-500/20 border-dashed animate-[spin_10s_linear_infinite_reverse]" />
        
        {/* Center icon */}
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 ring-2 ring-white/20">
          <BookOpen className="h-8 w-8 animate-pulse" />
        </div>
      </div>

      {/* Main Title */}
      <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
        AI Đang Soạn Bài Học Chuyên Sâu
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-indigo-300 font-medium">
        Chương {chapterIndex}: {chapterTitle}
      </p>

      {/* Animated Step Timeline */}
      <div className="mx-auto mt-8 max-w-lg space-y-3 text-left">
        {STEPS.map((step, idx) => {
          const isDone = idx < activeStep;
          const isCurrent = idx === activeStep;
          const Icon = step.icon;

          return (
            <div
              key={idx}
              className={`flex items-center gap-3.5 rounded-2xl p-3.5 transition-all duration-500 ${
                isCurrent
                  ? "border border-indigo-500/40 bg-indigo-950/40 shadow-lg shadow-indigo-600/10 scale-[1.02]"
                  : isDone
                  ? "border border-emerald-500/20 bg-emerald-950/10 opacity-85"
                  : "border border-slate-800/40 bg-slate-900/20 opacity-40"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl leading-none transition ${
                  isCurrent
                    ? "bg-indigo-600 text-white animate-pulse shadow-md shadow-indigo-600/30"
                    : isDone
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                    : "bg-slate-800 text-slate-400"
                }`}
              >
                {isDone ? (
                  <Check className="h-4 w-4 stroke-[2.5]" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-xs font-bold leading-snug ${
                    isCurrent
                      ? "text-indigo-200"
                      : isDone
                      ? "text-emerald-300"
                      : "text-slate-400"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] leading-snug text-slate-400 truncate mt-0.5">
                  {step.sub}
                </p>
              </div>
              {isCurrent && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
                  <span className="text-[10px] font-semibold text-indigo-400">
                    Đang xử lý
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shimmer skeleton hint below */}
      <div className="mx-auto mt-8 max-w-lg space-y-2 opacity-40">
        <div className="h-3 rounded-full bg-slate-800 animate-pulse w-3/4 mx-auto" />
        <div className="h-2.5 rounded-full bg-slate-800 animate-pulse w-1/2 mx-auto" />
      </div>
    </div>
  );
}

