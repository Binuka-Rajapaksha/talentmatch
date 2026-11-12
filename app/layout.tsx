import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase, Users, Sparkles } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "TalentMatch – AI Candidate Matching Engine",
  description: "Executive search AI candidate ranking across 10 target roles",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
            <Link href="/jobs" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  TalentMatch
                </span>
                <span className="ml-2 hidden rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 sm:inline-block">
                  AI Matching Agent
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/jobs"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-600"
              >
                <Briefcase className="h-4 w-4" />
                <span>Jobs (10)</span>
              </Link>
              <Link
                href="/candidates"
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-indigo-600"
              >
                <Users className="h-4 w-4" />
                <span>Candidates</span>
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}