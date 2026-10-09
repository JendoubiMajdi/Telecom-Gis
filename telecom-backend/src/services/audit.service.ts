import { Request } from 'express';
import pool from '../db/database';
import { AuthRequest } from '../models/AuthRequest';

// ── Audit log: who did what, when, with before/after values ───────────────────

// Creates the table on startup if it does not exist (no manual SQL needed).
export const ensureAuditTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id          BIGSERIAL PRIMARY KEY,
      user_id     TEXT,
      user_email  TEXT,
      user_role   TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   TEXT,
      details     JSONB,
      ip_address  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at DESC)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log (user_email)');
};

export interface AuditEntry {
  action: string;                 // e.g. 'site.create', 'site.update', 'site.delete'
  entityType?: string;            // e.g. 'site'
  entityId?: string | number | null;
  details?: Record<string, unknown>;
}

// Never throws: a failure to write the log must not break the user's action.
export const logAudit = async (req: Request, entry: AuditEntry): Promise<void> => {
  try {
    const u = (req as AuthRequest).user;
    await pool.query(
      `INSERT INTO audit_log (user_id, user_email, user_role, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        (req as AuthRequest).userId ?? null,
        u?.email ?? null,
        u?.role ?? null,
        entry.action,
        entry.entityType ?? null,
        entry.entityId != null ? String(entry.entityId) : null,
        entry.details ? JSON.stringify(entry.details) : null,
        req.ip ?? null,
      ]
    );
  } catch (err) {
    console.error('Audit log write failed:', err);
  }
};

export interface AuditQuery {
  limit: number;
  offset: number;
  userEmail?: string;
  action?: string;
}

export const getAuditLog = async ({ limit, offset, userEmail, action }: AuditQuery) => {
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (userEmail) { params.push(userEmail); where.push(`user_email = $${params.length}`); }
  if (action)    { params.push(`${action}%`); where.push(`action LIKE $${params.length}`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = await pool.query(`SELECT COUNT(*)::int AS n FROM audit_log ${clause}`, params);

  params.push(limit, offset);
  const rows = await pool.query(
    `SELECT id, user_id, user_email, user_role, action, entity_type, entity_id, details, ip_address, created_at
     FROM audit_log ${clause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return { total: total.rows[0].n as number, rows: rows.rows };
};