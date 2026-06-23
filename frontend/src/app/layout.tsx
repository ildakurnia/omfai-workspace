import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "OMFAI Workspace",
  description: "Sistem Pemantauan Aktivitas Karyawan Terpusat secara Real-Time",
  icons: {
    icon: "/omfai-logo-v2.png",
    shortcut: "/omfai-logo-v2.png",
    apple: "/omfai-logo-v2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased overflow-x-hidden`}
    >
      <body suppressHydrationWarning className={`${inter.className} min-h-full flex flex-col bg-background text-foreground overflow-x-hidden`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
