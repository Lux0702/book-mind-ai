import { NextRequest, NextResponse } from "next/server";
import { evaluatePronunciationWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      expectedText,
      spokenText,
      audioBase64,
      audioMimeType,
      language,
      pinyinOrIpa,
      apiKey,
      masterApiKey,
      model,
    } = body;

    if (!expectedText || !expectedText.trim()) {
      return NextResponse.json(
        { error: "Thiếu văn bản mẫu cần đọc." },
        { status: 400 }
      );
    }

    if ((!spokenText || !spokenText.trim()) && !audioBase64) {
      return NextResponse.json(
        { error: "Chưa ghi nhận được giọng đọc của bạn. Vui lòng bấm vào Micro và đọc to rõ ràng." },
        { status: 400 }
      );
    }

    const evaluation = await evaluatePronunciationWithAI({
      expectedText,
      spokenText: spokenText || "",
      audioBase64,
      audioMimeType,
      language,
      pinyinOrIpa,
      apiKey,
      masterApiKey,
      model,
    });

    return NextResponse.json({ evaluation });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi AI chấm điểm phát âm.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

