import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  adjustFontFallback: true,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  title: "Industrial Form Builder",
  description: "Build nested-header industrial forms, collect entries, and review submissions.",
  manifest: "/manifest.webmanifest",
  applicationName: "Industrial Form Builder",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Industrial Forms",
  },
  icons: {
    icon: "/pwa-icon.svg",
    apple: "/pwa-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--background:#fafaf9;--foreground:#0f172a}html{background:var(--background);color:var(--foreground)}body{margin:0;min-height:100%;background:var(--background);color:var(--foreground);font-family:ui-sans-serif,system-ui,sans-serif}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
