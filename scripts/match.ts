import fs from "fs";
import path from "path";
import { PrismaClient, Job, Candidate } from "@prisma/client";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SHORTLIST_SIZE = 35; // (Given range: 30-50)
const BATCH_SIZE = 5;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Getting expected years of experience from the job title & description
 * and generates domain synonyms for Stage 1 shortlisting.
 */
async function inferJobExpectationsWithAgent(job: Job): Promise<{
  expectedYears: number;
  searchSynonyms: string[];
}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "job_inference",
        strict: true,
        schema: {
          type: "object",
          properties: {
            expectedYears: { type: "number" },
            searchSynonyms: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["expectedYears", "searchSynonyms"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content: `You are the TalentMatch AI Matching Agent.
Jobs do not state a minimum years of experience. Infer the expected years from the job title and description:
- Entry-level frontline roles (e.g., Cashier, Housekeeping Cleaner): 1 year
- Certified / operational roles (e.g., Teacher, Mortgage Loan Closer): 2 years
- Mid-level professional / technical roles (e.g., Data Analyst, Failure Analysis Engineer, Paralegal): 3 years
- Management / Regional roles (e.g., Regional Facilities Manager): 5 years
- Senior technical roles (e.g., Senior Mechanical/HVAC Engineer): 6 years
- Director / Executive roles (e.g., Sales Director): 8 years

Also provide 10-12 lowercase domain keywords, abbreviations, and alternative role titles ("searchSynonyms") to help shortlist relevant CVs for this role.

Job Title: ${job.title}
Required Skills: ${JSON.stringify(job.requiredSkills)}
Job Description:
${job.description}`,
      },
    ],
  });

  const parsed = JSON.parse(
    response.choices[0].message.content ||
    '{"expectedYears": 2, "searchSynonyms": []}'
  );
  return {
    expectedYears: Math.max(1, Math.min(15, Number(parsed.expectedYears) || 2)),
    searchSynonyms: (parsed.searchSynonyms || []).map((s: string) =>
      s.toLowerCase()
    ),
  };
}

// Fast pass over all 472 candidates to pick top candidates per job.
function shortlistCandidates(
  job: Job,
  synonyms: string[],
  candidates: Candidate[],
  topK: number
): Candidate[] {
  const jobTitleTokens = tokenize(job.title);
  const jobSkillTokens = tokenize(job.requiredSkills.join(" "));

  const scored = candidates.map((c) => {
    const designationLower = (c.currentDesignation || "").toLowerCase();
    const skillsLower = c.skills.join(" ").toLowerCase();
    const rawLower = c.rawText.toLowerCase();

    let score = 0;

    for (const t of jobTitleTokens) {
      if (designationLower.includes(t)) score += 15;
      else if (rawLower.includes(t)) score += 3;
    }

    for (const reqSkill of job.requiredSkills) {
      const reqLower = reqSkill.toLowerCase();
      if (skillsLower.includes(reqLower)) score += 10;
      else if (rawLower.includes(reqLower)) score += 5;
    }

    for (const t of jobSkillTokens) {
      if (skillsLower.includes(t)) score += 2;
    }

    for (const syn of synonyms) {
      if (designationLower.includes(syn)) score += 12;
      if (skillsLower.includes(syn)) score += 6;
      else if (rawLower.includes(syn)) score += 2;
    }

    return { candidate: c, preScore: score };
  });

  scored.sort((a, b) => b.preScore - a.preScore);
  return scored.slice(0, topK).map((s) => s.candidate);
}

// Evaluates shortlisted candidates on the 50/30/20 rubric.
async function scoreBatchWithLLM(
  job: Job,
  expectedYears: number,
  batch: Candidate[]
) {
  const prompt = `You are the TalentMatch AI Matching Agent for an executive search firm.
Evaluate each candidate against the target job strictly using the 50/30/20 scoring rubric.

TARGET JOB:
- Job ID: ${job.id}
- Job Title: ${job.title}
- Inferred Expected Experience: ${expectedYears} years
- Required Skills List (${job.requiredSkills.length} total): ${JSON.stringify(job.requiredSkills)}
- Job Description:
${job.description}

SCORING RUBRIC:
1. Skills (50 points max — determined from matchedSkills):
   - Compare the job's Required Skills List against the candidate's skills AND full work history in rawCvText.
   - Count equivalent wording and demonstrated duties as a match (e.g., "POS Systems Operation" and "POS" or "Scanning and Checkout Systems"; "Extract, Transform, Load" and "ETL").
   - Do NOT force or hallucinate matches: if a required skill specifies a specialized exam/certification (e.g., "IELTS") or industry domain (e.g., "Healthcare") that is completely absent from the CV, do NOT match it.
   - Return inside "matchedSkills" ONLY exact strings from the Job's Required Skills List.

2. Experience (30 points max):
   - Compare the candidate's years of experience against the job's expected years (${expectedYears} years).
   - Full 30 points if the candidate has at or above ${expectedYears} years of relevant experience; fewer points the further below ${expectedYears} years they are.
   - If the candidate's experience is only partially related (e.g., general ESL teaching when specialized exam prep is required), scale experienceScore proportionally (18-22 points). If completely unrelated, give 0-6 points.

3. Current Designation (20 points max):
   - Compare the candidate's most recent job title in rawCvText against the Job Title ("${job.title}").
   - 18-20 points for the same or a very similar role.
   - 10-15 points for a related role in the same field (or when the job title specifies a specialization like "IELTS Teacher" and the candidate is a general "English Teacher").
   - 0-4 points for an unrelated role.

4. verifiedCurrentRole & domainSummary:
   - "verifiedCurrentRole": The candidate's actual most recent job title read directly from rawCvText (never a company name or city).
   - "domainSummary": A concise 3-6 word description of their relevant background (e.g., "retail & checkout experience").

CANDIDATES TO EVALUATE:
${batch
      .map(
        (c, idx) => `--- CANDIDATE ${idx + 1} ---
candidateId: "${c.id}"
name: "${c.name}"
parsedDesignation: "${c.currentDesignation || "Unspecified"}"
totalExperienceYears: ${c.totalExperience}
extractedSkills: ${JSON.stringify(c.skills)}
rawCvText:
${c.rawText.slice(0, 3500)}
`
      )
      .join("\n")}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "batch_match_results",
        strict: true,
        schema: {
          type: "object",
          properties: {
            results: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  candidateId: { type: "string" },
                  matchedSkills: { type: "array", items: { type: "string" } },
                  experienceScore: { type: "integer" },
                  designationScore: { type: "integer" },
                  verifiedCurrentRole: { type: "string" },
                  domainSummary: { type: "string" },
                },
                required: [
                  "candidateId",
                  "matchedSkills",
                  "experienceScore",
                  "designationScore",
                  "verifiedCurrentRole",
                  "domainSummary",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["results"],
          additionalProperties: false,
        },
      },
    },
    messages: [{ role: "user", content: prompt }],
  });

  const parsed = JSON.parse(
    response.choices[0].message.content || '{"results":[]}'
  );
  return parsed.results as Array<{
    candidateId: string;
    matchedSkills: string[];
    experienceScore: number;
    designationScore: number;
    verifiedCurrentRole: string;
    domainSummary: string;
  }>;
}

export async function matchSingleJob(jobId: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`Job ${jobId} not found`);

  // 1. ExpectedYears and domain search synonyms from job title & description
  const { expectedYears, searchSynonyms } =
    await inferJobExpectationsWithAgent(job);

  await prisma.job.update({
    where: { id: job.id },
    data: { expectedYears },
  });

  // 2. Shortlist top 35 candidates
  const allCandidates = await prisma.candidate.findMany();
  const candidateMap = new Map(allCandidates.map((c) => [c.id, c]));
  const shortlisted = shortlistCandidates(
    job,
    searchSynonyms,
    allCandidates,
    SHORTLIST_SIZE
  );

  await prisma.match.deleteMany({ where: { jobId: job.id } });

  console.log(
    `\nMatching Job [${job.id}] "${job.title}" | Inferred Expected Yrs: ${expectedYears} | Shortlisted ${shortlisted.length}/${allCandidates.length} CVs`
  );

  for (let i = 0; i < shortlisted.length; i += BATCH_SIZE) {
    const batch = shortlisted.slice(i, i + BATCH_SIZE);
    const llmResults = await scoreBatchWithLLM(job, expectedYears, batch);

    for (const item of llmResults) {
      const cand = candidateMap.get(item.candidateId);
      if (!cand) continue;

      const matchedSet = new Set(
        item.matchedSkills.map((s) => s.trim().toLowerCase())
      );

      const canonicalMatched: string[] = [];
      const canonicalMissing: string[] = [];

      for (const reqSkill of job.requiredSkills) {
        if (matchedSet.has(reqSkill.toLowerCase())) {
          canonicalMatched.push(reqSkill);
        } else {
          canonicalMissing.push(reqSkill);
        }
      }

      const totalReq = job.requiredSkills.length || 1;
      const skillsScore = Math.round((canonicalMatched.length / totalReq) * 50);

      // Enforce upper bound if candidate's totalExperience is below expectedYears
      const maxExpScoreByYears =
        cand.totalExperience >= expectedYears
          ? 30
          : Math.round((cand.totalExperience / expectedYears) * 30);

      const experienceScore = Math.max(
        0,
        Math.min(30, maxExpScoreByYears, item.experienceScore)
      );
      const designationScore = Math.max(
        0,
        Math.min(20, item.designationScore)
      );

      const totalScore = skillsScore + experienceScore + designationScore;

      const currentRole =
        item.verifiedCurrentRole || cand.currentDesignation || "Unspecified";
      const summaryClean = item.domainSummary.replace(/\.$/, "").trim();
      const reason = `Has ${canonicalMatched.length} of ${totalReq} required skills and ${cand.totalExperience} years' experience (${summaryClean}); currently ${currentRole}.`;

      await prisma.match.create({
        data: {
          jobId: job.id,
          candidateId: cand.id,
          totalScore,
          skillsScore,
          experienceScore,
          designationScore,
          matchedSkills: canonicalMatched,
          missingSkills: canonicalMissing,
          reason,
        },
      });
    }
    process.stdout.write(
      `  Scored ${Math.min(i + BATCH_SIZE, shortlisted.length)}/${shortlisted.length}\r`
    );
  }
}

export async function exportTop10Csv() {
  const jobs = await prisma.job.findMany({ orderBy: { id: "asc" } });
  const resultsDir = path.join(process.cwd(), "results");
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const csvRows: string[] = [
    "job_id,rank,candidate_id,total_score,skills_score,experience_score,designation_score,reason",
  ];

  for (const job of jobs) {
    const topMatches = await prisma.match.findMany({
      where: { jobId: job.id },
      orderBy: [
        { totalScore: "desc" },
        { skillsScore: "desc" },
        { designationScore: "desc" },
      ],
      take: 10,
    });

    topMatches.forEach((m, idx) => {
      const escapedReason = `"${m.reason.replace(/"/g, '""')}"`;
      csvRows.push(
        `${job.id},${idx + 1},${m.candidateId},${m.totalScore},${m.skillsScore},${m.experienceScore},${m.designationScore},${escapedReason}`
      );
    });
  }

  const csvPath = path.join(resultsDir, "top10.csv");
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");
  console.log(`\nExported top 10 matches for all jobs to ${csvPath}`);
}

async function main() {
  const jobs = await prisma.job.findMany({ orderBy: { id: "asc" } });
  for (const job of jobs) {
    await matchSingleJob(job.id);
  }
  await exportTop10Csv();
}

const isDirectRun = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("scripts/match.ts");

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}