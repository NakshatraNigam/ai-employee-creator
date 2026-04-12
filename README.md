# AI Employee Creator

No-code AI employee builder with:

- Next.js 14 App Router
- Tailwind CSS
- React Flow canvas builder
- Supabase auth + JSON config persistence

## Features in this milestone

- Drag-and-drop builder nodes: `Identity`, `Brain`, `Skill`, `Trigger`, `Output`
- Configurable node settings in a right-side panel
- Live Employee Card summary (name, role, status, model, memory, skills, outputs)
- Supabase magic-link auth
- Save/load employee graph configs as JSON (`employee_configs` table)
- Brain knowledge ingestion: PDF/CSV/URL -> LangChain chunking -> Gemini/OpenAI embeddings -> Supabase pgvector
- Executable workflow runner: chat trigger -> RAG context -> model response -> run logging + memory
  - Supports Gemini and OpenAI providers via env toggles

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env.local
```

3. Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL` (optional, defaults to `text-embedding-3-small`)
- `OPENAI_CHAT_MODEL` (optional, defaults to `gpt-4o-mini`)
- `OPENAI_CHAT_MODEL_GPT4O` (optional, defaults to `gpt-4o`)
- `GEMINI_API_KEY`
- `GEMINI_CHAT_MODEL` (optional, defaults to `gemini-2.5-flash`)
- `GEMINI_EMBED_MODEL` (optional, defaults to `gemini-embedding-001`)
- `CHAT_PROVIDER` (`gemini` or `openai`)
- `EMBEDDING_PROVIDER` (`gemini` or `openai`)
- `EMBEDDING_DIMENSION` (must match `knowledge_chunks.embedding` vector size)

4. Run the SQL in [`supabase/schema.sql`](./supabase/schema.sql) in your Supabase SQL editor.

5. Start dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database table

`employee_configs`

- `id uuid`
- `user_id uuid` (references `auth.users`)
- `name text`
- `status text` (`draft` or `active`)
- `config jsonb` (stores full graph: nodes + edges + metadata)
- timestamps + RLS policies

`knowledge_documents`

- source metadata + full extracted text + chunk count
- linked to `employee_configs`
- protected with RLS per owner

`knowledge_chunks`

- one row per chunk with `embedding vector(1536)`
- ivfflat cosine index for vector search
- protected with RLS per owner

`workflow_runs`

- per-run execution log (`running/completed/failed`)
- stores trigger, input payload, output payload, error

`agent_memories`

- user/assistant memory rows by `session_id`
- enables session/permanent memory modes during chat runs

## Next slices

- Knowledge file ingestion pipeline (chunk + embed + pgvector)
- Org chart/team mode with coordinator agent templates
- Trigger runners (BullMQ + cron + webhook runtime)
- One-click deploy for embeddable chat widget
