import Link from "next/link";


export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Hero: title, tagline, CTA — content moved higher, clearer hierarchy */}
      <section className="flex flex-col items-center justify-center px-6 pt-16 pb-12 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-neutral-500">
          AI 求职助手
        </p>
        <h1 className="mt-3 text-5xl font-bold tracking-tight text-white sm:text-6xl">
          龙蛋计划
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-400">
          一个帮助我定制简历、生成求职邮件、追踪投递记录的 AI 求职助手。
        </p>
        <Link
          href="/new"
          className="mt-8 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition-all duration-200 hover:bg-neutral-100 hover:shadow-white/20"
        >
          开始使用
        </Link>
      </section>

      {/* Features: 3 cards with clearer styling and hover */}
      <section className="px-6 py-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 sm:flex-row sm:gap-5">
          <Link
            href="/new"
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-6 py-6 text-center shadow-sm transition-colors duration-200 hover:border-neutral-700 hover:bg-neutral-800/60"
          >
            <h3 className="text-base font-semibold text-white">定制简历</h3>
            <p className="mt-2 text-sm leading-snug text-neutral-500">
              根据岗位定制简历内容
            </p>
          </Link>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-6 py-6 text-center shadow-sm transition-colors duration-200 hover:border-neutral-700 hover:bg-neutral-800/60">
            <h3 className="text-base font-semibold text-white">求职邮件</h3>
            <p className="mt-2 text-sm leading-snug text-neutral-500">
              生成得体的求职与跟进邮件
            </p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-6 py-6 text-center shadow-sm transition-colors duration-200 hover:border-neutral-700 hover:bg-neutral-800/60"
          >
            <h3 className="text-base font-semibold text-white">投递追踪</h3>
            <p className="mt-2 text-sm leading-snug text-neutral-500">
              记录与追踪投递状态
            </p>
          </Link>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="flex flex-col items-center px-6 pb-20 pt-6 text-center">
        <p className="text-sm text-neutral-500">准备好更高效地求职了吗？</p>
        <Link
          href="/new"
          className="mt-4 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-white/10 transition-all duration-200 hover:bg-neutral-100 hover:shadow-white/20"
        >
          开始使用
        </Link>
      </section>
    </main>
  );
}
