import { NextRequest, NextResponse } from "next/server";
import { generateCustomExamWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseTitle, scopeTitle, scannedContentAndVocab, apiKey, model } =
      body;

    const exam = await generateCustomExamWithAI({
      courseTitle,
      scopeTitle,
      scannedContentAndVocab,
      apiKey,
      model,
    });

    return NextResponse.json({ exam });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi AI sinh đề thi ôn tập.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
