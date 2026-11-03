import { NextRequest, NextResponse } from "next/server";

const SERVER_RATE_LIMIT_PER_MIN = 12;
const ipAndUserRequestMap = new Map<string, number[]>();

export async function middleware(req: NextRequest) {
  // Chỉ áp dụng kiểm tra bảo mật Server-side cho các API AI (/api/agent/*)
  if (!req.nextUrl.pathname.startsWith("/api/agent/")) {
    return NextResponse.next();
  }

  const userEmail = (req.headers.get("x-user-email") || "").trim().toLowerCase();
  const expiresAtRaw = req.headers.get("x-session-expires-at") || "";
  const authHeader = req.headers.get("authorization") || "";
  const supabaseUrl =
    req.headers.get("x-supabase-url") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    req.headers.get("x-supabase-anon-key") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  // 1. Kiểm tra xác thực & Thời hạn phiên đăng nhập (Session Expiration Check)
  if (!userEmail || !expiresAtRaw) {
    return NextResponse.json(
      {
        error:
          "Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Hệ thống đã đăng xuất, vui lòng đăng nhập lại!",
        code: "SESSION_EXPIRED",
      },
      { status: 401 }
    );
  }

  const expiresAtMs = Number(expiresAtRaw);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= Date.now()) {
    return NextResponse.json(
      {
        error:
          "Phiên đăng nhập của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục học tập!",
        code: "SESSION_EXPIRED",
      },
      { status: 401 }
    );
  }

  // 2. Nếu có Bearer JWT Token của Supabase Auth -> Xác thực trực tiếp chữ ký JWT với Supabase Server
  if (
    authHeader.startsWith("Bearer ") &&
    supabaseUrl &&
    supabaseAnonKey
  ) {
    const jwt = authHeader.slice(7).trim();
    if (jwt) {
      try {
        const cleanUrl = supabaseUrl.replace(/\/+$/, "");
        const verifyRes = await fetch(`${cleanUrl}/auth/v1/user`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${jwt}`,
            apikey: supabaseAnonKey,
          },
        });

        if (verifyRes.status === 401 || verifyRes.status === 403) {
          return NextResponse.json(
            {
              error:
                "Token xác thực Supabase đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại!",
              code: "SESSION_EXPIRED",
            },
            { status: 401 }
          );
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời tới Supabase Auth
      }
    }
  }

  // 3. Server-side Rate Limiting theo IP & Tài khoản (Chống spam gọi thẳng API bằng Postman/cURL)
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : "local-ip";
  const rateKey = `${clientIp}:${userEmail}`;
  const now = Date.now();
  const recentHits = (ipAndUserRequestMap.get(rateKey) || []).filter(
    (t) => now - t < 60_000
  );

  if (recentHits.length >= SERVER_RATE_LIMIT_PER_MIN) {
    return NextResponse.json(
      {
        error: `Phát hiện tần suất gọi API vượt ngưỡng an toàn phía Server (${SERVER_RATE_LIMIT_PER_MIN} requests/phút). Vui lòng đợi 30 giây rồi thử lại!`,
        code: "RATE_LIMITED",
      },
      { status: 429 }
    );
  }

  recentHits.push(now);
  ipAndUserRequestMap.set(rateKey, recentHits);

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/agent/:path*"],
};

