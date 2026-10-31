"use client";

import React from "react";
import { Sparkles, Scan, CheckCircle2 } from "lucide-react";

export default function TranslationEvaluatingLoader() {
  return (
    <div className="mt-4 rounded-2xl border border-indigo-500/30 bg-slate-950/90 p-5 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-600/20">
            <Scan className="h-4 w-4 animate-spin" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              AI Đang Đối Chiếu & Chấm Điểm
              <Sparkles className="h-3 w-3 text-indigo-400 animate-pulse" />
            </h4>
            <p className="text-[11px] text-slate-400">
              Phân tích độ chính xác ngữ nghĩa, ngữ pháp & phong cách dịch
            </p>
          </div>
        </div>
        <span className="text-[11px] font-semibold text-indigo-400 animate-pulse">
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
            className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-center"
          >
            <span className="text-[10px] text-slate-400 block">{dimension}</span>
            <div className="mt-2 h-6 flex items-center justify-center">
              <div className="w-10 h-4 rounded-md bg-indigo-500/20 animate-pulse" />
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-[pulse_1.5s_infinite]"
                style={{ width: `${60 + i * 10}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Detail feedback skeleton */}
      <div className="mt-4 space-y-2 pt-3 border-t border-slate-850">
        <div className="h-2.5 rounded-full bg-slate-800/80 animate-pulse w-3/4" />
        <div className="h-2 rounded-full bg-slate-800/60 animate-pulse w-1/2" />
      </div>
    </div>
  );
}

