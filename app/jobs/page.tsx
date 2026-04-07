import Link from "next/link";
import {
  getSupabaseConfigMessage,
  isSupabaseConfigured,
  listJobs,
  type JobRecord,
} from "@/lib/supabase";

// ---------------------------------------------------------------------------
// URL filter helpers
// ---------------------------------------------------------------------------

type FilterParams = { [key: string]: string | string[] | undefined };

function buildFilterHref(
  current: FilterParams,
  patch: Record<string, string | null>,
): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    if (typeof v === "string") params.set(k, v);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) params.delete(k);
    else params.set(k, v);
  }
  const s = params.toString();
  return s ? `/jobs?${s}` : "/jobs";
}

// ---------------------------------------------------------------------------
// Styling helpers
// ---------------------------------------------------------------------------

function getDecisionStyle(decision: JobRecord["decision"]) {
  if (decision === "accepted") {
    return "border-emerald-700/80 bg-emerald-950/40 text-emerald-300";
  }
  return "border-amber-700/80 bg-amber-950/40 text-amber-300";
}

function buildTailorHref(job: JobRecord) {
  return `/tailor?company=${encodeURIComponent(job.company)}&role=${encodeURIComponent(job.role_title)}&jd=${encodeURIComponent(job.short_summary)}&job_id=${job.id}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const params = await searchParams;
  const decisionFilter = typeof params.decision === "string" ? params.decision : "all";
  const companyFilter = typeof params.company === "string" ? params.company : "";
  const hideApplied = params.hide_applied === "1";

  const supabaseConfigured = isSupabaseConfigured();
  const supabaseConfigMessage = getSupabaseConfigMessage();

  const jobsResult = supabaseConfigured
    ? await listJobs()
    : { data: [] as JobRecord[], error: supabaseConfigMessage };
  const allJobs = jobsResult.data ?? [];

  // Stats (before filters)
  const totalFetched = allJobs.length;
  const acceptedAll = allJobs.filter((j) => j.decision === "accepted").length;
  const maybeAll = allJobs.filter((j) => j.decision === "maybe").length;
  const appliedAll = allJobs.filter((j) => j.status === "applied").length;

  // In-memory filtering
  let filtered = allJobs;
  if (decisionFilter === "accepted") {
    filtered = filtered.filter((j) => j.decision === "accepted");
  }
  if (companyFilter) {
    filtered = filtered.filter((j) => j.company === companyFilter);
  }

  // Split into unapplied + applied; applied always sorts to bottom
  const unapplied = filtered.filter((j) => j.status !== "applied");
  const applied = filtered.filter((j) => j.status === "applied");
  const visible = hideApplied ? unapplied : [...unapplied, ...applied];

  // Top companies for filter pills (from all jobs, by count)
  const companyCounts = new Map<string, number>();
  for (const j of allJobs) {
    companyCounts.set(j.company, (companyCounts.get(j.company) ?? 0) + 1);
  }
  const topCompanies = [...companyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name);

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white">岗位列表</h1>
            <p className="mt-2 text-sm text-neutral-400">
              来自 Greenhouse / Lever，按匹配度排序
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm text-neutral-500 transition hover:text-neutral-300"
          >
            → 申请面板
          </Link>
        </div>

        {/* Supabase errors */}
        {!supabaseConfigured && (
          <div className="mt-6 rounded-xl border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
            {supabaseConfigMessage}
          </div>
        )}
        {supabaseConfigured && jobsResult.error && (
          <div className="mt-6 rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {jobsResult.error}
          </div>
        )}

        {/* Stats bar */}
        {totalFetched > 0 && (
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <span className="text-neutral-400">
              共 <span className="text-white">{totalFetched}</span> 条
            </span>
            <span className="text-emerald-400">
              ✓ accepted: <span className="text-white">{acceptedAll}</span>
            </span>
            <span className="text-amber-400">
              ~ maybe: <span className="text-white">{maybeAll}</span>
            </span>
            {appliedAll > 0 && (
              <span className="text-neutral-500">
                已投递: {appliedAll}
              </span>
            )}
            {visible.length !== totalFetched && (
              <span className="text-neutral-500">
                当前显示: {visible.length}
              </span>
            )}
          </div>
        )}

        {/* Filter bar */}
        {totalFetched > 0 && (
          <div className="mt-5 space-y-3">
            {/* Decision + applied toggle */}
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-neutral-500">决策：</span>
              <Link
                href={buildFilterHref(params, { decision: null })}
                className={`rounded-lg border px-3 py-1 text-xs transition ${
                  decisionFilter === "all"
                    ? "border-white bg-white text-black"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                全部
              </Link>
              <Link
                href={buildFilterHref(params, { decision: "accepted" })}
                className={`rounded-lg border px-3 py-1 text-xs transition ${
                  decisionFilter === "accepted"
                    ? "border-emerald-500 bg-emerald-950/60 text-emerald-300"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                只看 accepted
              </Link>

              <div className="ml-auto">
                <Link
                  href={buildFilterHref(params, {
                    hide_applied: hideApplied ? null : "1",
                  })}
                  className={`rounded-lg border px-3 py-1 text-xs transition ${
                    hideApplied
                      ? "border-neutral-600 bg-neutral-800 text-neutral-300"
                      : "border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {hideApplied ? "隐藏已投递 ✓" : "隐藏已投递"}
                </Link>
              </div>
            </div>

            {/* Company pills */}
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-neutral-500">公司：</span>
              <Link
                href={buildFilterHref(params, { company: null })}
                className={`rounded-lg border px-3 py-1 text-xs transition ${
                  !companyFilter
                    ? "border-white bg-white text-black"
                    : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                }`}
              >
                所有
              </Link>
              {topCompanies.map((name) => (
                <Link
                  key={name}
                  href={buildFilterHref(params, { company: name })}
                  className={`rounded-lg border px-3 py-1 text-xs transition ${
                    companyFilter === name
                      ? "border-sky-600 bg-sky-950/60 text-sky-300"
                      : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
                  }`}
                >
                  {name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {supabaseConfigured && !jobsResult.error && allJobs.length === 0 && (
          <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">暂无岗位数据</h2>
            <p className="mt-3 text-sm text-neutral-400">
              运行 <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-200">npm run jobs:collect</code> 抓取岗位，再运行{" "}
              <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-neutral-200">npm run jobs:evaluate</code> 打分。
            </p>
          </section>
        )}

        {visible.length === 0 && allJobs.length > 0 && (
          <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">当前筛选无结果</h2>
            <p className="mt-3 text-sm text-neutral-400">
              <Link href="/jobs" className="text-sky-400 hover:text-sky-300">
                清空筛选条件
              </Link>
            </p>
          </section>
        )}

        {/* Job list */}
        {visible.length > 0 && (
          <section className="mt-8 space-y-4">
            {visible.map((job) => {
              const isApplied = job.status === "applied";
              return (
                <article
                  key={job.job_key}
                  className={`rounded-2xl border p-6 shadow-sm transition ${
                    isApplied
                      ? "border-neutral-800/40 bg-neutral-900/30 opacity-50"
                      : "border-neutral-800 bg-neutral-900/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-xl font-semibold text-white">{job.company}</h2>
                      <p className="mt-1 text-base text-neutral-300">{job.role_title}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className="text-sm font-medium text-neutral-400">
                        {job.fit_score}
                      </span>
                      {isApplied ? (
                        <span className="rounded-full border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-400">
                          已投递
                        </span>
                      ) : (
                        <span
                          className={`rounded-full border px-3 py-1 text-xs ${getDecisionStyle(job.decision)}`}
                        >
                          {job.decision}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
                    {job.location && <span>📍 {job.location}</span>}
                    {job.priority && <span>优先级 {job.priority}</span>}
                  </div>

                  {job.short_summary && (
                    <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-neutral-400">
                      {job.short_summary}
                    </p>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    {!isApplied && (
                      <Link
                        href={buildTailorHref(job)}
                        className="inline-block rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-neutral-100"
                      >
                        开始定制 →
                      </Link>
                    )}
                    {job.role_url && (
                      <a
                        href={job.role_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block rounded-xl border border-neutral-700 px-5 py-2.5 text-sm font-semibold text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                      >
                        查看 JD ↗
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
