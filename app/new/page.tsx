import Link from "next/link";

export default function NewJobPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-16 text-neutral-100">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm text-neutral-500 transition hover:text-neutral-300"
        >
          ← 返回首页
        </Link>
        <h1 className="text-3xl font-bold text-white">新建职位定制</h1>
        <p className="mt-3 text-sm text-neutral-400">
          粘贴职位描述和你的基础简历内容，我们会生成一份模拟的定制结果。
        </p>

        <form action="/tailor" method="get" className="mt-8 space-y-4">
          <label className="block text-sm text-neutral-300">
            公司名称（可手动填写）
            <input
              name="company"
              type="text"
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="例如：OpenAI"
            />
          </label>

          <label className="block text-sm text-neutral-300">
            岗位名称（可手动填写）
            <input
              name="role"
              type="text"
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="例如：Frontend Engineer"
            />
          </label>
          <label className="block text-sm text-neutral-300">
            职位描述（JD）
            <textarea
              name="jd"
              rows={10}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="在这里粘贴完整的职位描述……"
            />
          </label>

          <label className="block text-sm text-neutral-300">
            基础简历内容
            <textarea
              name="resume"
              rows={10}
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="在这里粘贴你的基础简历内容（项目/经历/技能）……"
            />
          </label>

          <label className="block text-sm text-neutral-300">
            申请链接（可选）
            <input
              name="applicationLink"
              type="url"
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-neutral-500"
              placeholder="https://company.com/jobs/123"
            />
          </label>

          <label className="block text-sm text-neutral-300">
            邮件语言
            <select
              name="emailLang"
              defaultValue="auto"
              className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
            >
              <option value="auto">自动</option>
              <option value="en">英文</option>
              <option value="zh">中文</option>
            </select>
          </label>

          <button
            type="submit"
            className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition hover:bg-neutral-100 hover:shadow-white/20"
          >
            提交并生成定制结果
          </button>
        </form>
      </div>
    </main>
  );
}
