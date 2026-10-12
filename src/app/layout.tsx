import type { Metadata } from "next";
import "./globals.css";
import { SessionGate } from "@/components/auth/session-gate";
import { MockProvider } from "@/mocks/provider";

export const metadata: Metadata = {
  title: { default: "ClassForge", template: "%s · ClassForge" },
  description: "Multi-tenant school ERP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">
        <MockProvider>
          <SessionGate>{children}</SessionGate>
        </MockProvider>
      </body>
    </html>
  );
}