import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

type FilterDecision = "accepted" | "maybe" | "rejected";

type FilteredJob = {
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
  fit_score: string;
  decision: FilterDecision;
  decision_reason: string;
  pipeline_status: string;
};

type SupabaseJobInsert = {
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
  collected_at: string | null;
  fit_score: number;
  decision: FilterDecision;
  decision_reason: string;
  status: "new";
};

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, "openclaw-workspace", "data");
const filteredPath = path.join(dataDir, "jobs_filtered.csv");
const envPath = path.join(projectRoot, ".env.local");

function readCsv<T>(filePath: string): T[] {
  const content = fs.readFileSync(filePath, "utf8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}

function parseEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return {} as Record<string, string>;

  const content = fs.readFileSync(filePath, "utf8");
  const entries = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const result: Record<string, string> = {};
  for (const entry of entries) {
    const index = entry.indexOf("=");
    if (index === -1) continue;
    const key = entry.slice(0, index).trim();
    const value = entry.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    result[key] = value;
  }
  return result;
}

function getEnv(key: string, envMap: Record<string, string>) {
  return process.env[key] ?? envMap[key] ?? "";
}

function parseKeywordList(value: string) {
  return value
    .split(/[;,|]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toSupabaseJob(row: FilteredJob): SupabaseJobInsert {
  return {
    job_key: row.job_key,
    company: row.company.trim(),
    role_title: row.role_title.trim(),
    location: row.location.trim(),
    role_url: row.role_url.trim(),
    short_summary: row.short_summary.trim(),
    required_keywords: parseKeywordList(row.required_keywords),
    preferred_keywords: parseKeywordList(row.preferred_keywords),
    hiring_team_if_visible: row.hiring_team_if_visible.trim(),
    priority: row.priority.trim(),
    source_type: row.source_type.trim() || "manual_csv",
    collected_at: row.collected_at?.trim() || null,
    fit_score: Number(row.fit_score) || 0,
    decision: row.decision,
    decision_reason: row.decision_reason.trim(),
    status: "new",
  };
}

async function main() {
  const envMap = parseEnvFile(envPath);
  const supabaseUrl = getEnv("SUPABASE_URL", envMap) || getEnv("NEXT_PUBLIC_SUPABASE_URL", envMap);
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY", envMap);

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) in environment.");
  }

  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in environment.");
  }

  const rows = readCsv<FilteredJob>(filteredPath);
  const candidates = rows.filter(
    (row) => row.decision === "accepted" || row.decision === "maybe",
  );

  const payload = candidates.map(toSupabaseJob);

  if (payload.length === 0) {
    console.log(JSON.stringify({
      step: "sync_jobs_to_supabase",
      candidate_count: 0,
      synced_count: 0,
      message: "No accepted/maybe jobs to sync.",
    }, null, 2));
    return;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/jobs?on_conflict=job_key`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let parsed: unknown = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
    } catch {
      parsed = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(`Supabase sync failed: ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`);
  }

  const syncedCount = Array.isArray(parsed) ? parsed.length : payload.length;

  console.log(JSON.stringify({
    step: "sync_jobs_to_supabase",
    candidate_count: candidates.length,
    synced_count: syncedCount,
    table: "jobs",
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
