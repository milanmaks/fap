import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAP — File Analytics Platform & AI Chatbot",
  description:
    "Data-file analytics platform with versioned historical profiles and Gemini Flash AI Chatbot",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="sr">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
