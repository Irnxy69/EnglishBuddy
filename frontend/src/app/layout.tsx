import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EnglishBuddy — AI English Speaking Practice",
  description:
    "Practice IELTS speaking, daily English, and job interviews with your AI partner Echo. Get real-time feedback and band score analysis.",
  keywords: ["IELTS", "English speaking", "AI practice", "language learning"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-grid">{children}</body>
    </html>
  );
}
