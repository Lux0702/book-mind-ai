import { NextRequest, NextResponse } from "next/server";
import { getDailyLiveFreeModels } from "@/lib/freeModelDiscovery";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent/free-models
 * Daily live discovery endpoint: checks which OpenRouter (:free) & Groq models are active today
 * and caches them on the server so AI routes never hit retired/404 models.
 */
export async function GET(req: NextRequest) {
  try {
    const forceRefresh = req.nextUrl.searchParams.get("force") === "1";
    const snapshot = await getDailyLiveFreeModels({ forceRefresh });
    return NextResponse.json({
      ok: true,
      ...snapshot,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Không thể kiểm tra danh sách model miễn phí hôm nay.",
      },
      { status: 500 }
    );
  }
}
