"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Filter,
  CheckCircle2,
  XCircle,
  Sliders,
  AlertCircle,
  Columns,
} from "lucide-react";

type MatchItem = {
  id: string;
  candidateId: string;
  totalScore: number;
  skillsScore: number;
  experienceScore: number;
  designationScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  reason: string;
  candidate: {
    id: string;
    name: string;
    currentDesignation: string | null;
    currentCompany: string | null;
    totalExperience: number;
    email: string | null;
  };
};

export default function JobMatchesClient({
  jobId,
  initialMatches,
}: {
  jobId: string;
  initialMatches: MatchItem[];
}) {
  const router = useRouter();
  const [minScore, setMinScore] = useState<number>(0);
  const [isRematching, setIsRematching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Adjustable weights (default 50 / 30 / 20)
  const [showWeights, setShowWeights] = useState(false);
  const [wSkills, setWSkills] = useState(50);
  const [wExp, setWExp] = useState(30);
  const [wDesig, setWDesig] = useState(20);

  // Side-by-side candidate comparison
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const toggleCompare = (cId: string) => {
    setCompareIds((prev) =>
      prev.includes(cId)
        ? prev.filter((id) => id !== cId)
        : prev.length < 2
        ? [...prev, cId]
        : [prev[1], cId]
    );
  };

  const handleRematch = async () => {
    setIsRematching(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/rematch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to re-run matching");
      router.refresh();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error running matcher");
    } finally {
      setIsRematching(false);
    }
  };

  const weightedMatches = useMemo(() => {
    const totalWeight = wSkills + wExp + wDesig || 100;
    return initialMatches
      .map((m) => {
        const normSkills = (m.skillsScore / 50) * wSkills;
        const normExp = (m.experienceScore / 30) * wExp;
        const normDesig = (m.designationScore / 20) * wDesig;
        const adjustedTotal = Math.round(
          ((normSkills + normExp + normDesig) / totalWeight) * 100
        );
        return { ...m, displayTotal: adjustedTotal };
      })
      .filter((m) => m.displayTotal >= minScore)
      .sort((a, b) => b.displayTotal - a.displayTotal || b.skillsScore - a.skillsScore);
  }, [initialMatches, minScore, wSkills, wExp, wDesig]);

  const comparedCandidates = useMemo(
    () => weightedMatches.filter((m) => compareIds.includes(m.candidateId)),
    [weightedMatches, compareIds]
  );

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700">
              Min Score: <strong className="text-indigo-600">{minScore}</strong>
            </label>
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="h-2 w-28 cursor-pointer accent-indigo-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowWeights(!showWeights)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
          >
            <Sliders className="h-3.5 w-3.5 text-indigo-600" />
            Adjust Weights ({wSkills}/{wExp}/{wDesig})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Showing <strong>{weightedMatches.length}</strong> of{" "}
            {initialMatches.length} scored candidates
          </span>

          <button
            type="button"
            onClick={handleRematch}
            disabled={isRematching}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRematching ? "animate-spin" : ""}`}
            />
            {isRematching ? "Re-scoring with AI..." : "Re-run Matching"}
          </button>
        </div>
      </div>

      {/* Custom Weights Drawer (Nice-to-Have) */}
      {showWeights && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-900">
              Custom Recruiter Scoring Weights
            </span>
            <button
              onClick={() => {
                setWSkills(50);
                setWExp(30);
                setWDesig(20);
              }}
              className="text-xs font-medium text-indigo-600 hover:underline"
            >
              Reset to Default (50 / 30 / 20)
            </button>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-700">
                Skills Weight: <strong>{wSkills}</strong>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={wSkills}
                onChange={(e) => setWSkills(Number(e.target.value))}
                className="mt-1 w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Experience Weight: <strong>{wExp}</strong>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={wExp}
                onChange={(e) => setWExp(Number(e.target.value))}
                className="mt-1 w-full accent-indigo-600"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700">
                Designation Weight: <strong>{wDesig}</strong>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                value={wDesig}
                onChange={(e) => setWDesig(Number(e.target.value))}
                className="mt-1 w-full accent-indigo-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Side-by-Side Comparison Modal/Panel (Nice-to-Have) */}
      {comparedCandidates.length === 2 && (
        <div className="rounded-xl border-2 border-indigo-500 bg-white p-5 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Columns className="h-4 w-4 text-indigo-600" />
              Side-by-Side Candidate Comparison
            </h3>
            <button
              onClick={() => setCompareIds([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Clear Comparison
            </button>
          </div>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            {comparedCandidates.map((c) => (
              <div key={c.candidateId} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/candidates/${c.candidateId}`}
                      className="font-bold text-indigo-600 hover:underline"
                    >
                      {c.candidate.name} (#{c.candidateId})
                    </Link>
                    <p className="text-xs text-slate-600">
                      {c.candidate.currentDesignation || "N/A"} at{" "}
                      {c.candidate.currentCompany || "N/A"} (
                      {c.candidate.totalExperience} yrs)
                    </p>
                  </div>
                  <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-sm font-bold text-white">
                    {c.displayTotal}/100
                  </span>
                </div>
                <p className="mt-2 text-xs italic text-slate-700">
                  &ldquo;{c.reason}&rdquo;
                </p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="rounded bg-white px-2 py-0.5 font-medium">
                    Skills: {c.skillsScore}/50
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 font-medium">
                    Exp: {c.experienceScore}/30
                  </span>
                  <span className="rounded bg-white px-2 py-0.5 font-medium">
                    Role: {c.designationScore}/20
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ranked Candidates List */}
      {initialMatches.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
          <p className="font-semibold">This job has not been matched yet.</p>
          <p className="mt-1 text-sm">
            Click &ldquo;Re-run Matching&rdquo; above or run{" "}
            <code className="rounded bg-amber-100 px-1.5 py-0.5">
              npx tsx scripts/match.ts
            </code>{" "}
            to generate ranked candidate matches.
          </p>
        </div>
      ) : weightedMatches.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-600">
          No candidates meet the minimum score filter of {minScore}. Lower the
          slider to view lower-scoring candidates.
        </div>
      ) : (
        <div className="space-y-3">
          {weightedMatches.map((m, idx) => (
            <div
              key={m.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-sm font-bold text-white">
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/candidates/${m.candidateId}`}
                        className="text-lg font-bold text-slate-900 hover:text-indigo-600 hover:underline"
                      >
                        {m.candidate.name}
                      </Link>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-medium text-slate-600">
                        ID: {m.candidateId}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleCompare(m.candidateId)}
                        className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                          compareIds.includes(m.candidateId)
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {compareIds.includes(m.candidateId)
                          ? "Comparing ✓"
                          : "+ Compare"}
                      </button>
                    </div>

                    <p className="mt-0.5 text-sm text-slate-600">
                      <strong>
                        {m.candidate.currentDesignation || "No Title Listed"}
                      </strong>
                      {m.candidate.currentCompany
                        ? ` at ${m.candidate.currentCompany}`
                        : ""}{" "}
                      · <span>{m.candidate.totalExperience} yrs total exp</span>
                    </p>
                  </div>
                </div>

                {/* Total & Factor Score Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <span>Skills:</span>
                    <strong className="text-slate-900">
                      {m.skillsScore}/50
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <span>Experience:</span>
                    <strong className="text-slate-900">
                      {m.experienceScore}/30
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <span>Designation:</span>
                    <strong className="text-slate-900">
                      {m.designationScore}/20
                    </strong>
                  </div>

                  <div
                    className={`ml-1 rounded-xl px-3.5 py-1.5 text-sm font-extrabold ${
                      m.displayTotal >= 75
                        ? "bg-emerald-600 text-white"
                        : m.displayTotal >= 50
                        ? "bg-amber-500 text-white"
                        : "bg-slate-200 text-slate-800"
                    }`}
                  >
                    {m.displayTotal} / 100
                  </div>
                </div>
              </div>

              {/* AI One-Line Reason */}
              <div className="mt-3 rounded-lg bg-indigo-50/60 px-3.5 py-2 text-sm text-slate-800">
                <span className="font-semibold text-indigo-900">Reason: </span>
                {m.reason}
              </div>

              {/* Matched & Missing Skills */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Matched Skills ({m.matchedSkills.length})
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.matchedSkills.length > 0 ? (
                      m.matchedSkills.map((sk) => (
                        <span
                          key={sk}
                          className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-600/20"
                        >
                          {sk}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-rose-700">
                    <XCircle className="h-3.5 w-3.5" />
                    Missing Skills ({m.missingSkills.length})
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.missingSkills.length > 0 ? (
                      m.missingSkills.map((sk) => (
                        <span
                          key={sk}
                          className="rounded bg-rose-50 px-2 py-0.5 text-xs text-rose-700 ring-1 ring-rose-600/15"
                        >
                          {sk}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-emerald-600">
                        All required skills matched!
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}