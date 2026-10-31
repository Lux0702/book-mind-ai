"use client";

import React from "react";
import { Sparkles, Bot } from "lucide-react";

export default function TutorThinkingLoader() {
  return (
    <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-4 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20">
          <Bot className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-ping" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-indigo-300">
              Gia sư AI BookMind
            </span>
            <span className="text-[10px] text-slate-400">
              đang suy nghĩ câu trả lời...
            </span>
          </div>

          {/* Thinking Sound Wave / Pulse Dots */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-indigo-400 animate-[bounce_1s_infinite_100ms]" />
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-[bounce_1s_infinite_300ms]" />
            <span className="h-2 w-2 rounded-full bg-indigo-300 animate-[bounce_1s_infinite_500ms]" />
            <span className="ml-2 text-[11px] italic text-slate-400">
              Đối chiếu văn bản chương sách & kiến thức ngữ cảnh...
            </span>
          </div>
        </div>
      </div>

      {/* Shimmer skeleton lines */}
      <div className="mt-3.5 space-y-2 pt-2 border-t border-slate-850">
        <div className="h-2.5 rounded-full bg-slate-800/80 animate-pulse w-5/6" />
        <div className="h-2.5 rounded-full bg-slate-800/60 animate-pulse w-full" />
        <div className="h-2.5 rounded-full bg-slate-800/40 animate-pulse w-2/3" />
      </div>
    </div>
  );
}

