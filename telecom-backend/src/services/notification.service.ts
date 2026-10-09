import pool from '../db/database';

// ── In-app notifications ──────────────────────────────────────────────────────
// A notification is targeted at ONE user (unlike the audit log, which is the full
// history for admins). Creating a notification never throws, so a failure here can
// never break the action that triggered it.

export interface NotificationInput {
  type: string;                       // e.g. 'site.create', 'user.role_change'
  title: string;
  message: string;
  link?: string | null;               // frontend route, e.g. '/map?site=12'
  entityType?: string | null;
  entityId?: string | number | null;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

// Creates the table on startup if needed, and removes old entries.
export const ensureNotificationsTable = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          BIGSERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      message     TEXT NOT NULL,
      link        TEXT,
      entity_type TEXT,
      entity_id   TEXT,
      is_read     BOOLEAN NOT NULL DEFAULT false,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, created_at DESC)'
  );

  // Housekeeping: read ones after 30 days, anything after 90 days
  await pool.query(`
    DELETE FROM notifications
    WHERE (is_read = true AND created_at < NOW() - INTERVAL '30 days')
       OR created_at < NOW() - INTERVAL '90 days'
  `);
};

// Notify specific users (duplicates removed).
export const notifyUsers = async (
  userIds: Array<string | number>,
  input: NotificationInput
): Promise<void> => {
  try {
    const ids = Array.from(new Set(userIds.map(String)));
    if (ids.length === 0) return;

    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, link, entity_type, entity_id)
       SELECT uid, $2, $3, $4, $5, $6, $7 FROM unnest($1::text[]) AS uid`,
      [
        ids,
        input.type,
        input.title,
        input.message,
        input.link ?? null,
        input.entityType ?? null,
        input.entityId != null ? String(input.entityId) : null,
      ]
    );
  } catch (err) {
    console.error('notifyUsers failed:', err);
  }
};

// Notify every ACTIVE admin except the person who did the action
// (nobody needs a notification about their own click).
export const notifyAdmins = async (
  input: NotificationInput,
  excludeUserId?: string | number | null
): Promise<void> => {
  try {
    const r = await pool.query(
      `SELECT id::text AS id FROM users WHERE role = 'admin' AND is_active = true`
    );
    const skip = excludeUserId != null ? String(excludeUserId) : '';
    const ids: string[] = r.rows.map((row: { id: string }) => row.id).filter((id: string) => id !== skip);
    await notifyUsers(ids, input);
  } catch (err) {
    console.error('notifyAdmins failed:', err);
  }
};

// ── Reading (used by the bell) ────────────────────────────────────────────────
export const listForUser = async (
  userId: string,
  limit: number
): Promise<{ unreadCount: number; items: AppNotification[] }> => {
  const items = await pool.query(
    `SELECT id::text AS id, type, title, message, link,
            is_read AS "isRead", created_at AS "createdAt"
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, limit]
  );
  const unread = await pool.query(
    'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return { unreadCount: unread.rows[0].n, items: items.rows };
};

export const markRead = async (id: string, userId: string): Promise<boolean> => {
  // A user can only touch their own notifications.
  const r = await pool.query(
    'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [id, userId]
  );
  return (r.rowCount ?? 0) > 0;
};

export const markAllRead = async (userId: string): Promise<number> => {
  const r = await pool.query(
    'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
    [userId]
  );
  return r.rowCount ?? 0;
};