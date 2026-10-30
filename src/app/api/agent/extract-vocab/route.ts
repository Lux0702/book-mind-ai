import { NextRequest, NextResponse } from "next/server";
import { extractAllChapterVocabWithAI } from "@/lib/geminiAgent";

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

    const vocabulary = await extractAllChapterVocabWithAI({
      courseTitle,
      chapterTitle,
      chapterText: chapterText || "",
      pageImagesBase64,
      apiKey,
      model,
    });

    return NextResponse.json({ vocabulary });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Lỗi khi AI quét toàn bộ từ vựng của chương.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
