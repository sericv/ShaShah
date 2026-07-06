import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "شاشة (Shasha) — مشاركة الشاشة بجودة فائقة",
  description: "منصة شخصية سريعة ومجانية لمشاركة الشاشة، الكاميرا، والصوت مع الأصدقاء وزملاء العمل بدون حساب وبجودة 1080p 60fps.",
  keywords: ["screen sharing", "webrtc screen share", "مشاركة الشاشة", "شاشة بث", "بث شاشة", "دردشة مباشرة"],
  authors: [{ name: "Shasha Team" }],
  openGraph: {
    title: "شاشة — مشاركة الشاشة بجودة فائقة",
    description: "شارك شاشتك، ميكروفونك، وكاميرتك في ثانية واحدة بدون تسجيل حساب.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="h-full scroll-smooth antialiased">
      <body className="min-h-full bg-shasha-bg text-shasha-text flex flex-col font-sans selection:bg-shasha-accent/30 selection:text-shasha-text">
        {children}
      </body>
    </html>
  );
}
