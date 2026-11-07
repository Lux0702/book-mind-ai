export interface ExtractedChapterRaw {
  index: number;
  title: string;
  startPage: number;
  endPage: number;
  rawText: string;
  isScannedPages?: boolean;
}

export interface ParsedBookResult {
  fileName: string;
  fileSizeMB: number;
  totalPages: number;
  isMostlyScanned: boolean;
  pageTexts: string[];
  chapters: ExtractedChapterRaw[];
}

export interface ParseProgressCallback {
  (info: { currentPage: number; totalPages: number; statusText: string }): void;
}

/**
 * Clean up spaced numbers/letters common in CJK/special PDFs (e.g., "LESSON 1 1" -> "LESSON 11")
 */
export function normalizePdfHeaderSample(text: string): string {
  return text
    .replace(/L\s*E\s*S\s*S\s*O\s*N/gi, "LESSON")
    .replace(/C\s*H\s*A\s*P\s*T\s*E\s*R/gi, "CHAPTER")
    .replace(/U\s*N\s*I\s*T/gi, "UNIT")
    .replace(/D\s*i\s*a\s*l\s*o\s*g\s*u\s*e/gi, "Dialogue")
    .replace(/(LESSON|CHAPTER|UNIT|CHƯƠNG|BÀI)\s+(\d)\s+(\d)\b/gi, "$1 $2$3")
    .replace(
      /第\s*([一二三四五六七八九十百零0-9]+)\s*([課课章節节單元])/g,
      "第$1$2"
    );
}

/**
 * Build a compact summary of the book's first 15 pages (where the Table of Contents lives)
 * plus the header of every page in the PDF so AI can map all lessons (e.g. Unit 1 -> Unit 15+) without getting truncated.
 */
export function buildTocPromptPayload(pageTexts: string[]): string {
  const lines: string[] = [];
  const tocLimit = Math.min(15, pageTexts.length);

  lines.push("=== NỘI DUNG 15 TRANG ĐẦU (CHỨA MỤC LỤC / TABLE OF CONTENTS) ===");
  for (let i = 0; i < tocLimit; i++) {
    const t = normalizePdfHeaderSample(pageTexts[i].trim());
    if (t.length > 0) {
      lines.push(`[Page ${i + 1}] ${t.slice(0, 350)}`);
    }
  }

  lines.push(
    `\n=== TIÊU ĐỀ ĐẦU TRANG CỦA TOÀN BỘ ${pageTexts.length} TRANG TRONG FILE PDF (TỪ ĐẦU ĐẾN CUỐI SÁCH) ===`
  );
  for (let i = 0; i < pageTexts.length; i++) {
    const sample = normalizePdfHeaderSample(pageTexts[i].slice(0, 90).trim());
    if (sample.length > 0) {
      lines.push(`[Page ${i + 1}] ${sample}`);
    }
  }

  return lines.join("\n");
}

/**
 * Slice pageTexts into ExtractedChapterRaw[] given custom {title, startPage, endPage} ranges
 */
export function buildChaptersFromRanges(
  pageTexts: string[],
  ranges: { title: string; startPage: number; endPage: number }[]
): ExtractedChapterRaw[] {
  const totalPages = pageTexts.length;
  return ranges
    .map((r, idx) => {
      const sp = Math.max(1, Math.min(r.startPage, totalPages));
      const ep = Math.max(sp, Math.min(r.endPage, totalPages));
      const slice = pageTexts.slice(sp - 1, ep);
      const combinedText = slice
        .map((t, offset) => `[Page ${sp + offset}]\n${t}`)
        .join("\n\n")
        .trim();
      const rawTextNoTags = slice.join("").trim();
      const pageCount = Math.max(1, ep - sp + 1);
      const avgCharsPerPage = rawTextNoTags.length / pageCount;
      return {
        index: idx + 1,
        title: r.title,
        startPage: sp,
        endPage: ep,
        rawText: combinedText,
        // Nếu trung bình mỗi trang dưới 450 ký tự chữ -> PDF dạng Scan hoặc Hybrid (vừa có chữ tiêu đề vừa có ảnh nội dung chính)
        isScannedPages: avgCharsPerPage < 450,
      };
    })
    .filter((c) => c.endPage >= c.startPage);
}

/**
 * Streams a heavy PDF file (e.g. 81.8MB+) page-by-page in the browser,
 * cleaning up page buffers immediately after reading each page so RAM stays low.
 */
export async function parseHeavyPdfClientSide(
  file: File,
  onProgress?: ParseProgressCallback,
  pagesPerChunkFallback = 15
): Promise<ParsedBookResult> {
  const fileSizeMB = Number((file.size / (1024 * 1024)).toFixed(2));
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    disableFontFace: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;

  const pageTexts: string[] = [];
  let nonEmptyPages = 0;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    if (
      onProgress &&
      (pageNum === 1 || pageNum % 5 === 0 || pageNum === totalPages)
    ) {
      onProgress({
        currentPage: pageNum,
        totalPages,
        statusText: `Đang lọc văn bản trang ${pageNum}/${totalPages} (Giải phóng bộ nhớ đệm tự động)...`,
      });
    }

    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const strings = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (strings.length > 350) {
      nonEmptyPages++;
    }
    pageTexts.push(strings);
    page.cleanup();
  }

  // Phát hiện PDF Scan hoặc PDF Hybrid (có ít chữ tiêu đề/số trang nhưng nội dung chính nằm trong ảnh)
  const isMostlyScanned = totalPages > 0 && nonEmptyPages / totalPages < 0.55;

  // Detect chapter/lesson headings:
  // 1. Standard Lesson / Chapter / Unit / Bài / Chương / 第X課
  // 2. Textbook Dialogue 1 / 對話一 with track code like "01-1", "02-1", "03-1"... (common in Contemporary Chinese textbooks where "LESSON 1" is inside a vector badge!)
  const chapterHeadingRegex =
    /(?:(?:CHAPTER|Chapter|CHƯƠNG|Chương|BÀI|Bài|UNIT|Unit|PART|Part|MODULE|Module|LESSON|Lesson)\s*(?:[0-9]{1,3}|[IVXLCDM]+|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten)\b|第[一二三四五六七八九十百零0-9]{1,4}[課课章節节單元]|(?:對話一|对话一)\s*Dialogue\s*(?:I|1)\s*([0-9]{2})-1)[:.\-\s]*([^\n]{0,90})/i;

  const detectedStarts: { page: number; title: string }[] = [];

  for (let i = 0; i < pageTexts.length; i++) {
    // Skip very dense Table of Contents pages where multiple "Lesson 1 ... Lesson 2 ... Lesson 3" appear on the same page
    const rawSample = pageTexts[i].slice(0, 500).trim();
    const normalizedSample = normalizePdfHeaderSample(rawSample);

    const multipleLessonsOnSamePage =
      (
        normalizedSample.match(
          /(?:LESSON\s*\d+|第[一二三四五六七八九十0-9]+[課课])/gi
        ) || []
      ).length >= 3;
    if (multipleLessonsOnSamePage && i < 20) {
      // This is a Table of Contents page, not the actual start of a lesson
      continue;
    }

    const match = normalizedSample.match(chapterHeadingRegex);
    if (match) {
      let cleanTitle = match[0].slice(0, 95).trim();
      // If matched via "對話一 Dialogue I 01-1", prefix with Lesson number and page header
      if (match[1]) {
        const lessonNum = parseInt(match[1], 10);
        const topTitle = normalizedSample.slice(0, 80).trim();
        cleanTitle = `Lesson ${lessonNum}: ${topTitle}`;
      }

      if (
        detectedStarts.length === 0 ||
        i + 1 - detectedStarts[detectedStarts.length - 1].page >= 5
      ) {
        detectedStarts.push({
          page: i + 1,
          title: cleanTitle,
        });
      }
    }
  }

  const createChapterSegment = (
    startPage: number,
    endPage: number,
    customTitle?: string
  ): ExtractedChapterRaw => {
    const slice = pageTexts.slice(startPage - 1, endPage);
    const combinedText = slice
      .map((t, offset) => `[Page ${startPage + offset}]\n${t}`)
      .join("\n\n")
      .trim();

    const rawTextNoTags = slice.join("").trim();
    const snippet =
      normalizePdfHeaderSample(
        slice.find((s) => s.length > 15)?.slice(0, 65) || ""
      ).trim() || `Trang ${startPage}–${endPage}`;

    const title =
      customTitle || `Trang ${startPage}–${endPage}: ${snippet}...`;
    const pageCount = Math.max(1, endPage - startPage + 1);
    const avgCharsPerPage = rawTextNoTags.length / pageCount;

    return {
      index: 0,
      title,
      startPage,
      endPage,
      rawText: combinedText,
      isScannedPages: avgCharsPerPage < 450,
    };
  };

  const rawSegments: ExtractedChapterRaw[] = [];
  const maxAllowedSingleChapterPages = Math.max(pagesPerChunkFallback * 2, 35);

  if (detectedStarts.length >= 1) {
    if (detectedStarts[0].page > 1) {
      const missingEnd = detectedStarts[0].page - 1;
      for (let sp = 1; sp <= missingEnd; sp += pagesPerChunkFallback) {
        const ep = Math.min(sp + pagesPerChunkFallback - 1, missingEnd);
        rawSegments.push(
          createChapterSegment(
            sp,
            ep,
            `Phần Mở đầu / Mục lục (Trang ${sp}–${ep})`
          )
        );
      }
    }

    for (let idx = 0; idx < detectedStarts.length; idx++) {
      const startPage = detectedStarts[idx].page;
      const endPage =
        idx + 1 < detectedStarts.length
          ? detectedStarts[idx + 1].page - 1
          : totalPages;

      const span = endPage - startPage + 1;
      if (span <= maxAllowedSingleChapterPages) {
        rawSegments.push(
          createChapterSegment(startPage, endPage, detectedStarts[idx].title)
        );
      } else {
        const firstEnd = Math.min(
          startPage + pagesPerChunkFallback - 1,
          endPage
        );
        rawSegments.push(
          createChapterSegment(startPage, firstEnd, detectedStarts[idx].title)
        );
        for (
          let sp = firstEnd + 1;
          sp <= endPage;
          sp += pagesPerChunkFallback
        ) {
          const ep = Math.min(sp + pagesPerChunkFallback - 1, endPage);
          rawSegments.push(createChapterSegment(sp, ep));
        }
      }
    }
  } else {
    for (
      let startPage = 1;
      startPage <= totalPages;
      startPage += pagesPerChunkFallback
    ) {
      const endPage = Math.min(
        startPage + pagesPerChunkFallback - 1,
        totalPages
      );
      rawSegments.push(createChapterSegment(startPage, endPage));
    }
  }

  const chapters: ExtractedChapterRaw[] = rawSegments.map((seg, i) => ({
    ...seg,
    index: i + 1,
  }));

  await pdf.destroy();

  return {
    fileName: file.name,
    fileSizeMB,
    totalPages,
    isMostlyScanned,
    pageTexts,
    chapters,
  };
}

/**
 * Render a specific range of PDF pages into compressed JPEG base64 images
 */
export async function renderPdfPagesToImagesBase64(
  file: Blob | File,
  startPage: number,
  endPage: number,
  maxPagesToRender = 20
): Promise<string[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  }).promise;

  const images: string[] = [];
  const safeEnd = Math.min(
    endPage,
    startPage + maxPagesToRender - 1,
    pdf.numPages
  );

  for (let p = startPage; p <= safeEnd; p++) {
    const page = await pdf.getPage(p);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const maxDim = Math.max(unscaledViewport.width, unscaledViewport.height, 1);
    const targetScale = Math.min(1.35, Math.max(0.85, 1150 / maxDim));
    const viewport = page.getViewport({ scale: targetScale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      await page.render({ canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.68);
      images.push(dataUrl.replace(/^data:image\/jpeg;base64,/, ""));
    }
    page.cleanup();
  }

  await pdf.destroy();
  return images;
}

/**
 * Local Browser OCR using Tesseract.js (WebAssembly) — 100% client-side, never hits API limits or timeouts.
 */
export async function runLocalBrowserOcrOnImages(
  imagesBase64: string[],
  startPageNum = 1,
  onProgress?: (statusText: string) => void
): Promise<string> {
  if (!imagesBase64 || imagesBase64.length === 0) return "";
  const Tesseract = await import("tesseract.js");
  onProgress?.("Đang khởi tạo bộ đọc OCR nội bộ trên trình duyệt (Tesseract.js)...");

  const worker = await Tesseract.createWorker("eng+vie");
  const pageTexts: string[] = [];

  try {
    for (let i = 0; i < imagesBase64.length; i++) {
      const pageNo = startPageNum + i;
      onProgress?.(
        `Đang quét chữ từ ảnh (OCR Trình duyệt): Trang ${i + 1}/${imagesBase64.length} (Trang ${pageNo})...`
      );
      const dataUrl = `data:image/jpeg;base64,${imagesBase64[i]}`;
      const ret = await worker.recognize(dataUrl);
      const text = (ret.data?.text || "").trim();
      if (text) {
        pageTexts.push(`--- [OCR Trang ${pageNo}] ---\n${text}`);
      }
    }
  } finally {
    await worker.terminate();
  }

  return pageTexts.join("\n\n");
}

/**
 * Converts user uploaded files (PDF pages or multiple PNG/JPEG/WEBP photos) into Base64 strings.
 */
export async function convertUploadedFilesToImagesBase64(
  files: FileList | File[],
  startPage?: number,
  endPage?: number,
  maxPages = 20
): Promise<string[]> {
  const images: string[] = [];
  const fileArray = Array.from(files);

  for (const f of fileArray) {
    if (f.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name)) {
      // Direct image file
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          const clean = res.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
          resolve(clean);
        };
        reader.onerror = reject;
        reader.readAsDataURL(f);
      });
      images.push(base64);
    } else if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      const pdfImages = await renderPdfPagesToImagesBase64(
        f,
        startPage || 1,
        endPage || 9999,
        maxPages
      );
      images.push(...pdfImages);
    }
  }

  return images;
}

/**
 * Splits plain text (.txt / .md / pasted text) into logical Course chapters.
 */
export function parseRawTextIntoChapters(
  title: string,
  fullText: string
): ExtractedChapterRaw[] {
  const clean = fullText.replace(/\r\n/g, "\n").trim();
  const chapterRegex =
    /\n(?=(?:CHAPTER|Chapter|CHƯƠNG|Chương|UNIT|Unit|PART|Part|LESSON|Lesson)\s+(?:[0-9]+|[IVXLCDM]+)\b)/g;

  const parts = clean.split(chapterRegex).filter((p) => p.trim().length > 80);

  if (parts.length >= 2) {
    return parts.map((part, idx) => {
      const firstLine = part.split("\n")[0].trim().slice(0, 90);
      return {
        index: idx + 1,
        title: firstLine || `Chương ${idx + 1}`,
        startPage: idx + 1,
        endPage: idx + 1,
        rawText: part.trim(),
      };
    });
  }

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: ExtractedChapterRaw[] = [];
  let buffer = "";
  let idx = 1;

  for (const para of paragraphs) {
    if ((buffer + "\n\n" + para).length > 4500 && buffer.length > 600) {
      const firstLine = buffer.split("\n")[0].slice(0, 70).trim();
      chunks.push({
        index: idx,
        title: `Chương ${idx}: ${firstLine}...`,
        startPage: idx,
        endPage: idx,
        rawText: buffer.trim(),
      });
      idx++;
      buffer = para;
    } else {
      buffer = buffer ? `${buffer}\n\n${para}` : para;
    }
  }

  if (buffer.trim()) {
    const firstLine = buffer.split("\n")[0].slice(0, 70).trim();
    chunks.push({
      index: idx,
      title:
        chunks.length === 0
          ? `${title} - Bài học toàn văn`
          : `Chương ${idx}: ${firstLine}...`,
      startPage: idx,
      endPage: idx,
      rawText: buffer.trim(),
    });
  }

  return chunks;
}
