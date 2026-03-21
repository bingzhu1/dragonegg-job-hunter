create table if not exists public.jobs (
  id bigserial primary key,
  job_key text not null unique,
  company text not null,
  role_title text not null,
  location text not null default '',
  role_url text not null default '',
  short_summary text not null default '',
  required_keywords text[] not null default '{}',
  preferred_keywords text[] not null default '{}',
  hiring_team_if_visible text not null default '',
  priority text not null default '',
  source_type text not null default 'manual_csv',
  collected_at timestamptz,
  fit_score integer not null default 0,
  decision text not null default 'maybe',
  decision_reason text not null default '',
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_decision_check
    check (decision in ('accepted', 'maybe', 'rejected')),

  constraint jobs_status_check
    check (status in ('new', 'saved', 'dismissed', 'applied'))
);

create index if not exists jobs_company_idx on public.jobs(company);
create index if not exists jobs_decision_idx on public.jobs(decision);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_fit_score_idx on public.jobs(fit_score desc);
create index if not exists jobs_collected_at_idx on public.jobs(collected_at desc);

create or replace function public.set_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_jobs_updated_at_trigger on public.jobs;

create trigger set_jobs_updated_at_trigger
before update on public.jobs
for each row
execute function public.set_jobs_updated_at();
