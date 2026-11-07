"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Key,
  Zap,
  Crown,
  Infinity as InfinityIcon,
  Search,
  RefreshCw,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Copy,
  Check,
  ArrowLeft,
  Receipt,
  Sparkles,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Cloud,
} from "lucide-react";
import {
  PlanTier,
  UserQuotaAccount,
  PaymentTransaction,
  AppSettings,
  AiUsageLogItem,
} from "@/types/course";
import {
  PLAN_CONFIG,
  VIP_FUP_DAILY_CREDITS,
  getAllUsersForAdmin,
  adminUpdateUserAccount,
  adminResetAllDailyQuotas,
  adminCreateUserAccount,
  adminDeleteUserAccount,
  getAllPaymentTransactions,
  getAllAiUsageLogs,
  getTodayDateString,
  syncAndVerifyAdminRoleFromSupabase,
} from "@/lib/quotaManager";
import {
  getAppSettings,
  saveAppSettings,
  DEFAULT_SETTINGS,
  getCurrentUser,
  AppUser,
} from "@/lib/storage";
import CustomSelect from "@/components/ui/CustomSelect";

const SUPABASE_ADMIN_SQL_SCHEMA = `-- 1. Tạo đầy đủ các bảng đồng bộ Cloud & Phân quyền trên Supabase:
CREATE TABLE IF NOT EXISTS public.courses (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  title TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flashcards (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  course_id TEXT NOT NULL,
  data JSONB NOT NULL,
  next_review_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE TABLE IF NOT EXISTS public.user_quotas (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user', -- Chỉ nhận 'user' hoặc 'admin' (chỉ cấp từ Supabase)
  plan TEXT NOT NULL DEFAULT 'free',
  issued_api_key TEXT NOT NULL DEFAULT 'BM-FREE-INIT00-0000',
  used_calls INTEGER DEFAULT 0,
  max_calls INTEGER DEFAULT 30,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access courses" ON public.courses;
CREATE POLICY "Allow public access courses" ON public.courses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access flashcards" ON public.flashcards;
CREATE POLICY "Allow public access flashcards" ON public.flashcards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public access user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Select user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Client sync user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Update own usage user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Admin full control user_quotas" ON public.user_quotas;

-- 1. Cho phép đọc hạn mức để kiểm tra và đồng bộ:
CREATE POLICY "Select user_quotas"
ON public.user_quotas FOR SELECT USING (true);

-- 2. Học viên chỉ được tự đồng bộ dòng của mình với role bắt buộc là 'user' (Chặn tự nâng quyền thành 'admin' qua API):
CREATE POLICY "Client sync user_quotas"
ON public.user_quotas FOR INSERT
WITH CHECK (role = 'user');

CREATE POLICY "Update own usage user_quotas"
ON public.user_quotas FOR UPDATE
USING (role = 'user')
WITH CHECK (role = 'user');

-- 3. CHỈ Admin được xác thực từ auth.users (JWT app_metadata.role = 'admin') mới có toàn quyền sửa role/plan:
CREATE POLICY "Admin full control user_quotas"
ON public.user_quotas FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- =================================================================================
-- 2. TẠO KHO LƯU TRỮ STORAGE (KHO A: book-chapters) ĐỂ LƯU CHƯƠNG & TỰ ĐỘNG DỌN KHI TẠO XONG 100%:
-- =================================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-chapters', 'book-chapters', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow public access book-chapters" ON storage.objects;
CREATE POLICY "Allow public access book-chapters"
ON storage.objects FOR ALL
USING (bucket_id = 'book-chapters')
WITH CHECK (bucket_id = 'book-chapters');

-- =================================================================================
-- 3. CẤP QUYỀN ADMIN TRỰC TIẾP TRÊN SUPABASE (Thay email của bạn vào bên dưới):
-- =================================================================================
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'email_cua_ban@domain.com';

INSERT INTO public.user_quotas (email, role, plan, issued_api_key, used_calls, max_calls, data)
VALUES ('email_cua_ban@domain.com', 'admin', 'unlimited', 'BM-VIP-ADMIN', 0, -1, '{"role": "admin"}'::jsonb)
ON CONFLICT (email) DO UPDATE
SET role = 'admin',
    data = COALESCE(public.user_quotas.data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
    updated_at = NOW();`;

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserQuotaAccount[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [aiLogs, setAiLogs] = useState<AiUsageLogItem[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedSettingsNotice, setSavedSettingsNotice] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const [activeTab, setActiveTab] = useState<"users" | "transactions" | "ai_logs" | "master_key">("users");
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Admin Authorization Gate state (Strictly verified from Supabase)
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAdminAuthorized, setIsAdminAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authReason, setAuthReason] = useState<string>("");
  const [authSource, setAuthSource] = useState<string>("none");
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [copiedGateSql, setCopiedGateSql] = useState(false);

  // Create new user modal state
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPlan, setNewUserPlan] = useState<PlanTier>("free");
  const [newUserCustomQuota, setNewUserCustomQuota] = useState<string>("30");

  // Edit custom quota inline state
  const [editingQuotaEmail, setEditingQuotaEmail] = useState<string | null>(
    null
  );
  const [editingQuotaValue, setEditingQuotaValue] = useState<string>("");

  const loadAdminData = useCallback(async (forceRefresh = false) => {
    setIsCheckingAuth(true);
    const loadedSettings = getAppSettings();
    setSettings(loadedSettings);

    const u = await getCurrentUser(forceRefresh);
    setCurrentUser(u);

    const verification = await syncAndVerifyAdminRoleFromSupabase(u, forceRefresh);
    setIsAdminAuthorized(verification.isAdmin);
    setAuthReason(verification.reason);
    setAuthSource(verification.source);
    setSupabaseConnected(verification.supabaseConnected);

    setUsers(getAllUsersForAdmin());
    setTransactions(getAllPaymentTransactions());
    setAiLogs(getAllAiUsageLogs());
    setIsCheckingAuth(false);
  }, []);

  const refreshLocalLists = useCallback(() => {
    setUsers(getAllUsersForAdmin());
    setTransactions(getAllPaymentTransactions());
    setAiLogs(getAllAiUsageLogs());
  }, []);

  useEffect(() => {
    loadAdminData();
    const handleUpdate = () => refreshLocalLists();
    const handleSessionExpired = (e: Event) => {
      const evt = e as CustomEvent<{ reason?: string }>;
      setCurrentUser(null);
      setIsAdminAuthorized(false);
      setAuthReason(
        evt.detail?.reason ||
          "Phiên đăng nhập đã hết hạn. Hệ thống đã tự động đăng xuất, vui lòng quay về trang chủ để đăng nhập lại!"
      );
    };

    window.addEventListener("bookmind:quota-updated", handleUpdate);
    window.addEventListener("bookmind:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("bookmind:quota-updated", handleUpdate);
      window.removeEventListener(
        "bookmind:session-expired",
        handleSessionExpired
      );
    };
  }, [loadAdminData, refreshLocalLists]);

  const handleSaveMasterSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveAppSettings(settings);
    setSavedSettingsNotice(true);
    setTimeout(() => setSavedSettingsNotice(false), 2500);
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKeyId(key);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleChangeUserPlan = (email: string, newPlan: PlanTier) => {
    adminUpdateUserAccount(email, { plan: newPlan });
    loadAdminData();
  };

  const handleResetUserDailyCalls = (email: string) => {
    adminUpdateUserAccount(email, { usedCalls: 0 });
    loadAdminData();
  };

  const handleSimulateQuotaExhausted = (user: UserQuotaAccount) => {
    const limit =
      user.plan === "unlimited" || user.maxCalls === -1
        ? user.fupDailyLimit || VIP_FUP_DAILY_CREDITS
        : user.maxCalls;
    adminUpdateUserAccount(user.email, { usedCalls: limit });
    loadAdminData();
  };

  const handleRegenerateUserKey = (email: string) => {
    if (
      !window.confirm(
        `Bạn có chắc muốn cấp lại Mã API Key mới cho tài khoản ${email}? (Key mới sẽ tự động gắn vào dữ liệu của user này)`
      )
    ) {
      return;
    }
    adminUpdateUserAccount(email, { regenerateKey: true });
    loadAdminData();
  };

  const handleToggleLockUser = (user: UserQuotaAccount) => {
    adminUpdateUserAccount(user.email, { isLocked: !user.isLocked });
    loadAdminData();
  };

  const handleDeleteUser = (email: string) => {
    if (
      !window.confirm(
        `Xóa tài khoản hạn mức của ${email} khỏi danh sách quản lý?`
      )
    ) {
      return;
    }
    adminDeleteUserAccount(email);
    loadAdminData();
  };

  const handleSaveCustomQuota = (email: string) => {
    const parsed = parseInt(editingQuotaValue, 10);
    if (!isNaN(parsed) && (parsed >= -1)) {
      adminUpdateUserAccount(email, { maxCalls: parsed });
      loadAdminData();
    }
    setEditingQuotaEmail(null);
  };

  const handleResetAllUsersToday = () => {
    if (
      !window.confirm(
        "Reset số lượt gọi hôm nay về 0 cho TOÀN BỘ tài khoản học viên?"
      )
    ) {
      return;
    }
    adminResetAllDailyQuotas();
    loadAdminData();
  };

  const handleCreateNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim()) return;
    const customMax =
      newUserPlan === "unlimited"
        ? -1
        : parseInt(newUserCustomQuota, 10) || PLAN_CONFIG[newUserPlan].maxCalls;

    adminCreateUserAccount({
      name: newUserName,
      email: newUserEmail,
      plan: newUserPlan,
      customMaxCalls: customMax,
    });
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPlan("free");
    setNewUserCustomQuota("15");
    setIsCreateUserOpen(false);
    loadAdminData();
  };

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesPlan = planFilter === "all" || u.plan === planFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.issuedApiKey.toLowerCase().includes(q);
    return matchesPlan && matchesSearch;
  });

  // KPI metrics
  const totalUsers = users.length;
  const proCount = users.filter((u) => u.plan === "pro").length;
  const unlimitedCount = users.filter((u) => u.plan === "unlimited").length;
  const freeCount = users.filter((u) => u.plan === "free").length;
  const todayTotalCalls = users.reduce((sum, u) => sum + (u.usedCalls || 0), 0);
  const allTimeTotalCalls = users.reduce(
    (sum, u) => sum + (u.totalCalls || u.usedCalls || 0),
    0
  );
  const totalRevenueVnd = transactions.reduce(
    (sum, tx) => sum + (tx.amountVnd || 0),
    0
  );

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">
        Đang kiểm tra phân quyền Quản trị viên (Admin RBAC)...
      </div>
    );
  }

  // ADMIN AUTHORIZATION GATE: Chỉ cho phép tài khoản có role = 'admin' trực tiếp từ Supabase
  if (!isAdminAuthorized) {
    const targetEmail = currentUser?.email || "email_cua_ban@domain.com";
    const quickGrantSql = `-- 1. Tự động khởi tạo bảng public.user_quotas (nếu chưa có trên Supabase):
CREATE TABLE IF NOT EXISTS public.user_quotas (
  email TEXT PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'user',
  plan TEXT NOT NULL DEFAULT 'free',
  issued_api_key TEXT NOT NULL DEFAULT 'BM-FREE-INIT00-0000',
  used_calls INTEGER DEFAULT 0,
  max_calls INTEGER DEFAULT 30,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_quotas ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE public.user_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Select user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Client sync user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Update own usage user_quotas" ON public.user_quotas;
DROP POLICY IF EXISTS "Admin full control user_quotas" ON public.user_quotas;

-- 1. Cho phép đọc hạn mức để kiểm tra và đồng bộ:
CREATE POLICY "Select user_quotas"
ON public.user_quotas FOR SELECT USING (true);

-- 2. Học viên chỉ được tự đồng bộ dòng của mình với role bắt buộc là 'user' (Chặn tự nâng quyền thành 'admin' qua API):
CREATE POLICY "Client sync user_quotas"
ON public.user_quotas FOR INSERT
WITH CHECK (role = 'user');

CREATE POLICY "Update own usage user_quotas"
ON public.user_quotas FOR UPDATE
USING (role = 'user')
WITH CHECK (role = 'user');

-- 3. CHỈ Admin được xác thực từ auth.users (JWT app_metadata.role = 'admin') mới có toàn quyền sửa role/plan:
CREATE POLICY "Admin full control user_quotas"
ON public.user_quotas FOR ALL
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- 2. Cấp quyền Admin cho tài khoản '${targetEmail}' trên cả auth.users và public.user_quotas:
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = '${targetEmail}';

INSERT INTO public.user_quotas (email, role, plan, issued_api_key, used_calls, max_calls, data)
VALUES ('${targetEmail}', 'admin', 'unlimited', 'BM-VIP-ADMIN', 0, -1, '{"role": "admin"}'::jsonb)
ON CONFLICT (email) DO UPDATE
SET role = 'admin',
    data = COALESCE(public.user_quotas.data, '{}'::jsonb) || '{"role": "admin"}'::jsonb,
    updated_at = NOW();`;

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 text-slate-100">
        <div className="w-full max-w-xl rounded-3xl border border-amber-500/30 bg-slate-900 p-7 shadow-2xl space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20">
              <Lock className="h-6 w-6" />
            </div>
            <div>
              <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300">
                Supabase Server-Side RBAC
              </span>
              <h1 className="mt-1 text-lg font-extrabold text-white">
                Truy Cập Bị Từ Chối • Chỉ Admin Từ Supabase Mới Được Vào
              </h1>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Tài khoản đang đăng nhập:</span>
              <strong className="text-white">
                {currentUser?.email || "Chưa đăng nhập"}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Phương thức xác thực:</span>
              <span className="text-slate-300 font-semibold">
                {!currentUser
                  ? "Chưa đăng nhập"
                  : currentUser.app_metadata?.provider === "local"
                  ? "Tài khoản cục bộ (Local) • Không phải Supabase Auth"
                  : `Supabase Auth (${currentUser.app_metadata?.provider || "email"})`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Vai trò trên Supabase (Role):</span>
              <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                role = &quot;user&quot; (Không có quyền Admin)
              </span>
            </div>
            <div className="pt-1 border-t border-slate-800/80 text-[11px] text-amber-300/90 leading-relaxed">
              <strong>Nguyên tắc bảo mật:</strong> Tài khoản Admin <strong>chỉ có thể được thêm/cấp quyền trực tiếp từ Supabase</strong> (bảng <code className="text-white">auth.users</code> hoặc <code className="text-white">public.user_quotas</code>). Tên hay tiền tố email hoàn toàn không liên quan và không thể tự nâng quyền từ phía trình duyệt.
            </div>
          </div>

          {authReason && (
            <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{authReason}</span>
            </div>
          )}

          {/* Nếu chưa cấu hình kết nối Supabase trên trình duyệt thì cho phép nhập URL & Anon Key để kết nối tới Supabase */}
          {!supabaseConnected && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveAppSettings(settings);
                loadAdminData();
              }}
              className="rounded-2xl border border-emerald-500/30 bg-slate-950/90 p-4 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <Cloud className="h-4 w-4" />
                <span>Kết nối Supabase Project để hệ thống kiểm tra quyền Admin:</span>
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <input
                  type="text"
                  required
                  value={settings.supabaseUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, supabaseUrl: e.target.value })
                  }
                  placeholder="Supabase URL (https://xyz.supabase.co)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="password"
                  required
                  value={settings.supabaseAnonKey}
                  onChange={(e) =>
                    setSettings({ ...settings, supabaseAnonKey: e.target.value })
                  }
                  placeholder="Supabase Anon Public Key (eyJ...)"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2 text-xs font-bold text-white transition cursor-pointer"
              >
                Lưu Kết Nối Supabase & Kiểm Tra Quyền Admin
              </button>
            </form>
          )}

          {/* Hướng dẫn SQL cấp quyền Admin trực tiếp trong Supabase */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                Cách thêm tài khoản Admin trực tiếp trong Supabase SQL Editor:
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(quickGrantSql);
                  setCopiedGateSql(true);
                  setTimeout(() => setCopiedGateSql(false), 2000);
                }}
                className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-emerald-300 cursor-pointer"
              >
                {copiedGateSql ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Đã Copy SQL</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy lệnh SQL</span>
                  </>
                )}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-xl bg-slate-900/90 p-3 text-[11px] leading-relaxed text-emerald-300 font-mono border border-slate-800">
              {quickGrantSql}
            </pre>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Link
              href="/"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 py-2.5 text-center text-xs font-bold text-slate-300 transition"
            >
              ← Về Trang Học Viên
            </Link>
            <button
              type="button"
              onClick={() => loadAdminData(true)}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 py-2.5 text-xs font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Kiểm Tra Lại Quyền Từ Supabase</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 sm:h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-lg font-extrabold text-white truncate">
                  BookMind AI • Admin
                </h1>
                <span className="hidden md:inline-block shrink-0 rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-black uppercase text-amber-300">
                  Supabase Verified Admin ({authSource === "supabase_auth_metadata" ? "auth.users" : "user_quotas"})
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block truncate">
                Quản lý Tài khoản Học viên, API Key gián tiếp, AI Credit mỗi ngày & Gói cước (Quyền Admin chỉ cấp từ Supabase)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsCreateUserOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-2.5 sm:px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Thêm Tài Khoản User</span>
              <span className="sm:hidden">Thêm User</span>
            </button>

            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-2.5 sm:px-3.5 py-2 text-xs font-bold text-slate-200 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              <span className="hidden sm:inline">Về Trang Học Tập</span>
              <span className="sm:hidden">Trang chủ</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 space-y-6">
        {/* KPI Overview Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Tổng Tài Khoản User</span>
              <Users className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white">
              {totalUsers} Users
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="text-emerald-400">{freeCount} Free</span>•
              <span className="text-amber-400">{proCount} Pro</span>•
              <span className="text-purple-400">{unlimitedCount} VIP</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Lượt Gọi AI Hôm Nay ({getTodayDateString()})</span>
              <Zap className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-white">
              {todayTotalCalls} lượt
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Tổng tích lũy: <strong className="text-indigo-300">{allTimeTotalCalls} lượt gọi</strong>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Doanh Thu Nâng Cấp (Ảo)</span>
              <Receipt className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-extrabold text-emerald-400">
              {totalRevenueVnd.toLocaleString("vi-VN")}đ
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {transactions.length} giao dịch qua QR MoMo / VNPay
            </div>
          </div>

          <div
            onClick={() => setActiveTab("master_key")}
            className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 cursor-pointer hover:border-amber-500/40 transition"
          >
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Master Key & Supabase Cloud</span>
              <Key className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-sm font-bold text-white">
              {settings.masterGeminiApiKey
                ? `Gemini: ${settings.masterGeminiApiKey.slice(0, 6)}••••`
                : "Gemini: Theo biến .env"}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span
                className={`flex items-center gap-1 ${
                  settings.supabaseUrl && settings.supabaseAnonKey
                    ? "text-emerald-400"
                    : "text-amber-300"
                }`}
              >
                <Cloud className="h-3.5 w-3.5" />
                {settings.supabaseUrl && settings.supabaseAnonKey
                  ? "Đã kết nối Supabase"
                  : "Bấm cấu hình Master Key & Supabase"}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex w-full sm:w-auto overflow-x-auto no-scrollbar items-center gap-2 pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "users"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Users className="h-4 w-4 shrink-0" />
              <span>Quản Lý Tài Khoản User ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("transactions")}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "transactions"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Receipt className="h-4 w-4 shrink-0" />
              <span>Lịch Sử Thanh Toán QR ({transactions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("ai_logs")}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "ai_logs"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="h-4 w-4 shrink-0" />
              <span>Nhật Ký AI Credit & Hoàn Trả ({aiLogs.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("master_key")}
              className={`flex items-center gap-2 shrink-0 whitespace-nowrap rounded-xl px-3.5 sm:px-4 py-2 text-xs font-bold transition cursor-pointer ${
                activeTab === "master_key"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              <Key className="h-4 w-4 shrink-0" />
              <span>Cấu Hình Master Key & Supabase</span>
            </button>
          </div>

          {activeTab === "users" && (
            <button
              type="button"
              onClick={handleResetAllUsersToday}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer w-full sm:w-auto"
            >
              <RefreshCw className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>Reset Lượt Gọi Hôm Nay Cho Toàn Bộ User</span>
            </button>
          )}
        </div>

        {/* TAB 1: USER ACCOUNTS MANAGEMENT TABLE */}
        {activeTab === "users" && (
          <div className="space-y-4">
            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm theo Email, Tên học viên hoặc Mã API Key (BM-FREE / BM-PRO / BM-VIP)..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="w-full sm:w-56">
                <CustomSelect
                  value={planFilter}
                  onChange={(val) => setPlanFilter(val)}
                  size="sm"
                  accentColor="indigo"
                  icon={<Crown className="h-3.5 w-3.5" />}
                  options={[
                    { value: "all", label: "Tất cả Gói cước", badge: `${users.length}` },
                    { value: "free", label: "Gói Free (30 Credits/ngày)", badge: `${freeCount}` },
                    { value: "pro", label: "Gói Pro (120 Credits/ngày)", badge: `${proCount}` },
                    { value: "unlimited", label: "Gói VIP (FUP 500 Credits)", badge: `${unlimitedCount}` },
                  ]}
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4">Học Viên & Email</th>
                    <th className="py-3.5 px-4">Gói Đang Dùng</th>
                    <th className="py-3.5 px-4">Mã API Key Đã Cấp (Nội Bộ)</th>
                    <th className="py-3.5 px-4">Lượt Gọi Hôm Nay (Reset/Ngày)</th>
                    <th className="py-3.5 px-4">Tổng Lượt Gọi</th>
                    <th className="py-3.5 px-4">Trạng Thái</th>
                    <th className="py-3.5 px-4 text-right">Thao Tác Quản Trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-slate-500"
                      >
                        Không tìm thấy tài khoản học viên nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isUnlimited =
                        u.plan === "unlimited" || u.maxCalls === -1;
                      const pct = isUnlimited
                        ? 20
                        : Math.min(
                            100,
                            Math.round(
                              (u.usedCalls / Math.max(1, u.maxCalls)) * 100
                            )
                          );

                      return (
                        <tr
                          key={u.email}
                          className="hover:bg-slate-800/40 transition"
                        >
                          {/* 1. User, Email & Read-Only Role Badge (Managed in Supabase only) */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{u.name}</span>
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase ${
                                  u.role === "admin"
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-slate-800 text-slate-300 border border-slate-700"
                                }`}
                                title="Quyền Admin chỉ có thể được cấp hoặc thu hồi trực tiếp từ cơ sở dữ liệu Supabase"
                              >
                                {u.role === "admin" ? "Admin" : "User"}
                              </span>
                            </div>
                            <div className="text-slate-400 font-medium">
                              {u.email}
                            </div>
                            {/* <div className="text-[10px] text-slate-500 mt-0.5">
                              Tạo:{" "}
                              {new Date(u.createdAt).toLocaleDateString("vi-VN")} • Role đồng bộ từ Supabase
                            </div> */}
                          </td>

                          {/* 2. Plan Selector */}
                          <td className="py-3.5 px-4 min-w-[175px]">
                            <CustomSelect
                              value={u.plan}
                              onChange={(newVal) =>
                                handleChangeUserPlan(u.email, newVal as PlanTier)
                              }
                              size="sm"
                              accentColor={
                                u.plan === "unlimited"
                                  ? "purple"
                                  : u.plan === "pro"
                                  ? "amber"
                                  : "emerald"
                              }
                              options={[
                                {
                                  value: "free",
                                  label: "Free (30 Credit/ngày)",
                                },
                                {
                                  value: "pro",
                                  label: "Pro (120 Credit/ngày)",
                                },
                                {
                                  value: "unlimited",
                                  label: "VIP (FUP 500 Credit)",
                                },
                              ]}
                            />
                          </td>

                          {/* 3. Assigned Indirect API Key */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <code className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-400">
                                {u.issuedApiKey}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyKey(u.issuedApiKey)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                                title="Sao chép mã API Key"
                              >
                                {copiedKeyId === u.issuedApiKey ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRegenerateUserKey(u.email)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-amber-300 transition cursor-pointer"
                                title="Cấp lại Mã API Key mới cho user này"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* 4. Today Quota & Custom Limit */}
                          <td className="py-3.5 px-4 min-w-[190px]">
                            {editingQuotaEmail === u.email ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  value={editingQuotaValue}
                                  onChange={(e) =>
                                    setEditingQuotaValue(e.target.value)
                                  }
                                  className="w-20 rounded-lg border border-indigo-500 bg-slate-950 px-2 py-1 text-xs text-white"
                                  placeholder="Số lượt"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSaveCustomQuota(u.email)}
                                  className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white"
                                >
                                  Lưu
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingQuotaEmail(null)}
                                  className="text-[11px] text-slate-400"
                                >
                                  Hủy
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  {isUnlimited ? (
                                    <span className="flex items-center gap-1 font-bold text-purple-300">
                                      <InfinityIcon className="h-3.5 w-3.5" />
                                      {u.usedCalls} / {u.fupDailyLimit || VIP_FUP_DAILY_CREDITS} Credit (FUP)
                                    </span>
                                  ) : (
                                    <span
                                      className={`font-bold ${
                                        u.usedCalls >= u.maxCalls
                                          ? "text-rose-400"
                                          : "text-white"
                                      }`}
                                    >
                                      {u.usedCalls} / {u.maxCalls} 
                                    </span>
                                  )}

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingQuotaEmail(u.email);
                                        setEditingQuotaValue(
                                          String(u.maxCalls)
                                        );
                                      }}
                                      className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
                                      title="Chỉnh sửa giới hạn lượt gọi/ngày"
                                    >
                                      <Sliders className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleResetUserDailyCalls(u.email)
                                      }
                                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-emerald-300 hover:bg-slate-700 cursor-pointer"
                                      title="Reset số lượt gọi hôm nay về 0"
                                    >
                                      Reset 0
                                    </button>
                                    {!isUnlimited && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleSimulateQuotaExhausted(u)
                                        }
                                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 cursor-pointer"
                                        title="Giả lập đã dùng hết sạch lượt hôm nay để test bảng Nâng cấp"
                                      >
                                        Test hết lượt
                                      </button>
                                    )}
                                  </div>
                                </div>

                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-950">
                                  <div
                                    className={`h-full ${
                                      isUnlimited
                                        ? "bg-purple-500 w-full"
                                        : u.usedCalls >= u.maxCalls
                                        ? "bg-rose-500"
                                        : "bg-emerald-400"
                                    }`}
                                    style={{
                                      width: isUnlimited ? "100%" : `${pct}%`,
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 5. Total Historical Calls */}
                          <td className="py-3.5 px-4 font-bold text-slate-200">
                            {u.totalCalls || u.usedCalls || 0} lượt
                          </td>

                          {/* 6. Status */}
                          <td className="py-3.5 px-4">
                            {u.isLocked ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-300">
                                <Lock className="h-3 w-3" />
                                Đã khóa AI
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                <Check className="h-3 w-3" />
                                Hoạt động
                              </span>
                            )}
                          </td>

                          {/* 7. Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleLockUser(u)}
                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-bold transition cursor-pointer ${
                                  u.isLocked
                                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                    : "border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                }`}
                                title={
                                  u.isLocked
                                    ? "Mở khóa quyền gọi AI"
                                    : "Tạm khóa quyền gọi AI của user này"
                                }
                              >
                                {u.isLocked ? (
                                  <span className="flex items-center gap-1">
                                    <Unlock className="h-3 w-3" />
                                    Mở khóa
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <Lock className="h-3 w-3" />
                                    Khóa
                                  </span>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.email)}
                                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-400 hover:bg-rose-500/25 transition cursor-pointer"
                                title="Xóa tài khoản user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: PAYMENT TRANSACTIONS LOG */}
        {activeTab === "transactions" && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Mã Đơn Hàng</th>
                  <th className="py-3.5 px-4">Học Viên & Email</th>
                  <th className="py-3.5 px-4">Gói Nâng Cấp</th>
                  <th className="py-3.5 px-4">Số Tiền</th>
                  <th className="py-3.5 px-4">Cổng Thanh Toán</th>
                  <th className="py-3.5 px-4">Mã API Key Đã Cấp</th>
                  <th className="py-3.5 px-4">Thời Gian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Chưa có giao dịch nâng cấp gói nào được ghi nhận.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                        {tx.orderCode}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white">{tx.userName}</div>
                        <div className="text-slate-400">{tx.userEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-indigo-300">
                        {PLAN_CONFIG[tx.plan]?.name || tx.plan}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-400">
                        {tx.amountFormatted}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase ${
                            tx.paymentMethod === "momo"
                              ? "bg-[#A50064]/30 text-pink-300 border border-pink-500/30"
                              : "bg-[#005BAA]/30 text-sky-300 border border-sky-500/30"
                          }`}
                        >
                          {tx.paymentMethod === "momo"
                            ? "Ví MoMo QR"
                            : "VNPay SmartQR"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        {tx.assignedApiKey}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(tx.createdAt).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2B: AI USAGE & REFUND LOGS */}
        {activeTab === "ai_logs" && (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4">Idempotency Key</th>
                  <th className="py-3.5 px-4">Email Học Viên</th>
                  <th className="py-3.5 px-4">Tác Vụ AI & Endpoint</th>
                  <th className="py-3.5 px-4">Trọng Số Credit</th>
                  <th className="py-3.5 px-4">Trạng Thái & Hoàn Credit</th>
                  <th className="py-3.5 px-4">Retry / Thời Gian Phản Hồi</th>
                  <th className="py-3.5 px-4">Thời Điểm Gọi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs">
                {aiLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      Chưa có nhật ký gọi AI nào trong phiên làm việc này.
                    </td>
                  </tr>
                ) : (
                  aiLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-300">
                        {log.idempotencyKey}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {log.userEmail}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-200">
                          {log.taskLabel}
                        </div>
                        <div className="font-mono text-[10px] text-slate-500">
                          {log.endpoint}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 font-mono font-bold text-amber-300">
                          {log.creditsCharged} Credit
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {log.status === "success" ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Thành công (-{log.creditsCharged} Cr)
                          </span>
                        ) : log.status === "failed_refunded" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 border border-rose-500/30 px-2.5 py-1 text-[11px] font-bold text-rose-300">
                              <RefreshCw className="h-3.5 w-3.5" />
                              Đã hoàn 100% (+{log.creditsCharged} Cr)
                            </span>
                            {log.errorMessage && (
                              <div className="text-[10px] text-rose-400 max-w-xs truncate">
                                {log.errorMessage}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300">
                            Chặn Rate Limit (0 Cr)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        Retry: {log.retryCount} • {log.latencyMs}ms
                      </td>
                      <td className="py-3.5 px-4 text-slate-400">
                        {new Date(log.createdAt).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: MASTER AI AGENT KEYS & SUPABASE CLOUD CONFIGURATION */}
        {activeTab === "master_key" && (
          <form
            onSubmit={handleSaveMasterSettings}
            className="max-w-4xl space-y-6"
          >
            {/* Card 1: 4-Provider AI Agent Keys Cluster (Admin Only) */}
            <div className="rounded-3xl border border-amber-500/30 bg-slate-900/80 p-6 space-y-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      1. Quản Lý Cụm 4 API Key Của Các AI Agent (Chỉ Hiển Thị Cho Admin)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Cấu hình các API Key gốc của hệ thống (Groq, OpenRouter, SiliconFlow & Google Gemini). Tài khoản User thông thường sẽ không nhìn thấy các Key này.
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 text-xs font-bold text-emerald-300">
                  Bảo mật cấp Admin
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    1. Groq Cloud API Key (<code>gsk_...</code>)
                  </label>
                  <input
                    type="password"
                    value={settings.groqApiKey || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        groqApiKey: e.target.value.trim(),
                      })
                    }
                    placeholder="gsk_..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    2. OpenRouter API Key (<code>sk-or-v1-...</code>)
                  </label>
                  <input
                    type="password"
                    value={settings.openRouterApiKey || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        openRouterApiKey: e.target.value.trim(),
                      })
                    }
                    placeholder="sk-or-v1-..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    3. SiliconFlow API Key (<code>sk-...</code>)
                  </label>
                  <input
                    type="password"
                    value={settings.siliconFlowApiKey || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        siliconFlowApiKey: e.target.value.trim(),
                      })
                    }
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    4. Master Google Gemini API Key (<code>AIzaSy...</code>)
                  </label>
                  <input
                    type="password"
                    value={settings.masterGeminiApiKey || ""}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        masterGeminiApiKey: e.target.value.trim(),
                      })
                    }
                    placeholder="AIzaSy... (Hoặc biến GEMINI_API_KEY trong .env)"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Mô hình AI mặc định của toàn hệ thống
                  </label>
                  <CustomSelect
                    value={settings.geminiModel}
                    onChange={(val) =>
                      setSettings({ ...settings, geminiModel: val })
                    }
                    accentColor="amber"
                    icon={<Sparkles className="h-4 w-4" />}
                    options={[
                      {
                        value: "qwen-groq",
                        label: "⚡ Groq Cloud Siêu Tốc (GPT-OSS 120B / Qwen 3.8)",
                        badge: "Mặc định Siêu tốc",
                      },
                      {
                        value: "qwen-openrouter",
                        label: "🟢 OpenRouter Free + Nemotron Vision VL",
                        badge: "Đa năng & Vision",
                      },
                      {
                        value: "qwen-siliconflow",
                        label: "🔵 SiliconFlow Qwen Cloud",
                        badge: "Dự phòng",
                      },
                      {
                        value: "gemini-2.5-flash",
                        label: "Google Gemini 2.5 Flash (+ Tự động Failover)",
                        badge: "Google AI",
                      },
                      {
                        value: "gemini-2.0-flash",
                        label: "Google Gemini 2.0 Flash",
                      },
                      {
                        value: "gemini-2.5-pro",
                        label: "Google Gemini 2.5 Pro",
                      },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Supabase Cloud Database & Auth Configuration */}
            <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/80 p-6 space-y-5 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">
                      2. Cấu Hình Cơ Sở Dữ Liệu Supabase Cloud (Dành Riêng Cho Admin)
                    </h3>
                    <p className="text-xs text-slate-400">
                      Kết nối Supabase để lưu trữ đồng bộ User, Google OAuth, Khóa học và Flashcards trên Cloud
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSql(!showSql)}
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 transition cursor-pointer"
                >
                  {showSql
                    ? "Ẩn mã SQL khởi tạo bảng"
                    : "Xem mã SQL tạo bảng Supabase"}
                </button>
              </div>

              {showSql && (
                <div className="relative rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(SUPABASE_ADMIN_SQL_SCHEMA);
                      setCopiedSql(true);
                      setTimeout(() => setCopiedSql(false), 2000);
                    }}
                    className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 cursor-pointer"
                  >
                    {copiedSql ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Đã sao chép SQL</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                  <pre className="overflow-x-auto text-[11px] leading-relaxed text-emerald-300 font-mono">
                    {SUPABASE_ADMIN_SQL_SCHEMA}
                  </pre>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={settings.supabaseUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, supabaseUrl: e.target.value })
                    }
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-300">
                    Supabase Anon / Public Key
                  </label>
                  <input
                    type="password"
                    value={settings.supabaseAnonKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        supabaseAnonKey: e.target.value,
                      })
                    }
                    placeholder="eyJhbGciOiJIUzI1NiIsInR..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {savedSettingsNotice ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã lưu cấu hình Master Gemini Key & Supabase thành công!
                </span>
              ) : (
                <span />
              )}

              <button
                type="submit"
                className="rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-3 text-xs sm:text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                Lưu Cấu Hình Master Key & Supabase
              </button>
            </div>
          </form>
        )}
      </main>

      {/* Create New User Modal */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white">
              Thêm Tài Khoản Học Viên & Cấp Gói AI
            </h3>

            <form onSubmit={handleCreateNewUser} className="space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Họ và tên học viên
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Email tài khoản
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="hocvien@gmail.com"
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Gói cước áp dụng
                </label>
                <CustomSelect
                  value={newUserPlan}
                  onChange={(val) => {
                    const p = val as PlanTier;
                    setNewUserPlan(p);
                    setNewUserCustomQuota(String(PLAN_CONFIG[p].maxCalls));
                  }}
                  options={[
                    { value: "free", label: "Gói Free (15 lượt/ngày)" },
                    { value: "pro", label: "Gói Pro (50 lượt/ngày)" },
                    { value: "unlimited", label: "Gói Unlimited (Không giới hạn)" },
                  ]}
                />
              </div>

              {newUserPlan !== "unlimited" && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-300">
                    Số lượt gọi AI mỗi ngày (Tự động reset 00:00)
                  </label>
                  <input
                    type="number"
                    value={newUserCustomQuota}
                    onChange={(e) => setNewUserCustomQuota(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2 text-xs text-white"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white"
                >
                  Tạo Tài Khoản & Gắn Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

