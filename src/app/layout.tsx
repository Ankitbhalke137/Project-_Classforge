import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SessionGate } from "@/components/auth/session-gate";
import { MockProvider } from "@/mocks/provider";

export const metadata: Metadata = {
  title: { default: "ClassForge", template: "%s · ClassForge" },
  description: "Multi-tenant school ERP.",
};

/**
 * The design system's one typeface. Self-hosted by next/font, so there is no
 * render-blocking request to Google at runtime and no layout shift.
 */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} h-full`}>
      <body className="flex min-h-full flex-col font-sans">
        <MockProvider>
          <SessionGate>{children}</SessionGate>
        </MockProvider>
      </body>
    </html>
  );
}