import React from "react";

export default function AppRouteLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 space-y-5 animate-in fade-in duration-150">
      {/* Mode Switcher / Top Control Skeleton */}
      <div className="h-14 w-full rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] p-2 flex items-center gap-2.5 animate-pulse">
        <div className="h-full flex-1 rounded-lg bg-[#262520]" />
        <div className="h-full flex-1 rounded-lg bg-[#141413]" />
      </div>

      {/* Main Hero / Filter Bar Skeleton */}
      <div className="rounded-xl border-2 border-[#3A3832] bg-[#1D1C19] p-5 space-y-4 animate-pulse">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-5 w-56 rounded-lg bg-[#3A3832]" />
            <div className="h-3.5 w-80 max-w-full rounded bg-[#262520]" />
          </div>
          <div className="h-9 w-36 rounded-xl bg-[#262520]" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
          <div className="h-12 rounded-xl bg-[#141413] border border-[#3A3832]" />
          <div className="h-12 rounded-xl bg-[#141413] border border-[#3A3832]" />
          <div className="h-12 rounded-xl bg-[#141413] border border-[#3A3832]" />
        </div>
      </div>

      {/* Content Cards Skeleton Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-36 rounded-xl border-2 border-[#3A3832] bg-[#1D1C19]/80 p-5 animate-pulse space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-1/3 rounded bg-[#3A3832]" />
              <div className="h-5 w-14 rounded-full bg-[#262520]" />
            </div>
            <div className="h-3 w-3/4 rounded bg-[#262520]" />
            <div className="h-10 w-full rounded-lg bg-[#141413]" />
          </div>
        ))}
      </div>
    </div>
  );
}
