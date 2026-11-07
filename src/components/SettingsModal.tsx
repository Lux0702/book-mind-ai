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
                    label: "Google Gemini 2.5 Flash (+ Tự động chuyển sang Qwen khi hết Quota)",
                    subLabel: "Ưu tiên Gemini, tự động nhảy sang Qwen (Groq/SiliconFlow/OpenRouter) nếu hết 20 lượt",
                    badge: "Auto 4 Tầng",
                  },
                  {
                    value: "qwen-groq",
                    label: "⚡ Qwen 3 32B — Groq Cloud Siêu Tốc (Free)",
                    subLabel: "Tốc độ tạo bài 2–3 giây, hạn mức 1.000+ lượt/ngày miễn phí",
                    badge: "Siêu tốc Free",
                  },
                  {
                    value: "qwen-openrouter",
                    label: "🟢 Qwen 2.5 72B & Qwen VL Vision — OpenRouter (Free)",
                    subLabel: "Bản 72B thông minh nhất + đọc trực tiếp ảnh trang sách (:free $0.00)",
                    badge: "Qwen 72B Free",
                  },
                  {
                    value: "qwen-siliconflow",
                    label: "🔵 Qwen 2.5 7B & VL — SiliconFlow Cloud (Free)",
                    subLabel: "Chính chủ hệ sinh thái Qwen, cực chuẩn tiếng Trung/Anh miễn phí",
                    badge: "Qwen Cloud",
                  },
                  {
                    value: "gemini-2.0-flash",
                    label: "Google Gemini 2.0 Flash",
                    subLabel: "Phản hồi nhanh cho dịch câu và phát âm",
                    badge: "Tốc độ cao",
                  },
                  {
                    value: "gemini-2.5-pro",
                    label: "Google Gemini 2.5 Pro",
                    subLabel: "Phân tích ngữ pháp & diễn giải sách chuyên sâu nhất",
                    badge: "Chuyên sâu",
                  },
                ]}
              />
            </div>
          </div>

          {/* Section 2: JSON Backup & Restore */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <h3 className="text-sm font-semibold text-amber-300">
              2. Sao lưu & Khôi phục toàn bộ Khóa học (File .JSON)
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
