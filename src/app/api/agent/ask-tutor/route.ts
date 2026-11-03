import { NextRequest, NextResponse } from "next/server";
import { askBookTutorWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseTitle,
      chapterTitle,
      chapterText,
      question,
      selectedExcerpt,
      apiKey,
      masterApiKey,
      model,
    } = body;

    const answer = await askBookTutorWithAI({
      courseTitle,
      chapterTitle,
      chapterText,
      question,
      selectedExcerpt,
      apiKey,
      masterApiKey,
      model,
    });

    return NextResponse.json({ answer });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi hỏi Gia sư AI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
