import { NextRequest, NextResponse } from "next/server";
import { evaluateSentenceTranslationWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      originalSentence,
      referenceTranslation,
      contextHint,
      userTranslation,
      apiKey,
      masterApiKey,
      model,
    } = body;

    if (!userTranslation || !userTranslation.trim()) {
      return NextResponse.json(
        { error: "Vui lòng nhập câu dịch của bạn trước khi chấm điểm." },
        { status: 400 }
      );
    }

    const evaluation = await evaluateSentenceTranslationWithAI({
      originalSentence,
      referenceTranslation,
      contextHint,
      userTranslation,
      apiKey,
      masterApiKey,
      model,
    });

    return NextResponse.json({ evaluation });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi AI chấm điểm bản dịch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
