import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      toEmail,
      toName,
      subject,
      plan,
      apiKey,
      maxCalls,
      paymentMethod,
      amountFormatted,
      orderCode,
      resendApiKey,
    } = body;

    if (!toEmail) {
      return NextResponse.json(
        { error: "Thiếu thông tin email." },
        { status: 400 }
      );
    }

    const planName =
      plan === "unlimited"
        ? "BookMind Unlimited (VIP)"
        : plan === "pro"
        ? "BookMind Pro (50 lượt/ngày)"
        : "Gói Free (15 lượt/ngày)";

    const quotaDisplay =
      maxCalls === -1
        ? "Không giới hạn lượt gọi AI (Unlimited)"
        : `${maxCalls} lượt gọi AI / ngày (Tự động làm mới lúc 00:00 mỗi ngày)`;

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #090d16; color: #f1f5f9; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7e22ce 100%); padding: 28px 32px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #ffffff; letter-spacing: -0.5px;">BookMind AI</h1>
          <p style="margin: 6px 0 0; font-size: 13px; color: #e0e7ff;">Thông báo Kích hoạt Tài khoản & Gói Học Tập AI</p>
        </div>
        <div style="padding: 32px;">
          <p style="font-size: 15px; color: #e2e8f0; margin-top: 0;">Xin chào <strong>${toName || toEmail}</strong>,</p>
          <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
            ${
              paymentMethod === "momo" || paymentMethod === "vnpay"
                ? `Cảm ơn bạn đã nâng cấp thành công lên <strong>${planName}</strong> qua cổng thanh toán <strong>${paymentMethod.toUpperCase()}</strong> (Mã đơn: <code>${orderCode}</code> - Số tiền: <strong>${amountFormatted}</strong>).`
                : `Chúc mừng bạn đã đăng ký tài khoản học tập trên <strong>BookMind AI</strong> thành công! Hệ thống đã tự động cấp phát và gắn API Key nội bộ vào tài khoản của bạn mà không cần phải nhập tay.`
            }
          </p>

          <div style="margin: 24px 0; padding: 20px; border-radius: 12px; background-color: #0f172a; border: 1px solid #10b981; text-align: center;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #34d399; margin-bottom: 8px; font-weight: 700;">
              TRẠNG THÁI TÀI KHOẢN: ĐÃ KÍCH HOẠT TỰ ĐỘNG
            </div>
            <div style="font-size: 18px; font-weight: 800; color: #ffffff;">
              ${planName}
            </div>
            <div style="margin-top: 8px; font-size: 13px; color: #fbbf24;">
              Hạn mức: <strong>${quotaDisplay}</strong>
            </div>
          </div>
        </div>
      </div>
    `;

    const activeResendKey =
      (resendApiKey && resendApiKey.trim()) ||
      process.env.RESEND_API_KEY ||
      "";

    let sentViaProvider = false;

    if (activeResendKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeResendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from:
              process.env.RESEND_FROM_EMAIL ||
              "BookMind AI <onboarding@resend.dev>",
            to: [toEmail],
            subject:
              subject ||
              `[BookMind AI] Xác nhận đăng ký tài khoản thành công (${planName})`,
            html: htmlContent,
          }),
        });
        if (resendRes.ok) {
          sentViaProvider = true;
        }
      } catch {
        // Fallback sang thông báo nội bộ
      }
    }

    return NextResponse.json({
      success: true,
      sentViaProvider,
      toEmail,
      apiKey,
      plan,
      maxCalls,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Lỗi khi gửi thông báo đăng ký.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
