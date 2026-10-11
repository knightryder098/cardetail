import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "@/styles/booking.css";
import "@/styles/admin.css";
// lola
export const metadata: Metadata = {
  title: {
    default: "Balaji Studio — Precision car care",
    template: "%s · Balaji Studio",
  },
  description:
    "Thoughtful detailing and considered protection. Explore treatments and book care for the car you love.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
