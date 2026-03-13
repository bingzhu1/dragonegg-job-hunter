import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getSupabaseConfigMessage,
  isSupabaseConfigured,
  listApplications,
  type ApplicationAiMode,
  type ApplicationRecord,
  type ApplicationStatus,
  updateApplicationStatus,
} from "@/lib/supabase";

function formatAiMode(aiMode: ApplicationAiMode) {
  return aiMode === "real" ? "real（真实模型）" : "fallback（规则回退）";
}

function buildMaterialStatus(record: ApplicationRecord) {
  const items: string[] = [];

  if (record.tailored_bullets.length > 0) items.push("已生成简历定制");
  if (record.email_subject || record.email_body) items.push("已生成邮件");
  if (items.length === 0) items.push("材料状态未记录");

  return items;
}

function formatCreatedAt(createdAt: string) {
  if (!createdAt) return "创建时间未记录";

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "创建时间未记录";

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function displayCompany(company: string) {
  return company || "未填写公司名";
}

function displayRole(role: string) {
  return role || "未填写岗位名";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved === "1" : false;
  const updated = typeof params.updated === "string" ? params.updated === "1" : false;
  const saveError = typeof params.saveError === "string" ? params.saveError === "1" : false;
  const updateError = typeof params.updateError === "string" ? params.updateError === "1" : false;
  const noticeMessage = typeof params.message === "string" ? params.message : "";
  const supabaseConfigured = isSupabaseConfigured();
  const supabaseConfigMessage = getSupabaseConfigMessage();

  const recordsResult = supabaseConfigured
    ? await listApplications()
    : { data: [] as ApplicationRecord[], error: supabaseConfigMessage };
  const records = recordsResult.data ?? [];
  const latestRecord = records[0] ?? null;

  const totalCount = records.length;
  const pendingCount = records.filter((record) => record.status === "待申请").length;
  const appliedCount = records.filter((record) => record.status === "已投递").length;
  const interviewCount = records.filter((record) => record.status === "面试中").length;
  const statusOptions: ApplicationStatus[] = ["待申请", "已投递", "面试中"];

  const statusStyles: Record<ApplicationStatus, { card: string; badge: string }> = {
    待申请: {
      card: "border-amber-900/60",
      badge: "border-amber-700/80 text-amber-300",
    },
    已投递: {
      card: "border-neutral-800",
      badge: "border-neutral-700 text-neutral-300",
    },
    面试中: {
      card: "border-emerald-900/60",
      badge: "border-emerald-700/80 text-emerald-400/90",
    },
  };

  async function updateRecordStatus(formData: FormData) {
    "use server";

    const idRaw = formData.get("applicationId");
    const statusRaw = formData.get("status");
    const applicationId =
      typeof idRaw === "string" ? Number(idRaw) : Number.NaN;
    const nextStatus =
      statusRaw === "待申请" || statusRaw === "已投递" || statusRaw === "面试中"
        ? statusRaw
        : null;

    if (!Number.isFinite(applicationId) || !nextStatus) {
      redirect("/dashboard?updateError=1&message=状态更新参数无效");
    }

    const result = await updateApplicationStatus(applicationId, nextStatus);
    if (result.error) {
      redirect(
        `/dashboard?updateError=1&message=${encodeURIComponent(result.error)}`,
      );
    }

    revalidatePath("/dashboard");
    redirect("/dashboard?updated=1");
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link
            href="/"
            className="text-neutral-500 transition hover:text-neutral-300"
          >
            ← 返回首页
          </Link>
          <Link
            href="/new"
            className="text-neutral-500 transition hover:text-neutral-300"
          >
            新建申请
          </Link>
        </div>

        {saved && (
          <div className="mt-6 rounded-xl border border-emerald-800/70 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            已将当前申请包保存到 Supabase 申请面板。
          </div>
        )}
        {updated && (
          <div className="mt-6 rounded-xl border border-emerald-800/70 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            已更新申请记录状态。
          </div>
        )}
        {(saveError || updateError) && (
          <div className="mt-6 rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {noticeMessage || "操作失败，请检查 Supabase 配置、表结构和权限设置。"}
          </div>
        )}
        {!supabaseConfigured && (
          <div className="mt-6 rounded-xl border border-amber-900/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
            {supabaseConfigMessage}
          </div>
        )}
        {supabaseConfigured && recordsResult.error && !saveError && !updateError && (
          <div className="mt-6 rounded-xl border border-rose-900/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-300">
            {recordsResult.error}
          </div>
        )}

        <h1 className="mt-3 text-4xl font-bold text-white">申请面板</h1>
        <p className="mt-4 text-base text-neutral-400">
          查看和管理保存在 Supabase 中的申请记录。生成材料不等于已经投递，状态需要你自己推进。
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <div className="min-w-[7rem] rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-4">
            <p className="text-xs text-neutral-500">总记录</p>
            <p className="mt-1 text-2xl font-semibold text-white">{totalCount}</p>
          </div>
          <div className="min-w-[7rem] rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-4">
            <p className="text-xs text-neutral-500">待申请</p>
            <p className="mt-1 text-2xl font-semibold text-white">{pendingCount}</p>
          </div>
          <div className="min-w-[7rem] rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-4">
            <p className="text-xs text-neutral-500">已投递</p>
            <p className="mt-1 text-2xl font-semibold text-white">{appliedCount}</p>
          </div>
          <div className="min-w-[7rem] rounded-xl border border-neutral-800 bg-neutral-900/60 px-5 py-4">
            <p className="text-xs text-neutral-500">面试中</p>
            <p className="mt-1 text-2xl font-semibold text-white">{interviewCount}</p>
          </div>
        </div>

        {latestRecord && (
          <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-sm font-semibold text-white">更新最新记录状态</h2>
            <p className="mt-2 text-sm text-neutral-400">
              当前会更新最近一次保存到 Supabase 的申请记录。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={updateRecordStatus}>
                <input type="hidden" name="applicationId" value={latestRecord.id} />
                <input type="hidden" name="status" value="已投递" />
                <button
                  type="submit"
                  className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white"
                >
                  标记为已投递
                </button>
              </form>
              <form action={updateRecordStatus}>
                <input type="hidden" name="applicationId" value={latestRecord.id} />
                <input type="hidden" name="status" value="面试中" />
                <button
                  type="submit"
                  className="rounded-xl border border-emerald-700/80 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500 hover:text-emerald-200"
                >
                  标记为面试中
                </button>
              </form>
            </div>
          </section>
        )}

        {records.length === 0 && !recordsResult.error && (
          <section className="mt-10 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">还没有申请记录</h2>
            <p className="mt-3 text-sm text-neutral-400">
              先去新建申请页填写 JD 和简历，再在定制结果页点击“加入申请面板”。
            </p>
            <Link
              href="/new"
              className="mt-5 inline-block rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-neutral-100 hover:shadow-white/20"
            >
              去新建申请
            </Link>
          </section>
        )}

        <section className="mt-10 space-y-4">
          {records.map((record) => {
            const materialStatus = buildMaterialStatus(record);

            return (
              <div
                key={record.id}
                className={`rounded-2xl border bg-neutral-900/60 p-6 shadow-sm ${statusStyles[record.status].card}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-white">{displayCompany(record.company)}</h2>
                    <p className="mt-1 text-sm text-neutral-400">{displayRole(record.role)}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs ${statusStyles[record.status].badge}`}
                  >
                    {record.status}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/30 p-4">
                  <p className="text-xs font-medium text-neutral-400">申请包摘要</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs text-neutral-500">公司名</p>
                      <p className="mt-1 text-sm text-neutral-100">{displayCompany(record.company)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">岗位名</p>
                      <p className="mt-1 text-sm text-neutral-100">{displayRole(record.role)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">当前状态</p>
                      <p className="mt-1 text-sm text-neutral-100">{record.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">邮件语言</p>
                      <p className="mt-1 text-sm text-neutral-100">
                        {record.email_language}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">AI mode</p>
                      <p className="mt-1 text-sm text-neutral-100">
                        {formatAiMode(record.ai_mode)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">创建时间</p>
                      <p className="mt-1 text-sm text-neutral-100">
                        {formatCreatedAt(record.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-neutral-500">材料状态</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {materialStatus.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-neutral-700 bg-neutral-900/70 px-3 py-1 text-xs text-neutral-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-neutral-500">状态操作</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {statusOptions.map((status) => {
                        const isCurrent = record.status === status;

                        return (
                          <form key={status} action={updateRecordStatus}>
                            <input type="hidden" name="applicationId" value={record.id} />
                            <input type="hidden" name="status" value={status} />
                            <button
                              type="submit"
                              disabled={isCurrent}
                              className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                                isCurrent
                                  ? "cursor-default border-neutral-700 bg-neutral-900 text-white"
                                  : "border-neutral-700 text-neutral-200 hover:border-neutral-500 hover:text-white"
                              }`}
                            >
                              {isCurrent ? `当前：${status}` : `设为${status}`}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-neutral-500">申请链接</p>
                    {record.application_link ? (
                      <div className="mt-2">
                        <a
                          href={record.application_link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex rounded-xl border border-sky-700/80 px-4 py-2 text-sm font-medium text-sky-300 transition hover:border-sky-500 hover:text-sky-200"
                        >
                          去申请
                        </a>
                        <p className="mt-2 break-all text-xs text-neutral-500">
                          {record.application_link}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-neutral-500">未提供申请链接</p>
                    )}
                  </div>
                </div>

                <p className="mt-4 text-sm text-neutral-500">
                  保存于 {formatCreatedAt(record.created_at)}
                </p>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
