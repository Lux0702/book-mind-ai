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
    <div className="relative overflow-hidden rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-6 sm:p-10 text-center shadow-[4px_4px_0_0_#F5EFE6]">
      {/* Animated Center Icon */}
      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
        <BookOpen className="h-8 w-8 animate-pulse" />
      </div>

      {/* Main Title */}
      <h3 className="text-xl sm:text-2xl font-extrabold text-[#F5EFE6] tracking-tight">
        AI Đang Soạn Bài Học Chuyên Sâu
      </h3>
      <p className="mt-1 text-xs sm:text-sm text-[#F3C969] font-bold">
        Chương {chapterIndex}: {chapterTitle}
      </p>

      {/* Animated Step Timeline */}
      <div className="mx-auto mt-7 max-w-lg space-y-3 text-left">
        {STEPS.map((step, idx) => {
          const isDone = idx < activeStep;
          const isCurrent = idx === activeStep;
          const Icon = step.icon;

          return (
            <div
              key={idx}
              className={`flex items-center gap-3.5 rounded-xl border-2 p-3.5 transition-colors ${
                isCurrent
                  ? "border-[#F5EFE6] bg-[#141413]"
                  : isDone
                  ? "border-[#A7D7A9] bg-[#141413]"
                  : "border-[#3A3832] bg-[#141413] opacity-50"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-[#F5EFE6] leading-none ${
                  isCurrent
                    ? "bg-[#F3C969] text-[#141413] animate-pulse"
                    : isDone
                    ? "bg-[#A7D7A9] text-[#141413]"
                    : "border-[#3A3832] bg-[#1D1C19] text-[#B8B2A6]"
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
                  className={`text-xs font-extrabold leading-snug ${
                    isCurrent
                      ? "text-[#F3C969]"
                      : isDone
                      ? "text-[#A7D7A9]"
                      : "text-[#B8B2A6]"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-[11px] leading-snug text-[#B8B2A6] truncate mt-0.5">
                  {step.sub}
                </p>
              </div>
              {isCurrent && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="h-2 w-2 rounded-full bg-[#F3C969] animate-ping" />
                  <span className="text-[10px] font-extrabold text-[#F3C969]">
                    Đang xử lý
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Skeleton hint below */}
      <div className="mx-auto mt-7 max-w-lg space-y-2 opacity-50">
        <div className="h-3 rounded-full bg-[#3A3832] animate-pulse w-3/4 mx-auto" />
        <div className="h-2.5 rounded-full bg-[#3A3832] animate-pulse w-1/2 mx-auto" />
      </div>
    </div>
  );
}

