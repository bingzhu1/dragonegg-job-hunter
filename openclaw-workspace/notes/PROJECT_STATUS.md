# PROJECT_STATUS.md

## Current Project
龙蛋计划（AI 求职自动化）

## Current Goal
在现有 MVP 基础上，把重点放在：
1. 自动抓取适合我的岗位
2. 自动筛选与整理岗位
3. 自动投递流程

当前不再把 email automation 作为主线。

## Done
- Next.js + Tailwind + OpenAI API 的 MVP 已完成
- `/new` 可输入 JD、简历、邮件语言和申请链接
- `/tailor` 可生成 JD 分析、简历改写、求职邮件
- `/dashboard` 已作为申请面板使用
- Supabase 已接通，具备数据库持久化能力
- OpenClaw 多 agent 骨架已搭好
- Discord 已接入 OpenClaw
- Discord 频道已绑定不同 agent：
  - `#general` -> `main`
  - `#router` -> `router`
  - `#dev` -> `dev`
  - `#research` -> `research`
  - `#ops` -> `ops`
- OpenClaw Control Center 已成功跑通
- 自动抓取 job 的方向已经开始过一部分
- Phase 1（抓岗 → 筛选 → 入库）最小闭环已跑通
- 已新增 Phase 1 脚本：
  - `scripts/normalize_jobs.ts`
  - `scripts/filter_jobs.ts`
  - `scripts/sync_jobs_to_supabase.ts`
  - `scripts/run_phase1.ts`
- 已新增 `supabase/jobs.sql` 并创建 `public.jobs` 表
- 已补充 npm scripts：
  - `jobs:normalize`
  - `jobs:filter`
  - `jobs:sync`
  - `jobs:phase1`
- 当前一键命令可用：`npm run jobs:phase1`
- 当前已验证：本地 CSV 标准化/筛选成功，Supabase `jobs` 已成功 upsert 2 条记录
- 当前幂等验证已通过：重复执行后 `jobs` 表总记录数仍为 2

## In Progress
- 明确联网自动抓岗执行器（当前已有 target companies + raw CSV + pipeline，但还没有真正自动抓网页岗位的执行器）
- 设计自动投递的主流程
- 建立 ChatGPT + OpenClaw 协同工作流
- 让 OpenClaw 在执行前先读取项目状态文件
- 规划 jobs 的前端查看页或最小 jobs list 入口

## Next Focus
1. 把联网自动抓岗执行器接上 `target_companies.csv`，替代当前手工/半手工写入 `jobs_raw.csv`
2. 补一个最小 jobs 查看入口（先读 Supabase `jobs`，不破坏现有 `/dashboard` 主流程）
3. 明确自动投递的触发条件和执行步骤
4. 让 dashboard 或 jobs 页面真正服务于自动投递流程
5. 梳理哪些网站/平台先支持，哪些后支持

## Constraints
- 不要破坏现有 `/new`、`/tailor`、`/dashboard` 主流程
- email automation 不是当前主线
- 优先做可验证、可回滚的小步改动
- 自动投递要优先考虑稳定性与可控性，不要一开始做过度复杂的全自动

## Working Style
- ChatGPT：负责方案设计、review、架构、关键 prompt、debug 思路
- OpenClaw：负责改文件、跑命令、执行任务、并行 agent 协作
- OpenClaw 在开始执行前，应先读取本文件，再读取相关代码

## Notes
- 当前多 agent 仍以“手动路由”为主，不依赖自动 subagent
- 当前模型分层尚未完成，agent 主要先做职责分工
- 当前主线是“自动抓岗 + 自动投递”，不是“邮件自动化”