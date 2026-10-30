import { NextRequest, NextResponse } from "next/server";
import { generateChapterLessonWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseTitle,
      chapterTitle,
      chapterText,
      pageImagesBase64,
      apiKey,
      model,
    } = body;

    const hasImages =
      Array.isArray(pageImagesBase64) && pageImagesBase64.length > 0;

    if ((!chapterText || chapterText.trim().length < 20) && !hasImages) {
      return NextResponse.json(
        {
          error:
            "Trang PDF này là bản Scan ảnh (không có lớp chữ văn bản). Hãy bấm nút 'Đọc trang Scan bằng Gemini Vision' hoặc dán văn bản vào chương này.",
        },
        { status: 400 }
      );
    }

    const lesson = await generateChapterLessonWithAI({
      courseTitle,
      chapterTitle,
      chapterText: chapterText || "",
      pageImagesBase64,
      apiKey,
      model,
    });

    return NextResponse.json({ lesson });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi AI tạo bài học cho chương.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
