import Link from "next/link";

type RecordStatus = "待申请" | "已投递" | "面试中";
type AiMode = "real" | "fallback";

type PackageSummary = {
  emailLanguage: string;
  aiMode: AiMode;
  materialStatus: string[];
};

type DashboardRecord = {
  company: string;
  role: string;
  status: RecordStatus;
  note: string;
  packageSummary?: PackageSummary;
};

type SavedPackage = {
  company: string;
  role: string;
  emailLanguage: string;
  aiMode: AiMode;
  resumeReady: boolean;
  emailReady: boolean;
};

const statusOptions: RecordStatus[] = ["待申请", "已投递", "面试中"];
const fallbackCompany = "未识别公司名";
const fallbackRole = "未识别岗位名";

function getTextParam(
  value: string | string[] | undefined,
  fallback = "",
) {
  if (typeof value !== "string") return fallback;

  const trimmed = value.trim();
  return trimmed || fallback;
}

function getStatusFromParam(value: string | string[] | undefined): RecordStatus {
  if (typeof value === "string" && statusOptions.includes(value as RecordStatus)) {
    return value as RecordStatus;
  }

  return "待申请";
}

function getBooleanParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value === "1" : false;
}

function getAiModeFromParam(value: string | string[] | undefined): AiMode {
  return value === "real" ? "real" : "fallback";
}

function formatAiMode(aiMode: AiMode) {
  return aiMode === "real" ? "real（真实模型）" : "fallback（规则回退）";
}

function buildMaterialStatus(resumeReady: boolean, emailReady: boolean) {
  const items: string[] = [];

  if (resumeReady) items.push("已生成简历定制");
  if (emailReady) items.push("已生成邮件");
  if (items.length === 0) items.push("材料状态未记录");

  return items;
}

function buildSavedPackage(params: {
  [key: string]: string | string[] | undefined;
}): SavedPackage {
  return {
    company: getTextParam(params.company, fallbackCompany),
    role: getTextParam(params.role, fallbackRole),
    emailLanguage: getTextParam(params.emailLanguage, "未记录"),
    aiMode: getAiModeFromParam(params.aiMode),
    resumeReady: getBooleanParam(params.resumeReady),
    emailReady: getBooleanParam(params.emailReady),
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const saved = typeof params.saved === "string" ? params.saved === "1" : false;
  const newestStatus = getStatusFromParam(params.status);
  const savedPackage = saved ? buildSavedPackage(params) : null;

  const savedRecord: DashboardRecord | null = savedPackage
    ? {
        company: savedPackage.company,
        role: savedPackage.role,
        status: newestStatus,
        note: "来自刚刚生成的申请包。生成材料不代表已经投递，你可以继续推进实际申请状态。",
        packageSummary: {
          emailLanguage: savedPackage.emailLanguage,
          aiMode: savedPackage.aiMode,
          materialStatus: buildMaterialStatus(
            savedPackage.resumeReady,
            savedPackage.emailReady,
          ),
        },
      }
    : null;

  const records: DashboardRecord[] = [
    {
      company: "OpenAI",
      role: "Software Engineer Intern",
      status: "已投递",
      note: "简历已定制，等待回复中。",
    },
    {
      company: "某厂",
      role: "产品经理",
      status: "待申请",
      note: "刚完成 JD 分析，下一步可以继续改简历或准备投递邮件。",
    },
    {
      company: "某司",
      role: "前端开发",
      status: "面试中",
      note: "已约下周一面。",
    },
  ];

  const allRecords = savedRecord ? [savedRecord, ...records] : records;
  const totalCount = allRecords.length;
  const pendingCount = allRecords.filter((record) => record.status === "待申请").length;
  const appliedCount = allRecords.filter((record) => record.status === "已投递").length;
  const interviewCount = allRecords.filter((record) => record.status === "面试中").length;

  const statusStyles: Record<RecordStatus, { card: string; badge: string }> = {
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

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="text-sm text-neutral-500 transition hover:text-neutral-300"
        >
          ← 返回首页
        </Link>

        {savedRecord && (
          <div className="mt-6 rounded-xl border border-emerald-800/70 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            已将本次申请包加入投递看板：{savedRecord.company} · {savedRecord.role}，当前状态为“{newestStatus}”。
          </div>
        )}

        <h1 className="mt-3 text-4xl font-bold text-white">投递记录</h1>
        <p className="mt-4 text-base text-neutral-400">
          查看和管理你的求职进度。生成材料不等于已经投递，状态需要你自己推进。
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

        {savedPackage && (
          <section className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="text-sm font-semibold text-white">更新最新记录状态</h2>
            <p className="mt-2 text-sm text-neutral-400">
              这里先用最简单的演示方式处理：只更新当前页面里最新保存的那条记录。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={{
                  pathname: "/dashboard",
                  query: {
                    saved: "1",
                    status: "已投递",
                    company: savedPackage.company,
                    role: savedPackage.role,
                    emailLanguage: savedPackage.emailLanguage,
                    aiMode: savedPackage.aiMode,
                    resumeReady: savedPackage.resumeReady ? "1" : "0",
                    emailReady: savedPackage.emailReady ? "1" : "0",
                  },
                }}
                className="rounded-xl border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:border-neutral-500 hover:text-white"
              >
                标记为已投递
              </Link>
              <Link
                href={{
                  pathname: "/dashboard",
                  query: {
                    saved: "1",
                    status: "面试中",
                    company: savedPackage.company,
                    role: savedPackage.role,
                    emailLanguage: savedPackage.emailLanguage,
                    aiMode: savedPackage.aiMode,
                    resumeReady: savedPackage.resumeReady ? "1" : "0",
                    emailReady: savedPackage.emailReady ? "1" : "0",
                  },
                }}
                className="rounded-xl border border-emerald-700/80 px-4 py-2 text-sm font-medium text-emerald-300 transition hover:border-emerald-500 hover:text-emerald-200"
              >
                标记为面试中
              </Link>
            </div>
          </section>
        )}

        <section className="mt-10 space-y-4">
          {allRecords.map((record, index) => (
            <div
              key={`${record.company}-${record.role}-${index}`}
              className={`rounded-2xl border bg-neutral-900/60 p-6 shadow-sm ${statusStyles[record.status].card}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">{record.company}</h2>
                  <p className="mt-1 text-sm text-neutral-400">{record.role}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs ${statusStyles[record.status].badge}`}
                >
                  {record.status}
                </span>
              </div>

              {record.packageSummary && (
                <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950/30 p-4">
                  <p className="text-xs font-medium text-neutral-400">申请包摘要</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <p className="text-xs text-neutral-500">公司名</p>
                      <p className="mt-1 text-sm text-neutral-100">{record.company}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">岗位名</p>
                      <p className="mt-1 text-sm text-neutral-100">{record.role}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">当前状态</p>
                      <p className="mt-1 text-sm text-neutral-100">{record.status}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">邮件语言</p>
                      <p className="mt-1 text-sm text-neutral-100">
                        {record.packageSummary.emailLanguage}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">AI mode</p>
                      <p className="mt-1 text-sm text-neutral-100">
                        {formatAiMode(record.packageSummary.aiMode)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-xs text-neutral-500">材料状态</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {record.packageSummary.materialStatus.map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-neutral-700 bg-neutral-900/70 px-3 py-1 text-xs text-neutral-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <p className="mt-4 text-sm text-neutral-500">{record.note}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
