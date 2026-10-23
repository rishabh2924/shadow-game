import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers/providers";
import { AppHeader } from "@/components/layout/app-header";

export const metadata: Metadata = {
  title: "Shadow Words — pass-and-play word deduction",
  description: "A local party game of hidden words and secret roles. Play on one shared device with your own word library.",
};

export const viewport: Viewport = { themeColor: "#070816", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppHeader />
          <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
