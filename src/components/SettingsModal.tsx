"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  Cloud,
  Download,
  Upload,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { AppSettings } from "@/types/course";
import {
  DEFAULT_SETTINGS,
  getAppSettings,
  saveAppSettings,
  exportAllDataJSON,
  importAllDataJSON,
} from "@/lib/storage";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChanged: () => void;
}

const SUPABASE_SQL_SCHEMA = `-- Chạy đoạn SQL này trong Supabase -> SQL Editor để tạo bảng đồng bộ Cloud miễn phí:
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  data JSONB NOT NULL,
  next_review_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public access flashcards" ON public.flashcards FOR ALL USING (true) WITH CHECK (true);`;

export default function SettingsModal({
  isOpen,
  onClose,
  onSettingsChanged,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSettings(getAppSettings());
      setSavedNotice(false);
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    saveAppSettings(settings);
    setSavedNotice(true);
    onSettingsChanged();
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 700);
  };

  const handleExport = async () => {
    const json = await exportAllDataJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `book-learning-courses-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importAllDataJSON(text);
      setImportStatus(`Đã khôi phục thành công ${count} khóa học!`);
      onSettingsChanged();
    } catch {
      setImportStatus("Lỗi định dạng file JSON sao lưu.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Cài đặt AI Agent & Đồng bộ Dữ liệu (Cloud / Backup)
              </h2>
              <p className="text-xs text-slate-400">
                Thiết lập Gemini API Key miễn phí và lưu trữ đồng nhất dữ liệu học tập
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* Section 1: Gemini API Key */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
                <Key className="h-4 w-4" />
                1. Google Gemini API Key (Dùng để tạo bài giảng & chấm điểm câu dịch)
              </h3>
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                Lấy API Key miễn phí tại Google AI Studio
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">
                  Gemini API Key
                </label>
                <input
                  type="password"
                  value={settings.geminiApiKey}
                  onChange={(e) =>
                    setSettings({ ...settings, geminiApiKey: e.target.value })
                  }
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Mô hình AI
                </label>
                <select
                  value={settings.geminiModel}
                  onChange={(e) =>
                    setSettings({ ...settings, geminiModel: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Chuyên sâu)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Local IndexedDB + Supabase Sync */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Cloud className="h-4 w-4" />
                2. Đồng bộ Cloud Supabase (Tùy chọn - Đồng nhất đa thiết bị)
              </h3>
              <button
                type="button"
                onClick={() => setShowSql(!showSql)}
                className="text-xs font-medium text-emerald-400 hover:underline"
              >
                {showSql ? "Ẩn mã SQL tạo bảng" : "Xem mã SQL tạo bảng Supabase"}
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-950/20 px-3 py-2 text-xs text-emerald-200">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                Mặc định toàn bộ Course, Chương học và Flashcards đã được lưu bền vững trong <strong>IndexedDB</strong> trên máy của bạn. Nếu nhập thêm Supabase (Free Tier), dữ liệu sẽ tự động đồng bộ lên Cloud.
              </span>
            </div>

            {showSql && (
              <div className="relative rounded-xl border border-slate-800 bg-slate-900 p-3">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700"
                >
                  {copiedSql ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy SQL
                    </>
                  )}
                </button>
                <pre className="overflow-x-auto text-[11px] leading-relaxed text-slate-300">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={settings.supabaseUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, supabaseUrl: e.target.value })
                  }
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Supabase Anon Public Key
                </label>
                <input
                  type="password"
                  value={settings.supabaseAnonKey}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      supabaseAnonKey: e.target.value,
                    })
                  }
                  placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: JSON Backup & Restore */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-amber-300">
              3. Sao lưu & Khôi phục toàn bộ Khóa học (File .JSON)
            </h3>
            <p className="text-xs text-slate-400">
              Xuất toàn bộ các Course, bài học AI đã tạo và tiến độ Flashcard ra file để cất giữ hoặc chuyển sang máy tính khác bất kỳ lúc nào.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                <Download className="h-4 w-4 text-amber-400" />
                Xuất file Backup (.JSON)
              </button>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                <Upload className="h-4 w-4 text-indigo-400" />
                Khôi phục từ file (.JSON)
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
              {importStatus && (
                <span className="text-xs font-medium text-emerald-400">
                  {importStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {savedNotice ? (
              <>
                <Check className="h-4 w-4" />
                Đã lưu cài đặt!
              </>
            ) : (
              "Lưu cấu hình"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
