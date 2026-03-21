import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

type NormalizedJob = {
  job_key: string;
  company: string;
  role_title: string;
  location: string;
  role_url: string;
  short_summary: string;
  required_keywords: string;
  preferred_keywords: string;
  hiring_team_if_visible: string;
  priority: string;
  source_type: string;
  collected_at: string;
};

type FilterDecision = "accepted" | "maybe" | "rejected";
type PipelineStatus = "new" | "synced";

type FilteredJob = NormalizedJob & {
  fit_score: number;
  decision: FilterDecision;
  decision_reason: string;
  pipeline_status: PipelineStatus;
};

const projectRoot = process.cwd();
const workspaceDir = path.join(projectRoot, "openclaw-workspace");
const dataDir = path.join(workspaceDir, "data");
const notesDir = path.join(workspaceDir, "notes");
const normalizedPath = path.join(dataDir, "jobs_normalized.csv");
const profilePath = path.join(notesDir, "profile.md");
const outputPath = path.join(dataDir, "jobs_filtered.csv");

const targetRoleSignals = [
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

const earlyCareerSignals = [
  "new grad",
  "early career",
  "0-2 years",
  "university grad",
  "entry level",
  "early-career",
];

const aiFitSignals = [
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

const hardRejectSignals = [
  "senior",
  "staff",
  "principal",
  "lead",
  "manager",
  "director",
  "5+ years",
  "7+ years",
];

const nonTargetSignals = [
  "account executive",
  "recruiter",
  "sales",
  "marketing",
  "hr",
  "human resources",
];

function readCsv<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

function writeCsv<T extends Record<string, unknown>>(filePath: string, rows: T[]) {
  const content = stringify(rows, {
    header: true,
  });
  fs.writeFileSync(filePath, content, "utf8");
}

function normalizeText(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildSearchText(job: NormalizedJob) {
  return [
    job.role_title,
    job.short_summary,
    job.required_keywords,
    job.preferred_keywords,
    job.hiring_team_if_visible,
    job.location,
  ]
    .map((part) => normalizeText(part).toLowerCase())
    .join(" \n ");
}

function includesAny(text: string, signals: string[]) {
  return signals.some((signal) => text.includes(signal));
}

function scorePriority(priority: string) {
  if (priority === "A") return 10;
  if (priority === "B") return 5;
  return 0;
}

function scoreRoleMatch(text: string) {
  return includesAny(text, targetRoleSignals) ? 30 : 0;
}

function scoreEarlyCareer(text: string) {
  return includesAny(text, earlyCareerSignals) ? 25 : 0;
}

function scoreAiFit(text: string) {
  let score = 0;
  for (const signal of aiFitSignals) {
    if (text.includes(signal)) score += 4;
  }
  return Math.min(score, 20);
}

function scoreCandidateFit(text: string, profileText: string) {
  let score = 0;

  if (profileText.includes("computer science") || profileText.includes("cs")) score += 5;
  if (profileText.includes("dragon egg")) score += 3;
  if (profileText.includes("finresearch")) score += 3;
  if (profileText.includes("ai crypto-trading bot")) score += 2;

  if (text.includes("python")) score += 1;
  if (text.includes("machine learning") || text.includes("llm")) score += 1;

  return Math.min(score, 15);
}

function buildDecision(job: NormalizedJob, profileText: string) {
  const text = buildSearchText(job);
  const reasons: string[] = [];

  if (includesAny(text, nonTargetSignals)) {
    return {
      fitScore: 0,
      decision: "rejected" as const,
      reason: "non_target_role",
    };
  }

  if (includesAny(text, hardRejectSignals)) {
    return {
      fitScore: 10,
      decision: "rejected" as const,
      reason: "senior_only",
    };
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

  let decision: FilterDecision = "maybe";
  if (fitScore >= 70) decision = "accepted";
  else if (fitScore < 40) decision = "rejected";

  if (reasons.length === 0) reasons.push("weak_fit");

  return {
    fitScore: Math.min(fitScore, 100),
    decision,
    reason: reasons.join("; "),
  };
}

function main() {
  const jobs = readCsv<NormalizedJob>(normalizedPath);
  const profileText = fs.readFileSync(profilePath, "utf8").toLowerCase();

  const filteredRows: FilteredJob[] = jobs.map((job) => {
    const result = buildDecision(job, profileText);
    return {
      ...job,
      fit_score: result.fitScore,
      decision: result.decision,
      decision_reason: result.reason,
      pipeline_status: "new",
    };
  });

  filteredRows.sort((a, b) => {
    if (b.fit_score !== a.fit_score) return b.fit_score - a.fit_score;
    const companyCompare = a.company.localeCompare(b.company);
    if (companyCompare !== 0) return companyCompare;
    return a.role_title.localeCompare(b.role_title);
  });

  writeCsv(outputPath, filteredRows);

  const summary = {
    step: "filter_jobs",
    normalized_count: jobs.length,
    accepted_count: filteredRows.filter((row) => row.decision === "accepted").length,
    maybe_count: filteredRows.filter((row) => row.decision === "maybe").length,
    rejected_count: filteredRows.filter((row) => row.decision === "rejected").length,
    output: path.relative(projectRoot, outputPath),
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
