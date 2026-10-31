"use client";

import React from "react";
import { Sparkles, Timer, Target } from "lucide-react";

export default function ExamGeneratingLoader() {
  return (
    <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-950 p-8 text-center shadow-2xl backdrop-blur animate-in fade-in zoom-in-95 duration-200">
      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping duration-1000" />
        <div className="absolute -inset-2 rounded-full border border-amber-500/30 animate-[spin_8s_linear_infinite]" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl shadow-amber-500/25">
          <Target className="h-7 w-7 animate-pulse" />
        </div>
      </div>

      <h3 className="text-xl font-extrabold text-white tracking-tight">
        AI Đang Soạn Đề Thi Mới Tinh Cho Chương Này
      </h3>
      <p className="mt-1 text-xs text-amber-300 font-medium max-w-md mx-auto">
        Tạo các câu hỏi trắc nghiệm & điền từ ngữ cảnh, tính toán thời gian bấm giờ từng câu dựa theo độ khó
      </p>

      {/* Dynamic progress bar */}
      <div className="mx-auto mt-6 max-w-sm">
        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-[pulse_1s_infinite] w-3/4" />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-400">
          <span>Tổng hợp ngữ pháp & từ vựng</span>
          <span className="text-amber-400 font-semibold">Khoảng 5-8 giây</span>
        </div>
      </div>
    </div>
  );
}

