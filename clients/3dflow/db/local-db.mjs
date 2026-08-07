#!/usr/bin/env node
// 3D-flow LOCAL backend CLI (SQLite via better-sqlite3).
// The local counterpart to the Supabase MCP `execute_sql`: same SQL, different transport.
// Used by the 3D flow when the Supabase MCP is unavailable, or when `--local` is requested.
//
// Usage:
//   node local-db.mjs available                 -> {available, engine, db}
//   node local-db.mjs init                       -> apply schema (idempotent)
//   node local-db.mjs path                        -> {db}
//   node local-db.mjs exec "<SQL>" '[paramsJSON]' -> rows[]  (SELECT/RETURNING) | {changes,...}
//   node local-db.mjs exec -      '[paramsJSON]'   -> read SQL from stdin (for complex SQL)
//   node local-db.mjs resume <group> <name>        -> {feature, scenarios[]}  (Step-0 resume slice)
//
// paramsJSON: a JSON array (positional `?`) or object (named `:name`) of bind params.
// DB path: $THREEDFLOW_DB or clients/3dflow/db/3dflow.local.db (single repo-level store, gitignored).

import Database from "better-sqlite3";
import { readFileSync, mkdirSync, readFileSync as read } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.THREEDFLOW_DB || join(HERE, "3dflow.local.db");
const SCHEMA = join(HERE, "schema.sqlite.sql");

const out = (o) => process.stdout.write(JSON.stringify(o) + "\n");
const die = (msg, code = 2) => { process.stderr.write(msg + "\n"); process.exit(code); };

function open() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}
function ensureSchema(db) {
  const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='features'").get();
  if (!has) db.exec(readFileSync(SCHEMA, "utf8"));
}
function run(sql, params) {
  const db = open();
  ensureSchema(db);
  try {
    const stmt = db.prepare(sql);
    let res;
    if (stmt.reader) res = params == null ? stmt.all() : stmt.all(params);
    else {
      const r = params == null ? stmt.run() : stmt.run(params);
      res = { changes: r.changes, lastInsertRowid: String(r.lastInsertRowid) };
    }
    return res;
  } finally {
    db.close();
  }
}

const [, , cmd, ...rest] = process.argv;
try {
  switch (cmd) {
    case "available": {
      const db = open(); db.close();
      out({ available: true, engine: "better-sqlite3", db: DB_PATH });
      break;
    }
    case "init": {
      const db = open(); db.exec(readFileSync(SCHEMA, "utf8")); db.close();
      out({ ok: true, initialized: true, db: DB_PATH });
      break;
    }
    case "path":
      out({ db: DB_PATH });
      break;
    case "exec": {
      let sql = rest[0];
      if (sql === "-" || sql === undefined) sql = read(0, "utf8"); // stdin
      const params = rest[1] ? JSON.parse(rest[1]) : undefined;
      out(run(sql, params));
      break;
    }
    case "resume": {
      const [group, name] = rest;
      if (!group || !name) die("usage: resume <group> <name>");
      const db = open(); ensureSchema(db);
      const feature = db.prepare('SELECT * FROM status_board WHERE "group"=? AND name=?').get(group, name);
      const scenarios = feature
        ? db.prepare('SELECT slug, title, lifecycle_state, approval_state FROM scenarios WHERE feature_id=?').all(feature.feature_id)
        : [];
      db.close();
      out({ feature: feature ?? null, scenarios });
      break;
    }
    default:
      die("usage: local-db.mjs available|init|path|exec <sql|-> [paramsJSON]|resume <group> <name>");
  }
} catch (e) {
  out({ error: e.message, code: e.code });
  process.exit(1);
}
