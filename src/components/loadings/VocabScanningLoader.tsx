"use client";

import React from "react";
import { Sparkles, Layers, Search } from "lucide-react";

export default function VocabScanningLoader() {
  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-5 shadow-lg backdrop-blur animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-600/20">
          <Search className="h-5 w-5 animate-pulse" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            AI Đang Quét 100% Từ Vựng Chương Sách
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
          </h4>
          <p className="text-xs text-slate-400">
            Trích xuất toàn bộ từ mới, cấp độ CEFR, phiên âm IPA, câu trích sách và collocations...
          </p>
        </div>
      </div>

      {/* Grid skeleton of flashcards appearing */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2.5 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 bg-indigo-500/30 rounded w-1/3" />
              <div className="h-3.5 bg-slate-800 rounded-full w-12" />
            </div>
            <div className="h-3 bg-slate-800 rounded w-2/3" />
            <div className="h-2.5 bg-slate-800/60 rounded w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

