import pool from '../db/database';

// ── Admin / user-management queries ───────────────────────────────────────────

export type Role = 'admin' | 'operator' | 'viewer';
export const ROLES: Role[] = ['admin', 'operator', 'viewer'];

// Adds the columns this feature needs. Safe to run on every startup.
export const ensureAdminSchema = async (): Promise<void> => {
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true');
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ');
};

// ── Used by the authenticate middleware on EVERY request ──────────────────────
// Reading the role from the database (not the token) means role changes and
// deactivations take effect immediately.
export interface UserAuthState {
  role: string;
  isActive: boolean;
}

export const getUserAuthState = async (id: string | number): Promise<UserAuthState | null> => {
  const r = await pool.query('SELECT role, is_active FROM users WHERE id = $1', [id]);
  if (!r.rows[0]) return null;
  return { role: r.rows[0].role, isActive: r.rows[0].is_active !== false };
};

// Never throws: recording a login time must not break logging in.
export const touchLastLogin = async (id: string | number): Promise<void> => {
  try {
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
  } catch (err) {
    console.error('touchLastLogin failed:', err);
  }
};

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

const USER_COLUMNS = `
  id::text AS id,
  email,
  full_name AS "fullName",
  role,
  is_active AS "isActive",
  COALESCE(two_factor_enabled, false) AS "twoFactorEnabled",
  created_at AS "createdAt",
  last_login_at AS "lastLoginAt"
`;

export const listUsers = async (): Promise<AdminUser[]> => {
  const r = await pool.query(`SELECT ${USER_COLUMNS} FROM users ORDER BY created_at DESC`);
  return r.rows;
};

export const getUserById = async (id: string): Promise<AdminUser | null> => {
  const r = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return r.rows[0] ?? null;
};

export const setUserRole = async (id: string, role: Role): Promise<AdminUser | null> => {
  const r = await pool.query(
    `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING ${USER_COLUMNS}`,
    [role, id]
  );
  return r.rows[0] ?? null;
};

export const setUserActive = async (id: string, active: boolean): Promise<AdminUser | null> => {
  const r = await pool.query(
    `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING ${USER_COLUMNS}`,
    [active, id]
  );
  return r.rows[0] ?? null;
};

export const countActiveAdmins = async (): Promise<number> => {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND is_active = true`
  );
  return r.rows[0].n;
};

// ── Dashboard summary cards ────────────────────────────────────────────────────
export interface AdminSummary {
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<Role, number>;
  };
  activity: {
    last24h: number;
    last7d: number;
    topUsers: Array<{ email: string; actions: number }>;
  };
}

export const getAdminSummary = async (): Promise<AdminSummary> => {
  const u = await pool.query(`
    SELECT role,
           COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE is_active)::int AS active
    FROM users GROUP BY role
  `);
  const byRole: Record<Role, number> = { admin: 0, operator: 0, viewer: 0 };
  let total = 0;
  let active = 0;
  for (const row of u.rows) {
    if (row.role in byRole) byRole[row.role as Role] = row.n;
    total += row.n;
    active += row.active;
  }

  const a = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int  AS last7d
    FROM audit_log
  `);
  const top = await pool.query(`
    SELECT user_email AS email, COUNT(*)::int AS actions
    FROM audit_log
    WHERE created_at > NOW() - INTERVAL '7 days' AND user_email IS NOT NULL
    GROUP BY user_email
    ORDER BY actions DESC
    LIMIT 5
  `);

  return {
    users: { total, active, inactive: total - active, byRole },
    activity: {
      last24h: a.rows[0]?.last24h ?? 0,
      last7d: a.rows[0]?.last7d ?? 0,
      topUsers: top.rows,
    },
  };
};