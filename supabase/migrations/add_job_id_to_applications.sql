-- Migration: link applications to jobs
-- Run this once in Supabase SQL Editor if the applications table already exists.
alter table public.applications
  add column if not exists job_id bigint references public.jobs(id) on delete set null;

create index if not exists applications_job_id_idx on public.applications(job_id);
