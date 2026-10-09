import pool from '../db/database';

// ── Tasks: an admin assigns work (usually tied to a site) to an operator ───────

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'blocked', 'done'];
export const TASK_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high', 'critical'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

export interface Task {
  id: string;
  title: string;
  description: string | null;
  siteId: string | null;
  siteName: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeId: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  createdById: string;
  createdByName: string | null;
  dueDate: string | null;          // 'YYYY-MM-DD'
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  commentCount: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  userName: string | null;
  kind: 'comment' | 'status';      // 'status' = automatic history entry
  body: string;
  createdAt: string;
}

export interface UserBrief {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
}

// Creates the tables on startup if needed (no manual SQL).
export const ensureTasksTables = async (): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id           BIGSERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      description  TEXT,
      site_id      BIGINT,
      site_name    TEXT,
      priority     TEXT NOT NULL DEFAULT 'medium',
      status       TEXT NOT NULL DEFAULT 'todo',
      assignee_id  TEXT NOT NULL,
      created_by   TEXT NOT NULL,
      due_date     DATE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_comments (
      id         BIGSERIAL PRIMARY KEY,
      task_id    BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      user_id    TEXT NOT NULL,
      user_name  TEXT,
      kind       TEXT NOT NULL DEFAULT 'comment',
      body       TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_id, status)');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at)');
};

const TASK_SELECT = `
  SELECT t.id::text AS id, t.title, t.description,
         t.site_id::text AS "siteId", t.site_name AS "siteName",
         t.priority, t.status,
         t.assignee_id AS "assigneeId", a.full_name AS "assigneeName", a.email AS "assigneeEmail",
         t.created_by AS "createdById", c.full_name AS "createdByName",
         to_char(t.due_date, 'YYYY-MM-DD') AS "dueDate",
         t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.completed_at AS "completedAt",
         (SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id AND tc.kind = 'comment') AS "commentCount"
  FROM tasks t
  LEFT JOIN users a ON a.id::text = t.assignee_id
  LEFT JOIN users c ON c.id::text = t.created_by
`;

export const getTaskById = async (id: string): Promise<Task | null> => {
  const r = await pool.query(`${TASK_SELECT} WHERE t.id = $1`, [id]);
  return r.rows[0] ?? null;
};

// assigneeId given → only that user's tasks (operators). Omitted → all tasks (admins).
export const listTasks = async (assigneeId?: string): Promise<Task[]> => {
  if (assigneeId) {
    const r = await pool.query(
      `${TASK_SELECT} WHERE t.assignee_id = $1 ORDER BY t.created_at DESC LIMIT 500`,
      [assigneeId]
    );
    return r.rows;
  }
  const r = await pool.query(`${TASK_SELECT} ORDER BY t.created_at DESC LIMIT 500`);
  return r.rows;
};

export interface NewTask {
  title: string;
  description: string | null;
  siteId: number | null;
  siteName: string | null;
  priority: TaskPriority;
  assigneeId: string;
  createdBy: string;
  dueDate: string | null;
}

export const createTask = async (t: NewTask): Promise<Task> => {
  const r = await pool.query(
    `INSERT INTO tasks (title, description, site_id, site_name, priority, assignee_id, created_by, due_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id::text AS id`,
    [t.title, t.description, t.siteId, t.siteName, t.priority, t.assigneeId, t.createdBy, t.dueDate]
  );
  return (await getTaskById(r.rows[0].id)) as Task;
};

export const setTaskStatus = async (id: string, status: TaskStatus): Promise<void> => {
  await pool.query(
    `UPDATE tasks
     SET status = $1,
         updated_at = NOW(),
         completed_at = CASE WHEN $1 = 'done' THEN NOW() ELSE NULL END
     WHERE id = $2`,
    [status, id]
  );
};

export const setTaskAssignee = async (id: string, assigneeId: string): Promise<void> => {
  await pool.query('UPDATE tasks SET assignee_id = $1, updated_at = NOW() WHERE id = $2', [assigneeId, id]);
};

export const deleteTask = async (id: string): Promise<void> => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]); // comments are removed by ON DELETE CASCADE
};

// ── Comments / history ─────────────────────────────────────────────────────────
export const addTaskComment = async (
  taskId: string,
  userId: string,
  userName: string | null,
  kind: 'comment' | 'status',
  body: string
): Promise<void> => {
  await pool.query(
    'INSERT INTO task_comments (task_id, user_id, user_name, kind, body) VALUES ($1, $2, $3, $4, $5)',
    [taskId, userId, userName, kind, body]
  );
  await pool.query('UPDATE tasks SET updated_at = NOW() WHERE id = $1', [taskId]);
};

export const listTaskComments = async (taskId: string): Promise<TaskComment[]> => {
  const r = await pool.query(
    `SELECT id::text AS id, task_id::text AS "taskId", user_id AS "userId", user_name AS "userName",
            kind, body, created_at AS "createdAt"
     FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC, id ASC`,
    [taskId]
  );
  return r.rows;
};

// ── Helpers ────────────────────────────────────────────────────────────────────
export const getUserBrief = async (id: string): Promise<UserBrief | null> => {
  const r = await pool.query(
    `SELECT id::text AS id, full_name AS "fullName", email, role, is_active AS "isActive"
     FROM users WHERE id::text = $1`,
    [id]
  );
  return r.rows[0] ?? null;
};

export const getSiteName = async (siteId: number): Promise<string | null> => {
  const r = await pool.query('SELECT site_name FROM sites WHERE id = $1', [siteId]);
  return r.rows[0]?.site_name ?? null;
};

// Site picker for the "new task" form
export const searchSites = async (
  q: string,
  limit = 8
): Promise<Array<{ id: number; site_name: string; region: string | null }>> => {
  const like = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const r = await pool.query(
    `SELECT id, site_name, region FROM sites
     WHERE site_name ILIKE $1 OR region ILIKE $1
     ORDER BY site_name
     LIMIT $2`,
    [like, limit]
  );
  return r.rows;
};