import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "veille_ | ta veille tech en une phrase",
  description:
    "Dis a l'IA ce qui t'interesse. Elle s'occupe du reste. Articles, scores, notifs Discord.",
  manifest: "/veille/manifest.json",
  icons: {
    icon: "/veille/icon.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#8B7CF7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased min-h-[100dvh]">
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>
              <div className="animate-page-in">
                <AppShell>{children}</AppShell>
              </div>
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
