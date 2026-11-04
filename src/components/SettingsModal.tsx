"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Download,
  Upload,
  Check,
  ShieldCheck,
  Sparkles,
  Sliders,
  Database,
  ExternalLink,
} from "lucide-react";
import { AppSettings } from "@/types/course";
import CustomSelect from "./ui/CustomSelect";
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

export default function SettingsModal({
  isOpen,
  onClose,
  onSettingsChanged,
}: SettingsModalProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedNotice, setSavedNotice] = useState(false);
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
      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Tùy chỉnh Học tập & Sao lưu Dữ liệu
              </h2>
              <p className="text-xs text-slate-400">
                Chọn mô hình AI phản hồi và sao lưu các khóa học cá nhân của bạn
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
        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {/* Section 1: AI Model Preference */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-indigo-300">
              <Sparkles className="h-4 w-4" />
              1. Mô hình AI Ưu tiên
            </h3>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-3 text-xs text-emerald-200 flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>
                Tài khoản của bạn đã được hệ thống tự động cấp phát và liên kết quyền gọi AI. Hạn mức lượt gọi tự động làm mới vào 00:00 mỗi ngày.
              </span>
            </div>

            <div>
              <label className="mb-1.5 block text-xs text-slate-400">
                Chọn mô hình xử lý bài học & chấm điểm
              </label>
              <CustomSelect
                value={settings.geminiModel}
                onChange={(newVal) =>
                  setSettings({ ...settings, geminiModel: newVal })
                }
                size="md"
                accentColor="indigo"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                options={[
                  {
                    value: "gemini-2.5-flash",
                    label: "Gemini 2.5 Flash",
                    subLabel: "Cân bằng hoàn hảo giữa tốc độ và độ chính xác",
                    badge: "Khuyên dùng",
                  },
                  {
                    value: "gemini-2.0-flash",
                    label: "Gemini 2.0 Flash",
                    subLabel: "Phản hồi nhanh cho dịch câu và phát âm",
                    badge: "Tốc độ cao",
                  },
                  {
                    value: "gemini-2.5-pro",
                    label: "Gemini 2.5 Pro",
                    subLabel: "Phân tích ngữ pháp & diễn giải sách chuyên sâu nhất",
                    badge: "Chuyên sâu",
                  },
                ]}
              />
            </div>
          </div>

          {/* Section 2: Supabase Cloud Configuration */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
                <Database className="h-4 w-4" />
                2. Cấu hình Supabase Cloud (Google Auth & Đồng bộ)
              </h3>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
              >
                <span>Dashboard Supabase</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="text-xs text-slate-400">
              Cần thiết để bật tính năng <strong>Đăng nhập Google</strong> và đồng bộ dữ liệu sách giữa các thiết bị.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={settings.supabaseUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, supabaseUrl: e.target.value.trim() })
                  }
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
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
                      supabaseAnonKey: e.target.value.trim(),
                    })
                  }
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 italic">
              💡 Mẹo khi Deploy lên Vercel: Thêm 2 biến này vào <strong>Vercel Settings &rarr; Environment Variables</strong> (tên <code>NEXT_PUBLIC_SUPABASE_URL</code> và <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>) để mọi người dùng đều có sẵn Google Auth tự động.
            </p>
          </div>

          {/* Section 3: JSON Backup & Restore */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-amber-300">
              3. Sao lưu & Khôi phục toàn bộ Khóa học (File .JSON)
            </h3>
            <p className="text-xs text-slate-400">
              Xuất toàn bộ các Course, bài học AI đã tạo và tiến độ Flashcard ra file để cất giữ hoặc chuyển sang thiết bị khác bất kỳ lúc nào.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
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
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500 cursor-pointer"
          >
            {savedNotice ? (
              <>
                <Check className="h-4 w-4" />
                Đã lưu!
              </>
            ) : (
              "Lưu tùy chỉnh"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
