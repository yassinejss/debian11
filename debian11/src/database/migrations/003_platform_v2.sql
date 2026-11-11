-- Migration 003: Platform v2 — Snapshots, Command Safety, Shared Sessions
-- Additive only — preserves all existing tables

-- Workspace snapshots
CREATE TABLE IF NOT EXISTS workspace_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    snapshot_data TEXT NOT NULL, -- JSON: {layout, tabs, splitMode, fontSize, theme}
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_restored_at INTEGER
);

-- Command safety audit log
CREATE TABLE IF NOT EXISTS command_safety_log (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    terminal_session_id TEXT,
    command TEXT NOT NULL,
    risk_level TEXT NOT NULL, -- 'low' | 'medium' | 'high'
    confirmed INTEGER, -- NULL=not shown, 1=confirmed, 0=cancelled
    executed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Notification records
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'process_crash' | 'sandbox_disconnect' | 'security' | 'info'
    title TEXT NOT NULL,
    message TEXT,
    read_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Process descriptions (extended process metadata)
ALTER TABLE managed_processes ADD COLUMN description TEXT;
ALTER TABLE managed_processes ADD COLUMN preset TEXT; -- 'minecraft'|'node'|'python'|'cloudflared'|'custom'

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_user_id ON workspace_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created_at ON workspace_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_command_safety_user ON command_safety_log(user_id);
