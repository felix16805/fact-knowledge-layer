-- =============================================================================
-- Fact Knowledge Layer — Initial Schema
-- Supabase / Postgres + pgvector
-- Run once in: Supabase Dashboard → SQL Editor
--
-- IMPORTANT: Vector dimensions are 1024 to match Voyage AI voyage-4 output.
-- =============================================================================

-- Enable pgvector extension
create extension if not exists vector;

-- =============================================================================
-- DOCUMENTS
-- Tracks uploaded PDFs and their processing status.
-- storage_path is UNIQUE to enable idempotent POST /api/documents:
--   INSERT ... ON CONFLICT (storage_path) DO NOTHING RETURNING *
-- =============================================================================
create table documents (
  id            uuid        primary key default gen_random_uuid(),
  filename      text        not null,
  storage_path  text        not null unique,  -- unique: prevents duplicate pipeline runs per file
  uploaded_at   timestamptz default now(),
  status        text        not null default 'pending'
                            check (status in ('pending', 'processing', 'ready', 'failed')),
  page_count    int,
  error_message text
);

alter table documents enable row level security;
create policy "anon read documents"          on documents for select using (true);
create policy "service role write documents" on documents for all    using (auth.role() = 'service_role');

-- =============================================================================
-- CHUNKS
-- Layout-aware text/table/slide units from the PDF parser sidecar.
-- bbox is nullable — present for tables (from camelot), absent for prose chunks.
-- embedding: voyage-4, 1024-dim.
-- =============================================================================
create table chunks (
  id            uuid        primary key default gen_random_uuid(),
  document_id   uuid        not null references documents(id) on delete cascade,
  page_number   int         not null,
  bbox          jsonb,      -- nullable: {x0, y0, x1, y1} in PDF points, when available
  raw_text      text        not null,
  chunk_type    text        not null default 'text'
                            check (chunk_type in ('text', 'table', 'slide')),
  embedding     vector(1024)          -- Voyage AI voyage-4 output dims
);

alter table chunks enable row level security;
create policy "anon read chunks"          on chunks for select using (true);
create policy "service role write chunks" on chunks for all    using (auth.role() = 'service_role');

-- IVFFlat index for cosine similarity search on chunk embeddings
create index chunks_embedding_idx on chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- =============================================================================
-- FACTS
-- Schema-free extracted facts. value is jsonb to accommodate numbers, strings,
-- ranges, and structured objects without schema migration.
-- Every fact MUST have a quoted_evidence span — no fact without evidence.
-- embedding: voyage-4, 1024-dim, of the canonical fact string.
-- =============================================================================
create table facts (
  id               uuid        primary key default gen_random_uuid(),
  document_id      uuid        not null references documents(id) on delete cascade,
  source_chunk_id  uuid        not null references chunks(id) on delete cascade,
  subject          text        not null,   -- e.g. "Delhivery", "India"
  metric           text        not null,   -- e.g. "Revenue from services", "Real GDP growth rate"
  value            jsonb       not null,   -- number | string | {min, max} | structured
  unit             text,                   -- e.g. "₹ Crore", "percent", "USD billion"
  time_scope       text,                   -- e.g. "FY24", "Q4 FY24", "2024-25"
  doc_scope        text,                   -- e.g. "consolidated", "standalone", "segment:PTL"
  qualifiers       jsonb,                  -- definition notes, adjustments, caveats
  quoted_evidence  text        not null,   -- verbatim span from the source chunk
  confidence       numeric     check (confidence between 0 and 1),
  embedding        vector(1024),           -- Voyage AI voyage-4, 1024-dim
  created_at       timestamptz default now()
);

alter table facts enable row level security;
create policy "anon read facts"          on facts for select using (true);
create policy "service role write facts" on facts for all    using (auth.role() = 'service_role');

-- IVFFlat index for cosine similarity candidate matching
create index facts_embedding_idx on facts using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Composite index for document-scoped fact queries
create index facts_document_id_idx on facts (document_id);

-- =============================================================================
-- FACT RELATIONSHIPS
-- Cross-document relationship pairs. Each pair is stored once, canonically
-- ordered (fact_a_id < fact_b_id) via the ordered_pair constraint — prevents
-- both (A,B) and (B,A) rows for the same pair.
-- reasoning is non-nullable: every classification must include LLM rationale.
-- reconciling_factor is populated only for 'reconcilable' type.
-- =============================================================================
create table fact_relationships (
  id                  uuid        primary key default gen_random_uuid(),
  fact_a_id           uuid        not null references facts(id) on delete cascade,
  fact_b_id           uuid        not null references facts(id) on delete cascade,
  relationship_type   text        not null
                                  check (relationship_type in (
                                    'corroborates',
                                    'contradicts',
                                    'reconcilable',
                                    'insufficient_context'
                                  )),
  reasoning           text        not null,   -- LLM's stated basis; always populated
  reconciling_factor  text,                   -- only for 'reconcilable': the resolving context
  confidence          numeric     check (confidence between 0 and 1),
  created_at          timestamptz default now(),

  -- Structural integrity constraints
  constraint no_self_relation check (fact_a_id != fact_b_id),
  constraint ordered_pair     check (fact_a_id < fact_b_id)  -- canonical ordering prevents duplicate A↔B rows
);

alter table fact_relationships enable row level security;
create policy "anon read relationships"          on fact_relationships for select using (true);
create policy "service role write relationships" on fact_relationships for all    using (auth.role() = 'service_role');

-- Lookup indexes for fact-centric queries
create index fact_relationships_a_idx on fact_relationships (fact_a_id);
create index fact_relationships_b_idx on fact_relationships (fact_b_id);
create index fact_relationships_type_idx on fact_relationships (relationship_type);

-- =============================================================================
-- DEMO CASES
-- Pinned pointers to the four required graded cases. Populated by
-- scripts/seed-demo-cases.ts after the pipeline has run on the starter dataset.
-- These reference REAL fact_relationships found by the pipeline — not hardcoded.
-- =============================================================================
create table demo_cases (
  id              uuid  primary key default gen_random_uuid(),
  title           text  not null,
  description     text  not null,
  analysis        text,
  notes           text,
  related_document_ids uuid[] not null default '{}'::uuid[],
  related_fact_ids uuid[] not null default '{}'::uuid[],
  created_at      timestamptz not null default now()
);

alter table demo_cases enable row level security;
create policy "anon read demo cases"          on demo_cases for select to anon, authenticated using (true);

create index demo_cases_created_at_idx on demo_cases (created_at desc);
create index demo_cases_related_document_ids_idx on demo_cases using gin (related_document_ids);
create index demo_cases_related_fact_ids_idx on demo_cases using gin (related_fact_ids);

-- =============================================================================
-- RATE LIMIT LOG
-- Used by /api/upload-url and /api/documents/[id]/process to enforce
-- 5 requests per IP per 10-minute window. INSERT ... ON CONFLICT DO UPDATE
-- pattern with the unique index below handles concurrent requests safely.
-- Only accessible via service role — no browser policy needed/wanted.
-- =============================================================================
create table rate_limit_log (
  id           uuid        primary key default gen_random_uuid(),
  ip           text        not null,
  endpoint     text        not null,
  window_start timestamptz not null,
  hit_count    int         not null default 1
);

-- Unique index is the ON CONFLICT target for the upsert pattern
create unique index rate_limit_log_ip_endpoint_window_idx
  on rate_limit_log (ip, endpoint, window_start);

-- Index for expiry cleanup queries
create index rate_limit_log_window_start_idx on rate_limit_log (window_start);

alter table rate_limit_log enable row level security;
create policy "service role only rate limit" on rate_limit_log for all using (auth.role() = 'service_role');

-- =============================================================================
-- pg-boss job queue schema
-- pg-boss manages its own schema (pgboss.*) — no DDL needed here.
-- It is initialized when new PgBoss(DATABASE_URL).start() is first called.
--
-- IMPORTANT: DATABASE_URL must be the DIRECT connection string (port 5432),
-- NOT the pgbouncer pooler (port 6543). Transaction-mode pooling breaks
-- pg-boss's advisory locks. Find it in:
--   Supabase → Project Settings → Database → Connection string → URI
--   with "Use connection pooling" toggled OFF.
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTION: upsert_rate_limit
-- Called by src/lib/rate-limit.ts. Atomically increments a rate-limit window
-- counter and returns the current hit count.
-- Uses INSERT ... ON CONFLICT ... DO UPDATE for safe concurrent upserts.
-- =============================================================================
create or replace function upsert_rate_limit(
  p_ip        text,
  p_endpoint  text,
  p_window_start timestamptz
) returns int
language plpgsql
security definer  -- runs as postgres superuser; bypasses RLS for this function
as $$
declare
  v_count int;
begin
  insert into rate_limit_log (ip, endpoint, window_start, hit_count)
  values (p_ip, p_endpoint, p_window_start, 1)
  on conflict (ip, endpoint, window_start)
  do update set hit_count = rate_limit_log.hit_count + 1;

  select hit_count into v_count
  from rate_limit_log
  where ip = p_ip and endpoint = p_endpoint and window_start = p_window_start;

  return v_count;
end;
$$;

-- =============================================================================
-- HELPER FUNCTION: find_similar_facts
-- Vector cosine similarity search for candidate fact pairs.
-- Excludes facts from the same document (cross-document matching only).
-- Returns fact IDs and similarity scores, ordered by similarity desc.
-- =============================================================================
create or replace function find_similar_facts(
  query_embedding     vector(1024),
  exclude_document_id uuid,
  similarity_threshold float default 0.82,
  max_results         int   default 10
) returns table(id uuid, similarity float)
language sql
stable
as $$
  select
    f.id,
    1 - (f.embedding <=> query_embedding) as similarity
  from facts f
  where
    f.document_id != exclude_document_id
    and f.embedding is not null
    and 1 - (f.embedding <=> query_embedding) >= similarity_threshold
  order by f.embedding <=> query_embedding  -- ascending distance = descending similarity
  limit max_results;
$$;

-- =============================================================================
-- STORAGE BUCKET: pdfs
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('pdfs', 'pdfs', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;
