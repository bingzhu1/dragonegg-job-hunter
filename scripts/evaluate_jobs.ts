/**
 * evaluate_jobs.ts
 *
 * Fetches jobs from Supabase and scores each one using the same rule-based
 * logic as filter_jobs.ts.  Writes back fit_score, decision, decision_reason.
 *
 * Default: only processes jobs with status = 'new'
 * With --all flag: re-evaluates every job in the table (useful after profile changes)
 *
 * Usage:
 *   npx tsx scripts/evaluate_jobs.ts          # new jobs only
 *   npx tsx scripts/evaluate_jobs.ts --all    # re-score everything
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const projectRoot = process.cwd();
const profilePath = path.join(projectRoot, "openclaw-workspace", "notes", "profile.md");
const envPath = path.join(projectRoot, ".env.local");
const RE_EVALUATE_ALL = process.argv.includes("--all");

// ---------------------------------------------------------------------------
// Scoring signals (kept in sync with filter_jobs.ts)
// ---------------------------------------------------------------------------

const TARGET_ROLE_SIGNALS = [
  "ai engineer",
  "applied ai",
  "llm engineer",
  "ai product engineer",
  "software engineer",
  "software engineer, infrastructure",
  "software engineer - new grad",
  "ml engineer",
  "machine learning engineer",
  "infrastructure",
  "ai/infra",
];

const EARLY_CAREER_SIGNALS = [
  "new grad",
  "early career",
  "0-2 years",
  "university grad",
  "entry level",
  "early-career",
];

const AI_FIT_SIGNALS = [
  "llm",
  "machine learning",
  "ml",
  "pytorch",
  "python",
  "distributed systems",
  "inference",
  "ai infra",
  "backend",
  "infrastructure",
  "data pipelines",
];

const HARD_REJECT_SIGNALS = [
  "senior",
  "staff",
  "principal",
  "lead",
  "manager",
  "director",
  "5+ years",
  "7+ years",
];

const NON_TARGET_SIGNALS = [
  "account executive",
  "recruiter",
  "sales",
  "marketing",
  "hr",
  "human resources",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type JobDecision = "accepted" | "maybe" | "rejected";

type SupabaseJobRow = {
  id: number;
  company: string;
  role_title: string;
  location: string;
  short_summary: string;
  required_keywords: string[];
  preferred_keywords: string[];
  priority: string;
  status: string;
};

type EvalUpdate = {
  fit_score: number;
  decision: JobDecision;
  decision_reason: string;
};

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function normalizeText(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildSearchText(job: SupabaseJobRow): string {
  return [
    job.role_title,
    job.short_summary,
    (job.required_keywords ?? []).join(" "),
    (job.preferred_keywords ?? []).join(" "),
    job.location,
  ]
    .map((part) => normalizeText(part).toLowerCase())
    .join(" \n ");
}

function includesAny(text: string, signals: string[]): boolean {
  return signals.some((signal) => text.includes(signal));
}

function scorePriority(priority: string): number {
  if (priority === "A") return 10;
  if (priority === "B") return 5;
  return 0;
}

function scoreRoleMatch(text: string): number {
  return includesAny(text, TARGET_ROLE_SIGNALS) ? 30 : 0;
}

function scoreEarlyCareer(text: string): number {
  return includesAny(text, EARLY_CAREER_SIGNALS) ? 25 : 0;
}

function scoreAiFit(text: string): number {
  let score = 0;
  for (const signal of AI_FIT_SIGNALS) {
    if (text.includes(signal)) score += 4;
  }
  return Math.min(score, 20);
}

function scoreCandidateFit(text: string, profileText: string): number {
  let score = 0;
  if (profileText.includes("computer science") || profileText.includes("cs")) score += 5;
  if (profileText.includes("dragon egg")) score += 3;
  if (profileText.includes("finresearch")) score += 3;
  if (profileText.includes("ai crypto-trading bot")) score += 2;
  if (text.includes("python")) score += 1;
  if (text.includes("machine learning") || text.includes("llm")) score += 1;
  return Math.min(score, 15);
}

function evaluateJob(job: SupabaseJobRow, profileText: string): EvalUpdate {
  // title-only text: reject signals should not fire on description content
  const titleText = job.role_title.toLowerCase();
  // full search text: used for positive scoring (ai fit, early career, etc.)
  const text = buildSearchText(job);
  const reasons: string[] = [];

  if (includesAny(titleText, NON_TARGET_SIGNALS)) {
    return { fit_score: 0, decision: "rejected", decision_reason: "non_target_role" };
  }

  if (includesAny(titleText, HARD_REJECT_SIGNALS)) {
    return { fit_score: 10, decision: "rejected", decision_reason: "senior_only" };
  }

  let fitScore = 0;

  const roleScore = scoreRoleMatch(text);
  if (roleScore > 0) reasons.push("target_role_match");
  fitScore += roleScore;

  const earlyCareerScore = scoreEarlyCareer(text);
  if (earlyCareerScore > 0) reasons.push("early_career_signal");
  fitScore += earlyCareerScore;

  const aiFitScore = scoreAiFit(text);
  if (aiFitScore > 0) reasons.push("ai_fit");
  fitScore += aiFitScore;

  const priorityScore = scorePriority(job.priority);
  if (priorityScore > 0) reasons.push(`priority_${job.priority}`);
  fitScore += priorityScore;

  const candidateFitScore = scoreCandidateFit(text, profileText);
  if (candidateFitScore > 0) reasons.push("candidate_profile_reference");
  fitScore += candidateFitScore;

  let decision: JobDecision = "maybe";
  if (fitScore >= 70) decision = "accepted";
  else if (fitScore < 40) decision = "rejected";

  if (reasons.length === 0) reasons.push("weak_fit");

  return {
    fit_score: Math.min(fitScore, 100),
    decision,
    decision_reason: reasons.join("; "),
  };
}

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function parseEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const result: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }
  return result;
}

function getEnv(key: string, envMap: Record<string, string>): string {
  return process.env[key] ?? envMap[key] ?? "";
}

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

async function fetchJobs(
  supabaseUrl: string,
  serviceKey: string,
  all: boolean,
): Promise<SupabaseJobRow[]> {
  const filter = all ? "" : "&status=eq.new";
  const url =
    `${supabaseUrl}/rest/v1/jobs?select=id,company,role_title,location,short_summary,required_keywords,preferred_keywords,priority,status${filter}`;

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch jobs: ${await response.text()}`);
  }

  return response.json() as Promise<SupabaseJobRow[]>;
}

async function patchJobEval(
  supabaseUrl: string,
  serviceKey: string,
  jobId: number,
  update: EvalUpdate,
): Promise<void> {
  const response = await fetch(`${supabaseUrl}/rest/v1/jobs?id=eq.${jobId}`, {
    method: "PATCH",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(update),
  });

  if (!response.ok) {
    throw new Error(`Failed to patch job ${jobId}: ${await response.text()}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const envMap = parseEnvFile(envPath);
  const supabaseUrl =
    getEnv("SUPABASE_URL", envMap) || getEnv("NEXT_PUBLIC_SUPABASE_URL", envMap);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", envMap);

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");

  const profileText = fs.existsSync(profilePath)
    ? fs.readFileSync(profilePath, "utf8").toLowerCase()
    : "";

  if (!profileText) {
    console.warn("WARN: profile.md not found — candidate fit scoring will be skipped.");
  }

  const jobs = await fetchJobs(supabaseUrl, serviceRoleKey, RE_EVALUATE_ALL);

  if (jobs.length === 0) {
    console.log(
      JSON.stringify(
        {
          step: "evaluate_jobs",
          mode: RE_EVALUATE_ALL ? "all" : "new_only",
          evaluated_count: 0,
          message: RE_EVALUATE_ALL
            ? "No jobs in table."
            : "No jobs with status=new. Use --all to re-evaluate everything.",
        },
        null,
        2,
      ),
    );
    return;
  }

  const counts = { accepted: 0, maybe: 0, rejected: 0 };
  const details: Array<{ id: number; company: string; role_title: string } & EvalUpdate> = [];

  for (const job of jobs) {
    const update = evaluateJob(job, profileText);
    await patchJobEval(supabaseUrl, serviceRoleKey, job.id, update);
    counts[update.decision]++;
    details.push({ id: job.id, company: job.company, role_title: job.role_title, ...update });
  }

  console.log(
    JSON.stringify(
      {
        step: "evaluate_jobs",
        mode: RE_EVALUATE_ALL ? "all" : "new_only",
        evaluated_count: jobs.length,
        ...counts,
        details,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
