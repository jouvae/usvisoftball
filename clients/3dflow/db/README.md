# 3D-flow local backend (SQLite)

An **offline, in-repo backend for the 3D flow** (`/discover`, `/design`, `/deliver`) that mirrors the
Supabase store's schema. Used automatically when the **Supabase MCP is unavailable**, or on request
(`--local` / `THREEDFLOW_BACKEND=local`). Backend selection is documented in the `3d-artifacts` skill
(§Backend selection).

## Files
- `schema.sql` — canonical **Postgres/Supabase** schema (apply to Supabase via the MCP or `psql`).
- `schema.sqlite.sql` — the **SQLite** twin (same tables/columns; dialect deltas noted in-file).
- `local-db.mjs` — CRUD CLI (better-sqlite3); the local twin of the Supabase MCP `execute_sql`.
- `3dflow.local.db` — the single local store (**gitignored**; created on first use).

> These two schemas are a **reconstruction** of the imported 3D tooling's entity set — the referenced
> `clients/3dflow/db/schema.sql` was not present in the import. Keep the two dialects in lockstep.

## Usage
```bash
node clients/3dflow/db/local-db.mjs available                    # engine + db path
node clients/3dflow/db/local-db.mjs init                          # apply schema (idempotent)
node clients/3dflow/db/local-db.mjs exec "<SQL>" '<paramsJSON>'   # SELECT/RETURNING -> rows[]; write -> {changes,…}
node clients/3dflow/db/local-db.mjs exec -   '<paramsJSON>'       # read SQL from stdin (complex SQL)
node clients/3dflow/db/local-db.mjs resume <group> <name>        # Step-0 resume slice (status_board + scenarios)
```
`paramsJSON` = a JSON **array** (positional `?`) or **object** (named `:name`). DB path override:
`$THREEDFLOW_DB`.

## Delegation
Heavy/multi-step artifact work is delegated to the **`local-artifact`** subagent (Read + Bash) — the
offline counterpart to `supabase-artifact`. It enforces the same 3d-artifacts invariants (never
hard-delete a lesson; model-lock; tier may only escalate; the store, not `status.md`, is the truth).

## SQLite dialect deltas (write SQLite-flavored SQL in local mode)
`jsonb`→TEXT holding a JSON string (no `::jsonb` casts) · `lessons.tags text[]`→TEXT JSON array ·
`boolean`→`0/1` · `now()`→`CURRENT_TIMESTAMP` · ids/`gen_random_*`→schema `DEFAULT`. `RETURNING`,
`ON CONFLICT`, the generated `severity`, and the `status_board` view all work.
