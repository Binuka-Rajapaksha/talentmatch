import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Clock, FileText } from "lucide-react";
import JobMatchesClient from "./JobMatchesClient";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: [{ totalScore: "desc" }, { skillsScore: "desc" }],
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              currentDesignation: true,
              currentCompany: true,
              totalExperience: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!job) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/jobs"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to all jobs
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-700">
                Job ID: {job.id}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-700">
                <Clock className="h-3.5 w-3.5 text-indigo-600" />
                Inferred Expected Experience: <strong>{job.expectedYears} years</strong>
              </span>
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {job.title}
            </h1>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Required Skills ({job.requiredSkills.length})
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {job.requiredSkills.map((sk) => (
              <span
                key={sk}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {sk}
              </span>
            ))}
          </div>
        </div>

        <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
            <FileText className="h-4 w-4 text-slate-500" />
            View Full Job Description
          </summary>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-700">
            {job.description}
          </pre>
        </details>
      </div>

      <JobMatchesClient jobId={job.id} initialMatches={job.matches} />
    </div>
  );
}