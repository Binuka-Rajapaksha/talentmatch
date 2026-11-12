import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();
const prisma = new PrismaClient();

const DATA_DIR = process.env.DATA_DIR || "./local_data";
const QUERIES_DIR = path.join(DATA_DIR, "queries");
const CORPUS_DIR = path.join(DATA_DIR, "corpus");

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseSingleDate(str: string, isEnd: boolean): number | null {
  const s = str.trim().toLowerCase();
  const now = new Date();
  if (
    s === "present" ||
    s === "current" ||
    s === "now" ||
    s === "till date" ||
    s === "ongoing"
  ) {
    return now.getFullYear() * 12 + now.getMonth();
  }
  const monthYear = s.match(/^([a-z]+)\.?\s+(\d{4})$/i);
  if (monthYear) {
    const m = MONTHS[monthYear[1].toLowerCase()];
    const y = parseInt(monthYear[2], 10);
    if (m !== undefined && !isNaN(y)) return y * 12 + m;
  }
  const numMonthYear = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (numMonthYear) {
    const m = parseInt(numMonthYear[1], 10) - 1;
    const y = parseInt(numMonthYear[2], 10);
    return y * 12 + m;
  }
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) {
    const y = parseInt(yearOnly[1], 10);
    return y * 12 + (isEnd ? 11 : 0);
  }
  return null;
}

const DATE_RANGE_REGEX =
  /^((?:[A-Za-z]+\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}))\s*(?:[-–—]|to)\s*((?:[A-Za-z]+\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current|Now|Ongoing))$/i;

function isSectionHeader(line: string): string | null {
  const clean = line.replace(/[:\-_]/g, "").trim().toUpperCase();
  const map: Record<string, string> = {
    "PROFESSIONAL EXPERIENCE": "EXPERIENCE",
    "WORK EXPERIENCE": "EXPERIENCE",
    "EXPERIENCE": "EXPERIENCE",
    "EMPLOYMENT HISTORY": "EXPERIENCE",
    "WORK HISTORY": "EXPERIENCE",
    "CAREER HISTORY": "EXPERIENCE",
    "EDUCATION": "EDUCATION",
    "ACADEMIC BACKGROUND": "EDUCATION",
    "QUALIFICATIONS": "EDUCATION",
    "SKILLS": "SKILLS",
    "TECHNICAL SKILLS": "SKILLS",
    "CORE COMPETENCIES": "SKILLS",
    "KEY SKILLS": "SKILLS",
    "AREAS OF EXPERTISE": "SKILLS",
    "OBJECTIVE": "OTHER",
    "CAREER OBJECTIVE": "OTHER",
    "PROFESSIONAL SUMMARY": "OTHER",
    "SUMMARY": "OTHER",
    "PROFILE": "OTHER",
    "CERTIFICATIONS": "OTHER",
    "LICENSES & CERTIFICATIONS": "OTHER",
    "LANGUAGES": "OTHER",
    "HOBBIES": "OTHER",
    "INTERESTS": "OTHER",
    "PROFESSIONAL AFFILIATIONS": "OTHER",
    "AFFILIATIONS": "OTHER",
    "AWARDS": "OTHER",
    "PROJECTS": "OTHER",
  };
  return map[clean] || null;
}

// Helper to detect whether a short line above a date range is a standalone location (e.g. "Sydney, NSW" or "Cairo, Egypt")
function looksLikeLocationOnly(line: string): boolean {
  if (!line || line.length > 45) return false;
  // Role/Company indicators mean it is NOT just a location
  if (
    /\b(engineer|manager|director|analyst|teacher|instructor|cashier|cleaner|housekeeper|paralegal|associate|specialist|officer|consultant|intern|lead|head|coordinator|supervisor|clerk|tutor|inc\.?|ltd\.?|llc|corp\.?|group|solutions|systems|services|company|hospital|bank|university|institute|school|market|store|hotel)\b/i.test(
      line
    )
  ) {
    return false;
  }
  // Matches "City, State/Country" pattern
  return /^[A-ZÀ-Ž][A-Za-zÀ-ž\s.-]+,\s*[A-ZÀ-Ž][A-Za-zÀ-ž\s.-]+$/.test(line.trim());
}

/**
 * Step 1 Job Parser
 */
function parseJobFile(id: string, raw: string) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const nonEmpty = lines.filter((l) => l.length > 0);
  let title = nonEmpty[0] || "";

  // Handle jobs where the first line is a full sentence
  if (title.length > 60 || /^we are seeking/i.test(title)) {
    const m = title.match(/We are seeking an?\s+(.+?)\s+to join/i);
    if (m) {
      title = m[1].trim();
    }
  }

  const requiredSkills: string[] = [];
  let inSkills = false;
  for (const line of lines) {
    if (
      /^(?:About\s+)?Required Skills:?$/i.test(line) ||
      /^Skills Required:?$/i.test(line)
    ) {
      inSkills = true;
      continue;
    }
    if (inSkills) {
      if (
        /^(?:What You Will Do|What We Offer|About the Role|How to Apply|Equal Opportunity|Responsibilities|Qualifications)/i.test(
          line
        )
      ) {
        break;
      }
      if (line.startsWith("-") || line.startsWith("•") || line.startsWith("*")) {
        const sk = line.replace(/^[-•*]\s*/, "").trim();
        if (sk) requiredSkills.push(sk);
      }
    }
  }

  return {
    id,
    title,
    description: raw,
    requiredSkills,
  };
}

function parseCandidateFile(id: string, raw: string) {
  const rawLines = raw.split(/\r?\n/).map((l) => l.trim());
  const lines = rawLines.filter((l) => l !== "---" && l !== "___");
  const nonEmpty = lines.filter((l) => l.length > 0);

  // Assuming the first line of CV is Name
  const name = nonEmpty[0] || "";

  const headerBlock = nonEmpty.slice(1, 8).join(" \n ");
  const emailMatch = headerBlock.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const email = emailMatch ? emailMatch[0].trim() : null;

  let phone: string | null = null;
  for (const hLine of nonEmpty.slice(1, 7)) {
    const parts = hLine.split("|").map((p) => p.trim());
    for (const part of parts) {
      if (part.includes("@") || /linkedin\.com/i.test(part)) continue;
      const phoneMatch = part.match(/(\+?\d[\d\s().-]{7,18}\d)/);
      if (phoneMatch) {
        phone = phoneMatch[1].trim();
        break;
      }
    }
    if (phone) break;
  }

  let currentSection = "HEADER";
  const sectionLines: Record<string, string[]> = {
    EXPERIENCE: [],
    SKILLS: [],
    EDUCATION: [],
  };

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const sec = isSectionHeader(line);
    if (sec) {
      currentSection = sec;
      continue;
    }
    if (sectionLines[currentSection]) {
      sectionLines[currentSection].push(line);
    }
  }

  const expLines = sectionLines.EXPERIENCE;
  let currentDesignation: string | null = null;
  let currentCompany: string | null = null;
  const intervals: [number, number][] = [];
  const workHistory: Array<{ role: string; company: string; dates: string }> = [];

  for (let i = 0; i < expLines.length; i++) {
    const line = expLines[i];
    const m = line.match(DATE_RANGE_REGEX);
    if (m) {
      const start = parseSingleDate(m[1], false);
      const end = parseSingleDate(m[2], true);
      if (start !== null && end !== null && end >= start) {
        intervals.push([start, end]);
      }

      const prev1 = i >= 1 ? expLines[i - 1] : null;
      const prev2 = i >= 2 ? expLines[i - 2] : null;
      const prev3 = i >= 3 ? expLines[i - 3] : null;

      let role = "";
      let company = "";

      // Case 1: 4-line header where prev1 is a standalone Location line (Role -> Company -> Location -> Date)
      if (
        prev1 &&
        looksLikeLocationOnly(prev1) &&
        prev2 &&
        prev3 &&
        !prev3.startsWith("-") &&
        !prev3.startsWith("•") &&
        prev3.length < 90
      ) {
        role = prev3;
        company = prev2.split(/,|\s+[-–]\s+/)[0].trim();
      }
      // Case 2: Standard 3-line header (Role -> Company, Location -> Date)
      else if (
        prev2 &&
        !prev2.startsWith("-") &&
        !prev2.startsWith("•") &&
        prev2.length < 90 &&
        !DATE_RANGE_REGEX.test(prev2)
      ) {
        role = prev2;
        company = prev1 ? prev1.split(/,|\s+[-–]\s+/)[0].trim() : "";
      }
      // Case 3: Combined 1-line header before Date (e.g., "Cashier - Tesco Extra")
      else if (prev1 && !prev1.startsWith("-") && !prev1.startsWith("•")) {
        const parts = prev1.split(/\s+[-–|@]\s+/);
        role = parts[0]?.trim() || "";
        company = parts[1]?.split(",")[0]?.trim() || "";
      }

      if (!currentDesignation && role) currentDesignation = role;
      if (!currentCompany && company) currentCompany = company;
      if (role || company) {
        workHistory.push({ role, company, dates: line });
      }
    }
  }

  // Merge overlapping role date intervals so concurrent roles are counted once
  let totalMonths = 0;
  if (intervals.length > 0) {
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [intervals[0]];
    for (let i = 1; i < intervals.length; i++) {
      const last = merged[merged.length - 1];
      const curr = intervals[i];
      if (curr[0] <= last[1] + 1) {
        last[1] = Math.max(last[1], curr[1]);
      } else {
        merged.push(curr);
      }
    }
    for (const [s, e] of merged) {
      totalMonths += e - s + 1;
    }
  }
  const totalExperience = Math.round((totalMonths / 12) * 10) / 10;

  const skillsSet = new Set<string>();
  for (const sLine of sectionLines.SKILLS) {
    let cleaned = sLine.replace(/^[-•*]\s*/, "").trim();
    if (!cleaned) continue;
    if (cleaned.includes(":") && !cleaned.includes("|")) {
      cleaned = cleaned.split(":").slice(1).join(":").trim();
    }
    if (/[,|;]/.test(cleaned)) {
      for (const item of cleaned.split(/[,|;]/)) {
        const sk = item.trim();
        if (sk) skillsSet.add(sk);
      }
    } else {
      skillsSet.add(cleaned);
    }
  }

  return {
    id,
    name,
    email,
    phone,
    currentDesignation,
    currentCompany,
    totalExperience,
    skills: Array.from(skillsSet),
    rawText: raw,
    workHistory,
    education: sectionLines.EDUCATION,
  };
}

async function main() {
  console.log("Starting TalentMatch Data Import...");

  const jobFiles = fs.readdirSync(QUERIES_DIR).filter((f) => !f.startsWith("."));
  for (const file of jobFiles) {
    const raw = fs.readFileSync(path.join(QUERIES_DIR, file), "utf8");
    const job = parseJobFile(file, raw);
    await prisma.job.upsert({
      where: { id: job.id },
      update: job,
      create: job,
    });
    console.log(
      `  Job [${job.id}] "${job.title}" | Required Skills: ${job.requiredSkills.length}`
    );
  }

  const cvFiles = fs.readdirSync(CORPUS_DIR).filter((f) => !f.startsWith("."));
  const parsedCandidates = cvFiles.map((file) => {
    const raw = fs.readFileSync(path.join(CORPUS_DIR, file), "utf8");
    return parseCandidateFile(file, raw);
  });

  const BATCH_SIZE = 50;
  for (let i = 0; i < parsedCandidates.length; i += BATCH_SIZE) {
    const batch = parsedCandidates.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((c) =>
        prisma.candidate.upsert({
          where: { id: c.id },
          update: c,
          create: c,
        })
      )
    );
    process.stdout.write(
      `\r  Imported ${Math.min(i + BATCH_SIZE, parsedCandidates.length)}/${parsedCandidates.length} CVs...`
    );
  }
  console.log("\nData Import Complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());