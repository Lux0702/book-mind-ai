"use client";

import React from "react";
import { Sparkles, Scan, CheckCircle2 } from "lucide-react";

export default function TranslationEvaluatingLoader() {
  return (
    <div className="mt-4 rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6]">
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#3A3832]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-[#F5EFE6] bg-[#C8B6FF] text-[#141413]">
            <Scan className="h-4 w-4 animate-spin" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-[#F5EFE6] flex items-center gap-1.5">
              AI Đang Đối Chiếu & Chấm Điểm
              <Sparkles className="h-3 w-3 text-[#F3C969] animate-pulse" />
            </h4>
            <p className="text-[11px] text-[#B8B2A6]">
              Phân tích độ chính xác ngữ nghĩa, ngữ pháp & phong cách dịch
            </p>
          </div>
        </div>
        <span className="text-[11px] font-extrabold text-[#F3C969] animate-pulse">
          Đang phân tích...
        </span>
      </div>

      {/* 4 Dimension Mock Gauges */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          "Độ sát nghĩa",
          "Ngữ pháp",
          "Từ vựng",
          "Độ tự nhiên",
        ].map((dimension, i) => (
          <div
            key={i}
            className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-3 text-center"
          >
            <span className="text-[10px] font-bold text-[#B8B2A6] block">{dimension}</span>
            <div className="mt-2 h-6 flex items-center justify-center">
              <div className="w-10 h-4 rounded bg-[#3A3832] animate-pulse" />
            </div>
            <div className="mt-2 h-2 w-full rounded-full border border-[#3A3832] bg-[#1D1C19] overflow-hidden">
              <div
                className="h-full bg-[#C8B6FF] animate-[pulse_1.5s_infinite]"
                style={{ width: `${60 + i * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Detail feedback skeleton */}
      <div className="mt-4 space-y-2 pt-3 border-t-2 border-[#3A3832]">
        <div className="h-2.5 rounded-full bg-[#3A3832] animate-pulse w-3/4" />
        <div className="h-2 rounded-full bg-[#3A3832] animate-pulse w-1/2" />
      </div>
    </div>
  );
}

