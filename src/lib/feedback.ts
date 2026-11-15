/**
 * Global Action Loading & Auto-Dismissing Toast Feedback System
 * Cung cấp hiệu ứng Loading đặc trưng riêng biệt cho từng thao tác (Delete / Edit / AI API / Cloud Sync)
 * và Toast thông báo tự động tắt mượt mà sau 1.8 giây (1-2s).
 */

export type FeedbackVariant = "delete" | "edit" | "api" | "sync";
export type ToastType = "success" | "error" | "delete" | "info";

export interface ActiveLoadingItem {
  id: string;
  variant: FeedbackVariant;
  title: string;
  subtitle?: string;
  startedAt: number;
}

export interface ToastNotificationItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs: number;
  createdAt: number;
}

const LOADING_EVENT = "bookmind:action-loading";
const TOAST_EVENT = "bookmind:toast";

export function startActionLoading(options: {
  id?: string;
  variant: FeedbackVariant;
  title: string;
  subtitle?: string;
}): string {
  const id =
    options.id ||
    `load-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LOADING_EVENT, {
        detail: {
          action: "start",
          item: {
            id,
            variant: options.variant,
            title: options.title,
            subtitle: options.subtitle,
            startedAt: Date.now(),
          } satisfies ActiveLoadingItem,
        },
      })
    );
  }
  return id;
}

export function stopActionLoading(id?: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(LOADING_EVENT, {
        detail: {
          action: "stop",
          id,
        },
      })
    );
  }
}

export function showToast(options: {
  type?: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}): void {
  if (typeof window === "undefined") return;
  const item: ToastNotificationItem = {
    id: `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: options.type || "success",
    title: options.title,
    message: options.message,
    // Mặc định tự động tắt sau 1.8 giây (nằm trong khoảng 1-2s theo yêu cầu)
    durationMs: options.durationMs ?? 1800,
    createdAt: Date.now(),
  };

  window.dispatchEvent(
    new CustomEvent(TOAST_EVENT, {
      detail: item,
    })
  );
}

export async function runWithFeedback<T>(
  options: {
    variant: FeedbackVariant;
    loadingTitle: string;
    loadingSubtitle?: string;
    successTitle?: string;
    successMessage?: string;
    errorTitle?: string;
    toastDurationMs?: number;
    minLoadingMs?: number;
  },
  fn: () => Promise<T>
): Promise<T> {
  const loadId = startActionLoading({
    variant: options.variant,
    title: options.loadingTitle,
    subtitle: options.loadingSubtitle,
  });
  const startMs = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - startMs;
    const minWait = options.minLoadingMs ?? 320;
    if (elapsed < minWait) {
      await new Promise((r) => setTimeout(r, minWait - elapsed));
    }
    stopActionLoading(loadId);
    if (options.successTitle) {
      showToast({
        type: options.variant === "delete" ? "delete" : "success",
        title: options.successTitle,
        message: options.successMessage,
        durationMs: options.toastDurationMs ?? 1800,
      });
    }
    return result;
  } catch (err: unknown) {
    stopActionLoading(loadId);
    const errMsg =
      err instanceof Error ? err.message : "Đã xảy ra lỗi trong quá trình xử lý.";
    showToast({
      type: "error",
      title: options.errorTitle || "Thao tác không thành công",
      message: errMsg,
      durationMs: 2200,
    });
    throw err;
  }
}
