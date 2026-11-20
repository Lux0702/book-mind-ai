"use client";

import React from "react";
import { Sparkles, Layers, Search } from "lucide-react";

export default function VocabScanningLoader() {
  return (
    <div className="rounded-xl border-2 border-[#F5EFE6] bg-[#1D1C19] p-5 shadow-[4px_4px_0_0_#F5EFE6]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#F5EFE6] bg-[#F3C969] text-[#141413]">
          <Search className="h-5 w-5 animate-pulse" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-extrabold text-[#F5EFE6] flex items-center gap-2">
            AI Đang Quét 100% Từ Vựng Chương Sách
            <span className="h-2 w-2 rounded-full bg-[#F3C969] animate-ping" />
          </h4>
          <p className="text-xs text-[#B8B2A6]">
            Trích xuất toàn bộ từ mới, cấp độ CEFR, phiên âm IPA, câu trích sách và collocations...
          </p>
        </div>
      </div>

      {/* Grid skeleton of flashcards appearing */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-lg border-2 border-[#3A3832] bg-[#141413] p-4 space-y-2.5 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 bg-[#3A3832] rounded w-1/3" />
              <div className="h-3.5 bg-[#3A3832] rounded-full w-12" />
            </div>
            <div className="h-3 bg-[#3A3832] rounded w-2/3" />
            <div className="h-2.5 bg-[#3A3832] rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

