import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/fleet/AppShell";
import { AuthProvider } from "@/components/fleet/AuthProvider";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "ACEDFleet Management",
  description: "Mobile-first fleet management dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Space+Grotesk:wght@300..700&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <Suspense fallback={<div className="flex h-screen w-full items-center justify-center bg-[var(--canvas)]"><div className="text-[var(--steel)]">Loading Application...</div></div>}>
            <AppShell>
              {children}
            </AppShell>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
