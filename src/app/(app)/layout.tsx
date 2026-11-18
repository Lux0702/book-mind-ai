import AppDataProvider from "@/components/app/AppDataProvider";
import AppShell from "@/components/app/AppShell";

/**
 * Layout chung cho mọi trang của ứng dụng (trừ /admin và /api):
 * dữ liệu + đăng nhập + thanh điều hướng + modal dùng chung.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
    </AppDataProvider>
  );
}
