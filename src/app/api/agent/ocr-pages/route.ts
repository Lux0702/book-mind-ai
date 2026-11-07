import { NextRequest, NextResponse } from "next/server";
import { ocrPageImagesWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pageImagesBase64,
      startPageNum,
      apiKey,
      masterApiKey,
      model,
    } = body;

    if (!Array.isArray(pageImagesBase64) || pageImagesBase64.length === 0) {
      return NextResponse.json(
        { error: "Không có ảnh trang sách để OCR." },
        { status: 400 }
      );
    }

    const extractedText = await ocrPageImagesWithAI({
      pageImagesBase64,
      startPageNum,
      apiKey,
      masterApiKey,
      model,
    });

    return NextResponse.json({ extractedText });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi OCR ảnh trang sách.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

