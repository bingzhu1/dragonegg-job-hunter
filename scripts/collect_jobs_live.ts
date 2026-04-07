/**
 * collect_jobs_live.ts
 *
 * Fetches real job listings from Greenhouse and Lever public APIs.
 * Writes matching jobs directly to Supabase `jobs` with status='new'.
 * After running, use `npm run jobs:evaluate` to score the new entries.
 *
 * Config: openclaw-workspace/data/ats_targets.json
 *
 * Usage:
 *   npm run jobs:collect                     # collect + upsert
 *   npx tsx scripts/collect_jobs_live.ts     # same, directly
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Config paths
// ---------------------------------------------------------------------------

const projectRoot = process.cwd();
const atsTargetsPath = path.join(projectRoot, "openclaw-workspace", "data", "ats_targets.json");
const envPath = path.join(projectRoot, ".env.local");

// ---------------------------------------------------------------------------
// Role filter signals (keep in sync with filter_jobs.ts / evaluate_jobs.ts)
// ---------------------------------------------------------------------------

const TARGET_TITLE_SIGNALS = [
  "ai engineer",
  "applied ai",
  "llm engineer",
  "ai product engineer",
  "software engineer",
  "ml engineer",
  "machine learning engineer",
  "data scientist",
  "infrastructure engineer",
  "backend engineer",
  "forward deployed",
  "solutions engineer",
];

const HARD_REJECT_TITLE_SIGNALS = [
  "senior",
  "staff",
  "principal",
  "lead engineer",
  "engineering manager",
  "director",
  "vp ",
  "account executive",
  "recruiter",
  "sales",
  "marketing",
  "hr ",
  "human resources",
  "legal",
  "finance",
  "accounting",
  "designer",
  "product designer",
];

const TECH_KEYWORD_PATTERNS = [
  "python", "pytorch", "tensorflow", "jax",
  "llm", "machine learning", "deep learning", "nlp", "computer vision",
  "transformer", "rag", "fine-tuning", "reinforcement learning",
  "distributed systems", "inference", "gpu", "cuda",
  "kubernetes", "docker", "aws", "gcp", "azure",
  "sql", "postgresql", "data pipelines", "spark",
  "react", "typescript", "javascript", "frontend",
  "rust", "c++", "go", "java",
  "api", "rest", "grpc", "microservices",
  "backend", "infrastructure", "devops", "mlops",
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AtsType = "greenhouse" | "lever";

type AtsTarget = {
  company: string;
  ats_type: AtsType;
  ats_token: string;
  priority: string;
};

type AtsConfig = {
  companies: AtsTarget[];
};

type CollectedJob = {
  job_key: string;
  company: string;
  role_title: string;
  location: string;
  role_url: string;
  short_summary: string;
  required_keywords: string[];
  preferred_keywords: string[];
  hiring_team_if_visible: string;
  priority: string;
  source_type: string;
  collected_at: string;
  fit_score: number;
  decision: "maybe";
  decision_reason: string;
  status: "new";
};

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li>/gi, "\n• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildShortSummary(text: string, maxLen = 400): string {
  const cleaned = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "…" : cleaned;
}

function extractKeywords(text: string): { required: string[]; preferred: string[] } {
  const lower = text.toLowerCase();

  // Find "preferred" / "nice to have" section
  const preferredSectionMatch = lower.match(
    /(nice[\s-]to[\s-]have|preferred|bonus|plus|preferred qualifications?)([\s\S]{0,800})/i,
  );
  const preferredSection = preferredSectionMatch?.[2]?.toLowerCase() ?? "";

  const required: string[] = [];
  const preferred: string[] = [];

  for (const keyword of TECH_KEYWORD_PATTERNS) {
    if (!lower.includes(keyword)) continue;
    if (preferredSection.includes(keyword)) {
      preferred.push(keyword);
    } else {
      required.push(keyword);
    }
  }

  return { required, preferred };
}

function buildJobKey(roleUrl: string, company: string, roleTitle: string, location: string): string {
  const base = roleUrl || `${company}|${roleTitle}|${location}`;
  return crypto.createHash("sha1").update(base).digest("hex");
}

function isTargetRole(title: string): boolean {
  const lower = title.toLowerCase();
  if (HARD_REJECT_TITLE_SIGNALS.some((s) => lower.includes(s))) return false;
  // Accept if title matches any target signal, OR if it's a generic "engineer" / "scientist" not explicitly rejected
  if (TARGET_TITLE_SIGNALS.some((s) => lower.includes(s))) return true;
  // Soft pass: "engineer" or "scientist" without a hard-reject label
  return /\bengineer\b|\bscientist\b|\binfra\b|\bplatform\b/.test(lower);
}

// ---------------------------------------------------------------------------
// Greenhouse fetcher
// ---------------------------------------------------------------------------

type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  content: string;
  departments: Array<{ name: string }>;
  absolute_url: string;
  updated_at: string;
};

type GreenhouseResponse = {
  jobs: GreenhouseJob[];
};

async function fetchGreenhouse(target: AtsTarget, now: string): Promise<CollectedJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${target.ats_token}/jobs?content=true`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": "DragonEgg-JobCollector/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [${target.company}] fetch error: ${msg}`);
    return [];
  }

  if (resp.status === 404) {
    console.warn(`  [${target.company}] Greenhouse token "${target.ats_token}" returned 404 — skipping. Verify at https://boards.greenhouse.io/${target.ats_token}`);
    return [];
  }

  if (!resp.ok) {
    console.error(`  [${target.company}] Greenhouse HTTP ${resp.status}`);
    return [];
  }

  const data = (await resp.json()) as GreenhouseResponse;
  const jobs: CollectedJob[] = [];

  for (const job of data.jobs ?? []) {
    if (!isTargetRole(job.title)) continue;

    const bodyText = stripHtml(job.content ?? "");
    const { required, preferred } = extractKeywords(bodyText);
    const location = job.location?.name ?? "";
    const roleUrl = job.absolute_url ?? "";
    const department = job.departments?.[0]?.name ?? "";

    jobs.push({
      job_key: buildJobKey(roleUrl, target.company, job.title, location),
      company: target.company,
      role_title: job.title,
      location,
      role_url: roleUrl,
      short_summary: buildShortSummary(bodyText),
      required_keywords: required,
      preferred_keywords: preferred,
      hiring_team_if_visible: department,
      priority: target.priority,
      source_type: "greenhouse_api",
      collected_at: now,
      fit_score: 0,
      decision: "maybe",
      decision_reason: "pending_evaluation",
      status: "new",
    });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// Lever fetcher
// ---------------------------------------------------------------------------

type LeverPosting = {
  id: string;
  text: string;
  categories: {
    location?: string;
    team?: string;
    department?: string;
    commitment?: string;
  };
  description: string;
  lists: Array<{ text: string; content: string }>;
  hostedUrl: string;
  createdAt: number;
};

async function fetchLever(target: AtsTarget, now: string): Promise<CollectedJob[]> {
  const url = `https://api.lever.co/v0/postings/${target.ats_token}?mode=json`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { "User-Agent": "DragonEgg-JobCollector/1.0" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  [${target.company}] fetch error: ${msg}`);
    return [];
  }

  if (resp.status === 404) {
    console.warn(`  [${target.company}] Lever token "${target.ats_token}" returned 404 — skipping. Verify at https://jobs.lever.co/${target.ats_token}`);
    return [];
  }

  if (!resp.ok) {
    console.error(`  [${target.company}] Lever HTTP ${resp.status}`);
    return [];
  }

  const postings = (await resp.json()) as LeverPosting[];
  const jobs: CollectedJob[] = [];

  for (const posting of postings ?? []) {
    if (!isTargetRole(posting.text)) continue;

    const allText = [
      posting.description,
      ...(posting.lists ?? []).map((l) => l.content),
    ]
      .map(stripHtml)
      .join("\n");

    const { required, preferred } = extractKeywords(allText);
    const location = posting.categories?.location ?? "";
    const department = posting.categories?.team ?? posting.categories?.department ?? "";
    const roleUrl = posting.hostedUrl ?? "";

    jobs.push({
      job_key: buildJobKey(roleUrl, target.company, posting.text, location),
      company: target.company,
      role_title: posting.text,
      location,
      role_url: roleUrl,
      short_summary: buildShortSummary(allText),
      required_keywords: required,
      preferred_keywords: preferred,
      hiring_team_if_visible: department,
      priority: target.priority,
      source_type: "lever_api",
      collected_at: now,
      fit_score: 0,
      decision: "maybe",
      decision_reason: "pending_evaluation",
      status: "new",
    });
  }

  return jobs;
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
// Supabase upsert
// ---------------------------------------------------------------------------

async function upsertJobs(
  supabaseUrl: string,
  serviceKey: string,
  jobs: CollectedJob[],
): Promise<number> {
  if (jobs.length === 0) return 0;

  const response = await fetch(`${supabaseUrl}/rest/v1/jobs?on_conflict=job_key`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      // ignore-duplicates: skip existing job_keys entirely — preserves status/decision
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify(jobs),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase upsert failed: ${text}`);
  }

  const result = (await response.json()) as unknown[];
  return Array.isArray(result) ? result.length : jobs.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(atsTargetsPath)) {
    throw new Error(`ATS targets config not found at ${atsTargetsPath}`);
  }

  const config = JSON.parse(fs.readFileSync(atsTargetsPath, "utf8")) as AtsConfig;
  const companies = config.companies ?? [];

  if (companies.length === 0) {
    console.log(JSON.stringify({ step: "collect_jobs_live", message: "No companies configured in ats_targets.json" }, null, 2));
    return;
  }

  const envMap = parseEnvFile(envPath);
  const supabaseUrl =
    getEnv("SUPABASE_URL", envMap) || getEnv("NEXT_PUBLIC_SUPABASE_URL", envMap);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", envMap);

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL in .env.local");
  if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");

  const now = new Date().toISOString();
  const summary: Array<{
    company: string;
    fetched: number;
    inserted: number;
    skipped_existing: number;
    failed: boolean;
    source: string;
  }> = [];
  let totalInserted = 0;
  let totalFetched = 0;
  let totalFailed = 0;

  for (const target of companies) {
    console.error(`Collecting: ${target.company} (${target.ats_type}: ${target.ats_token})`);

    let jobs: CollectedJob[] = [];
    let failed = false;

    if (target.ats_type === "greenhouse") {
      jobs = await fetchGreenhouse(target, now);
    } else if (target.ats_type === "lever") {
      jobs = await fetchLever(target, now);
    } else {
      console.warn(`  [${target.company}] Unknown ats_type: ${String(target.ats_type)} — skipping`);
      failed = true;
    }

    let inserted = 0;
    if (!failed && jobs.length > 0) {
      try {
        inserted = await upsertJobs(supabaseUrl, serviceRoleKey, jobs);
      } catch (err) {
        console.error(`  [${target.company}] upsert error: ${err instanceof Error ? err.message : String(err)}`);
        failed = true;
      }
    }

    const skipped_existing = jobs.length - inserted;
    totalInserted += inserted;
    totalFetched += jobs.length;
    if (failed) totalFailed++;

    summary.push({
      company: target.company,
      fetched: jobs.length,
      inserted,
      skipped_existing,
      failed,
      source: target.ats_type,
    });

    if (!failed) {
      console.error(`  → fetched ${jobs.length}, inserted ${inserted}, skipped ${skipped_existing} (already exists)`);
    }
  }

  console.log(
    JSON.stringify(
      {
        step: "collect_jobs_live",
        companies_processed: companies.length,
        companies_failed: totalFailed,
        total_fetched: totalFetched,
        total_inserted: totalInserted,
        total_skipped_existing: totalFetched - totalInserted,
        details: summary,
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
