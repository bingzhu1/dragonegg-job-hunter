export type ApplicationStatus = "待申请" | "已投递" | "面试中";
export type ApplicationAiMode = "real" | "fallback";

export type ApplicationRecord = {
  id: number;
  company: string;
  role: string;
  jd: string;
  resume: string;
  email_language: string;
  ai_mode: ApplicationAiMode;
  status: ApplicationStatus;
  application_link: string;
  tailored_bullets: string[];
  email_subject: string;
  email_body: string;
  created_at: string;
  job_id: number | null;
};

export type ApplicationInsert = {
  company: string;
  role: string;
  jd: string;
  resume: string;
  email_language: string;
  ai_mode: ApplicationAiMode;
  status: ApplicationStatus;
  application_link: string | null;
  tailored_bullets: string[];
  email_subject: string;
  email_body: string;
  job_id?: number | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: string | null;
};

const APPLICATION_SELECT =
  "id,company,role,jd,resume,email_language,ai_mode,status,application_link,tailored_bullets,email_subject,email_body,created_at,job_id";
const statusOptions: ApplicationStatus[] = ["待申请", "已投递", "面试中"];

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getSupabaseConfigMessage() {
  return "Supabase 未配置：请在 .env.local 中设置 SUPABASE_URL 和 SUPABASE_ANON_KEY，并在 Supabase SQL Editor 运行 supabase/applications.sql。";
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const firstMessage = [obj.message, obj.error_description, obj.hint].find(
      (value) => typeof value === "string" && value.trim(),
    );
    if (typeof firstMessage === "string") {
      return firstMessage;
    }
  }

  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  return fallback;
}

function normalizeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeStatus(value: unknown): ApplicationStatus {
  return statusOptions.includes(value as ApplicationStatus)
    ? (value as ApplicationStatus)
    : "待申请";
}

function normalizeAiMode(value: unknown): ApplicationAiMode {
  return value === "real" ? "real" : "fallback";
}

function normalizeBullets(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => typeof item === "string")
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return normalizeBullets(parsed);
    } catch {
      return value
        .split(/\r?\n/)
        .map((line) => line.replace(/^-+\s*/, "").trim())
        .filter(Boolean);
    }
  }

  return [];
}

function normalizeApplicationRecord(value: unknown): ApplicationRecord | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const idValue =
    typeof obj.id === "number"
      ? obj.id
      : typeof obj.id === "string"
        ? Number(obj.id)
        : NaN;

  if (!Number.isFinite(idValue)) return null;

  const jobIdValue =
    typeof obj.job_id === "number"
      ? obj.job_id
      : typeof obj.job_id === "string" && obj.job_id
        ? Number(obj.job_id)
        : null;

  return {
    id: idValue,
    company: normalizeString(obj.company, "未识别公司名"),
    role: normalizeString(obj.role, "未识别岗位名"),
    jd: normalizeString(obj.jd),
    resume: normalizeString(obj.resume),
    email_language: normalizeString(obj.email_language, "未记录"),
    ai_mode: normalizeAiMode(obj.ai_mode),
    status: normalizeStatus(obj.status),
    application_link: normalizeString(obj.application_link),
    tailored_bullets: normalizeBullets(obj.tailored_bullets),
    email_subject: normalizeString(obj.email_subject),
    email_body: normalizeString(obj.email_body),
    created_at: normalizeString(obj.created_at),
    job_id: jobIdValue !== null && Number.isFinite(jobIdValue) ? jobIdValue : null,
  };
}

async function requestSupabase<T>(
  path: string,
  init?: RequestInit,
): Promise<SupabaseResult<T>> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: getSupabaseConfigMessage() };
  }

  try {
    const response = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        apikey: getSupabaseAnonKey(),
        Authorization: `Bearer ${getSupabaseAnonKey()}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });

    const responseText = await response.text();
    let payload: unknown = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText) as unknown;
      } catch {
        payload = responseText;
      }
    }

    if (!response.ok) {
      return {
        data: null,
        error: getErrorMessage(payload, "Supabase 请求失败，请检查表结构与权限配置。"),
      };
    }

    return { data: payload as T, error: null };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "无法连接到 Supabase，请检查项目地址、Key 和网络环境。";

    return { data: null, error: message };
  }
}

export async function listApplications(): Promise<SupabaseResult<ApplicationRecord[]>> {
  const result = await requestSupabase<unknown[]>(
    `applications?select=${APPLICATION_SELECT}&order=created_at.desc`,
  );

  if (result.error) {
    return { data: null, error: result.error };
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  const records = rows
    .map((row) => normalizeApplicationRecord(row))
    .filter((row): row is ApplicationRecord => Boolean(row));

  return { data: records, error: null };
}

export async function insertApplication(
  application: ApplicationInsert,
): Promise<SupabaseResult<ApplicationRecord>> {
  const result = await requestSupabase<unknown[]>("applications", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify([application]),
  });

  if (result.error) {
    return { data: null, error: result.error };
  }

  const firstRow = Array.isArray(result.data) ? result.data[0] : null;
  const record = normalizeApplicationRecord(firstRow);

  if (!record) {
    return {
      data: null,
      error: "Supabase 保存成功，但返回数据格式不符合预期。",
    };
  }

  return { data: record, error: null };
}

export async function updateApplicationStatus(
  id: number,
  status: ApplicationStatus,
): Promise<SupabaseResult<null>> {
  const result = await requestSupabase<unknown>(`applications?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status }),
  });

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: null, error: null };
}

export type JobRecord = {
  id: number;
  job_key: string;
  company: string;
  role_title: string;
  location: string;
  role_url: string;
  short_summary: string;
  required_keywords: string[];
  preferred_keywords: string[];
  priority: string;
  fit_score: number;
  decision: "accepted" | "maybe" | "rejected";
  status: string;
  collected_at: string;
};

function normalizeJobRecord(value: unknown): JobRecord | null {
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  const idValue =
    typeof obj.id === "number"
      ? obj.id
      : typeof obj.id === "string"
        ? Number(obj.id)
        : NaN;

  if (!Number.isFinite(idValue)) return null;

  const fitScoreValue =
    typeof obj.fit_score === "number"
      ? obj.fit_score
      : typeof obj.fit_score === "string"
        ? Number(obj.fit_score)
        : 0;

  const normalizeStringArray = (input: unknown) =>
    Array.isArray(input)
      ? input.filter((item) => typeof item === "string").map((item) => String(item))
      : [];

  const decision =
    obj.decision === "accepted" || obj.decision === "maybe" || obj.decision === "rejected"
      ? obj.decision
      : "maybe";

  return {
    id: idValue,
    job_key: normalizeString(obj.job_key),
    company: normalizeString(obj.company),
    role_title: normalizeString(obj.role_title),
    location: normalizeString(obj.location),
    role_url: normalizeString(obj.role_url),
    short_summary: normalizeString(obj.short_summary),
    required_keywords: normalizeStringArray(obj.required_keywords),
    preferred_keywords: normalizeStringArray(obj.preferred_keywords),
    priority: normalizeString(obj.priority),
    fit_score: Number.isFinite(fitScoreValue) ? fitScoreValue : 0,
    decision,
    status: normalizeString(obj.status),
    collected_at: normalizeString(obj.collected_at),
  };
}

export async function updateJobStatus(
  id: number,
  status: "new" | "saved" | "dismissed" | "applied",
): Promise<SupabaseResult<null>> {
  const result = await requestSupabase<unknown>(`jobs?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ status }),
  });

  if (result.error) {
    return { data: null, error: result.error };
  }

  return { data: null, error: null };
}

export async function listJobs(): Promise<SupabaseResult<JobRecord[]>> {
  const result = await requestSupabase<unknown[]>(
    "jobs?select=id,job_key,company,role_title,location,role_url,short_summary,required_keywords,preferred_keywords,priority,fit_score,decision,status,collected_at&decision=in.(accepted,maybe)&order=fit_score.desc",
  );

  if (result.error) {
    return { data: null, error: result.error };
  }

  const rows = Array.isArray(result.data) ? result.data : [];
  const records = rows
    .map((row) => normalizeJobRecord(row))
    .filter((row): row is JobRecord => Boolean(row));

  return { data: records, error: null };
}
