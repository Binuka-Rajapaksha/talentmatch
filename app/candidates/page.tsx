import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Search, User, Briefcase, Award } from "lucide-react";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();

  const candidates = await prisma.candidate.findMany({
    where: query
      ? {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { currentDesignation: { contains: query, mode: "insensitive" } },
          { currentCompany: { contains: query, mode: "insensitive" } },
          { rawText: { contains: query, mode: "insensitive" } },
        ],
      }
      : undefined,
    orderBy: { id: "asc" },
    take: 100,
    include: {
      matches: {
        orderBy: { totalScore: "desc" },
        take: 1,
        include: {
          job: { select: { id: true, title: true } },
        },
      },
    },
  });

  const totalCount = await prisma.candidate.count();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-400 sm:text-3xl">
            Candidate Directory ({totalCount} CVs)
          </h1>
          <p className="mt-1 text-sm text-slate-200">
            Search across all loaded candidate profiles by Candidate ID, Name,
            Designation, Employer, or Skill keywords.
          </p>
        </div>

        <form action="/candidates" method="GET" className="flex w-full sm:w-96">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search ID (e.g. 10004), name, title, skill..."
              className="w-full rounded-l-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-r-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Search
          </button>
        </form>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          No candidates matched &ldquo;{query}&rdquo;.{" "}
          <Link href="/candidates" className="text-indigo-600 underline">
            Clear search
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {candidates.map((c) => {
            const bestMatch = c.matches[0];
            return (
              <Link
                key={c.id}
                href={`/candidates/${c.id}`}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <h2 className="font-bold text-slate-900">{c.name}</h2>
                        <span className="font-mono text-xs text-slate-500">
                          ID: #{c.id}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {c.totalExperience} yrs
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span className="truncate">
                      {c.currentDesignation || "No designation"}
                      {c.currentCompany ? ` · ${c.currentCompany}` : ""}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {c.skills.slice(0, 4).map((sk) => (
                      <span
                        key={sk}
                        className="truncate rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        {sk}
                      </span>
                    ))}
                    {c.skills.length > 4 && (
                      <span className="text-[11px] text-slate-400">
                        +{c.skills.length - 4}
                      </span>
                    )}
                  </div>
                </div>

                {bestMatch && (
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
                    <span className="truncate text-slate-500">
                      Best fit: <strong>{bestMatch.job.title}</strong>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-bold text-indigo-600">
                      <Award className="h-3.5 w-3.5" />
                      {bestMatch.totalScore}/100
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}