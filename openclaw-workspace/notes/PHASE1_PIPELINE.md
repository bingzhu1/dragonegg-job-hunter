# PHASE1_PIPELINE.md

## Status
Phase 1（抓岗 → 筛选 → 入库）最小闭环已完成，当前可重复执行。

## Command
### One-shot
- `npm run jobs:phase1`

### Step-by-step
- `npm run jobs:normalize`
- `npm run jobs:filter`
- `npm run jobs:sync`

## Pipeline
### Inputs
- `openclaw-workspace/data/target_companies.csv`
- `openclaw-workspace/data/jobs_raw.csv`
- `openclaw-workspace/notes/profile.md`

### Intermediate Outputs
- `openclaw-workspace/data/jobs_normalized.csv`
- `openclaw-workspace/data/jobs_filtered.csv`

### Database
- Supabase table: `public.jobs`
- SQL file: `supabase/jobs.sql`

## Scripts
- `scripts/normalize_jobs.ts`
- `scripts/filter_jobs.ts`
- `scripts/sync_jobs_to_supabase.ts`
- `scripts/run_phase1.ts`

## Current Verified Result
- `npm run jobs:phase1` has been run successfully
- local CSV outputs generated successfully
- Supabase `public.jobs` contains 2 records
- idempotency check passed: re-running the pipeline keeps total record count at 2

## Current Boundaries
Phase 1 currently covers:
- raw jobs normalization
- rule-based filtering
- sync to Supabase `jobs`

Phase 1 does not yet cover:
- real networked job collection executor
- jobs frontend viewer / list page
- automated application execution

## Notes
- Keep existing `/new`, `/tailor`, `/dashboard` main flow unchanged for now
- Filtering is currently based on hardcoded rules with profile used as lightweight reference
