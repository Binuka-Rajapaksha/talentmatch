import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ArrowLeft,
  Mail,
  Phone,
  Briefcase,
  Building2,
  Clock,
  FileText,
  Award,
} from "lucide-react";

export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      matches: {
        orderBy: { totalScore: "desc" },
        include: {
          job: true,
        },
      },
    },
  });

  if (!candidate) notFound();

  const workHistory = Array.isArray(candidate.workHistory)
    ? (candidate.workHistory as Array<{
      role?: string;
      company?: string;
      dates?: string;
    }>)
    : [];

  return (
    <div className="space-y-6">
      <Link
        href="/candidates"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Candidates
      </Link>

      {/* Extracted Profile Header */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-indigo-700">
              Candidate ID: #{candidate.id}
            </span>
            <h1 className="mt-1.5 text-2xl font-bold text-slate-900 sm:text-3xl">
              {candidate.name}
            </h1>
          </div>
          <div className="rounded-xl bg-slate-900 px-4 py-2 text-white">
            <span className="block text-[10px] uppercase tracking-wider text-slate-400">
              Total Experience
            </span>
            <span className="text-lg font-bold">
              {candidate.totalExperience} Years
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 text-slate-700">
            <Briefcase className="h-4 w-4 text-slate-400" />
            <span>
              <strong className="block text-xs text-slate-400">
                Current Designation
              </strong>
              {candidate.currentDesignation || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Building2 className="h-4 w-4 text-slate-400" />
            <span>
              <strong className="block text-xs text-slate-400">
                Current Company
              </strong>
              {candidate.currentCompany || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Mail className="h-4 w-4 text-slate-400" />
            <span>
              <strong className="block text-xs text-slate-400">Email</strong>
              {candidate.email || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-700">
            <Phone className="h-4 w-4 text-slate-400" />
            <span>
              <strong className="block text-xs text-slate-400">Phone</strong>
              {candidate.phone || "—"}
            </span>
          </div>
        </div>

        {/* Extracted Skills */}
        <div className="mt-5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Extracted Skills ({candidate.skills.length})
          </h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {candidate.skills.length > 0 ? (
              candidate.skills.map((sk) => (
                <span
                  key={sk}
                  className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {sk}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400">No skills listed</span>
            )}
          </div>
        </div>

        {/* Work History (Nice-to-Have) */}
        {workHistory.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Extracted Work History
            </h2>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {workHistory.map((w, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs"
                >
                  <p className="font-semibold text-slate-800">{w.role}</p>
                  <p className="text-slate-600">{w.company}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-slate-400">
                    <Clock className="h-3 w-3" />
                    {w.dates}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Best-Matching Jobs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <Award className="h-5 w-5 text-indigo-600" />
          Best-Matching Jobs ({candidate.matches.length})
        </h2>
        {candidate.matches.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            This candidate was not in the top shortlist for the 10 jobs yet, or
            matching has not been run.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {candidate.matches.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 p-4"
              >
                <div className="space-y-1">
                  <Link
                    href={`/jobs/${m.jobId}`}
                    className="font-bold text-indigo-600 hover:underline"
                  >
                    {m.job.title} (Job #{m.jobId})
                  </Link>
                  <p className="text-xs text-slate-600">{m.reason}</p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded bg-slate-100 px-2 py-1">
                    Skills: <strong>{m.skillsScore}/50</strong>
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1">
                    Exp: <strong>{m.experienceScore}/30</strong>
                  </span>
                  <span className="rounded bg-slate-100 px-2 py-1">
                    Role: <strong>{m.designationScore}/20</strong>
                  </span>
                  <span className="rounded-lg bg-indigo-600 px-3 py-1 font-bold text-white">
                    {m.totalScore}/100
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Raw CV Text */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <FileText className="h-5 w-5 text-slate-600" />
          Raw CV Text (File #{candidate.id})
        </h2>
        <pre className="mt-4 max-h-[500px] overflow-y-auto rounded-lg bg-slate-900 p-4 font-mono text-xs leading-relaxed text-slate-100 whitespace-pre-wrap">
          {candidate.rawText}
        </pre>
      </div>
    </div>
  );
}