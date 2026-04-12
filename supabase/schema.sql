create extension if not exists vector;
create extension if not exists pgcrypto;

create table if not exists public.employee_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Untitled Employee',
  status text not null check (status in ('draft', 'active')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists employee_configs_user_updated_idx
  on public.employee_configs (user_id, updated_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists employee_configs_touch_updated_at on public.employee_configs;
create trigger employee_configs_touch_updated_at
before update on public.employee_configs
for each row
execute procedure public.touch_updated_at();

alter table public.employee_configs enable row level security;

drop policy if exists "Employees can view own configs" on public.employee_configs;
create policy "Employees can view own configs"
on public.employee_configs
for select
using (auth.uid() = user_id);

drop policy if exists "Employees can insert own configs" on public.employee_configs;
create policy "Employees can insert own configs"
on public.employee_configs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Employees can update own configs" on public.employee_configs;
create policy "Employees can update own configs"
on public.employee_configs
for update
using (auth.uid() = user_id);

drop policy if exists "Employees can delete own configs" on public.employee_configs;
create policy "Employees can delete own configs"
on public.employee_configs
for delete
using (auth.uid() = user_id);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_config_id uuid references public.employee_configs(id) on delete set null,
  source_type text not null check (source_type in ('file', 'url')),
  source_name text not null,
  source_url text,
  content_text text not null,
  chunk_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists knowledge_documents_user_created_idx
  on public.knowledge_documents (user_id, created_at desc);

create index if not exists knowledge_documents_agent_created_idx
  on public.knowledge_documents (agent_config_id, created_at desc);

drop trigger if exists knowledge_documents_touch_updated_at on public.knowledge_documents;
create trigger knowledge_documents_touch_updated_at
before update on public.knowledge_documents
for each row
execute procedure public.touch_updated_at();

alter table public.knowledge_documents enable row level security;

drop policy if exists "Employees can view own knowledge documents" on public.knowledge_documents;
create policy "Employees can view own knowledge documents"
on public.knowledge_documents
for select
using (auth.uid() = user_id);

drop policy if exists "Employees can insert own knowledge documents" on public.knowledge_documents;
create policy "Employees can insert own knowledge documents"
on public.knowledge_documents
for insert
with check (auth.uid() = user_id);

drop policy if exists "Employees can update own knowledge documents" on public.knowledge_documents;
create policy "Employees can update own knowledge documents"
on public.knowledge_documents
for update
using (auth.uid() = user_id);

drop policy if exists "Employees can delete own knowledge documents" on public.knowledge_documents;
create policy "Employees can delete own knowledge documents"
on public.knowledge_documents
for delete
using (auth.uid() = user_id);

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  agent_config_id uuid references public.employee_configs(id) on delete set null,
  chunk_index integer not null,
  content text not null,
  embedding vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists knowledge_chunks_doc_idx
  on public.knowledge_chunks (document_id, chunk_index);

create index if not exists knowledge_chunks_agent_idx
  on public.knowledge_chunks (agent_config_id, created_at desc);

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.knowledge_chunks enable row level security;

drop policy if exists "Employees can view own knowledge chunks" on public.knowledge_chunks;
create policy "Employees can view own knowledge chunks"
on public.knowledge_chunks
for select
using (auth.uid() = user_id);

drop policy if exists "Employees can insert own knowledge chunks" on public.knowledge_chunks;
create policy "Employees can insert own knowledge chunks"
on public.knowledge_chunks
for insert
with check (auth.uid() = user_id);

drop policy if exists "Employees can update own knowledge chunks" on public.knowledge_chunks;
create policy "Employees can update own knowledge chunks"
on public.knowledge_chunks
for update
using (auth.uid() = user_id);

drop policy if exists "Employees can delete own knowledge chunks" on public.knowledge_chunks;
create policy "Employees can delete own knowledge chunks"
on public.knowledge_chunks
for delete
using (auth.uid() = user_id);

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count integer default 5,
  filter_agent_config_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
as $$
  select
    kc.id,
    kc.document_id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where auth.uid() = kc.user_id
    and (filter_agent_config_id is null or kc.agent_config_id = filter_agent_config_id)
  order by kc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create table if not exists public.workflow_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_config_id uuid not null references public.employee_configs(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('chat', 'webhook', 'cron', 'chain')),
  status text not null check (status in ('running', 'completed', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create index if not exists workflow_runs_user_started_idx
  on public.workflow_runs (user_id, started_at desc);

create index if not exists workflow_runs_agent_started_idx
  on public.workflow_runs (agent_config_id, started_at desc);

alter table public.workflow_runs enable row level security;

drop policy if exists "Employees can view own workflow runs" on public.workflow_runs;
create policy "Employees can view own workflow runs"
on public.workflow_runs
for select
using (auth.uid() = user_id);

drop policy if exists "Employees can insert own workflow runs" on public.workflow_runs;
create policy "Employees can insert own workflow runs"
on public.workflow_runs
for insert
with check (auth.uid() = user_id);

drop policy if exists "Employees can update own workflow runs" on public.workflow_runs;
create policy "Employees can update own workflow runs"
on public.workflow_runs
for update
using (auth.uid() = user_id);

drop policy if exists "Employees can delete own workflow runs" on public.workflow_runs;
create policy "Employees can delete own workflow runs"
on public.workflow_runs
for delete
using (auth.uid() = user_id);

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_config_id uuid not null references public.employee_configs(id) on delete cascade,
  session_id text not null default 'default',
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists agent_memories_lookup_idx
  on public.agent_memories (user_id, agent_config_id, session_id, created_at desc);

alter table public.agent_memories enable row level security;

drop policy if exists "Employees can view own memories" on public.agent_memories;
create policy "Employees can view own memories"
on public.agent_memories
for select
using (auth.uid() = user_id);

drop policy if exists "Employees can insert own memories" on public.agent_memories;
create policy "Employees can insert own memories"
on public.agent_memories
for insert
with check (auth.uid() = user_id);

drop policy if exists "Employees can delete own memories" on public.agent_memories;
create policy "Employees can delete own memories"
on public.agent_memories
for delete
using (auth.uid() = user_id);
