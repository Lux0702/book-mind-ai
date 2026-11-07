import { NextRequest, NextResponse } from "next/server";
import { generateSupplementalExercisesWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courseTitle,
      chapterTitle,
      chapterText,
      existingLessonContext,
      apiKey,
      masterApiKey,
      model,
    } = body;

    if (
      (!chapterText || chapterText.trim().length < 10) &&
      (!existingLessonContext || existingLessonContext.trim().length < 10)
    ) {
      return NextResponse.json(
        {
          error:
            "Không có đủ văn bản hoặc dữ liệu bài học để tạo bổ sung bài tập.",
        },
        { status: 400 }
      );
    }

    const exercises = await generateSupplementalExercisesWithAI({
      courseTitle: courseTitle || "Giáo trình",
      chapterTitle: chapterTitle || "Chương học",
      chapterText: chapterText || "",
      existingLessonContext: existingLessonContext || "",
      apiKey,
      masterApiKey,
      model,
    });

    return NextResponse.json({ exercises });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Lỗi khi AI tạo bổ sung bài tập Điền từ, Trắc nghiệm & Luyện dịch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

