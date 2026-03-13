import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
};

type SupabaseResult<T> = {
  data: T | null;
  error: string | null;
};

const APPLICATION_SELECT =
  "id,company,role,jd,resume,email_language,ai_mode,status,application_link,tailored_bullets,email_subject,email_body,created_at";
const statusOptions: ApplicationStatus[] = ["待申请", "已投递", "面试中"];

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
}

function getSupabaseAnonKey() {
  return process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
}

function createSupabaseBrowserClient() {
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getClient(): SupabaseClient | null {
  return supabase;
}

export const supabase = createSupabaseBrowserClient();

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
      const parsed = JSON.parse(value) as unknown;
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
        : Number.NaN;

  if (!Number.isFinite(idValue)) {
    return null;
  }

  return {
    id: idValue,
    company: normalizeString(obj.company),
    role: normalizeString(obj.role),
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
  };
}

function normalizeApplicationInsert(application: ApplicationInsert) {
  return {
    company: normalizeString(application.company),
    role: normalizeString(application.role),
    jd: normalizeString(application.jd),
    resume: normalizeString(application.resume),
    email_language: normalizeString(application.email_language, "未记录"),
    ai_mode: normalizeAiMode(application.ai_mode),
    status: normalizeStatus(application.status),
    application_link: normalizeString(application.application_link),
    tailored_bullets: normalizeBullets(application.tailored_bullets),
    email_subject: normalizeString(application.email_subject),
    email_body: normalizeString(application.email_body),
  };
}

function ensureClient<T>(): SupabaseResult<T> | null {
  if (getClient()) {
    return null;
  }

  return {
    data: null,
    error: getSupabaseConfigMessage(),
  };
}

export async function listApplications(): Promise<SupabaseResult<ApplicationRecord[]>> {
  const missingClient = ensureClient<ApplicationRecord[]>();
  if (missingClient) return missingClient;

  const client = getClient();
  if (!client) {
    return { data: null, error: getSupabaseConfigMessage() };
  }

  const { data, error } = await client
    .from("applications")
    .select(APPLICATION_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return {
      data: null,
      error: getErrorMessage(error, "Supabase 请求失败，请检查表结构与权限配置。"),
    };
  }

  const records = (data ?? [])
    .map((row) => normalizeApplicationRecord(row))
    .filter((row): row is ApplicationRecord => Boolean(row));

  return { data: records, error: null };
}

export async function insertApplication(
  application: ApplicationInsert,
): Promise<SupabaseResult<ApplicationRecord>> {
  const missingClient = ensureClient<ApplicationRecord>();
  if (missingClient) return missingClient;

  const client = getClient();
  if (!client) {
    return { data: null, error: getSupabaseConfigMessage() };
  }

  const payload = normalizeApplicationInsert(application);
  const { data, error } = await client
    .from("applications")
    .insert(payload)
    .select(APPLICATION_SELECT)
    .single();

  if (error) {
    return {
      data: null,
      error: getErrorMessage(error, "Supabase 保存失败，请检查表结构与权限配置。"),
    };
  }

  const record = normalizeApplicationRecord(data);
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
  const missingClient = ensureClient<null>();
  if (missingClient) return missingClient;

  const client = getClient();
  if (!client) {
    return { data: null, error: getSupabaseConfigMessage() };
  }

  const { data, error } = await client
    .from("applications")
    .update({ status: normalizeStatus(status) })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      data: null,
      error: getErrorMessage(error, "Supabase 状态更新失败，请稍后重试。"),
    };
  }

  if (!data) {
    return {
      data: null,
      error: "没有找到要更新的申请记录。",
    };
  }

  return { data: null, error: null };
}
