import { DraftPreview } from "@/components/admin/DraftPreview";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Private draft preview",
  robots: { index: false, follow: false },
};
export default function Preview() {
  return <DraftPreview />;
}
