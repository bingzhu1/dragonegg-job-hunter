# NEXT_STEPS.md

## Phase 1 Status
Phase 1（抓岗 → 筛选 → 入库）最小闭环已完成并验证通过。

### 一键命令
- `npm run jobs:phase1`

### 分步命令
- `npm run jobs:normalize`
- `npm run jobs:filter`
- `npm run jobs:sync`

### 输入文件
- `openclaw-workspace/data/target_companies.csv`
- `openclaw-workspace/data/jobs_raw.csv`
- `openclaw-workspace/notes/profile.md`

### 输出文件
- `openclaw-workspace/data/jobs_normalized.csv`
- `openclaw-workspace/data/jobs_filtered.csv`

### Supabase
- `public.jobs`
- SQL 文件：`supabase/jobs.sql`

### 当前验证结果
- `jobs:phase1` 已实跑成功
- 当前 `public.jobs` 已写入 2 条记录
- 重复执行后总记录数仍为 2，幂等验证通过

## Next Work
1. 实现联网自动抓岗执行器
   - 目标：自动从 target companies / ATS 页面收集岗位并写入 `jobs_raw.csv`
   - 当前还没有这一步的真实执行器
2. 增加最小 jobs 查看入口
   - 先读 Supabase `jobs`
   - 先不要破坏现有 `/new` `/tailor` `/dashboard` 主流程
3. 继续设计自动投递执行
   - 当前还未开始执行自动投递动作
4. 如有需要，再把筛选规则从 hardcoded rules 抽到配置文件
