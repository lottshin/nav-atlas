import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { ThemeSync } from "@/components/theme/theme-sync";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans"
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono"
});

function resolveMetadataBase() {
  const configuredOrigin = process.env.NEXTAUTH_URL?.trim();
  if (!configuredOrigin) {
    return undefined;
  }

  try {
    return new URL(configuredOrigin);
  } catch {
    return undefined;
  }
}

const metadataBase = resolveMetadataBase();

export const metadata: Metadata = {
  title: "Nav Atlas",
  description: "按分类浏览 AI、设计、影视与高频工具网站。",
  applicationName: "Nav Atlas",
  ...(metadataBase ? { metadataBase } : {}),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg+xml"
      },
      {
        url: "/favicon.ico"
      }
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      {
        url: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png"
      }
    ]
  },
  openGraph: {
    title: "Nav Atlas",
    description: "按分类浏览 AI、设计、影视与高频工具网站。",
    type: "website",
    siteName: "Nav Atlas",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Nav Atlas 默认分享图"
      }
    ]
  },
  twitter: {
    card: "summary",
    title: "Nav Atlas",
    description: "按分类浏览 AI、设计、影视与高频工具网站。",
    images: ["/twitter-image.png"]
  }
};

const themeScript = `
  (function () {
    try {
      var path = window.location.pathname || "/";
      var isAdmin = path === "/admin" || path.indexOf("/admin/") === 0;
      var readCookie = function (name) {
        var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
        return match ? decodeURIComponent(match[1]) : null;
      };
      var saved = null;
      if (isAdmin) {
        saved = readCookie("admin_theme");
      } else {
        saved = window.localStorage.getItem("nav-theme");
      }
      var theme = saved === "dark" || saved === "light" ? saved : "light";
      document.documentElement.dataset.theme = theme;
    } catch (error) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetBrainsMono.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
