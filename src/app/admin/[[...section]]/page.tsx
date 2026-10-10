import { AdminApp } from "@/components/admin/AdminApp";
import { isDemo } from "@/server/store";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Studio workspace",
  robots: { index: false, follow: false },
};
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  return (
    <AdminApp
      section={(await params).section?.[0] ?? "overview"}
      demo={isDemo()}
    />
  );
}
