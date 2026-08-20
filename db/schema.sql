-- =====================================================================
-- Dezorin Web MVP — مخطط قاعدة البيانات (Supabase / Postgres)
-- المرحلة 2 من خطة الترحيل
-- =====================================================================
-- ملاحظة: auth.users تُدار تلقائيًا عبر Supabase Auth، لا حاجة لإنشائها.

-- ---------------------------------------------------------------------
-- جدول المشاريع
-- عمود state يحمل نفس بنية buildProjectData() في v0.1 حرفيًا (form + state)
-- ---------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  project_name  text not null,
  current_stage text,
  state         jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_projects_user_id on public.projects(user_id);

-- تحديث updated_at تلقائيًا عند أي تعديل
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
  before update on public.projects
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- جدول تتبع استهلاك AI (بند 7 — تتبّع فقط، لا فوترة، لا Quota تجارية)
-- سطر واحد لكل استدعاء OpenAI ناجح فعليًا
-- ---------------------------------------------------------------------
create table if not exists public.ai_usage_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  stage       text not null,   -- 'decision' | 'stage1' | 'stage2' | 'exploration' | 'discovery' | 'execution-idea'
  created_at  timestamptz not null default now()
);

create index if not exists idx_ai_usage_user_id_created_at
  on public.ai_usage_events(user_id, created_at);

-- =====================================================================
-- Row Level Security — خط الدفاع الأساسي لعزل المستخدمين
-- كل سياسة تشترط أن user_id يطابق هوية المستخدم المُصادَق (auth.uid())
-- =====================================================================

alter table public.projects enable row level security;
alter table public.ai_usage_events enable row level security;

-- projects: كل عملية مقيّدة بملكية المستخدم لصفه فقط
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
  on public.projects for insert
  with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ai_usage_events: كل مستخدم يقرأ سجلّه فقط، ويُدرج سطرًا لنفسه فقط
-- (لا استخدام لأي Service Role في هذا المسار — العزل بالكامل عبر RLS
-- باستخدام عميل Supabase مُقيَّد بتوكن المستخدم نفسه من جهة الخادم)
drop policy if exists "ai_usage_select_own" on public.ai_usage_events;
create policy "ai_usage_select_own"
  on public.ai_usage_events for select
  using (auth.uid() = user_id);

drop policy if exists "ai_usage_insert_own" on public.ai_usage_events;
create policy "ai_usage_insert_own"
  on public.ai_usage_events for insert
  with check (auth.uid() = user_id);
