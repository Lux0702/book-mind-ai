import { NextRequest, NextResponse } from "next/server";
import {
  analyzeTopicVocabWithAI,
  generateTopicVocabPracticeWithAI,
} from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      topicTitle,
      targetLanguage,
      rawInputText,
      existingItems,
      vocabulary,
      targetCount,
      apiKey,
      masterApiKey,
      model,
    } = body;

    if (action === "generate_practice") {
      if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
        return NextResponse.json(
          { error: "Chưa có danh sách từ vựng để AI tạo câu hỏi ôn tập." },
          { status: 400 }
        );
      }
      const practice = await generateTopicVocabPracticeWithAI({
        topicTitle: topicTitle || "Chủ đề từ vựng",
        targetLanguage: targetLanguage || "English",
        vocabulary,
        apiKey,
        masterApiKey,
        model,
      });
      return NextResponse.json({ practice });
    }

    // Default: analyze_and_enrich (or full pipeline)
    const analyzed = await analyzeTopicVocabWithAI({
      topicTitle: topicTitle || "Chủ đề từ vựng mới",
      targetLanguage: targetLanguage || "English",
      rawInputText: rawInputText || "",
      existingItems: Array.isArray(existingItems) ? existingItems : undefined,
      targetCount: targetCount || 20,
      apiKey,
      masterApiKey,
      model,
    });

    let practice = null;
    if (body.withPractice && analyzed.vocabulary.length >= 4) {
      try {
        practice = await generateTopicVocabPracticeWithAI({
          topicTitle: analyzed.topicTitle,
          targetLanguage: targetLanguage || "English",
          vocabulary: analyzed.vocabulary,
          apiKey,
          masterApiKey,
          model,
        });
      } catch {
        practice = null;
      }
    }

    return NextResponse.json({
      topicTitle: analyzed.topicTitle,
      topicSummary: analyzed.topicSummary,
      vocabulary: analyzed.vocabulary,
      practice,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Lỗi khi AI phân tích từ vựng chủ đề và tạo bài tập.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
