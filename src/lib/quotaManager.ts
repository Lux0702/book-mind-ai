import {
  PlanTier,
  UserRole,
  UserQuotaAccount,
  VirtualEmailItem,
  PaymentTransaction,
  AiUsageLogItem,
} from "@/types/course";
import {
  AppUser,
  getAppSettings,
  saveAppSettings,
  getCurrentUser,
  getSupabaseClient,
  getSessionAuthHeaders,
  triggerSessionExpiredLogout,
} from "./storage";

const QUOTA_STORAGE_KEY = "book_agent_user_quotas_v1";
const EMAIL_INBOX_STORAGE_KEY = "book_agent_virtual_emails_v1";
const TRANSACTIONS_STORAGE_KEY = "book_agent_payment_tx_v1";
const AI_USAGE_LOGS_STORAGE_KEY = "book_agent_ai_usage_logs_v1";

export const VIP_FUP_DAILY_CREDITS = 500; // Fair Usage Policy cho gói VIP Unlimited (500 Credits/ngày)
export const MAX_REQUESTS_PER_MINUTE = 10; // Rate limit chống spam
export const MAX_CONCURRENT_REQUESTS = 2; // Tối đa 2 request xử lý đồng thời / tài khoản

export interface AiTaskCreditConfig {
  endpoint: string;
  taskLabel: string;
  credits: number;
  costTier: "Thấp" | "Trung bình" | "Cao";
  description: string;
}

export const AI_TASK_CREDITS: Record<string, AiTaskCreditConfig> = {
  "/api/agent/lookup-word": {
    endpoint: "/api/agent/lookup-word",
    taskLabel: "Tra từ điển 1 chạm",
    credits: 1,
    costTier: "Thấp",
    description: "Tra nghĩa, phiên âm IPA/Pinyin và ngữ cảnh từ vựng",
  },
  "/api/agent/ask-tutor": {
    endpoint: "/api/agent/ask-tutor",
    taskLabel: "Phân tích ngữ pháp & Hỏi Gia sư AI",
    credits: 2,
    costTier: "Thấp",
    description: "Giải đáp ngữ pháp, cấu trúc câu và ngữ cảnh chương sách",
  },
  "/api/agent/extract-vocabulary": {
    endpoint: "/api/agent/extract-vocabulary",
    taskLabel: "Tạo Flashcard & Trích xuất từ vựng",
    credits: 2,
    costTier: "Trung bình",
    description: "Quét chương sách và tạo bộ thẻ nhớ SRS tự động",
  },
  "/api/agent/extract-vocab": {
    endpoint: "/api/agent/extract-vocab",
    taskLabel: "Tạo Flashcard & Trích xuất từ vựng",
    credits: 2,
    costTier: "Trung bình",
    description: "Quét chương sách và tạo bộ thẻ nhớ SRS tự động",
  },
  "/api/agent/detect-toc": {
    endpoint: "/api/agent/detect-toc",
    taskLabel: "Quét Mục lục Sách tự động bằng AI",
    credits: 2,
    costTier: "Trung bình",
    description: "Phân tích và chia chương giáo trình tự động",
  },
  "/api/agent/generate-exam": {
    endpoint: "/api/agent/generate-exam",
    taskLabel: "Tạo bộ đề thi kiểm tra chương",
    credits: 3,
    costTier: "Trung bình",
    description: "Sinh câu hỏi trắc nghiệm, điền từ và tự luận theo chương",
  },
  "/api/agent/evaluate-translation": {
    endpoint: "/api/agent/evaluate-translation",
    taskLabel: "Chấm điểm dịch thuật AI",
    credits: 3,
    costTier: "Trung bình",
    description: "Chấm % độ chính xác bản dịch, sửa lỗi ngữ pháp & từ vựng",
  },
  "/api/agent/analyze-chapter": {
    endpoint: "/api/agent/analyze-chapter",
    taskLabel: "Phân tích & Soạn bài giảng chương sách",
    credits: 5,
    costTier: "Cao",
    description: "Tổng hợp tóm tắt, từ vựng cốt lõi, ngữ pháp và bài tập dịch",
  },
  "/api/agent/chapter-lesson": {
    endpoint: "/api/agent/chapter-lesson",
    taskLabel: "Phân tích & Soạn bài giảng chương sách",
    credits: 5,
    costTier: "Cao",
    description: "Tổng hợp tóm tắt, từ vựng cốt lõi, ngữ pháp và bài tập dịch",
  },
  "/api/agent/evaluate-pronunciation": {
    endpoint: "/api/agent/evaluate-pronunciation",
    taskLabel: "Chấm phát âm AI bằng Audio",
    credits: 5,
    costTier: "Cao",
    description: "Phân tích sóng âm giọng nói thực tế (Multimodal Audio) + STT",
  },
};

export function getEndpointCreditInfo(endpoint: string): AiTaskCreditConfig {
  return (
    AI_TASK_CREDITS[endpoint] || {
      endpoint,
      taskLabel: "Tác vụ AI tổng hợp",
      credits: 2,
      costTier: "Trung bình",
      description: "Xử lý ngôn ngữ tự nhiên với Gemini AI",
    }
  );
}

export interface PlanInfo {
  id: PlanTier;
  name: string;
  shortBadge: string;
  maxCalls: number; // Số AI Credit / ngày (-1 = Unlimited có FUP 500 Credit/ngày)
  fupDailyLimit: number;
  priceVnd: number;
  priceFormatted: string;
  keyPrefix: "BM-FREE" | "BM-PRO" | "BM-VIP";
  description: string;
  features: string[];
}

export const PLAN_CONFIG: Record<PlanTier, PlanInfo> = {
  free: {
    id: "free",
    name: "Gói Free (30 AI Credits/ngày)",
    shortBadge: "Free",
    maxCalls: 30,
    fupDailyLimit: 30,
    priceVnd: 0,
    priceFormatted: "0đ",
    keyPrefix: "BM-FREE",
    description:
      "Tự động kích hoạt khi đăng ký, cấp 30 AI Credits mỗi ngày (tự động reset về 0 lúc 00:00) & hoàn Credit 100% nếu request lỗi.",
    features: [
      "30 AI Credits miễn phí mỗi ngày (Tự động reset 00:00)",
      "Tra từ điển (1 Credit), Ngữ pháp/Flashcard (2 Credits)",
      "Tạo đề thi/Chấm dịch (3 Credits), Soạn chương/Chấm âm (5 Credits)",
      "Hoàn trả 100% Credit tự động nếu kết nối hoặc AI gặp lỗi",
      "Ôn tập Flashcards SRS SM-2 không tốn Credit",
    ],
  },
  pro: {
    id: "pro",
    name: "Gói BookMind Pro (120 AI Credits/ngày)",
    shortBadge: "Pro",
    maxCalls: 120,
    fupDailyLimit: 120,
    priceVnd: 49000,
    priceFormatted: "49.000đ",
    keyPrefix: "BM-PRO",
    description:
      "Gói tiêu chuẩn với 120 AI Credits/ngày giúp học chuyên sâu nhiều chương sách, luyện dịch và chấm phát âm thoải mái.",
    features: [
      "120 AI Credits tốc độ cao mỗi ngày (Tự động reset 00:00)",
      "Tương đương 24 lần soạn chương/chấm âm hoặc 120 lần tra từ/ngày",
      "Cơ chế Retry tự động & Hoàn 100% Credit khi request thất bại",
      "AI chấm phát âm Multimodal Audio & sửa lỗi khẩu hình",
      "Hỏi đáp Gia sư AI trực tiếp trên từng trang sách",
    ],
  },
  unlimited: {
    id: "unlimited",
    name: "Gói BookMind VIP (Unlimited • FUP)",
    shortBadge: "VIP",
    maxCalls: -1,
    fupDailyLimit: VIP_FUP_DAILY_CREDITS,
    priceVnd: 149000,
    priceFormatted: "149.000đ",
    keyPrefix: "BM-VIP",
    description:
      "Trải nghiệm học tập không giới hạn kèm Chính sách Sử dụng Hợp lý (Fair Usage Policy: 500 AI Credits/ngày).",
    features: [
      "Không giới hạn tính năng học tập (Fair Usage Policy: 500 Credits/ngày)",
      "Bảo vệ tốc độ ổn định: Tối đa 2 tác vụ đồng thời, 10 req/phút",
      "Hoàn trả 100% Credit tự động nếu xảy ra lỗi hệ thống",
      "Mở khóa mô hình Gemini 2.5 Pro & Multimodal Audio",
      "Ưu tiên băng thông xử lý & đồng bộ đa thiết bị",
    ],
  },
};

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Tính mã băm chữ ký 4 ký tự cho thân API Key để xác thực tính hợp lệ
 */
export function computeKeySignature(prefix: string, bodyCode: string): string {
  const raw = `BOOKMIND_AI_SECRET_2026:${prefix}:${bodyCode}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(36).toUpperCase().padStart(4, "0").slice(0, 4);
}

/**
 * Tạo mã BookMind Virtual API Key nội bộ cho người dùng theo gói (VD: BM-FREE-8A4F2C-9E1B)
 */
export function generateVirtualApiKey(plan: PlanTier, seed = ""): string {
  const prefix = PLAN_CONFIG[plan].keyPrefix;
  const randomChars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let bodyCode = "";

  const seedHash = seed
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  for (let i = 0; i < 6; i++) {
    const idx =
      (Math.floor(Math.random() * randomChars.length) + seedHash + i * 7) %
      randomChars.length;
    bodyCode += randomChars[idx];
  }

  const signature = computeKeySignature(prefix, bodyCode);
  return `${prefix}-${bodyCode}-${signature}`;
}

/**
 * Kiểm tra định dạng và chữ ký của mã BookMind Virtual API Key
 */
export function verifyVirtualApiKey(keyInput: string): {
  valid: boolean;
  plan?: PlanTier;
  normalizedKey?: string;
} {
  if (!keyInput) return { valid: false };
  const cleaned = keyInput.trim().toUpperCase();
  const match = cleaned.match(/^BM-(FREE|PRO|VIP)-([A-Z0-9]{6})-([A-Z0-9]{4})$/);
  if (!match) {
    return { valid: false };
  }

  const [, tierCode, bodyCode, sig] = match;
  const prefix = `BM-${tierCode}`;
  const expectedSig = computeKeySignature(prefix, bodyCode);

  if (sig !== expectedSig) {
    return { valid: false };
  }

  const plan: PlanTier =
    tierCode === "VIP" ? "unlimited" : tierCode === "PRO" ? "pro" : "free";

  return {
    valid: true,
    plan,
    normalizedKey: cleaned,
  };
}

function getAllQuotaAccounts(): Record<string, UserQuotaAccount> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAllQuotaAccounts(map: Record<string, UserQuotaAccount>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUOTA_STORAGE_KEY, JSON.stringify(map));
}

/**
 * Kiểm tra nếu sang ngày mới (YYYY-MM-DD) thì tự động reset usedCalls = 0
 * và đảm bảo API Key luôn được kích hoạt tự động trong hồ sơ user
 */
function normalizeAndResetDailyAccount(
  account: UserQuotaAccount
): { account: UserQuotaAccount; changed: boolean } {
  const today = getTodayDateString();
  let changed = false;

  // Đảm bảo API key đã cấp được gắn tự động, user không cần phải tự nhập tay
  if (!account.issuedApiKey) {
    account.issuedApiKey = generateVirtualApiKey(
      account.plan || "free",
      account.email
    );
    changed = true;
  }
  if (!account.isKeyActivated || !account.activatedApiKey) {
    account.activatedApiKey = account.issuedApiKey;
    account.isKeyActivated = true;
    changed = true;
  }

  if (!account.role) {
    // Mặc định mọi tài khoản đều là "user". Quyền "admin" CHỈ được đồng bộ từ Supabase (không phụ thuộc tên email).
    account.role = "user";
    changed = true;
  }

  // Tự động nâng cấp hạn mức cũ (15 -> 30 Credits cho Free, 50 -> 120 Credits cho Pro)
  if (account.plan === "free" && account.maxCalls === 15) {
    account.maxCalls = PLAN_CONFIG.free.maxCalls;
    changed = true;
  } else if (account.plan === "pro" && account.maxCalls === 50) {
    account.maxCalls = PLAN_CONFIG.pro.maxCalls;
    changed = true;
  }
  if (!account.fupDailyLimit) {
    account.fupDailyLimit = PLAN_CONFIG[account.plan || "free"].fupDailyLimit;
    changed = true;
  }

  // Tự động reset số AI Credit mỗi khi sang ngày mới (cho cả Free, Pro và bộ đếm FUP của VIP)
  if (account.lastResetDate !== today) {
    account.usedCalls = 0;
    account.lastResetDate = today;
    changed = true;
  }

  if (typeof account.totalCalls !== "number") {
    account.totalCalls = account.usedCalls || 0;
    changed = true;
  }

  return { account, changed };
}

export function getUserQuotaAccount(
  user: AppUser | null
): UserQuotaAccount | null {
  if (!user || typeof window === "undefined") return null;
  const keyId = (user.email || user.id).toLowerCase();
  const all = getAllQuotaAccounts();
  const existing = all[keyId];

  if (existing) {
    const { account, changed } = normalizeAndResetDailyAccount(existing);
    if (changed) {
      all[keyId] = account;
      saveAllQuotaAccounts(all);
    }
    return account;
  }

  return null;
}

/**
 * Khởi tạo tài khoản hạn mức & tự động gắn API Key gián tiếp vào dữ liệu user khi đăng ký
 */
export async function ensureUserQuotaProvisioned(
  user: AppUser,
  options?: { isNewRegistration?: boolean }
): Promise<{ account: UserQuotaAccount; emailItem: VirtualEmailItem | null }> {
  const keyId = (user.email || user.id).toLowerCase();
  const all = getAllQuotaAccounts();
  const today = getTodayDateString();

  if (all[keyId] && !options?.isNewRegistration) {
    const { account, changed } = normalizeAndResetDailyAccount(all[keyId]);
    if (changed) {
      all[keyId] = account;
      saveAllQuotaAccounts(all);
    }
    return { account, emailItem: null };
  }

  const email = user.email || `${user.id}@bookmind.user`;
  const name =
    user.user_metadata?.full_name ||
    email.split("@")[0] ||
    "Học viên BookMind";

  const issuedKey = generateVirtualApiKey("free", email);
  const now = new Date().toISOString();

  const newAccount: UserQuotaAccount = {
    userId: user.id,
    email,
    name,
    plan: "free",
    issuedApiKey: issuedKey,
    activatedApiKey: issuedKey, // Tự động gắn vào dữ liệu user, không bắt nhập tay!
    isKeyActivated: true,
    usedCalls: 0,
    totalCalls: 0,
    maxCalls: PLAN_CONFIG.free.maxCalls, // 15 lượt / ngày
    lastResetDate: today,
    isLocked: false,
    createdAt: now,
    updatedAt: now,
  };

  all[keyId] = newAccount;
  saveAllQuotaAccounts(all);

  // Đồng bộ vào AppSettings
  const currentSettings = getAppSettings();
  saveAppSettings({ ...currentSettings, geminiApiKey: issuedKey });

  // Gửi thông báo xác nhận đăng ký thành công (không cần lộ API key bắt nhập)
  const emailItem = await sendAndStoreApiKeyEmail({
    toEmail: email,
    toName: name,
    plan: "free",
    apiKey: issuedKey,
    maxCalls: PLAN_CONFIG.free.maxCalls,
    paymentMethod: "register",
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }

  return { account: newAccount, emailItem };
}

/**
 * Giữ hàm tương thích nếu Admin hoặc user muốn đổi mã Key thủ công
 */
export function activateUserVirtualKey(
  user: AppUser,
  inputKey: string
): {
  success: boolean;
  message: string;
  account?: UserQuotaAccount;
} {
  const verification = verifyVirtualApiKey(inputKey);
  if (!verification.valid || !verification.normalizedKey || !verification.plan) {
    return {
      success: false,
      message: "Mã API Key không hợp lệ!",
    };
  }

  const keyId = (user.email || user.id).toLowerCase();
  const all = getAllQuotaAccounts();
  const targetPlan = verification.plan;
  const planInfo = PLAN_CONFIG[targetPlan];
  const today = getTodayDateString();

  const existing = all[keyId];
  const account: UserQuotaAccount = {
    userId: user.id,
    email: user.email || `${user.id}@bookmind.user`,
    name: user.user_metadata?.full_name || "Học viên BookMind",
    plan: targetPlan,
    issuedApiKey: verification.normalizedKey,
    activatedApiKey: verification.normalizedKey,
    isKeyActivated: true,
    usedCalls: 0,
    totalCalls: existing?.totalCalls || 0,
    maxCalls: planInfo.maxCalls,
    lastResetDate: today,
    isLocked: existing?.isLocked || false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  all[keyId] = account;
  saveAllQuotaAccounts(all);

  const settings = getAppSettings();
  saveAppSettings({
    ...settings,
    geminiApiKey: verification.normalizedKey,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }

  return {
    success: true,
    message: `Đã cập nhật sang ${planInfo.name}!`,
    account,
  };
}

/**
 * Nâng cấp gói (Pro 50 lượt/ngày hoặc Unlimited) sau khi thanh toán QR VNPay / MoMo ảo
 * Tự động gắn Key mới vào dữ liệu của user, không cần nhập tay!
 */
export async function upgradeUserPlanAfterPayment(params: {
  user: AppUser;
  targetPlan: "pro" | "unlimited";
  paymentMethod: "momo" | "vnpay";
  recipientEmail?: string;
  autoActivate?: boolean;
}): Promise<{
  account: UserQuotaAccount;
  newApiKey: string;
  emailItem: VirtualEmailItem;
  orderCode: string;
}> {
  const { user, targetPlan, paymentMethod, recipientEmail } = params;
  const keyId = (user.email || user.id).toLowerCase();
  const all = getAllQuotaAccounts();
  const planInfo = PLAN_CONFIG[targetPlan];
  const today = getTodayDateString();

  const targetEmail = recipientEmail?.trim() || user.email || "user@bookmind.ai";
  const userName =
    user.user_metadata?.full_name ||
    targetEmail.split("@")[0] ||
    "Học viên BookMind";

  const newApiKey = generateVirtualApiKey(
    targetPlan,
    `${targetEmail}-${Date.now()}`
  );
  const orderCode = `BM-${paymentMethod.toUpperCase()}-${Date.now()
    .toString()
    .slice(-6)}`;

  const existing = all[keyId];
  const updatedAccount: UserQuotaAccount = {
    userId: user.id,
    email: targetEmail,
    name: userName,
    plan: targetPlan,
    issuedApiKey: newApiKey,
    activatedApiKey: newApiKey, // Tự động gắn luôn vào tài khoản!
    isKeyActivated: true,
    usedCalls: 0, // Reset lượt dùng hôm nay về 0 cho gói mới
    totalCalls: existing?.totalCalls || 0,
    maxCalls: planInfo.maxCalls,
    lastResetDate: today,
    isLocked: false,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  all[keyId] = updatedAccount;
  saveAllQuotaAccounts(all);
  void upsertAccountToSupabaseCloud(updatedAccount);

  const settings = getAppSettings();
  saveAppSettings({
    ...settings,
    geminiApiKey: newApiKey,
  });

  // Lưu lịch sử giao dịch cho trang Admin
  recordPaymentTransaction({
    id: `tx-${Date.now()}`,
    orderCode,
    userEmail: targetEmail,
    userName,
    plan: targetPlan,
    amountVnd: planInfo.priceVnd,
    amountFormatted: planInfo.priceFormatted,
    paymentMethod,
    assignedApiKey: newApiKey,
    createdAt: new Date().toISOString(),
  });

  const emailItem = await sendAndStoreApiKeyEmail({
    toEmail: targetEmail,
    toName: userName,
    plan: targetPlan,
    apiKey: newApiKey,
    maxCalls: planInfo.maxCalls,
    paymentMethod,
    amountFormatted: planInfo.priceFormatted,
    orderCode,
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }

  return {
    account: updatedAccount,
    newApiKey,
    emailItem,
    orderCode,
  };
}

/**
 * Lưu và đọc lịch sử giao dịch thanh toán cho Admin
 */
function recordPaymentTransaction(tx: PaymentTransaction): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    const list: PaymentTransaction[] = raw ? JSON.parse(raw) : [];
    const updated = [tx, ...list].slice(0, 100);
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore
  }
}

export function getAllPaymentTransactions(): PaymentTransaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Quản lý Hộp thư Thông báo của người dùng
 */
export function getVirtualEmails(userEmail?: string): VirtualEmailItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EMAIL_INBOX_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as VirtualEmailItem[];
    if (!userEmail) return list;
    const norm = userEmail.toLowerCase();
    return list.filter((item) => item.toEmail.toLowerCase() === norm);
  } catch {
    return [];
  }
}

export function markEmailAsRead(emailId: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(EMAIL_INBOX_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw) as VirtualEmailItem[];
    const updated = list.map((item) =>
      item.id === emailId ? { ...item, isRead: true } : item
    );
    localStorage.setItem(EMAIL_INBOX_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("bookmind:email-updated"));
  } catch {
    // Ignore
  }
}

export async function sendAndStoreApiKeyEmail(params: {
  toEmail: string;
  toName: string;
  plan: PlanTier;
  apiKey: string;
  maxCalls: number;
  paymentMethod?: "register" | "momo" | "vnpay";
  amountFormatted?: string;
  orderCode?: string;
}): Promise<VirtualEmailItem> {
  const planInfo = PLAN_CONFIG[params.plan];
  const isUpgrade =
    params.paymentMethod === "momo" || params.paymentMethod === "vnpay";

  const subject = isUpgrade
    ? `[BookMind AI] Xác nhận nâng cấp thành công ${planInfo.name}`
    : `[BookMind AI] Chào mừng ${params.toName}! Tài khoản đã được kích hoạt (15 lượt AI/ngày)`;

  let realEmailSent = false;

  try {
    const settings = getAppSettings();
    const res = await fetch("/api/auth/send-key-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        subject,
        resendApiKey: settings.resendApiKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      realEmailSent = Boolean(data.sentViaProvider);
    }
  } catch {
    // Fallback an toàn vào thông báo hệ thống
  }

  const emailItem: VirtualEmailItem = {
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toEmail: params.toEmail,
    toName: params.toName,
    subject,
    plan: params.plan,
    apiKey: params.apiKey,
    maxCalls: params.maxCalls,
    createdAt: new Date().toISOString(),
    isRead: false,
    paymentMethod: params.paymentMethod || "register",
    amountFormatted: params.amountFormatted,
    orderCode: params.orderCode,
    realEmailSent,
  };

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(EMAIL_INBOX_STORAGE_KEY);
      const list: VirtualEmailItem[] = raw ? JSON.parse(raw) : [];
      const updated = [emailItem, ...list].slice(0, 30);
      localStorage.setItem(EMAIL_INBOX_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent("bookmind:new-email", { detail: emailItem })
      );
      window.dispatchEvent(new CustomEvent("bookmind:email-updated"));
    } catch {
      // Ignore storage error
    }
  }

  return emailItem;
}

export function getAllAiUsageLogs(): AiUsageLogItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AI_USAGE_LOGS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AiUsageLogItem[];
  } catch {
    return [];
  }
}

function appendAiUsageLog(item: AiUsageLogItem): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getAllAiUsageLogs();
    const updated = [item, ...existing].slice(0, 120);
    localStorage.setItem(AI_USAGE_LOGS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  } catch {
    // Ignore storage error
  }
}

// Bộ nhớ theo dõi Concurrency, Rate Limit và Idempotency trong phiên làm việc
const inFlightIdempotencyMap = new Map<string, Promise<Response>>();
const userRequestTimestamps = new Map<string, number[]>();
let activeConcurrencyCount = 0;

function computeIdempotencyKey(endpoint: string, payload: Record<string, unknown>): string {
  const raw = `${endpoint}:${JSON.stringify(payload).slice(0, 350)}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `IDEMP-${(hash >>> 0).toString(36).toUpperCase()}`;
}

/**
 * Hàm gọi AI tập trung (Resilient AI Credit Pipeline v2.0):
 * 1. Kiểm tra Auth, Khóa tài khoản & Chống bấm đúp (Idempotency Key + Concurrency Limit = 2)
 * 2. Kiểm tra Rate Limit (Tối đa 10 requests / phút / user)
 * 3. Kiểm tra số dư AI Credit theo trọng số tác vụ (1 - 5 Credits) & Chính sách Fair Usage Policy (VIP 500 Credits/ngày)
 * 4. Tạm giữ Credit (Pre-auth Hold) → Gọi AI kèm Timeout (35s) & Retry Exponential Backoff (tối đa 2 lần)
 * 5. Kiểm tra tính hợp lệ của JSON trả về
 * 6. Thành công → Trừ Credit & Ghi log; Thất bại → Tự động Hoàn trả 100% Credit (Auto-Refund) & Ghi log lỗi
 */
/**
 * Đồng bộ dữ liệu hạn mức từ bảng `public.user_quotas` trên Supabase Cloud
 * Chống việc học viên dùng F12 DevTools sửa `localStorage` để nâng gói hoặc xóa `usedCalls = 0`
 */
async function syncAccountFromSupabaseCloud(
  account: UserQuotaAccount
): Promise<UserQuotaAccount> {
  const supabase = getSupabaseClient();
  if (!supabase || !account.email) return account;

  try {
    const cleanEmail = account.email.trim().toLowerCase();
    const { data, error } = await supabase
      .from("user_quotas")
      .select("*")
      .ilike("email", cleanEmail)
      .maybeSingle();

    if (!error && data) {
      const today = getTodayDateString();
      const cloudData = (data.data || {}) as Partial<UserQuotaAccount>;
      const cloudResetDate = cloudData.lastResetDate || today;
      const cloudUsedCalls =
        cloudResetDate === today ? Number(data.used_calls ?? 0) : 0;

      // Bảo vệ chống gian lận: Lấy số lượt đã dùng cao nhất giữa Cloud và Local trong cùng ngày
      account.plan = (data.plan as PlanTier) || account.plan;
      account.maxCalls = Number(
        data.max_calls ?? PLAN_CONFIG[account.plan].maxCalls
      );
      account.usedCalls = Math.max(account.usedCalls || 0, cloudUsedCalls);
      account.isLocked = Boolean(cloudData.isLocked ?? account.isLocked);
      account.role =
        String(data.role || cloudData.role || "user").toLowerCase() === "admin"
          ? "admin"
          : "user";

      const all = getAllQuotaAccounts();
      all[cleanEmail] = account;
      saveAllQuotaAccounts(all);
    }
  } catch {
    // Bỏ qua nếu offline hoặc bảng chưa khởi tạo
  }

  return account;
}

async function upsertAccountToSupabaseCloud(
  account: UserQuotaAccount
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase || !account.email) return;

  try {
    const cleanEmail = account.email.trim().toLowerCase();
    await supabase.from("user_quotas").upsert(
      {
        email: cleanEmail,
        role: account.role || "user",
        plan: account.plan,
        issued_api_key: account.issuedApiKey,
        used_calls: account.usedCalls,
        max_calls: account.maxCalls,
        data: account,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
  } catch {
    // Bỏ qua lỗi mạng
  }
}

export async function fetchAiAgent(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<Response> {
  const user = await getCurrentUser();
  const settings = getAppSettings();
  const taskInfo = getEndpointCreditInfo(endpoint);
  const requiredCredits = taskInfo.credits;

  if (!user) {
    await triggerSessionExpiredLogout(
      "Phiên đăng nhập của bạn đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại!"
    );
    return new Response(
      JSON.stringify({
        error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để sử dụng AI!",
        code: "SESSION_EXPIRED",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let account = getUserQuotaAccount(user);
  if (!account) {
    const provisioned = await ensureUserQuotaProvisioned(user);
    account = provisioned.account;
  }

  // Đồng bộ hạn mức trực tiếp từ Supabase Cloud để chống sửa dữ liệu ở DevTools localStorage
  account = await syncAccountFromSupabaseCloud(account);

  // 1. Kiểm tra xem tài khoản có bị Admin khóa không
  if (account.isLocked) {
    return new Response(
      JSON.stringify({
        error:
          "Tài khoản của bạn hiện đang bị tạm khóa quyền gọi AI bởi Quản trị viên (Admin). Vui lòng liên hệ Admin để mở khóa.",
        code: "ACCOUNT_LOCKED",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2. Chống bấm đúp liên tiếp (Idempotency Key Deduplication)
  const idempotencyKey = computeIdempotencyKey(endpoint, payload);
  const existingInFlight = inFlightIdempotencyMap.get(idempotencyKey);
  if (existingInFlight) {
    const cloned = await existingInFlight;
    return cloned.clone();
  }

  // 3. Kiểm tra giới hạn xử lý đồng thời (Max Concurrency = 2)
  if (activeConcurrencyCount >= MAX_CONCURRENT_REQUESTS) {
    return new Response(
      JSON.stringify({
        error: `Hệ thống đang xử lý ${activeConcurrencyCount} tác vụ AI đồng thời cho tài khoản của bạn. Vui lòng chờ vài giây để tác vụ trước hoàn tất (Không bị trừ AI Credit).`,
        code: "CONCURRENCY_LIMIT",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 4. Kiểm tra Rate Limit theo phút (Chống spam/abuse: tối đa 10 requests/phút)
  const userKey = (user.email || user.id).toLowerCase();
  const nowMs = Date.now();
  const recentStamps = (userRequestTimestamps.get(userKey) || []).filter(
    (t) => nowMs - t < 60_000
  );
  if (recentStamps.length >= MAX_REQUESTS_PER_MINUTE) {
    appendAiUsageLog({
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      idempotencyKey,
      userEmail: account.email,
      endpoint,
      taskLabel: taskInfo.taskLabel,
      creditsCharged: 0,
      status: "rate_limited",
      refunded: false,
      retryCount: 0,
      latencyMs: 0,
      errorMessage: "Vượt giới hạn tốc độ 10 requests/phút",
      createdAt: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({
        error: `Bạn đang thao tác quá nhanh (vượt quá ${MAX_REQUESTS_PER_MINUTE} yêu cầu/phút). Vui lòng đợi khoảng 15–30 giây rồi thử lại (Không bị trừ AI Credit).`,
        code: "RATE_LIMITED",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }
  recentStamps.push(nowMs);
  userRequestTimestamps.set(userKey, recentStamps);

  // 5. Kiểm tra số dư AI Credit hôm nay (Bao gồm Fair Usage Policy 500 Credits/ngày cho gói VIP)
  const isVip = account.plan === "unlimited" || account.maxCalls === -1;
  const effectiveDailyMax = isVip
    ? account.fupDailyLimit || VIP_FUP_DAILY_CREDITS
    : account.maxCalls;

  if (account.usedCalls + requiredCredits > effectiveDailyMax) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bookmind:quota-exceeded", {
          detail: { account, requiredCredits, taskLabel: taskInfo.taskLabel },
        })
      );
    }
    const planLabel = PLAN_CONFIG[account.plan].name;
    const remain = Math.max(0, effectiveDailyMax - account.usedCalls);
    return new Response(
      JSON.stringify({
        error: isVip
          ? `Bạn đã chạm ngưỡng Chính sách Sử dụng Hợp lý (Fair Usage Policy: ${effectiveDailyMax} AI Credits/ngày) của gói VIP. Hạn mức sẽ tự động reset về 0 vào lúc 00:00 ngày mai!`
          : `Tác vụ "${taskInfo.taskLabel}" cần ${requiredCredits} AI Credits, nhưng bạn chỉ còn ${remain}/${effectiveDailyMax} Credits hôm nay (${planLabel}). Hãy nâng cấp lên gói Pro (120 Credits/ngày) hoặc VIP ngay!`,
        code: "QUOTA_EXCEEDED",
        requiredCredits,
        remainingCredits: remain,
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  // 6. Thực thi gọi AI kèm Timeout (35s) + Retry Exponential Backoff (tối đa 2 lần) + Auto-Refund nếu lỗi
  const executeWithRetry = async (): Promise<Response> => {
    activeConcurrencyCount++;
    const startTime = Date.now();
    let attempt = 0;
    const maxRetries = 2;
    let lastErrorText = "Lỗi kết nối hoặc xử lý AI";

    try {
      while (attempt <= maxRetries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 35_000);

        try {
          const authHeaders = await getSessionAuthHeaders();
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Idempotency-Key": idempotencyKey,
              ...authHeaders,
            },
            body: JSON.stringify({
              ...payload,
              apiKey: account.issuedApiKey,
              masterApiKey: settings.masterGeminiApiKey || "",
              model: payload.model || settings.geminiModel,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          // Đọc và kiểm tra cấu trúc JSON trả về
          const rawText = await res.text();
          let parsedJson: Record<string, unknown> | null = null;
          try {
            parsedJson = rawText ? JSON.parse(rawText) : null;
          } catch {
            parsedJson = null;
          }

          // Nếu hết hạn phiên đăng nhập (HTTP 401 / SESSION_EXPIRED) -> Tự động Logout ngay lập tức và yêu cầu đăng nhập lại
          if (res.status === 401 || parsedJson?.code === "SESSION_EXPIRED") {
            const expiredMsg =
              typeof parsedJson?.error === "string"
                ? parsedJson.error
                : "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục!";
            await triggerSessionExpiredLogout(expiredMsg);
            return new Response(
              JSON.stringify({
                error: expiredMsg,
                code: "SESSION_EXPIRED",
              }),
              { status: 401, headers: { "Content-Type": "application/json" } }
            );
          }

          if (res.ok && parsedJson && !parsedJson.error) {
            // THÀNH CÔNG: Trừ đúng số AI Credit của tác vụ, đồng bộ lên Supabase Cloud và lưu vào ai_usage_logs
            const all = getAllQuotaAccounts();
            const latest = all[userKey] || account;
            latest.usedCalls = (latest.usedCalls || 0) + requiredCredits;
            latest.totalCalls = (latest.totalCalls || 0) + requiredCredits;
            latest.lastResetDate = getTodayDateString();
            latest.updatedAt = new Date().toISOString();
            all[userKey] = latest;
            saveAllQuotaAccounts(all);

            void upsertAccountToSupabaseCloud(latest);

            appendAiUsageLog({
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              idempotencyKey,
              userEmail: account.email,
              endpoint,
              taskLabel: taskInfo.taskLabel,
              creditsCharged: requiredCredits,
              status: "success",
              refunded: false,
              retryCount: attempt,
              latencyMs: Date.now() - startTime,
              createdAt: new Date().toISOString(),
            });

            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
            }

            return new Response(rawText, {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          // Nếu lỗi 400 (input không hợp lệ từ phía người dùng) thì không cần retry nhưng vẫn hoàn trả Credit
          lastErrorText =
            (parsedJson && typeof parsedJson.error === "string"
              ? parsedJson.error
              : `Lỗi phản hồi từ AI (HTTP ${res.status})`) || "Lỗi xử lý AI";

          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            break;
          }
        } catch (err: unknown) {
          clearTimeout(timeoutId);
          if (err instanceof Error && err.name === "AbortError") {
            lastErrorText = "Yêu cầu xử lý AI vượt quá thời gian chờ (Timeout 35s)";
          } else {
            lastErrorText =
              err instanceof Error ? err.message : "Mất kết nối mạng khi gọi AI";
          }
        }

        attempt++;
        if (attempt <= maxRetries) {
          // Exponential Backoff: 800ms -> 1600ms
          await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt - 1)));
        }
      }

      // THẤT BẠI SAU KHI ĐÃ RETRY: HOÀN TRẢ 100% CREDIT (Không trừ bất kỳ Credit nào của user)
      appendAiUsageLog({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        idempotencyKey,
        userEmail: account.email,
        endpoint,
        taskLabel: taskInfo.taskLabel,
        creditsCharged: requiredCredits,
        status: "failed_refunded",
        refunded: true,
        retryCount: Math.min(attempt, maxRetries),
        latencyMs: Date.now() - startTime,
        errorMessage: lastErrorText,
        createdAt: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          error: `${lastErrorText} • [Bảo vệ tài khoản: Hệ thống đã tự động hoàn trả 100% (${requiredCredits} AI Credits) cho bạn]`,
          refundedCredits: requiredCredits,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    } finally {
      activeConcurrencyCount = Math.max(0, activeConcurrencyCount - 1);
      inFlightIdempotencyMap.delete(idempotencyKey);
    }
  };

  const promise = executeWithRetry();
  inFlightIdempotencyMap.set(idempotencyKey, promise);
  return promise;
}

// ============================================================================
// CÁC HÀM QUẢN TRỊ DÀNH RIÊNG CHO TRANG ADMIN (/admin)
// ============================================================================

export function getAllUsersForAdmin(): UserQuotaAccount[] {
  if (typeof window === "undefined") return [];
  const all = getAllQuotaAccounts();
  let changedAny = false;

  const list = Object.keys(all).map((key) => {
    const { account, changed } = normalizeAndResetDailyAccount(all[key]);
    if (changed) {
      all[key] = account;
      changedAny = true;
    }
    return account;
  });

  if (changedAny) {
    saveAllQuotaAccounts(all);
  }

  return list.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function adminUpdateUserAccount(
  emailKey: string,
  updates: {
    name?: string;
    plan?: PlanTier;
    maxCalls?: number;
    usedCalls?: number;
    isLocked?: boolean;
    regenerateKey?: boolean;
  }
): UserQuotaAccount | null {
  const normKey = emailKey.toLowerCase();
  const all = getAllQuotaAccounts();
  const target =
    all[normKey] ||
    Object.values(all).find(
      (u) => u.email.toLowerCase() === normKey || u.userId === emailKey
    );

  if (!target) return null;

  const storageKey =
    Object.keys(all).find(
      (k) =>
        k === normKey ||
        all[k].email.toLowerCase() === normKey ||
        all[k].userId === emailKey
    ) || normKey;

  if (updates.name !== undefined) {
    target.name = updates.name;
  }

  if (updates.plan !== undefined && updates.plan !== target.plan) {
    target.plan = updates.plan;
    target.maxCalls = PLAN_CONFIG[updates.plan].maxCalls;
    const newKey = generateVirtualApiKey(
      updates.plan,
      `${target.email}-${Date.now()}`
    );
    target.issuedApiKey = newKey;
    target.activatedApiKey = newKey;
  }

  if (updates.maxCalls !== undefined) {
    target.maxCalls = updates.maxCalls;
  }

  if (updates.usedCalls !== undefined) {
    target.usedCalls = Math.max(0, updates.usedCalls);
  }

  if (updates.isLocked !== undefined) {
    target.isLocked = updates.isLocked;
  }

  if (updates.regenerateKey) {
    const regenerated = generateVirtualApiKey(
      target.plan,
      `${target.email}-${Date.now()}`
    );
    target.issuedApiKey = regenerated;
    target.activatedApiKey = regenerated;
  }

  target.updatedAt = new Date().toISOString();
  all[storageKey] = target;
  saveAllQuotaAccounts(all);
  void upsertAccountToSupabaseCloud(target);

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }

  return target;
}

export function adminResetAllDailyQuotas(): number {
  const all = getAllQuotaAccounts();
  const today = getTodayDateString();
  let count = 0;
  for (const k of Object.keys(all)) {
    all[k].usedCalls = 0;
    all[k].lastResetDate = today;
    all[k].updatedAt = new Date().toISOString();
    count++;
  }
  saveAllQuotaAccounts(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }
  return count;
}

export function adminCreateUserAccount(params: {
  name: string;
  email: string;
  plan: PlanTier;
  customMaxCalls?: number;
}): UserQuotaAccount {
  const cleanEmail = params.email.trim().toLowerCase();
  const all = getAllQuotaAccounts();
  const issuedKey = generateVirtualApiKey(params.plan, cleanEmail);
  const now = new Date().toISOString();
  const defaultMax = PLAN_CONFIG[params.plan].maxCalls;

  const newAcc: UserQuotaAccount = {
    userId: `user-${Date.now()}`,
    email: cleanEmail,
    name: params.name.trim() || cleanEmail.split("@")[0],
    role: "user", // Quyền Admin CHỈ có thể thêm từ Supabase, không thể tạo tài khoản Admin từ client
    plan: params.plan,
    issuedApiKey: issuedKey,
    activatedApiKey: issuedKey,
    isKeyActivated: true,
    usedCalls: 0,
    totalCalls: 0,
    maxCalls:
      params.customMaxCalls !== undefined ? params.customMaxCalls : defaultMax,
    fupDailyLimit: PLAN_CONFIG[params.plan].fupDailyLimit,
    lastResetDate: getTodayDateString(),
    isLocked: false,
    createdAt: now,
    updatedAt: now,
  };

  all[cleanEmail] = newAcc;
  saveAllQuotaAccounts(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }
  return newAcc;
}

/**
 * Xác thực quyền Admin (`role === "admin"`) NGHIÊM NGẶT và DUY NHẤT từ Supabase:
 * - Kiểm tra `auth.users` (`app_metadata.role === "admin"` hoặc `user_metadata.role === "admin"`)
 * - Hoặc kiểm tra bảng `public.user_quotas` trên Supabase (`role = 'admin'` hoặc `data->>'role' = 'admin'`)
 * - Tên email (VD: admin@...) hay dữ liệu cục bộ hoàn toàn KHÔNG liên quan và không thể tự cấp quyền Admin.
 */
export interface AdminRoleVerificationResult {
  isAdmin: boolean;
  supabaseConnected: boolean;
  source: "supabase_auth_metadata" | "supabase_user_quotas_table" | "none";
  reason: string;
}

const ADMIN_ROLE_CACHE_TTL_MS = 30_000;
let cachedAdminVerification: {
  userKey: string;
  fetchedAt: number;
  result: AdminRoleVerificationResult;
} | null = null;
let inFlightAdminVerification: Promise<AdminRoleVerificationResult> | null =
  null;

export async function syncAndVerifyAdminRoleFromSupabase(
  user: AppUser | null,
  forceRefresh = false
): Promise<AdminRoleVerificationResult> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    if (user) {
      setLocalAccountRoleFromSupabase(user, "user");
    }
    return {
      isAdmin: false,
      supabaseConnected: false,
      source: "none",
      reason:
        "Chưa cấu hình kết nối Supabase (Project URL & Anon Key). Quyền Admin chỉ được xác thực trực tiếp từ Supabase.",
    };
  }

  if (!user) {
    return {
      isAdmin: false,
      supabaseConnected: true,
      source: "none",
      reason:
        "Bạn chưa đăng nhập tài khoản. Hãy đăng nhập tài khoản đã được cấp quyền Admin trên Supabase.",
    };
  }

  const userKey = (user.email || user.id).toLowerCase();
  if (
    !forceRefresh &&
    cachedAdminVerification &&
    cachedAdminVerification.userKey === userKey &&
    Date.now() - cachedAdminVerification.fetchedAt < ADMIN_ROLE_CACHE_TTL_MS
  ) {
    return cachedAdminVerification.result;
  }

  if (!forceRefresh && inFlightAdminVerification) {
    return inFlightAdminVerification;
  }

  const verifyPromise = (async (): Promise<AdminRoleVerificationResult> => {
    try {
      // 1. Kiểm tra trực tiếp từ metadata của user đã xác thực qua getCurrentUser() (không gọi lặp lại /auth/v1/user)
      const activeUser = forceRefresh ? await getCurrentUser(true) : user;
      const targetUser = activeUser || user;

      const appRole = String(targetUser.app_metadata?.role || "").toLowerCase();
      const userRole = String(targetUser.user_metadata?.role || "").toLowerCase();
      if (appRole === "admin" || userRole === "admin") {
        setLocalAccountRoleFromSupabase(targetUser, "admin");
        const res: AdminRoleVerificationResult = {
          isAdmin: true,
          supabaseConnected: true,
          source: "supabase_auth_metadata",
          reason:
            "Xác thực thành công từ Supabase Auth (auth.users metadata role = 'admin').",
        };
        cachedAdminVerification = {
          userKey,
          fetchedAt: Date.now(),
          result: res,
        };
        return res;
      }

      // 2. Kiểm tra từ bảng public.user_quotas trên Supabase Database
      const emailToQuery = (targetUser.email || "").trim().toLowerCase();
      if (emailToQuery) {
        const { data: rowData, error: rowErr } = await supabase
          .from("user_quotas")
          .select("*")
          .ilike("email", emailToQuery)
          .maybeSingle();

        if (!rowErr && rowData) {
          const dbRole = String(
            rowData.role || rowData.data?.role || "user"
          ).toLowerCase();
          if (dbRole === "admin") {
            setLocalAccountRoleFromSupabase(targetUser, "admin");
            const res: AdminRoleVerificationResult = {
              isAdmin: true,
              supabaseConnected: true,
              source: "supabase_user_quotas_table",
              reason:
                "Xác thực thành công từ bảng public.user_quotas trên Supabase (role = 'admin').",
            };
            cachedAdminVerification = {
              userKey,
              fetchedAt: Date.now(),
              result: res,
            };
            return res;
          }
        }
      }

      // Nếu cả 2 nơi trên Supabase đều không phải 'admin' -> hạ về 'user'
      setLocalAccountRoleFromSupabase(targetUser, "user");
      const failRes: AdminRoleVerificationResult = {
        isAdmin: false,
        supabaseConnected: true,
        source: "none",
        reason: `Tài khoản "${emailToQuery || targetUser.id}" chưa có role = 'admin' trong Supabase (auth.users hoặc public.user_quotas).`,
      };
      cachedAdminVerification = {
        userKey,
        fetchedAt: Date.now(),
        result: failRes,
      };
      return failRes;
    } catch {
      setLocalAccountRoleFromSupabase(user, "user");
      return {
        isAdmin: false,
        supabaseConnected: true,
        source: "none",
        reason: "Không thể truy vấn xác thực quyền Admin từ Supabase.",
      };
    }
  })();

  inFlightAdminVerification = verifyPromise;
  try {
    return await verifyPromise;
  } finally {
    inFlightAdminVerification = null;
  }
}

function setLocalAccountRoleFromSupabase(user: AppUser, verifiedRole: UserRole): void {
  if (typeof window === "undefined") return;
  const keyId = (user.email || user.id).toLowerCase();
  const all = getAllQuotaAccounts();
  if (all[keyId] && all[keyId].role !== verifiedRole) {
    all[keyId].role = verifiedRole;
    all[keyId].updatedAt = new Date().toISOString();
    saveAllQuotaAccounts(all);
  }
}

export function adminDeleteUserAccount(emailKey: string): boolean {
  const normKey = emailKey.toLowerCase();
  const all = getAllQuotaAccounts();
  const foundKey = Object.keys(all).find(
    (k) =>
      k === normKey ||
      all[k].email.toLowerCase() === normKey ||
      all[k].userId === emailKey
  );
  if (!foundKey) return false;
  delete all[foundKey];
  saveAllQuotaAccounts(all);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bookmind:quota-updated"));
  }
  return true;
}
