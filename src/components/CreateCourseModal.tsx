"use client";

import React, { useState } from "react";
import {
  X,
  Upload,
  FileText,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Cpu,
  AlertCircle,
  Trash2,
  Plus,
  Loader2,
  Wand2,
  GraduationCap,
  Lightbulb,
} from "lucide-react";
import { Course, ChapterUnit } from "@/types/course";
import CustomSelect from "./ui/CustomSelect";
import {
  parseHeavyPdfClientSide,
  parseRawTextIntoChapters,
  buildTocPromptPayload,
  buildChaptersFromRanges,
  renderPdfPagesToImagesBase64,
  ExtractedChapterRaw,
} from "@/lib/pdfParser";
import {
  getAppSettings,
  saveCoursePdfBlob,
  uploadCourseRawStorageToCloud,
} from "@/lib/storage";
import { fetchAiAgent } from "@/lib/quotaManager";

interface CreateCourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCourseCreated: (course: Course) => Promise<void>;
}

const GRADIENTS = [
  "from-indigo-600 via-purple-600 to-pink-500",
  "from-emerald-600 via-teal-600 to-cyan-600",
  "from-blue-600 via-indigo-600 to-violet-600",
  "from-amber-500 via-orange-600 to-rose-600",
  "from-fuchsia-600 via-pink-600 to-rose-500",
];

export default function CreateCourseModal({
  isOpen,
  onClose,
  onCourseCreated,
}: CreateCourseModalProps) {
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("B1 - C1");
  const [pagesPerChunk, setPagesPerChunk] = useState(15);

  const [pastedText, setPastedText] = useState("");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isHybridVisionMode, setIsHybridVisionMode] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isDetectingToc, setIsDetectingToc] = useState(false);
  const [parseProgress, setParseProgress] = useState<{
    currentPage: number;
    totalPages: number;
    statusText: string;
  } | null>(null);
  const [allPageTexts, setAllPageTexts] = useState<string[]>([]);
  const [extractedChapters, setExtractedChapters] = useState<
    ExtractedChapterRaw[]
  >([]);
  const [totalPages, setTotalPages] = useState<number | undefined>(undefined);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setErrorMsg(null);

    if (!title) {
      setTitle(
        file.name.replace(/\.(pdf|txt|md)$/i, "").replace(/[_-]/g, " ")
      );
    }

    setIsParsing(true);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const res = await parseHeavyPdfClientSide(
          file,
          (info) => setParseProgress(info),
          pagesPerChunk
        );
        setAllPageTexts(res.pageTexts);
        setExtractedChapters(res.chapters);
        setTotalPages(res.totalPages);
        const hasScannedOrHybrid =
          res.isMostlyScanned || res.chapters.some((c) => c.isScannedPages);
        setIsHybridVisionMode(hasScannedOrHybrid);
      } else {
        const text = await file.text();
        const chs = parseRawTextIntoChapters(
          file.name.replace(/\.(txt|md)$/i, ""),
          text
        );
        setAllPageTexts([]);
        setExtractedChapters(chs);
        setTotalPages(chs.length);
        setIsHybridVisionMode(false);
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Không thể đọc file. Vui lòng kiểm tra định dạng PDF/TXT."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleAiDetectToc = async () => {
    if (allPageTexts.length === 0) return;
    setErrorMsg(null);
    setIsDetectingToc(true);
    try {
      const settings = getAppSettings();
      const pageSummaries = buildTocPromptPayload(allPageTexts);
      let tocImagesBase64: string[] | undefined = undefined;

      // Nếu là PDF Hybrid/Scan (mục lục có thể nằm trong ảnh), tự động render 10 trang đầu (từ trang 2-11, bỏ qua bìa trang 1) gửi kèm cho Vision AI
      if (
        selectedFile &&
        selectedFile.name.toLowerCase().endsWith(".pdf") &&
        (isHybridVisionMode ||
          allPageTexts.slice(0, 12).join("").trim().length < 2500)
      ) {
        const startTocPage = allPageTexts.length > 2 ? 2 : 1;
        const endTocPage = Math.min(startTocPage + 9, allPageTexts.length);
        tocImagesBase64 = await renderPdfPagesToImagesBase64(
          selectedFile,
          startTocPage,
          endTocPage,
          10
        );
      }

      const res = await fetchAiAgent("/api/agent/detect-toc", {
        pageSummaries,
        tocImagesBase64,
        totalPages: allPageTexts.length,
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Không thể phân tích mục lục bằng AI.");
      }

      if (Array.isArray(data.chapters) && data.chapters.length > 0) {
        const rebuilt = buildChaptersFromRanges(allPageTexts, data.chapters);
        setExtractedChapters(rebuilt);
      } else {
        throw new Error(
          "AI không tìm thấy trang Mục lục trong 11 trang đầu của file PDF."
        );
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Lỗi khi gọi AI đọc Mục lục. Hãy kiểm tra Gemini API Key."
      );
    } finally {
      setIsDetectingToc(false);
    }
  };

  const handleDeleteExtractedChapter = (idxToDelete: number) => {
    const filtered = extractedChapters
      .filter((_, i) => i !== idxToDelete)
      .map((ch, i) => ({ ...ch, index: i + 1 }));
    setExtractedChapters(filtered);
  };

  const handleUpdateChapterRange = (
    idx: number,
    newTitle: string,
    newStart: number,
    newEnd: number
  ) => {
    const updated = [...extractedChapters];
    const sp = Math.max(1, Math.min(newStart, totalPages || 9999));
    const ep = Math.max(sp, Math.min(newEnd, totalPages || 9999));

    let newRawText = updated[idx].rawText;
    if (
      allPageTexts.length > 0 &&
      (sp !== updated[idx].startPage || ep !== updated[idx].endPage)
    ) {
      const slice = allPageTexts.slice(sp - 1, ep);
      newRawText = slice
        .map((t, offset) => `[Page ${sp + offset}]\n${t}`)
        .join("\n\n")
        .trim();
    }

    updated[idx] = {
      ...updated[idx],
      title: newTitle,
      startPage: sp,
      endPage: ep,
      rawText: newRawText,
    };
    setExtractedChapters(updated);
  };

  const handleAddCustomChapter = () => {
    const lastEnd =
      extractedChapters.length > 0
        ? extractedChapters[extractedChapters.length - 1].endPage
        : 0;
    const sp = Math.min(lastEnd + 1, totalPages || 1);
    const ep = Math.min(sp + pagesPerChunk - 1, totalPages || sp);
    let rawText = "";
    if (allPageTexts.length > 0) {
      const slice = allPageTexts.slice(sp - 1, ep);
      rawText = slice
        .map((t, offset) => `[Page ${sp + offset}]\n${t}`)
        .join("\n\n")
        .trim();
    }
    setExtractedChapters([
      ...extractedChapters,
      {
        index: extractedChapters.length + 1,
        title: `Bài học mới (Trang ${sp}–${ep})`,
        startPage: sp,
        endPage: ep,
        rawText,
      },
    ]);
  };

  const handleCreateCourse = async () => {
    setErrorMsg(null);
    let finalChaptersRaw = extractedChapters;

    if (mode === "paste") {
      if (!pastedText.trim() || pastedText.trim().length < 50) {
        setErrorMsg(
          "Vui lòng dán ít nhất 50 ký tự văn bản sách hoặc tài liệu."
        );
        return;
      }
      finalChaptersRaw = parseRawTextIntoChapters(
        title || "Tài liệu học tập",
        pastedText
      );
    } else if (finalChaptersRaw.length === 0) {
      setErrorMsg("Vui lòng chọn file sách PDF hoặc TXT trước.");
      return;
    }

    const courseId = `course-${Date.now()}`;
    const gradient = GRADIENTS[Math.floor(Math.random() * GRADIENTS.length)];

    const chapterUnits: ChapterUnit[] = finalChaptersRaw.map((ch, i) => ({
      id: `${courseId}-ch-${i + 1}`,
      courseId,
      index: i + 1,
      title: ch.title,
      summary:
        ch.rawText.slice(0, 180).replace(/\s+/g, " ").trim() +
        (ch.rawText.length > 180 ? "..." : ""),
      startPage: ch.startPage,
      endPage: ch.endPage,
      rawText: ch.rawText,
      isScannedPages: Boolean(ch.isScannedPages || isHybridVisionMode),
      isGenerated: false,
      lesson: null,
      completedClozeIds: [],
      completedQuizIds: [],
      completedTranslationIds: [],
    }));

    const newCourse: Course = {
      id: courseId,
      title: title.trim() || "Khóa học Sách mới",
      author: author.trim() || "Tác giả",
      description:
        description.trim() ||
        `Khóa học tạo từ ${
          selectedFile ? selectedFile.name : "tài liệu văn bản"
        } gồm ${chapterUnits.length} chương học chuyên sâu.`,
      targetLanguage: "Multilingual",
      level,
      coverGradient: gradient,
      sourceFileName: selectedFile?.name,
      sourceFileSizeMB: selectedFile
        ? Number((selectedFile.size / (1024 * 1024)).toFixed(2))
        : undefined,
      totalPages,
      chapters: chapterUnits,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const isPdfFile = Boolean(
      selectedFile && selectedFile.name.toLowerCase().endsWith(".pdf")
    );
    if (isPdfFile && selectedFile) {
      await saveCoursePdfBlob(courseId, selectedFile, selectedFile.name);
      newCourse.hasCloudPdf = selectedFile.size <= 48 * 1024 * 1024;
    }

    // Đẩy gói nội dung từng chương (và file PDF gốc nếu <= 48MB) lên Kho A (Supabase Storage) ở chế độ nền
    void uploadCourseRawStorageToCloud(
      newCourse,
      isPdfFile ? selectedFile : null
    );

    await onCourseCreated(newCourse);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                Thêm Sách / Tài liệu mới (Tạo Course & Lọc Mục Lục)
              </h2>
              <p className="text-xs text-slate-400">
                Đọc PDF 80MB+ trực tiếp, hỗ trợ AI quét Mục lục (TOC) và xóa/chỉnh sửa các chương thừa trước khi học
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
          {/* Mode Selector */}
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-950 p-1.5">
            <button
              type="button"
              onClick={() => setMode("file")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "file"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Upload className="h-4 w-4" />
              Tải file Sách (PDF / TXT / MD)
            </button>
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
                mode === "paste"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <FileText className="h-4 w-4" />
              Dán văn bản / Chương sách
            </button>
          </div>

          {/* Course Metadata Inputs */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Tên Khóa học / Tên Sách
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Giáo trình Tiếng Trung Đương Đại 1, Clean Code..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Cấp độ mục tiêu
              </label>
              <CustomSelect
                value={level}
                onChange={(newVal) => setLevel(newVal)}
                accentColor="indigo"
                icon={<GraduationCap className="h-3.5 w-3.5" />}
                options={[
                  {
                    value: "A1 - A2",
                    label: "A1 - A2 / TOCFL 1-2",
                    badge: "Sơ cấp",
                  },
                  {
                    value: "B1 - B2",
                    label: "B1 - B2 / TOCFL 3-4",
                    badge: "Trung cấp",
                  },
                  {
                    value: "B1 - C1",
                    label: "B1 - C1",
                    badge: "Trung - Cao",
                  },
                  {
                    value: "B2 - C1",
                    label: "B2 - C1",
                    badge: "Khá giỏi",
                  },
                  {
                    value: "C1 - C2",
                    label: "C1 - C2",
                    badge: "Cao cấp",
                  },
                ]}
              />
            </div>
          </div>

          {/* File Upload Area */}
          {mode === "file" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-3 text-xs text-indigo-200">
                <div className="flex items-center gap-2.5">
                  <Cpu className="h-4 w-4 shrink-0 text-indigo-400" />
                  <span>
                    Sau khi chọn file, bạn có thể bấm{" "}
                    <strong>&ldquo;AI Đọc Mục Lục (TOC)&rdquo;</strong> hoặc tự xóa/chỉnh số trang từng bài học.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Số trang/chương mặc định:</span>
                  <input
                    type="number"
                    min={3}
                    max={50}
                    value={pagesPerChunk}
                    onChange={(e) =>
                      setPagesPerChunk(Number(e.target.value) || 15)
                    }
                    className="w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-center text-xs text-white"
                  />
                </div>
              </div>

              <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-6 text-center transition hover:border-indigo-500 hover:bg-slate-900/60">
                <Upload className="mb-2 h-8 w-8 text-indigo-400" />
                <span className="text-sm font-semibold text-white">
                  {selectedFile
                    ? `${selectedFile.name} (${(
                        selectedFile.size /
                        (1024 * 1024)
                      ).toFixed(2)} MB)`
                    : "Bấm để chọn file Sách PDF (kể cả 80MB - 300MB) hoặc TXT / MD"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {/* Progress bar when parsing heavy PDF */}
              {isParsing && parseProgress && (
                <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between text-xs text-indigo-300">
                    <span>{parseProgress.statusText}</span>
                    <span className="font-bold">
                      {Math.round(
                        (parseProgress.currentPage / parseProgress.totalPages) *
                          100
                      )}
                      %
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-200"
                      style={{
                        width: `${Math.round(
                          (parseProgress.currentPage /
                            parseProgress.totalPages) *
                            100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Hybrid PDF (Text + Image) Vision Toggle */}
              {selectedFile && selectedFile.name.toLowerCase().endsWith(".pdf") && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/20 p-3.5 text-xs transition hover:border-amber-500/70">
                  <input
                    type="checkbox"
                    checked={isHybridVisionMode}
                    onChange={(e) => setIsHybridVisionMode(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-amber-500/50 bg-slate-900 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 font-bold text-amber-300">
                      <span>
                        Chế độ Đọc Kết Hợp Chữ + Ảnh (Hybrid PDF / Gemini Vision)
                      </span>
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200 border border-amber-500/30">
                        Khuyên bật khi PDF có nội dung chính là Ảnh
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-300">
                      Nếu file PDF của bạn chỉ lấy được vài dòng chữ tiêu đề/số trang còn <strong>nội dung chính (hội thoại, bảng từ vựng, bài đọc) nằm trong hình ảnh</strong>, hãy bật ô này. Hệ thống sẽ tự động chụp từng trang PDF gửi kèm cho <strong>Gemini Vision</strong> đọc 100% chữ trong ảnh khi tạo bài học!
                    </p>
                  </div>
                </label>
              )}

              {/* Preview & Edit/Filter extracted chapters */}
              {!isParsing && extractedChapters.length > 0 && (
                <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        Danh sách Chương / Bài học ({extractedChapters.length} bài{" "}
                        {totalPages ? `• Tổng ${totalPages} trang PDF` : ""})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {allPageTexts.length > 0 && (
                        <button
                          type="button"
                          disabled={isDetectingToc}
                          onClick={handleAiDetectToc}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
                        >
                          {isDetectingToc ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              AI đang đọc Mục lục sách...
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3.5 w-3.5" />
                              AI Đọc Mục Lục (TOC) & Lọc Bài Học Chuẩn
                            </>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleAddCustomChapter}
                        className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        <Plus className="h-3.5 w-3.5 text-indigo-400" />
                        Thêm chương
                      </button>
                    </div>
                  </div>

                  <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span>
                      Bạn có thể <strong>Xóa</strong> các chương dẫn nhập không cần thiết, hoặc <strong>sửa trực tiếp Tên bài & Số trang bắt đầu – kết thúc</strong> ở bảng dưới đây:
                    </span>
                  </p>

                  <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                    {extractedChapters.map((ch, idx) => (
                      <div
                        key={idx}
                        className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 p-2.5 text-xs"
                      >
                        <span className="w-6 text-center font-bold text-indigo-400">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={ch.title}
                          onChange={(e) =>
                            handleUpdateChapterRange(
                              idx,
                              e.target.value,
                              ch.startPage,
                              ch.endPage
                            )
                          }
                          className="min-w-[200px] flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>Trang</span>
                          <input
                            type="number"
                            min={1}
                            max={totalPages || 9999}
                            value={ch.startPage}
                            onChange={(e) =>
                              handleUpdateChapterRange(
                                idx,
                                ch.title,
                                Number(e.target.value) || 1,
                                ch.endPage
                              )
                            }
                            className="w-16 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-center text-white"
                          />
                          <span>→</span>
                          <input
                            type="number"
                            min={1}
                            max={totalPages || 9999}
                            value={ch.endPage}
                            onChange={(e) =>
                              handleUpdateChapterRange(
                                idx,
                                ch.title,
                                ch.startPage,
                                Number(e.target.value) || ch.startPage
                              )
                            }
                            className="w-16 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-center text-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExtractedChapter(idx)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-950/60 hover:text-rose-400"
                          title="Xóa chương không cần thiết này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Nội dung văn bản Sách / Tài liệu (Có thể bao gồm nhiều chương)
              </label>
              <textarea
                rows={8}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Dán nội dung cuốn sách, truyện hoặc bài báo vào đây..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-800 bg-slate-950/60 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isParsing || isDetectingToc}
            onClick={handleCreateCourse}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            Lưu Danh sách Chương & Tạo Course
          </button>
        </div>
      </div>
    </div>
  );
}
