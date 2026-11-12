# TalentMatch – AI Candidate Matching Engine

TalentMatch is a full-stack recruitment web application built with Next.js, TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL (Neon), and OpenAI (`gpt-4o-mini`). It ranks candidate CVs against job openings using an explainable **50 / 30 / 20** factor scoring model (Skills: 50, Experience: 30, Current Designation: 20) and provides recruiters with factor score breakdowns, semantic skill equivalence matching, matched and missing skill tags, adjustable scoring weights, and side-by-side candidate comparison.

---

## 1. How to Run Locally & Run the Import

### Prerequisites
- Node.js 18+
- PostgreSQL database (hosted on Neon.tech or local)
- OpenAI API Key

### Local Setup Steps

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/Binuka-Rajapaksha/talentmatch.git
   cd talentmatch
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your PostgreSQL connection string, OpenAI API key, and local data folder path:
   ```bash
   cp .env.example .env
   ```
   Example `.env` configuration:
   ```env
   DATABASE_URL="postgresql://user:password@host:5432/talentmatch?sslmode=require"
   OPENAI_API_KEY="sk-your-openai-api-key"
   DATA_DIR="./local_data"
   ```

3. **Place the dataset folders locally:**
   Put the provided `corpus/` and `queries/` folders inside `./local_data/corpus` and `./local_data/queries` (or update `DATA_DIR` in `.env` to point to their parent directory). As required, neither the raw data folders nor `.env` are committed to the repository.

4. **Push the Prisma database schema:**
   ```bash
   npx prisma db push
   ```

5. **Run the data import script (Step 1):**
   Loads all 10 job descriptions from `queries/` and all 472 candidate CVs from `corpus/` into PostgreSQL:
   ```bash
   npm run import
   # or: npx tsx scripts/import.ts
   ```

6. **Run the AI matching agent (Step 2):**
   Infers expected years of experience, shortlists and scores candidates across all 10 jobs, saves matches to PostgreSQL, and exports `results/top10.csv`:
   ```bash
   npm run match
   # or: npx tsx scripts/match.ts
   ```

7. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. How CV & Job Details Were Extracted

### Dataset Coverage
- **All 472 CVs** from `corpus/` and **all 10 job descriptions** from `queries/` were loaded and evaluated (no reduced subset was used).
- **Candidate ID Hygiene:** Because the 472 CVs share only 242 unique names and emails, the exact file name (e.g., `10004`, `67`) is strictly used as the candidate primary key (`id`) across the database, matching pipeline, and web UI.

### CV Extraction (`scripts/import.ts`)
- **Name & Contact Details:** The first non-empty line is extracted as the candidate's name. Email addresses and international phone numbers are parsed from the top contact block using regular expressions while filtering out postal codes and LinkedIn URLs.
- **Handling Missing Fields:** If any field (such as phone, email, current designation, or current company) is absent from a CV, it is stored as `null` or empty and never fabricated.
- **Current Designation & Employer:** Section headers (`PROFESSIONAL EXPERIENCE`, `Work Experience`, `EMPLOYMENT HISTORY`, etc.) are normalized into logical buckets. The parser detects both 3-line role headers (`Role Title` -> `Company, Location` -> `Date Range`) and 4-line role headers (`Role Title` -> `Company` -> `Standalone Location` -> `Date Range`) so the most recent job title and employer are captured accurately across varying CV layouts.
- **Total Experience (Merged Date Intervals):** Role date ranges across formats (`January 2021 – Present`, `06/2018 - 12/2020`, `2014 - 2017`) are converted into month indices (`year * 12 + month`), with `"Present"` resolved to the current month. All intervals for a candidate are sorted and merged mathematically before summing months so overlapping or concurrent roles are counted only once.
- **Skills & Work History:** Skills are parsed from bulleted, comma-separated, and pipe-separated (`|`) lists while stripping category prefixes (such as `Electrical Design & Engineering:`). Structured work history roles and education entries are also saved as JSON for display on candidate profile pages.

### Job Extraction (`scripts/import.ts`)
- Extracts the job ID (file name), title, full raw description, and required skills list across varying section headers (`Required Skills`, `About Required Skills`).
- Handles layouts without a standalone title header (such as Job `46795`, where `"Paralegal, Privacy and Information Management"` is extracted from the opening sentence).

---

## 3. How the Matching Agent Works

Evaluating 472 CVs across 10 jobs equals 4,720 candidate-job pairs. To avoid slow execution and free-tier LLM rate limits while maintaining accuracy across all 472 CVs, TalentMatch uses a **Two-Stage Shortlist-then-Score** pipeline (`scripts/match.ts`):

### Stage 1: Dynamic Expected Years Inference & Fast Shortlisting
1. **Inferring Expected Years:** Because job files do not state a minimum years of experience, the matching agent first analyzes each job's title, seniority level, and description using OpenAI Structured Outputs (`inferJobExpectationsWithAgent`) to infer the expected years of experience:
   - Entry-level frontline roles (`Cashier`, `Housekeeping Cleaner`): **1 year**
   - Certified / operational roles (`IELTS Teacher`, `Retail Mortgage Loan Closer`): **2 years**
   - Mid-level technical / specialist roles (`Healthcare Data Analyst`, `Failure Analysis Engineer`, `Paralegal, Privacy and Information Management`): **3 years**
   - Management / regional roles (`Regional Facilities Manager`): **5 years**
   - Senior engineering roles (`Senior Mechanical/HVAC Engineer`): **6 years**
   - Executive / director roles (`Sales Director, ProductFE`): **8 years**
2. **Shortlisting Top 35 Candidates per Job:** The agent also generates 10–12 domain search keywords and role synonyms for the job. A fast local scorer evaluates all 472 CVs using title token overlap against `currentDesignation`, phrase overlap against `requiredSkills`, and domain synonym matches to select the **top 35 candidates per job** for deep LLM evaluation.

### Stage 2: LLM Factor Scoring (50 / 30 / 20 Rubric)
Shortlisted candidates are evaluated in batches of 5 using OpenAI `gpt-4o-mini` with strict JSON Schema validation (`response_format: { type: "json_schema", strict: true }`):

- **Skills (0–50 points):** The LLM compares each item in the job's required skills list against both the candidate's extracted skills and their full work history descriptions, counting semantic equivalents as matches (for example, `"POS Systems Operation"` matching `"Scanning and Checkout Systems"`, or `"Extract, Transform, Load"` matching `"ETL"`). Returned skills are canonicalized against the job's required skills list, and the score is calculated deterministically as:
  `skillsScore = Math.round((matchedSkills.length / requiredSkills.length) * 50)`
- **Experience (0–30 points):** Compares the candidate's experience against the job's inferred expected years. Full 30 points are awarded when a candidate meets or exceeds the expected years in a relevant domain, scaled down proportionally when total or relevant experience falls below the expected threshold.
- **Current Designation (0–20 points):** Compares the candidate's current job title against the target job title—awarding 18–20 points for an exact or equivalent role, 10–15 points for a related role in the same field, and 0–4 points for an unrelated role.
- **Handling Low-Fit Jobs (`35129` IELTS Teacher):** The prompt enforces strict anti-hallucination rules so specialized certifications or skills absent from a CV (such as `"IELTS"`) are never marked as matched, resulting in realistic lower top scores when strong fits do not exist in the corpus.

All results are persisted in PostgreSQL (`Match` table) and exported to `results/top10.csv`.

---

## 4. AI Tools & APIs Used

- **OpenAI API (`gpt-4o-mini`):** Used with Structured Outputs (`json_schema`) in `scripts/match.ts` and the `/api/jobs/[id]/rematch` endpoint for inferring expected experience, generating domain search expansions, matching semantic skills, scoring experience/designation fit, and producing concise one-line explanations.
- **AI Coding Assistants:** Used during development to assist with Next.js App Router component scaffolding, regular expression edge-case testing for CV parsing, and documentation formatting.

---

## 5. Extra Features Added & Future Improvements

### Extra Features Added
1. **Interactive 50 / 30 / 20 Recruiter Weight Sliders:** On any job page, recruiters can dynamically adjust the Skills, Experience, and Designation weights via sliders to re-rank candidates in real time based on hiring priorities.
2. **Side-by-Side Candidate Comparison:** Recruiters can select any two candidates (`+ Compare`) on a job opening to compare their factor scores, experience, current roles, and AI reasoning side by side.
3. **On-Demand Re-run Matching Button:** Each job detail page includes a `"Re-run Matching"` button wired to `/api/jobs/[id]/rematch` to regenerate scores live.
4. **Extracted Work History Timeline:** Candidate profile pages display structured work history cards alongside extracted contact details, skills, best-matching jobs, and the raw CV viewer.

### What I Would Do With More Time
- **Hybrid Vector + Lexical Retrieval:** Combine `text-embedding-3-small` embeddings stored in PostgreSQL (`pgvector`) with BM25 keyword scoring in Stage 1 for even stronger recall across unconventional CV phrasing.
- **Live CV Upload & Job Creation UI:** Add a drag-and-drop CV upload flow and a new job form that parses and scores new records asynchronously via background queues.
- **Automated Testing Suite:** Add unit tests for the date-interval merger and end-to-end Playwright tests for the filtering and comparison workflows.