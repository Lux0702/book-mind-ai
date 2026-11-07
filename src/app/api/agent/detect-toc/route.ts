import { NextRequest, NextResponse } from "next/server";
import { extractBookTocWithAI } from "@/lib/geminiAgent";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pageSummaries,
      tocImagesBase64,
      totalPages,
      apiKey,
      masterApiKey,
      model,
    } = body;

    const chapters = await extractBookTocWithAI({
      pageSummaries,
      tocImagesBase64,
      totalPages,
      apiKey,
      masterApiKey,
      model,
    });

    return NextResponse.json({ chapters });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Lỗi khi AI phân tích mục lục cuốn sách.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
