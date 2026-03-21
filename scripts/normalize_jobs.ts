import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

type RawJob = {
  company: string;
  role_title: string;
  location: string;
  role_url: string;
  short_summary: string;
  required_keywords: string;
  preferred_keywords: string;
  hiring_team_if_visible: string;
};

type TargetCompany = {
  company: string;
  company_url: string;
  careers_url: string;
  priority: string;
  notes: string;
};

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

const projectRoot = process.cwd();
const workspaceDir = path.join(projectRoot, "openclaw-workspace");
const dataDir = path.join(workspaceDir, "data");
const rawJobsPath = path.join(dataDir, "jobs_raw.csv");
const targetCompaniesPath = path.join(dataDir, "target_companies.csv");
const outputPath = path.join(dataDir, "jobs_normalized.csv");

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

function normalizeCompanyKey(value: string | undefined) {
  return normalizeText(value).toLowerCase();
}

function normalizeUrl(value: string | undefined) {
  const raw = normalizeText(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    url.hash = "";
    const pathname = url.pathname.replace(/\/$/, "");
    url.pathname = pathname || "/";

    if (["job-boards.greenhouse.io", "boards.greenhouse.io"].includes(url.hostname)) {
      const ghJid = url.searchParams.get("gh_jid");
      url.search = ghJid ? `?gh_jid=${ghJid}` : "";
    } else {
      url.search = "";
    }

    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function normalizeKeywordList(value: string | undefined) {
  const raw = normalizeText(value);
  if (!raw) return "";

  const tokens = raw
    .split(/[;,|]/g)
    .map((item) => normalizeText(item))
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(token);
  }

  return deduped.join("; ");
}

function buildJobKey(job: Pick<NormalizedJob, "company" | "role_title" | "location" | "role_url">) {
  const base = job.role_url || `${job.company}|${job.role_title}|${job.location}`;
  return crypto.createHash("sha1").update(base).digest("hex");
}

function scoreCompleteness(job: NormalizedJob) {
  const fields = [
    job.company,
    job.role_title,
    job.location,
    job.role_url,
    job.short_summary,
    job.required_keywords,
    job.preferred_keywords,
    job.hiring_team_if_visible,
    job.priority,
  ];

  return fields.filter(Boolean).length;
}

function pickBetterRecord(current: NormalizedJob, incoming: NormalizedJob) {
  return scoreCompleteness(incoming) > scoreCompleteness(current) ? incoming : current;
}

function main() {
  const rawJobs = readCsv<RawJob>(rawJobsPath);
  const companies = readCsv<TargetCompany>(targetCompaniesPath);
  const now = new Date().toISOString();

  const priorityMap = new Map<string, string>();
  for (const company of companies) {
    priorityMap.set(normalizeCompanyKey(company.company), normalizeText(company.priority));
  }

  const deduped = new Map<string, NormalizedJob>();

  for (const rawJob of rawJobs) {
    const company = normalizeText(rawJob.company);
    const roleTitle = normalizeText(rawJob.role_title);

    if (!company || !roleTitle) continue;

    const normalized: NormalizedJob = {
      job_key: "",
      company,
      role_title: roleTitle,
      location: normalizeText(rawJob.location),
      role_url: normalizeUrl(rawJob.role_url),
      short_summary: normalizeText(rawJob.short_summary),
      required_keywords: normalizeKeywordList(rawJob.required_keywords),
      preferred_keywords: normalizeKeywordList(rawJob.preferred_keywords),
      hiring_team_if_visible: normalizeText(rawJob.hiring_team_if_visible),
      priority: priorityMap.get(normalizeCompanyKey(company)) ?? "",
      source_type: "manual_csv",
      collected_at: now,
    };

    normalized.job_key = buildJobKey(normalized);

    const existing = deduped.get(normalized.job_key);
    if (!existing) {
      deduped.set(normalized.job_key, normalized);
      continue;
    }

    deduped.set(normalized.job_key, pickBetterRecord(existing, normalized));
  }

  const rows = [...deduped.values()].sort((a, b) => {
    const companyCompare = a.company.localeCompare(b.company);
    if (companyCompare !== 0) return companyCompare;
    return a.role_title.localeCompare(b.role_title);
  });

  writeCsv(outputPath, rows);

  console.log(JSON.stringify({
    step: "normalize_jobs",
    raw_count: rawJobs.length,
    normalized_count: rows.length,
    output: path.relative(projectRoot, outputPath),
  }, null, 2));
}

main();
