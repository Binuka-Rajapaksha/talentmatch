import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Briefcase, Clock, ChevronRight, Award } from "lucide-react";

export default async function JobsPage() {
    const jobs = await prisma.job.findMany({
        orderBy: { id: "asc" },
        include: {
            matches: {
                orderBy: { totalScore: "desc" },
                take: 1,
            },
            _count: {
                select: { matches: true },
            },
        },
    });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-400 sm:text-3xl">
                    Open Positions
                </h1>
                <p className="mt-1 text-sm text-slate-200">
                    Select a job opening to inspect AI-ranked candidates, factor score
                    breakdowns (50/30/20), and semantic skill matches.
                </p>
            </div>

            {jobs.length === 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
                    <p className="font-semibold">No jobs found in database.</p>
                    <p className="mt-1 text-sm">
                        Run <code className="rounded bg-amber-100 px-1.5 py-0.5">npx tsx scripts/import.ts</code> to load the 10 job descriptions and CVs.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                    {jobs.map((job) => {
                        const topScore = job.matches[0]?.totalScore ?? null;
                        return (
                            <Link
                                key={job.id}
                                href={`/jobs/${job.id}`}
                                className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                                                Job #{job.id}
                                            </span>
                                            <h2 className="mt-1.5 text-lg font-semibold text-slate-900 group-hover:text-indigo-600">
                                                {job.title}
                                            </h2>
                                        </div>

                                        {topScore !== null ? (
                                            <div className="flex flex-col items-end">
                                                <span
                                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${topScore >= 75
                                                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                                                            : topScore >= 50
                                                                ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20"
                                                                : "bg-slate-100 text-slate-700"
                                                        }`}
                                                >
                                                    <Award className="h-3.5 w-3.5" />
                                                    Top Fit: {topScore}/100
                                                </span>
                                                <span className="mt-1 text-xs text-slate-500">
                                                    {job._count.matches} ranked
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                                                Not matched yet
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                                        <span className="inline-flex items-center gap-1">
                                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                                            Expected: <strong>{job.expectedYears}+ yrs</strong>
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                                            Required Skills: <strong>{job.requiredSkills.length}</strong>
                                        </span>
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {job.requiredSkills.slice(0, 5).map((skill) => (
                                            <span
                                                key={skill}
                                                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                        {job.requiredSkills.length > 5 && (
                                            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs text-slate-500">
                                                +{job.requiredSkills.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 text-xs font-medium text-indigo-600">
                                    <span>View Ranked Candidates</span>
                                    <ChevronRight className="ml-1 h-4 w-4 transition group-hover:translate-x-0.5" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}