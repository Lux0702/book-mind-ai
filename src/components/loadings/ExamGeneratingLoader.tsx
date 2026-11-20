"use client";

import React from "react";
import { Sparkles, Timer, Target } from "lucide-react";

export default function ExamGeneratingLoader() {
  return (
    <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-8 text-center shadow-[4px_4px_0_0_#F5EFE6]">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413] shadow-[3px_3px_0_0_#F5EFE6]">
        <Target className="h-7 w-7 animate-pulse" />
      </div>

      <h3 className="text-xl font-extrabold text-[#F5EFE6] tracking-tight">
        AI Đang Soạn Đề Thi Mới Tinh Cho Chương Này
      </h3>
      <p className="mt-1 text-xs text-[#B8B2A6] font-semibold max-w-md mx-auto">
        Tạo các câu hỏi trắc nghiệm & điền từ ngữ cảnh, tính toán thời gian bấm giờ từng câu dựa theo độ khó
      </p>

      {/* Dynamic progress bar */}
      <div className="mx-auto mt-6 max-w-sm">
        <div className="h-3 w-full rounded-full border-2 border-[#F5EFE6] bg-[#141413] overflow-hidden">
          <div className="h-full bg-[#F3C969] animate-[pulse_1s_infinite] w-3/4" />
        </div>
        <div className="mt-2 flex justify-between text-[11px] font-semibold text-[#B8B2A6]">
          <span>Tổng hợp ngữ pháp & từ vựng</span>
          <span className="text-[#F3C969] font-extrabold">Khoảng 5-8 giây</span>
        </div>
      </div>
    </div>
  );
}

